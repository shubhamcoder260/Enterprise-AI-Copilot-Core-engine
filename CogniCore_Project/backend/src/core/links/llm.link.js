import { readDatabaseSchema } from "../schema.reader.js";
import { buildSqlPrompt } from "../../llm/sql.prompt.js";
import { formatLlmResponse } from "../../llm/llm.formatter.js";
import { getRecentExchanges } from "../../store/history.store.js";
import { GATE_CHAIN } from "../../kernel/gate.chain.js";
import { PASS, BUG, ANSWERED } from "../../kernel/handler-result.js";

const FAST_REFUSAL_CODES = [
  "table_missing",
  "table_not_found",
  "unresolvable_missing_column",
  "numeric_column_missing"
];

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
    const schema = await readDatabaseSchema();

    // 1b. Recent history for context resolution (up to 3 turns)
    const history = sessionId ? await getRecentExchanges(sessionId, 3) : [];

    // 2. Build prompt
    const prompt = buildSqlPrompt({ query, schema, history });

    // 3. Client generation — via capability seam (llm)
    const clientResult = await llm.generateSql({ prompt, model });

    if (!clientResult.success) {
      console.log(`ℹ️ [LLM Cascade] Generation failed: ${clientResult.errorType}`);
      return PASS(clientResult.errorType);
    }

    // 4+5. GATE CHAIN: validation gates first, then physical read-only execution.
    let rows;
    let finalSql;
    let sawValidator = false;
    for (const gate of GATE_CHAIN) {
      if (gate.type === "validate") {
        const validation = gate.run(clientResult.sql);
        if (!validation.valid) {
          console.log(`ℹ️ [LLM Cascade] Validation failed: ${validation.reason}`);
          return PASS(validation.reason);
        }
        finalSql = validation.sql;
        sawValidator = true;
        console.log("📝 [LLM Link] Validated SQL:", finalSql);
      } else if (gate.type === "execute") {
        try {
          rows = await gate.run(finalSql);
        } catch (dbErr) {
          console.log(`ℹ️ [LLM Cascade] SQL execution error: ${dbErr.message}`);
          return PASS("llm_execution_error");
        }
      }
    }
    if (!sawValidator) {
      console.error("🚨 [LLM BUG] GATE_CHAIN had no validator gate — refusing to execute");
      return BUG("llm_gate_chain_missing_validator");
    }

    // 5b. Case-sensitivity recovery: retry with COLLATE NOCASE on zero results.
    // Retry goes through the db capability (same read-only guarantee).
    const isZeroCount =
      Array.isArray(rows) &&
      rows.length === 1 &&
      Object.keys(rows[0]).length === 1 &&
      /count/i.test(Object.keys(rows[0])[0]) &&
      (rows[0][Object.keys(rows[0])[0]] === 0 || rows[0][Object.keys(rows[0])[0]] === "0");

    const isZeroResults = !Array.isArray(rows) || rows.length === 0 || isZeroCount;

    if (isZeroResults) {
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

    // 6. Formatter
    const processingMs = Date.now() - startTime;
    const extraMeta = { sessionId, organization, role, processingMs };
    if (history && history.length > 0) {
      extraMeta.contextTurns = history.length;
    }

    const responsePayload = formatLlmResponse({
      sql: finalSql,
      rows,
      model: clientResult.model,
      llmDurationMs: clientResult.durationMs,
      extraMeta
    });

    return ANSWERED(responsePayload);
  } catch (err) {
    console.error("🚨 [LLM BUG] Local LLM execution threw unexpected error:", err);
    return BUG(`llm_bug:${err.message}`, err);
  }
}