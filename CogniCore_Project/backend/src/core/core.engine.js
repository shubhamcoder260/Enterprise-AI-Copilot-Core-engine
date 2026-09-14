// ==========================================
// CORE ENGINE — ORCHESTRATION & FALLBACK CHAIN
// Chain: Tool -> Dynamic Engine -> Local LLM -> Helpful Error Fallback
// All links strictly produce the standard contract: { answer, source, data, meta }
// ==========================================

import { detectIntent } from "./intent.detector.js";
import { getTool } from "./tool.router.js";
import { runDynamicQuery } from "./dynamic.query.engine.js";
import { readDatabaseSchema } from "./schema.reader.js";
import { buildSqlPrompt } from "../llm/sql.prompt.js";
import { generateSql } from "../llm/llm.client.js";
import { validateAndSanitizeSql } from "../llm/sql.validator.js";
import { executeReadOnlySql } from "../config/database.js";
import { formatLlmResponse } from "../llm/llm.formatter.js";
import { getRecentExchanges } from "../store/history.store.js";

import { ANSWERED, PASS, ABSTAIN, BUG, isHandlerResult } from "../kernel/handler-result.js";

// ==========================================
// LINK 1: CONFIGURED TOOL HANDLER
// ==========================================
async function executeToolLink({ query, organization, role, sessionId, intent, startTime }) {
  const configuredIntents = [
    "education_cgpa_analytics",
    "education_foreign_students",
    "hospital_patient_analytics"
  ];

  if (!configuredIntents.includes(intent)) {

    return PASS("intent_not_configured_for_tool");  }

  const tool = getTool(intent);
  if (!tool) {
    return PASS("tool_not_found");
  }

   try {
    console.log("🔧 Attempting Tool Link:", tool.name);
    const result = await tool.execute({ query, organization, role, sessionId });

    // Expected soft failure: active database lacks the required table
    if (result.data?.error === "table_not_found") {
      console.log(`ℹ️ [Soft Cascade] Tool "${tool.name}" bypassed: missing required table "${result.data.table}". Cascading to next link.`);
      return PASS(`table_not_found:${result.data.table}`);
    }

    return ANSWERED({
      answer: result.answer,
      source: "tool",
      data: result.data || {},
      meta: {
        sessionId,
        organization,
        role,
        engineMode: "configured_tool",
        intent,
        tool: tool.name,
        processingMs: Date.now() - startTime
      }
    });
  } catch (err) {
    // Soft cascade against real node-sqlite3 driver string: "SQLITE_ERROR: no such table/column: <name>"
    const isExpectedMissingSchema =
      typeof err?.message === "string" &&
      /\bno\s+such\s+(?:table|column):\s*([a-zA-Z0-9_]+)/i.test(err.message);

    if (isExpectedMissingSchema) {
      const schemaMatch = err.message.match(/\bno\s+such\s+(?:table|column):\s*([a-zA-Z0-9_]+)/i);
      const itemName = schemaMatch ? schemaMatch[1] : "unknown";
      console.log(`ℹ️ [Soft Cascade] Tool "${tool.name}" bypassed due to SQLite driver missing schema element (${itemName}). Cascading down chain.`);
      return PASS(`missing_schema:${itemName}`);
    }

    // Real unexpected exception/bug (TypeError, ReferenceError, etc.): MUST be logged loud
    console.error(`🚨 [TOOL BUG] Unexpected exception in tool "${tool.name}":`, err);
    return BUG(`tool_bug:${err.message}`, err);
  }}
// ==========================================
// LINK 2: LOCAL LLM SQL GENERATOR (PHASE 2 SEAM)
// ==========================================
async function executeLlmLink({ query, organization, role, sessionId, model, startTime }) {
  const isLlmEnabled = process.env.ENABLE_LOCAL_LLM !== "false";

  if (!isLlmEnabled) {
    return { handled: false, reason: "llm_not_configured" };
  }

  try {
    console.log("🤖 Attempting Local LLM Link");

    // 1. Cached schema read (zero PRAGMA calls)
    const schema = await readDatabaseSchema();

    // 1b. Retrieve recent history for context resolution (up to 3 turns)
    const history = sessionId ? await getRecentExchanges(sessionId, 3) : [];

    // 2. Build prompt
    const prompt = buildSqlPrompt({ query, schema, history });

    // 3. Client generation with optional requestedModel
    const clientResult = await generateSql({ prompt, model });

    if (!clientResult.success) {
      console.log(`ℹ️ [LLM Cascade] Generation failed: ${clientResult.errorType}`);
      return { handled: false, reason: clientResult.errorType };
    }

    // 4. Validator security gate
    const validation = validateAndSanitizeSql(clientResult.sql);

    if (!validation.valid) {
      console.log(`ℹ️ [LLM Cascade] Validation failed: ${validation.reason}`);
      return { handled: false, reason: validation.reason };
    }

    console.log("📝 [LLM Link] Validated SQL:", validation.sql);

    // 5. Read-only physical execution
    let rows;
    let finalSql = validation.sql;
    try {
      rows = await executeReadOnlySql(finalSql);
    } catch (dbErr) {
      console.log(`ℹ️ [LLM Cascade] SQL execution error: ${dbErr.message}`);
      return { handled: false, reason: "llm_execution_error" };
    }

    // 5b. Case-sensitivity recovery:
    // SQLite string equality is case-sensitive by default ('Submitted' != 'submitted').
    // If the query returned 0 records or count(*) = 0, retry with COLLATE NOCASE for string literals.
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
          const recoveryRows = await executeReadOnlySql(enhancedSql);
          const recoveryZeroCount =
            Array.isArray(recoveryRows) &&
            recoveryRows.length === 1 &&
            Object.keys(recoveryRows[0]).length === 1 &&
            /count/i.test(Object.keys(recoveryRows[0])[0]) &&
            (recoveryRows[0][Object.keys(recoveryRows[0])[0]] === 0 || recoveryRows[0][Object.keys(recoveryRows[0])[0]] === "0");

          if (Array.isArray(recoveryRows) && recoveryRows.length > 0 && !recoveryZeroCount) {
            console.log(
              `ℹ️ [Case-Sensitivity Recovery] Retried query with COLLATE NOCASE, found matching records (${recoveryRows.length})`
            );
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
    const extraMeta = {
      sessionId,
      organization,
      role,
      processingMs
    };
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

    return {
      handled: true,
      response: responsePayload
    };
  } catch (err) {
    console.error("🚨 [LLM BUG] Local LLM execution threw unexpected error:", err);
    return { handled: false, reason: err.message };
  }
}

// ==========================================
// LINK 3: DYNAMIC HEURISTIC QUERY ENGINE
// ==========================================
async function executeDynamicLink({ query, organization, role, sessionId, startTime }) {
  try {
    console.log("🔥 Attempting Dynamic Query Engine Link");
    const dynamicResult = await runDynamicQuery(query);

    if (dynamicResult.success) {
      return {
        handled: true,
        response: {
          answer: dynamicResult.answer,
          source: "dynamic",
          data: dynamicResult.data || {},
          meta: {
            sessionId,
            organization,
            role,
            engineMode: "dynamic_query",
            intent: "dynamic_query",
            processingMs: Date.now() - startTime
          }
        }
      };
    }

    return {
      handled: false,
      reason: dynamicResult.answer,
      partialResult: dynamicResult
    };
  } catch (err) {
    console.error("🚨 [DYNAMIC ENGINE BUG] Unexpected error:", err);
    return { handled: false, reason: err.message };
  }
}

// ==========================================
// LINK 4: HELPFUL FALLBACK WITH SCHEMA INSPECTION
// ==========================================


async function executeFallbackLink({ query, organization, role, sessionId, startTime, lastReason }) {
  console.log("🛡️ Falling back to Helpful Fallback handler with schema inspection");
  try {
    let tables = [];
    try {
      const schema = await readDatabaseSchema();
      tables = Object.keys(schema);
    } catch (e) {}

    const tablesText =
      tables.length > 0
        ? `Available tables in the active database: ${tables.join(", ")}.`
        : "No readable tables found in the currently active database.";

    const answer = `I could not find an exact answer for: "${query}".\n\n${tablesText}\n\nYou can ask to count records, show records, list columns, or calculate averages/totals for numeric fields.`;

    console.log("🛡️ about to return ANSWERED");

    return ANSWERED({
      answer,
      source: "fallback",
      data: { error: "unresolved_query", query, availableTables: tables },
      meta: {
        sessionId, organization, role,
        engineMode: "fallback",
        processingMs: Date.now() - startTime
      }
    });
  } catch (e) {
    console.error("🛡️💥 FALLBACK THREW:", e);
    throw e;
  }
}


// ==========================================
// RUN CORE ENGINE — CHAIN RUNNER
// ==========================================
export async function runCoreEngine({
  query,
  organization = "college",
  role = "admin",
  sessionId,
  model
}) 
{
  const startTime = Date.now();

  console.log("\n==============================");
  console.log("🧠 CORE ENGINE RECEIVED QUERY:");
  console.log(query);
  if (sessionId) {
    console.log("🆔 SESSION ID:", sessionId);
  }
  if (model) {
    console.log("🤖 REQUESTED MODEL:", model);
  }
  console.log("==============================");

  const intent = detectIntent(query, organization);
  console.log("🎯 DETECTED INTENT:", intent);

  const context = {
    query,
    organization,
    role,
    sessionId,
    model,
    intent,
    startTime
  };

  const chain = [
    { name: "Configured Tools", execute: executeToolLink },
    { name: "Dynamic Query Engine", execute: executeDynamicLink },
    { name: "Local LLM", execute: executeLlmLink },
    { name: "Helpful Fallback", execute: executeFallbackLink }
  ];

  let lastReason = "";

     for (const link of chain) {
    console.log(`🔗 Evaluating chain link: [${link.name}]`);
    const outcome = await link.execute({ ...context, lastReason });

    let status, response, reason;
    if (isHandlerResult(outcome)) {
      ({ status, response, reason } = outcome);
    } else {
      status = outcome.handled ? "ANSWERED" : "PASS";
      response = outcome.response;
      reason = outcome.reason;
    }

    if (status === "ANSWERED" && response) {
      console.log(`✅ Handled by: [${link.name}] (source: ${response.source})`);
      return response;
    }
    if (status === "BUG") {
      console.error(`🚨 [ENGINE] Link [${link.name}] bug: ${reason}`);
    }
    if (reason) {
      lastReason = reason;
      console.log(`↪ Link [${link.name}] ${status}: ${reason}`);
    }
  }

  // Absolute safety catch-all
  return {
    answer: "Unable to process query.",
    source: "error",
    data: {},
    meta: {
      sessionId,
      organization,
      role,
      engineMode: "error",
      processingMs: Date.now() - startTime
    }
  };
}
