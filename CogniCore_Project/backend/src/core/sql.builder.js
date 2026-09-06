// ==========================================
// SQL BUILDER (PLAN)
// Translates resolved table/column and query intent into SQL query plans
// This is the seam where LLM SQL generation plugs into in Phase 2
// ==========================================

import { findBestNumericColumn, isNumericColumn, findMatchingColumn } from "./schema.resolver.js";

export function quoteIdentifier(name) {
  return `"${String(name).replace(/"/g, '""')}"`;
}

export function buildQueryPlan({ query, schema = {}, resolved = {} }) {
  const q = String(query || "").toLowerCase().trim();
  const tables = Object.keys(schema);

  // 1. No tables in database
  if (tables.length === 0) {
    return {
      operation: "database_tables",
      sql: null,
      params: [],
      tableName: null,
      columnName: null,
      executionType: "meta",
      errorType: "no_tables",
      error: "The active database does not contain any readable tables."
    };
  }

  // 2. Database table questions ("what tables", "show tables", "list tables")
  const isTablesQuestion =
    q.includes("what tables") ||
    q.includes("show tables") ||
    q.includes("list tables") ||
    q.includes("available tables") ||
    q.includes("which tables") ||
    q.includes("tables are available");

  if (isTablesQuestion) {
    return {
      operation: "database_tables",
      sql: null,
      params: [],
      tableName: null,
      columnName: null,
      executionType: "meta"
    };
  }

  const { tableName, columnName } = resolved;

  // 3. Column listing questions ("what columns", "show columns", "list columns")
  const isColumnsQuestion =
    q.includes("what columns") ||
    q.includes("show columns") ||
    q.includes("list columns") ||
    q.includes("which columns") ||
    q.includes("columns are in") ||
    q.includes("columns in") ||
    q.includes("fields in") ||
    q.includes("what fields");

  if (isColumnsQuestion) {
    if (!tableName) {
      return {
        operation: "table_columns",
        sql: null,
        params: [],
        tableName: null,
        columnName: null,
        executionType: "meta",
        errorType: "table_missing",
        error: "Table name is required to list columns."
      };
    }

    return {
      operation: "table_columns",
      sql: null,
      params: [],
      tableName,
      columnName: null,
      executionType: "meta"
    };
  }

  // 4. Missing table for data queries
  if (!tableName) {
    return {
      operation: "unsupported",
      sql: null,
      params: [],
      tableName: null,
      columnName: null,
      executionType: "meta",
      errorType: "table_missing",
      error: "Could not determine which table this question refers to."
    };
  }

  const columns = schema[tableName] || [];
  let detectedColumn = columnName || findMatchingColumn(query, columns);

  // 5. Detect operation type
  const isCountQuestion =
    q.includes("how many") ||
    q.includes("count") ||
    q.includes("number of");

  const isShowQuestion =
    q.startsWith("show") ||
    q.startsWith("list") ||
    q.includes("show me") ||
    q.includes("display");

  const isAverageQuestion = q.includes("average") || q.includes("mean");
  const isSumQuestion = q.includes("total") || q.includes("sum");
  const isHighestQuestion =
    q.includes("highest") ||
    q.includes("maximum") ||
    q.includes("largest") ||
    q.includes("max");
  const isLowestQuestion =
    q.includes("lowest") ||
    q.includes("minimum") ||
    q.includes("smallest") ||
    q.includes("min");

  // Plan: COUNT
  if (isCountQuestion) {
    return {
      operation: "count",
      sql: `SELECT COUNT(*) AS count FROM ${quoteIdentifier(tableName)}`,
      params: [],
      tableName,
      columnName: null,
      executionType: "get"
    };
  }

  // Plan: SHOW / RECORDS
  if (isShowQuestion) {
    return {
      operation: "records",
      sql: `SELECT * FROM ${quoteIdentifier(tableName)} LIMIT 50`,
      params: [],
      tableName,
      columnName: null,
      executionType: "all"
    };
  }

  // Aggregate operations requiring a numeric column
  const needsNumericColumn =
    isAverageQuestion || isSumQuestion || isHighestQuestion || isLowestQuestion;

  if (needsNumericColumn) {
    if (!detectedColumn) {
      detectedColumn = findBestNumericColumn(columns);
    }

    if (!detectedColumn) {
      const numericColumns = columns.filter(isNumericColumn).map((c) => c.name);
      return {
        operation: "unsupported",
        sql: null,
        params: [],
        tableName,
        columnName: null,
        executionType: "meta",
        errorType: "numeric_column_missing",
        availableNumericColumns: numericColumns,
        error: `Could not determine which numeric column to calculate for table ${tableName}.`
      };
    }

    const colInfo = columns.find((c) => c.name === detectedColumn);
    if (colInfo && !isNumericColumn(colInfo)) {
      return {
        operation: "unsupported",
        sql: null,
        params: [],
        tableName,
        columnName: detectedColumn,
        executionType: "meta",
        errorType: "column_not_numeric",
        error: `${detectedColumn} is not a numeric column.`
      };
    }

    if (isAverageQuestion) {
      return {
        operation: "average",
        sql: `SELECT AVG(${quoteIdentifier(detectedColumn)}) AS average FROM ${quoteIdentifier(tableName)} WHERE ${quoteIdentifier(detectedColumn)} IS NOT NULL`,
        params: [],
        tableName,
        columnName: detectedColumn,
        executionType: "get"
      };
    }

    if (isSumQuestion) {
      return {
        operation: "sum",
        sql: `SELECT SUM(${quoteIdentifier(detectedColumn)}) AS total FROM ${quoteIdentifier(tableName)} WHERE ${quoteIdentifier(detectedColumn)} IS NOT NULL`,
        params: [],
        tableName,
        columnName: detectedColumn,
        executionType: "get"
      };
    }

    if (isHighestQuestion) {
      return {
        operation: "highest",
        sql: `SELECT * FROM ${quoteIdentifier(tableName)} WHERE ${quoteIdentifier(detectedColumn)} IS NOT NULL ORDER BY ${quoteIdentifier(detectedColumn)} DESC LIMIT 1`,
        params: [],
        tableName,
        columnName: detectedColumn,
        executionType: "get"
      };
    }

    if (isLowestQuestion) {
      return {
        operation: "lowest",
        sql: `SELECT * FROM ${quoteIdentifier(tableName)} WHERE ${quoteIdentifier(detectedColumn)} IS NOT NULL ORDER BY ${quoteIdentifier(detectedColumn)} ASC LIMIT 1`,
        params: [],
        tableName,
        columnName: detectedColumn,
        executionType: "get"
      };
    }
  }

  // 6. Fallback: unknown operation
  return {
    operation: "unsupported",
    sql: null,
    params: [],
    tableName,
    columnName: null,
    executionType: "meta",
    errorType: "unknown_operation",
    error: `Could not understand the operation for table ${tableName}.`
  };
}
