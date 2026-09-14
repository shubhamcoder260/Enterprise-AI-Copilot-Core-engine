import { getTool } from "../tool.router.js";
import { ANSWERED, PASS, BUG } from "../../kernel/handler-result.js";

export async function executeToolLink({ query, organization, role, sessionId, intent, startTime }) {
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
    const result = await tool.execute({ query, organization, role, sessionId, capabilities: ctx.capabilities });

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
