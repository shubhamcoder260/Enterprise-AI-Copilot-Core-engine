// ==========================================
// AST GATE (SECURITY & STRUCTURAL CONTRACT GATE)
// Layer 1.5 in GATE_CHAIN — parses AST with node-sql-parser
//
// Invariants:
//   1. Function Whitelist: COUNT, SUM, AVG, MIN, MAX, strftime, LOWER, UPPER, ROUND only
//   2. Schema Existence: Every AST table and column node must exist in live schema
//   3. Strict-mode Bare-Column / Aggregate / GROUP-BY rule (MySQL ONLY_FULL_GROUP_BY semantics):
//      Bare projected columns alongside aggregates without matching GROUP BY or
//      table PRIMARY KEY in GROUP BY (functional dependency) are rejected
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

  // Collect CTE aliases defined in WITH clause
  const cteNames = new Set();
  if (Array.isArray(stmt.with)) {
    for (const w of stmt.with) {
      const name = typeof w.name === "string" ? w.name : w.name?.value;
      if (name) cteNames.add(norm(name));
    }
  }

  // Collect subquery derived table aliases from FROM / JOIN
  const derivedAliases = new Set([...cteNames]);
  const fromTables = [];
  if (Array.isArray(stmt.from)) {
    for (const f of stmt.from) {
      if (f.table) {
        fromTables.push({
          name: f.table,
          as: f.as || f.table
        });
      } else if (f.as) {
        derivedAliases.add(norm(f.as));
      }
    }
  }

  if (schemaTables.length > 0) {
    // Check all tables in the query (including subqueries and CTE definitions)
    let allQueryTables = [];
    try {
      const tableList = parser.tableList(cleanSql, { database: "sqlite" }) || [];
      allQueryTables = tableList.map((t) => t.split("::")[2]).filter(Boolean);
    } catch {
      allQueryTables = fromTables.map((f) => f.name);
    }

    for (const tbl of allQueryTables) {
      const isCte = cteNames.has(norm(tbl));
      const exists = isCte || schemaTables.some((st) => norm(st.name) === norm(tbl));
      if (!exists) {
        return { valid: false, reason: `ast_table_not_in_schema:${tbl}` };
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
        if (derivedAliases.has(norm(tableName))) return; // CTE or subquery reference
        const matchedFrom = fromTables.find(
          (ft) => norm(ft.as) === norm(tableName) || norm(ft.name) === norm(tableName)
        );
        if (matchedFrom) {
          if (derivedAliases.has(norm(matchedFrom.name))) return;
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
            if (derivedAliases.has(norm(ft.name))) return true;
            const tableData = schemaTables.find((st) => norm(st.name) === norm(ft.name));
            return (tableData?.columns || []).some((c) => norm(c.name || c) === norm(colName));
          });
          if (!colExists && derivedAliases.size === 0) {
            invalidCol = colName;
          }
        }
      }
    });

    if (invalidCol) {
      return { valid: false, reason: `ast_column_not_in_schema:${invalidCol}` };
    }
  }

  // 3. STRICT-MODE BARE-COLUMN / AGGREGATE / GROUP-BY RULE (PK-FD ONLY_FULL_GROUP_BY)
  // If SELECT projects an aggregate AND a bare column, GROUP BY MUST exist and contain
  // either that column/expression, or the primary key of the column's table (functional dependency).

  // Extract primary keys by table from schema
  const pkByTable = new Map();
  for (const st of schemaTables) {
    const pks = new Set();
    for (const col of st.columns || []) {
      if (typeof col === "object" && col !== null) {
        if (col.pk || col.primaryKey) {
          pks.add(norm(col.name));
        }
      }
    }
    if (Array.isArray(st.primaryKeys)) {
      st.primaryKeys.forEach((p) => pks.add(norm(p)));
    }
    if (Array.isArray(st.pk)) {
      st.pk.forEach((p) => pks.add(norm(p)));
    }
    pkByTable.set(norm(st.name), pks);
  }

  // Helper to resolve physical table name for a column reference
  function resolveColumnTable(colRef) {
    if (!colRef) return null;
    if (colRef.table) {
      const matched = fromTables.find(
        (ft) => norm(ft.as) === norm(colRef.table) || norm(ft.name) === norm(colRef.table)
      );
      return matched ? norm(matched.name) : norm(colRef.table);
    }
    const cName = norm(colRef.column);
    const candidates = [];
    for (const ft of fromTables) {
      const st = schemaTables.find((s) => norm(s.name) === norm(ft.name));
      if (st && (st.columns || []).some((c) => norm(c.name || c) === cName)) {
        candidates.push(norm(ft.name));
      }
    }
    const unique = [...new Set(candidates)];
    return unique.length === 1 ? unique[0] : null;
  }

  const gbColumns = Array.isArray(stmt.groupby)
    ? stmt.groupby
    : stmt.groupby?.columns || [];

  const groupByExprStrs = new Set(gbColumns.map((gb) => JSON.stringify(gb)));
  const groupByCols = new Set();
  const qualifiedGbCols = new Set();
  const coveredOrdinalIndices = new Set();

  for (const gbNode of gbColumns) {
    if (gbNode.type === "number" || typeof gbNode.value === "number") {
      const idx = (gbNode.value || gbNode) - 1;
      coveredOrdinalIndices.add(idx);
    }
    const gbCol = extractColRef(gbNode);
    if (gbCol && gbCol.column) {
      const cNorm = norm(gbCol.column);
      groupByCols.add(cNorm);
      if (gbCol.table) {
        const resolvedGbTable = resolveColumnTable(gbCol);
        if (resolvedGbTable) {
          qualifiedGbCols.add(`${resolvedGbTable}.${cNorm}`);
        }
      }
    } else if (typeof gbNode === "string") {
      groupByCols.add(norm(gbNode));
    }
  }

  const projectedBareCols = [];
  let hasAggregateInSelect = false;

  if (Array.isArray(stmt.columns)) {
    stmt.columns.forEach((colNode, idx) => {
      const expr = colNode.expr;
      if (!expr) return;

      const exprStr = JSON.stringify(expr);
      const isDirectlyGrouped =
        coveredOrdinalIndices.has(idx) ||
        groupByExprStrs.has(exprStr) ||
        (colNode.as && groupByCols.has(norm(colNode.as)));

      if (expr.type === "aggr_func") {
        hasAggregateInSelect = true;
      } else {
        let exprHasAgg = false;
        walkAst(expr, (n) => {
          if (n.type === "aggr_func") exprHasAgg = true;
        });

        if (exprHasAgg) {
          hasAggregateInSelect = true;
        } else if (!isDirectlyGrouped) {
          const directCol = extractColRef(expr);
          if (directCol && directCol.column !== "*") {
            const resolvedTable = resolveColumnTable(directCol);
            projectedBareCols.push({
              name: directCol.column,
              table: resolvedTable,
              as: colNode.as || null
            });
          } else {
            walkAst(expr, (n) => {
              const innerCol = extractColRef(n);
              if (innerCol && innerCol.column !== "*") {
                const resolvedTable = resolveColumnTable(innerCol);
                projectedBareCols.push({
                  name: innerCol.column,
                  table: resolvedTable,
                  as: colNode.as || null
                });
              }
            });
          }
        }
      }
    });
  }

  if (hasAggregateInSelect && projectedBareCols.length > 0) {
    for (const bareCol of projectedBareCols) {
      const tablePks = bareCol.table ? pkByTable.get(bareCol.table) : null;
      let hasPkInGroupBy = false;
      if (tablePks && tablePks.size > 0) {
        for (const pkCol of tablePks) {
          if (
            groupByCols.has(pkCol) ||
            qualifiedGbCols.has(`${bareCol.table}.${pkCol}`)
          ) {
            hasPkInGroupBy = true;
            break;
          }
        }
      }

      const isCovered =
        groupByCols.has(norm(bareCol.name)) ||
        (bareCol.as && groupByCols.has(norm(bareCol.as))) ||
        hasPkInGroupBy;

      if (!isCovered) {
        return {
          valid: false,
          reason: `ast_bare_column_without_group_by:${bareCol.name}`
        };
      }
    }
  }

  return { valid: true, sql: cleanSql };
}

export const astGate = validateAst;
