// ==========================================
// AST GATE (SECURITY & STRUCTURAL CONTRACT GATE)
// Layer 1.5 in GATE_CHAIN — parses AST with node-sql-parser
//
// Invariants:
//   1. Function Whitelist: COUNT, SUM, AVG, MIN, MAX, strftime, LOWER, UPPER, ROUND only
//   2. Schema Existence: Every AST table and column node must exist in live schema
//   3. Strict-mode Bare-Column / Aggregate / GROUP-BY rule:
//      Bare projected columns alongside aggregates without matching GROUP BY are rejected
//   4. O16: load_extension rejected structurally
//   5. Byte-identical Litmus #8: sql.validator.js remains completely untouched
// ==========================================

import NodeSQLParser from "node-sql-parser";

const parser = new NodeSQLParser.Parser();

export const ALLOWED_FUNCTIONS = new Set([
  "COUNT",
  "SUM",
  "AVG",
  "MIN",
  "MAX",
  "STRFTIME",
  "LOWER",
  "UPPER",
  "ROUND"
]);

export const AGGREGATE_FUNCTIONS = new Set([
  "COUNT",
  "SUM",
  "AVG",
  "MIN",
  "MAX"
]);

const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9_]/g, "");

/**
 * Traverses an AST object recursively to visit every node.
 */
function walkAst(node, visitor) {
  if (!node || typeof node !== "object") return;
  visitor(node);
  for (const key of Object.keys(node)) {
    const val = node[key];
    if (Array.isArray(val)) {
      for (const child of val) walkAst(child, visitor);
    } else if (val && typeof val === "object") {
      walkAst(val, visitor);
    }
  }
}

/**
 * Helper to extract column reference name and table, including SQLite double-quoted strings.
 */
function extractColRef(node) {
  if (!node || typeof node !== "object") return null;
  if (node.type === "column_ref" && node.column) {
    return {
      table: node.table || null,
      column: typeof node.column === "string" ? node.column : node.column?.expr?.value || String(node.column)
    };
  }
  if (node.type === "double_quote_string" && node.value) {
    return {
      table: null,
      column: String(node.value)
    };
  }
  return null;
}

/**
 * Validates an SQL statement using AST inspection.
 *
 * @param {string} sql
 * @param {object} [options] - { schema }
 * @returns {{ valid: boolean, sql?: string, reason?: string }}
 */
export function validateAst(sql, options = {}) {
  if (!sql || typeof sql !== "string") {
    return { valid: false, reason: "ast_empty_input" };
  }

  const cleanSql = sql.trim().replace(/;+$/, "").trim();

  let ast;
  try {
    ast = parser.astify(cleanSql, { database: "sqlite" });
  } catch (err) {
    return { valid: false, reason: `ast_parse_error: ${err.message}` };
  }

  const stmt = Array.isArray(ast) ? ast[0] : ast;
  if (!stmt || stmt.type !== "select") {
    return { valid: false, reason: "ast_disallowed_statement_type" };
  }

  // 1. FUNCTION WHITELIST CHECK
  let disallowedFunc = null;
  walkAst(stmt, (node) => {
    let fnName = null;
    if (node.type === "aggr_func") {
      fnName = node.name;
    } else if (node.type === "function") {
      fnName =
        typeof node.name === "string"
          ? node.name
          : node.name?.name?.[0]?.value || node.name?.name || null;
    }
    if (fnName) {
      const upper = String(fnName).toUpperCase();
      if (!ALLOWED_FUNCTIONS.has(upper)) {
        disallowedFunc = String(fnName).toLowerCase();
      }
    }
  });

  if (disallowedFunc) {
    return { valid: false, reason: `ast_disallowed_function:${disallowedFunc}` };
  }

  // 2. SCHEMA EXISTENCE CHECK (Tables & Columns)
  const schema = options.schema || {};
  let schemaTables = [];
  if (Array.isArray(schema.tables)) {
    schemaTables = schema.tables;
  } else if (typeof schema === "object" && schema !== null) {
    schemaTables = Object.entries(schema).map(([name, data]) => ({
      name,
      columns: data.columns || []
    }));
  }

  const fromTables = [];
  if (Array.isArray(stmt.from)) {
    for (const f of stmt.from) {
      if (f.table) {
        fromTables.push({
          name: f.table,
          as: f.as || f.table
        });
      }
    }
  }

  if (schemaTables.length > 0 && fromTables.length > 0) {
    // Check tables exist in live schema
    for (const ft of fromTables) {
      const exists = schemaTables.some((st) => norm(st.name) === norm(ft.name));
      if (!exists) {
        return { valid: false, reason: `ast_table_not_in_schema:${ft.name}` };
      }
    }

    // Check columns exist in live schema
    let invalidCol = null;
    walkAst(stmt, (node) => {
      const colRef = extractColRef(node);
      if (!colRef) return;

      const colName = colRef.column;
      const tableName = colRef.table;
      if (colName === "*" || colName === "(EXTRACT_PARAM)") return;

      if (tableName) {
        const matchedFrom = fromTables.find(
          (ft) => norm(ft.as) === norm(tableName) || norm(ft.name) === norm(tableName)
        );
        if (matchedFrom) {
          const tableData = schemaTables.find((st) => norm(st.name) === norm(matchedFrom.name));
          const colExists = (tableData?.columns || []).some(
            (c) => norm(c.name || c) === norm(colName)
          );
          if (!colExists) {
            invalidCol = `${tableName}.${colName}`;
          }
        }
      } else {
        const isSelectAlias = (stmt.columns || []).some(
          (c) => c.as && norm(c.as) === norm(colName)
        );
        if (!isSelectAlias) {
          const colExists = fromTables.some((ft) => {
            const tableData = schemaTables.find((st) => norm(st.name) === norm(ft.name));
            return (tableData?.columns || []).some((c) => norm(c.name || c) === norm(colName));
          });
          if (!colExists) {
            invalidCol = colName;
          }
        }
      }
    });

    if (invalidCol) {
      return { valid: false, reason: `ast_column_not_in_schema:${invalidCol}` };
    }
  }

  // 3. STRICT-MODE BARE-COLUMN / AGGREGATE / GROUP-BY RULE
  // If SELECT projects an aggregate AND a bare column, GROUP BY MUST exist and contain that column.
  const projectedBareCols = [];
  let hasAggregateInSelect = false;

  if (Array.isArray(stmt.columns)) {
    for (const colNode of stmt.columns) {
      const expr = colNode.expr;
      if (!expr) continue;

      if (expr.type === "aggr_func") {
        hasAggregateInSelect = true;
      } else {
        const directCol = extractColRef(expr);
        if (directCol && directCol.column !== "*") {
          projectedBareCols.push(directCol.column);
        } else {
          let exprHasAgg = false;
          walkAst(expr, (n) => {
            if (n.type === "aggr_func") exprHasAgg = true;
          });
          if (exprHasAgg) {
            hasAggregateInSelect = true;
          } else {
            walkAst(expr, (n) => {
              const innerCol = extractColRef(n);
              if (innerCol && innerCol.column !== "*") {
                projectedBareCols.push(innerCol.column);
              }
            });
          }
        }
      }
    }
  }

  if (hasAggregateInSelect && projectedBareCols.length > 0) {
    const groupByCols = [];
    if (stmt.groupby && Array.isArray(stmt.groupby.columns)) {
      for (const gbNode of stmt.groupby.columns) {
        const gbCol = extractColRef(gbNode);
        if (gbCol && gbCol.column) {
          groupByCols.push(norm(gbCol.column));
        } else if (typeof gbNode === "string") {
          groupByCols.push(norm(gbNode));
        }
      }
    }

    for (const bareCol of projectedBareCols) {
      if (!groupByCols.includes(norm(bareCol))) {
        return {
          valid: false,
          reason: `ast_bare_column_without_group_by:${bareCol}`
        };
      }
    }
  }

  return { valid: true, sql: cleanSql };
}

export const astGate = validateAst;
