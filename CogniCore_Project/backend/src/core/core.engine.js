// ==========================================
// CORE ENGINE — ORCHESTRATION & FALLBACK CHAIN
// Chain: Tool -> Local LLM (Phase 2) -> Dynamic Engine -> Helpful Error Fallback
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
    return { handled: false, reason: "intent_not_configured_for_tool" };
  }

  const tool = getTool(intent);
  if (!tool) {
    return { handled: false, reason: "tool_not_found" };
  }

  try {
    console.log("🔧 Attempting Tool Link:", tool.name);
    const result = await tool.execute({ query, organization, role, sessionId });

    // Expected soft failure: active database lacks the required table
    if (result.data?.error === "table_not_found") {
      console.log(`ℹ️ [Soft Cascade] Tool "${tool.name}" bypassed: missing required table "${result.data.table}". Cascading to next link.`);
      return { handled: false, reason: `table_not_found:${result.data.table}` };
    }

    return {
      handled: true,
      response: {
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
      }
    };
  } catch (err) {
    // Exact match against real node-sqlite3 driver string: "SQLITE_ERROR: no such table: <tableName>"
    const isExpectedMissingTable =
      typeof err?.message === "string" &&
      /\bno\s+such\s+table:\s*([a-zA-Z0-9_]+)/i.test(err.message);

    if (isExpectedMissingTable) {
      const tableMatch = err.message.match(/\bno\s+such\s+table:\s*([a-zA-Z0-9_]+)/i);
      const tableName = tableMatch ? tableMatch[1] : "unknown";
      console.log(`ℹ️ [Soft Cascade] Tool "${tool.name}" bypassed due to SQLite driver missing table (${tableName}). Cascading down chain.`);
      return { handled: false, reason: `missing_table:${tableName}` };
    }

    // Real unexpected exception/bug (TypeError, ReferenceError, etc.): MUST be logged with console.error
    console.error(`🚨 [TOOL BUG] Unexpected exception in tool "${tool.name}":`, err);
    return { handled: false, reason: `tool_bug:${err.message}` };
  }
}

// ==========================================
// LINK 2: LOCAL LLM SQL GENERATOR (PHASE 2 SEAM)
// ==========================================
async function executeLlmLink({ query, organization, role, sessionId, model, startTime }) {
  const isLlmEnabled = process.env.ENABLE_LOCAL_LLM === "true";

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
    try {
      rows = await executeReadOnlySql(validation.sql);
    } catch (dbErr) {
      console.log(`ℹ️ [LLM Cascade] SQL execution error: ${dbErr.message}`);
      return { handled: false, reason: "llm_execution_error" };
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
      sql: validation.sql,
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

  let tables = [];
  try {
    const schema = await readDatabaseSchema();
    tables = Object.keys(schema);
  } catch (e) {}

  const tablesText =
    tables.length > 0
      ? `Available tables in the active database: ${tables.join(", ")}.`
      : "No readable tables found in the currently active database.";

  const answer =
    lastReason && lastReason.length > 10 && !lastReason.includes(":")
      ? lastReason
      : `I could not find an exact answer for: "${query}".\n\n${tablesText}\n\nYou can ask to count records, show records, list columns, or calculate averages/totals for numeric fields.`;

  return {
    handled: true,
    response: {
      answer,
      source: "fallback",
      data: {
        error: "unresolved_query",
        query,
        availableTables: tables
      },
      meta: {
        sessionId,
        organization,
        role,
        engineMode: "fallback",
        processingMs: Date.now() - startTime
      }
    }
  };
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
}) {
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
    { name: "Local LLM", execute: executeLlmLink },
    { name: "Dynamic Query Engine", execute: executeDynamicLink },
    { name: "Helpful Fallback", execute: executeFallbackLink }
  ];

  let lastReason = "";
  for (const link of chain) {
    console.log(`🔗 Evaluating chain link: [${link.name}]`);
    const outcome = await link.execute({ ...context, lastReason });

    if (outcome.handled && outcome.response) {
      console.log(`✅ Handled by: [${link.name}] (source: ${outcome.response.source})`);
      return outcome.response;
    }

    if (outcome.reason) {
      lastReason = outcome.reason;
      console.log(`↪ Link [${link.name}] passed: ${outcome.reason}`);
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