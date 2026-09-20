console.log("🔥 DYNAMIC QUERY ENGINE LOADED 🔥");

import { readDatabaseSchema } from "./schema.reader.js";
import { resolveTableAndColumn } from "./schema.resolver.js";
import { buildQueryPlan } from "./sql.builder.js";
import { executeQueryPlan } from "./query.executor.js";
import { formatExecutionResponse } from "./response.formatter.js";
import { tryRoute } from "./fastIntent.js";
import { getDistinct, ensureDistinctCacheLoaded } from "./distinct.cache.js";
import { validateAndSanitizeSql } from "../llm/sql.validator.js";

// Re-export focused modules for direct testing or downstream usage
export * from "./schema.resolver.js";
export * from "./sql.builder.js";
export * from "./query.executor.js";
export * from "./response.formatter.js";
export * from "./fastIntent.js";
export * from "./distinct.cache.js";

// Long-format helper (table has date/time columns or non-unique student_id)
function isLongFormat(tableName, schema) {
  if (!schema) return false;
  const tableData =
    schema[tableName] ||
    (Array.isArray(schema.tables)
      ? schema.tables.find((t) => t.name === tableName)
      : null);
  const cols = tableData?.columns || [];
  return cols.some((c) => /date|time|timestamp|day|datetime/i.test(c.name));
}

/**
 * Main dynamic query orchestrator:
 * 0. Fast Intent Router (fastIntent.js) — deterministic rule-based NL → SQL
 * 1. Understand (schema.resolver.js)
 * 2. Plan (sql.builder.js)
 * 3. Execute (query.executor.js)
 * 4. Format (response.formatter.js)
 */
export async function runDynamicQuery(query) {
  console.log("\n🔥 DYNAMIC ENGINE RECEIVED:", query);

  try {
    // 1. Read Schema
    const schema = await readDatabaseSchema();
    const tables = Object.keys(schema);
    console.log("📊 AVAILABLE TABLES:", tables);

    // 0. Fast Intent Router
    await ensureDistinctCacheLoaded(schema);

    const deps = {
      getSchema: () => schema,
      getDistinct,
      isLongFormat: (t) => isLongFormat(t, schema)
    };

    const fastPlan = tryRoute(query, deps);

    if (fastPlan) {
      console.log("⚡ [FAST INTENT] Matched:", fastPlan.shape, "→", fastPlan.sql, "params:", fastPlan.params);

      // Invariant 1: sql.validator.js security gate
      const validation = validateAndSanitizeSql(fastPlan.sql);
      if (!validation.valid) {
        console.warn("⚠️ [FAST INTENT] SQL failed validation:", validation.reason);
      } else {
        const plan = {
          operation: fastPlan.shape,
          sql: fastPlan.sql,
          params: fastPlan.params,
          tableName: fastPlan.table,
          columnName: fastPlan.orderCol || fastPlan.aggCol || null,
          executionType:
            fastPlan.shape === "count" || fastPlan.shape === "aggregate" || fastPlan.shape === "percentage"
              ? "get"
              : "all",
          readOnly: true,
          routedBy: "fastIntent"
        };

        // Execute on read-only connection
        const execution = await executeQueryPlan(plan);

        // Format
        const formatted = formatExecutionResponse({ plan, execution, schema });
        if (formatted && typeof formatted === "object") {
          if (!formatted.data) formatted.data = {};
          formatted.data.sql = fastPlan.sql;
          formatted.routedBy = "fastIntent";
        }
        return formatted;
      }
    }

    console.log("ℹ️ [FAST INTENT] No match, falling through to heuristic pipeline");

    // 2. Understand (Resolve table + column)
    const resolved = resolveTableAndColumn(query, schema);
    if (resolved.tableName) {
      console.log("🎯 USING TABLE:", resolved.tableName);
    }

    // 3. Plan (Build SQL query plan)
    const plan = buildQueryPlan({ query, schema, resolved, getDistinct });

    // H2 Universal builder shield: all builder operations decline if query contains unbound categorical distinct values
    if (plan.tableName && typeof getDistinct === "function" && !plan.errorType) {
      const distinctVals = getDistinct(plan.tableName) || [];
      const queryTokens = String(query || "").toLowerCase().split(/[^a-z0-9_]+/).filter(Boolean);
      const hasUnboundVal = queryTokens.some((tok) =>
        distinctVals.some((v) => v && v.value && String(v.value).trim().toLowerCase() === tok)
      );
      if (hasUnboundVal) {
        plan.errorType = "unbound_filter_criteria";
        plan.error = "Query contains categorical filter criteria that cannot be bound by single-table builder.";
        plan.sql = null;
        plan.executionType = "meta";
      }
    }

    // 4. Execute (Run SQL against active DB)
    const execution = await executeQueryPlan(plan);

    // 5. Format (Build natural language answer & data payload)
    const formatted = formatExecutionResponse({ plan, execution, schema });
    if (formatted) {
      if (plan.errorType && !formatted.code) {
        formatted.code = plan.errorType;
      }
      if (formatted.data && plan.sql) {
        formatted.data.sql = plan.sql;
      }
    }
    return formatted;
  } catch (error) {
    console.error("❌ DYNAMIC QUERY ERROR:", error);
    return {
      success: false,
      code: "dynamic_error",
      answer: `An error occurred while querying the active database: ${error.message}`,
      data: { error: error.message, errorType: "dynamic_error" }
    };
  }
}