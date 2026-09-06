console.log("🔥 DYNAMIC QUERY ENGINE LOADED 🔥");

import { readDatabaseSchema } from "./schema.reader.js";
import { resolveTableAndColumn } from "./schema.resolver.js";
import { buildQueryPlan } from "./sql.builder.js";
import { executeQueryPlan } from "./query.executor.js";
import { formatExecutionResponse } from "./response.formatter.js";

// Re-export focused modules for direct testing or downstream usage
export * from "./schema.resolver.js";
export * from "./sql.builder.js";
export * from "./query.executor.js";
export * from "./response.formatter.js";

/**
 * Main dynamic query orchestrator:
 * 1. Understand (schema.resolver.js)
 * 2. Plan (sql.builder.js)  <-- LLM slots in HERE
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

    // 2. Understand (Resolve table + column)
    const resolved = resolveTableAndColumn(query, schema);
    if (resolved.tableName) {
      console.log("🎯 USING TABLE:", resolved.tableName);
    }

    // 3. Plan (Build SQL query plan)
    const plan = buildQueryPlan({ query, schema, resolved });

    // 4. Execute (Run SQL against active DB)
    const execution = await executeQueryPlan(plan);

    // 5. Format (Build natural language answer & data payload)
    return formatExecutionResponse({ plan, execution, schema });
  } catch (error) {
    console.error("❌ DYNAMIC QUERY ERROR:", error);
    return {
      success: false,
      answer: `An error occurred while querying the active database: ${error.message}`,
      data: { error: error.message }
    };
  }
}