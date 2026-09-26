import { readDatabaseSchema } from "../schema.reader.js";
import { buildSqlPrompt } from "../../llm/sql.prompt.js";
import { formatLlmResponse } from "../../llm/llm.formatter.js";
import { getRecentExchanges } from "../../store/history.store.js";
import { gateChainFor } from "../../kernel/gate.selector.js";
import { DIALECTS } from "../../adapters/dialects/index.js";
import { PASS, BUG, ANSWERED } from "../../kernel/handler-result.js";
import { checkResultSanity } from "../result.sanity.js";
import { parseIntentIR } from "../intent.ir.js";
import { validateChartGrounding, enrichResultWithGrounding } from "../grounding.guard.js";
import { runVerificationChain } from "../../kernel/verify.chain.js";

const FAST_REFUSAL_CODES = [
  "table_missing",
  "table_not_found",
  "unresolvable_missing_column",
  "numeric_column_missing"
];

export function getRuleHint(reason = "") {
  if (reason.startsWith("ast_bare_column_without_group_by")) {
    return "every non-aggregated SELECT column must appear in GROUP BY, or the table's full primary key must be grouped";
  }
  if (reason.startsWith("ast_column_not_in_schema")) {
    return "the projected or referenced column does not exist in the schema. Check schema table definitions and column names";
  }
  if (reason.startsWith("ast_table_not_in_schema")) {
    return "the referenced table does not exist in the schema. Use only valid tables from the schema";
  }
  if (reason.startsWith("ast_disallowed_function")) {
    return "the SQL uses a disallowed function. Allowed functions are COUNT, SUM, AVG, MIN, MAX, strftime, LOWER, UPPER, ROUND";
  }
  if (reason.startsWith("group_by_required")) {
    return "queries with aggregate expressions and non-aggregated columns require a GROUP BY clause";
  }
  return "the generated SQL violated validation constraints. Correct the SQL syntax, schema references, or grouping";
}

export function buildCorrectivePrompt(reason, priorSql, basePrompt = "") {
  const hint = getRuleHint(reason);
  const rejectionNotice = `REJECTION NOTICE:
Your previous SQL was rejected: ${priorSql}.
Reason: ${reason}.
Rule violated: ${hint}.
Regenerate the complete corrected SQL. Output ONLY the SQL.`;
  return basePrompt ? `${basePrompt}\n\n${rejectionNotice}` : rejectionNotice;
}

export async function executeLlmLink(ctx) {
  const { query, organization, role, sessionId, model, startTime, capabilities, attempts = [] } = ctx;
  const { db, llm } = capabilities;

  // O15 Fast Refusal: Check if an upstream link reported an unresolvable structural decline
  const dynamicAttempt = attempts.find((a) => a.link === "Dynamic Query Engine");
  const reasonStr = dynamicAttempt?.reason || "";
  const matchedCode = FAST_REFUSAL_CODES.find(
    (code) => reasonStr.startsWith(`${code}:`) || ctx.code === code
  );

  if (matchedCode) {
    console.log(`⚡ [O15 Fast Refusal] Skipping LLM for unresolvable decline: ${matchedCode}`);
    return PASS(`fast_refusal:${matchedCode}`);
  }

  const isLlmEnabled = process.env.ENABLE_LOCAL_LLM !== "false";

  if (!isLlmEnabled) {
    return PASS("llm_not_configured");
  }

  try {
    console.log("🤖 Attempting Local LLM Link");

    // 1. Cached schema read (zero PRAGMA calls)
    const dialect = capabilities?.source?.dialect || "sqlite";
    const schema = await readDatabaseSchema(false, {
      source: capabilities?.source,
      adapter: capabilities?.db
    });

    // 1b. Recent history for context resolution (up to 3 turns)
    const history = sessionId ? await getRecentExchanges(sessionId, 3) : [];

    // 1c. Fast Ambiguity Clarification Check (Intent-IR Ladder Rung 3)
    const ir = parseIntentIR(query, { schema, dialect });
    if (ir.confidence === "AMBIGUOUS" && ir.clarificationPrompt) {
      console.log(`ℹ️ [LLM Link] Intent-IR flagged AMBIGUOUS: ${ir.clarificationPrompt}`);
      return ANSWERED({
        answer: ir.clarificationPrompt,
        source: "llm",
        meta: {
          sessionId,
          organization,
          role,
          processingMs: Date.now() - startTime,
          source: dialect,
          sourceId: capabilities?.source?.id || "sqlite_default",
          database: capabilities?.source?.database,
          intentIR: ir,
          clarification: true
        },
        data: { type: "clarification", prompt: ir.clarificationPrompt }
      });
    }

    // 2. Build prompt
    const prompt = buildSqlPrompt({ query, schema, history, dialect });

    // 3. Client generation — via capability seam (llm)
    const clientResult = await llm.generateSql({ prompt, model });

    if (!clientResult.success) {
      console.log(`ℹ️ [LLM Cascade] Generation failed: ${clientResult.errorType}`);
      return PASS(clientResult.errorType);
    }

    let totalLlmDurationMs = clientResult.durationMs || 0;
    let didRetry = false;
    let retryReason = null;
    let attemptsCount = 1;

    // 4+5. GATE CHAIN: validation gates first, then physical read-only execution.
    let rows;
    let finalSql;
    let sawValidator = false;
    let initialValidationFailed = false;
    let initialValidationReason = "";

    const activeChain = gateChainFor(capabilities?.source);

    for (const gate of activeChain) {
      if (gate.type === "validate") {
        const validation = await gate.run(finalSql || clientResult.sql, {
          schema,
          identity: ctx.identity,
          queryIntent: ir
        });
        if (!validation.valid) {
          if (validation.reason?.startsWith("ast_rls_") || validation.reason?.startsWith("rls_")) {
            console.log(`🛡️ [LLM Link RLS Block] Refusing execution: ${validation.reason}`);
            return ANSWERED({
              answer: validation.message || "Access to salary records of other employees is restricted by enterprise policy.",
              source: "rls_gate",
              data: { error: validation.reason, sql: null },
              meta: {
                sessionId,
                organization,
                role,
                rlsBlocked: true,
                sqlExecuted: false,
                processingMs: Date.now() - startTime
              }
            });
          }
          initialValidationFailed = true;
          initialValidationReason = validation.reason;
          break;
        }
        finalSql = validation.sql;
        sawValidator = true;
        console.log("📝 [LLM Link] Validated SQL:", finalSql);
      } else if (gate.type === "execute") {
        try {
          rows = await gate.run(finalSql, { capabilities });
        } catch (dbErr) {
          console.log(`ℹ️ [LLM Cascade] SQL execution error: ${dbErr.message}`);
          return PASS("llm_execution_error");
        }
      }
    }

    if (initialValidationFailed) {
      console.log(`ℹ️ [LLM Cascade] Initial validation failed: ${initialValidationReason}`);
      const isRetryable =
        (initialValidationReason.startsWith("ast_") ||
         initialValidationReason.startsWith("group_by_required")) &&
        attemptsCount < 2;

      if (!isRetryable) {
        return PASS(initialValidationReason);
      }

      // ONE-SHOT CORRECTIVE RETRY (Max 2 total attempts)
      attemptsCount++;
      retryReason = initialValidationReason;
      console.log(`🔄 [LLM Corrective Retry] Prompting retry (attempt 2/2) for: ${retryReason}`);

      const correctivePrompt = buildCorrectivePrompt(retryReason, finalSql || clientResult.sql, prompt);
      const retryResult = await llm.generateSql({ prompt: correctivePrompt, model });

      if (!retryResult.success) {
        console.log(`ℹ️ [LLM Corrective Retry] Retry generation failed: ${retryResult.errorType}`);
        return PASS(`corrective_retry_exhausted:${retryResult.errorType || retryReason}`);
      }

      totalLlmDurationMs += (retryResult.durationMs || 0);

      let retryRows;
      let retryFinalSql;
      let retrySawValidator = false;
      let retryValidationFailed = false;
      let retryValidationReason = "";

      for (const gate of activeChain) {
        if (gate.type === "validate") {
          const v = await gate.run(retryFinalSql || retryResult.sql, { schema });
          if (!v.valid) {
            retryValidationFailed = true;
            retryValidationReason = v.reason;
            break;
          }
          retryFinalSql = v.sql;
          retrySawValidator = true;
          console.log("📝 [LLM Link Retry] Validated SQL:", retryFinalSql);
        } else if (gate.type === "execute") {
          if (!retrySawValidator) {
            return BUG("llm_gate_chain_missing_validator");
          }
          try {
            retryRows = await gate.run(retryFinalSql, { capabilities });
          } catch (dbErr) {
            console.log(`ℹ️ [LLM Corrective Retry] Retry SQL execution error: ${dbErr.message}`);
            return PASS("corrective_retry_exhausted:llm_execution_error");
          }
        }
      }

      if (retryValidationFailed) {
        console.log(`ℹ️ [LLM Corrective Retry] Retry validation failed: ${retryValidationReason}`);
        return PASS(`corrective_retry_exhausted:${retryValidationReason}`);
      }

      finalSql = retryFinalSql;
      rows = retryRows;
      sawValidator = retrySawValidator;
      didRetry = true;
    }

    if (!sawValidator) {
      console.error("🚨 [LLM BUG] GATE_CHAIN had no validator gate — refusing to execute");
      return BUG("llm_gate_chain_missing_validator");
    }

    // 5b. Case-sensitivity recovery: retry with COLLATE NOCASE on zero results (SQLite only).
    // Retry goes through the db capability (same read-only guarantee).
    const isZeroCount =
      Array.isArray(rows) &&
      rows.length === 1 &&
      Object.keys(rows[0]).length === 1 &&
      /count/i.test(Object.keys(rows[0])[0]) &&
      (rows[0][Object.keys(rows[0])[0]] === 0 || rows[0][Object.keys(rows[0])[0]] === "0");

    const isZeroResults = !Array.isArray(rows) || rows.length === 0 || isZeroCount;
    const shouldTryCollateNoCase = DIALECTS[dialect]?.collateNOCASE ?? true;

    if (isZeroResults && shouldTryCollateNoCase) {
      const enhancedSql = finalSql.replace(
        /((?:=|\!=|<>)\s*'(?:''|[^'])*')(?!\s+COLLATE\b)/gi,
        "$1 COLLATE NOCASE"
      );

      if (enhancedSql !== finalSql) {
        try {
          const recoveryRows = await db.executeReadOnlySql(enhancedSql);
          const recoveryZeroCount =
            Array.isArray(recoveryRows) &&
            recoveryRows.length === 1 &&
            Object.keys(recoveryRows[0]).length === 1 &&
            /count/i.test(Object.keys(recoveryRows[0])[0]) &&
            (recoveryRows[0][Object.keys(recoveryRows[0])[0]] === 0 || recoveryRows[0][Object.keys(recoveryRows[0])[0]] === "0");

          if (Array.isArray(recoveryRows) && recoveryRows.length > 0 && !recoveryZeroCount) {
            console.log(`ℹ️ [Case-Sensitivity Recovery] Retried with COLLATE NOCASE, found ${recoveryRows.length} records`);
            rows = recoveryRows;
            finalSql = enhancedSql;
          }
        } catch (recoveryErr) {
          console.log(`ℹ️ [Case-Sensitivity Recovery] Retry failed: ${recoveryErr.message}`);
        }
      }
    }

    // 5c. Result Sanity Check (S9: boolean-shaped aggregates)
    const sanityCheck = await checkResultSanity({
      sql: finalSql,
      rows,
      query,
      schema,
      db
    });

    if (!sanityCheck.valid) {
      console.log(`ℹ️ [Result Sanity] Flagged: ${sanityCheck.reason}`);
      return PASS(sanityCheck.reason);
    }

    // 6. Formatter
    const processingMs = Date.now() - startTime;
    const extraMeta = {
      sessionId,
      organization,
      role,
      processingMs,
      source: dialect,
      sourceId: capabilities?.source?.id || "sqlite_default",
      database: capabilities?.source?.database
    };
    if (history && history.length > 0) {
      extraMeta.contextTurns = history.length;
    }
    if (didRetry) {
      extraMeta.retryReason = retryReason;
    }

    const responsePayload = formatLlmResponse({
      sql: finalSql,
      rows,
      model: clientResult.model,
      llmDurationMs: totalLlmDurationMs,
      extraMeta
    });

    let outcome = ANSWERED(responsePayload);
    if (didRetry) {
      outcome.reason = `corrective_retry:${retryReason}`;
    }

    // RLS Scoping Disclosure (Item 3: prevent silent substitution)
    const isRlsScoped =
      finalSql &&
      ctx.identity?.employeeId &&
      (finalSql.includes(`\`employee\` = '${ctx.identity.employeeId}'`) ||
       finalSql.includes(`"employee" = '${ctx.identity.employeeId}'`));

    if (isRlsScoped && outcome.payload) {
      const salaryVal = rows?.[0]?.gross_pay || rows?.[0]?.net_pay || (rows?.[0] ? Object.values(rows[0])[0] : null);
      const formattedSalary = salaryVal ? `$${Number(salaryVal).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : outcome.payload.answer;
      outcome.payload.answer = `You asked about company-wide salaries, but I can only show you your own salary record: ${formattedSalary}.`;
      if (outcome.payload.meta) {
        outcome.payload.meta.rlsScoped = true;
      }
    }

    try {
      const ir = parseIntentIR(query, { schema, dialect });
      const grounding = await validateChartGrounding(ir, { schema, adapter: db });
      if (grounding && grounding.action === "CLARIFY") {
        return ANSWERED({
          answer: grounding.reason,
          source: "llm",
          meta: { ...extraMeta, intentIR: ir, clarification: true },
          data: { type: "clarification", prompt: grounding.reason }
        });
      }
      outcome = enrichResultWithGrounding(outcome, grounding);
    } catch (gErr) {
      console.warn("⚠️ [LLM Link] Grounding check non-fatal error:", gErr.message);
    }

    try {
      const records = rows || outcome.payload?.data?.records || [];
      const vResult = runVerificationChain({
        answer: outcome.payload?.answer,
        records,
        query,
        operation: "AUTO"
      });
      const targetResp = outcome.response || outcome.payload;
      if (targetResp && targetResp.meta) {
        targetResp.meta.verification = vResult;
      }
      if (!vResult.verified) {
        console.warn(`⚠️ [Verification Chain] Assertions ungrounded or arithmetic mismatched: ${vResult.failures.join(", ")}`);
        if (vResult.honestNotice && targetResp) {
          targetResp.answer = `${targetResp.answer}\n\n${vResult.honestNotice}`;
        }
      }
    } catch (vErr) {
      console.warn("⚠️ [LLM Link] Verification chain non-fatal error:", vErr.message);
    }

    return outcome;
  } catch (err) {
    console.error("🚨 [LLM BUG] Local LLM execution threw unexpected error:", err);
    return BUG(`llm_bug:${err.message}`, err);
  }
}