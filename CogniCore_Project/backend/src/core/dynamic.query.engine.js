console.log("🔥 DYNAMIC QUERY ENGINE LOADED 🔥");

import { readDatabaseSchema } from "./schema.reader.js";
import { resolveTableAndColumn } from "./schema.resolver.js";
import { buildQueryPlan } from "./sql.builder.js";
import { executeQueryPlan } from "./query.executor.js";
import { formatExecutionResponse } from "./response.formatter.js";
import { tryRoute } from "./fastIntent.js";
import { getDistinct, ensureDistinctCacheLoaded } from "./distinct.cache.js";
import { validateAndSanitizeSql } from "../llm/sql.validator.js";
import { gateChainFor } from "../kernel/gate.selector.js";

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
export async function runDynamicQuery(query, options = {}) {
  const capabilities = options.capabilities;
  const dialect = (capabilities?.source?.dialect || "sqlite").toLowerCase();
  console.log(`\n🔥 DYNAMIC ENGINE RECEIVED (${dialect}):`, query);

  try {
    // 1. Read Schema
    const schema = options.schema || await readDatabaseSchema(false, {
      source: capabilities?.source,
      adapter: capabilities?.db
    });
    const tables = Object.keys(schema);
    console.log("📊 AVAILABLE TABLES:", tables);

    // 0. Fast Intent Router
    await ensureDistinctCacheLoaded(schema);

    const deps = {
      getSchema: () => schema,
      getDistinct,
      isLongFormat: (t) => isLongFormat(t, schema),
      dialect
    };

    const fastPlan = tryRoute(query, deps, dialect);

    if (fastPlan) {
      console.log("⚡ [FAST INTENT] Matched:", fastPlan.shape, "→", fastPlan.sql, "params:", fastPlan.params);

      // Invariant 1: Gate validation via gateChainFor
      let isValid = true;
      let rejectReason = null;
      let validatedSql = fastPlan.sql;
      const identity = options.identity !== undefined ? options.identity : capabilities?.identity;
      const chain = gateChainFor(capabilities?.source);

      for (const gate of chain) {
        if (gate.type === "validate") {
          const vRes = await gate.run(validatedSql, { schema, identity });
          if (!vRes.valid) {
            isValid = false;
            rejectReason = vRes.reason;
            if (vRes.reason?.startsWith("ast_rls_") || vRes.reason?.startsWith("rls_")) {
              return {
                success: false,
                code: vRes.reason,
                rlsBlocked: true,
                answer: vRes.message || "Access to salary records of other employees is restricted by enterprise policy."
              };
            }
            break;
          }
          if (vRes.sql) validatedSql = vRes.sql;
        }
      }

      if (!isValid) {
        console.warn("⚠️ [FAST INTENT] SQL failed validation:", rejectReason);
      } else {
        const plan = {
          operation: fastPlan.shape,
          sql: validatedSql,
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
        let execution;
        if (capabilities?.db && typeof capabilities.db.queryReadOnly === "function") {
          const rows = await capabilities.db.queryReadOnly(plan.sql, plan.params);
          execution = {
            success: true,
            operation: plan.operation,
            tableName: plan.tableName,
            columnName: plan.columnName,
            records: rows,
            rowCount: rows.length,
            rawResult: plan.executionType === "get" ? rows[0] : rows,
            result: plan.executionType === "get" ? (rows[0] ? Object.values(rows[0])[0] : null) : null
          };
        } else {
          execution = await executeQueryPlan(plan);
        }

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

    if (dialect !== "sqlite") {
      return {
        success: false,
        code: "dynamic_unmatched",
        answer: `Fast intent did not match for ${dialect} source, cascading to LLM.`
      };
    }

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