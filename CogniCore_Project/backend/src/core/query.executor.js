// ==========================================
// QUERY EXECUTOR (EXECUTE)
// Safely connects to the active database, runs prepared SQL plans, and returns raw results
// ==========================================

import { connectDatabase, closeDatabase } from "../config/database.js";

export async function executeQueryPlan(plan) {
  if (!plan || plan.executionType === "meta" || !plan.sql) {
    return {
      success: !plan?.error,
      operation: plan?.operation || "unsupported",
      tableName: plan?.tableName || null,
      columnName: plan?.columnName || null,
      rawResult: null,
      error: plan?.error || null
    };
  }

  let db;
  try {
    db = await connectDatabase();

    let rawResult = null;
    if (plan.executionType === "get") {
      rawResult = await db.get(plan.sql, plan.params || []);
    } else if (plan.executionType === "all") {
      rawResult = await db.all(plan.sql, plan.params || []);
    }

    return {
      success: true,
      operation: plan.operation,
      tableName: plan.tableName,
      columnName: plan.columnName,
      rawResult,
      error: null
    };
  } catch (error) {
    console.error("❌ QUERY EXECUTOR ERROR:", error);
    return {
      success: false,
      operation: plan.operation,
      tableName: plan.tableName,
      columnName: plan.columnName,
      rawResult: null,
      error: error.message
    };
  } finally {
    if (db) {
      await closeDatabase();
    }
  }
}
