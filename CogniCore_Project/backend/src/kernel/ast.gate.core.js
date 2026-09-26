// ==========================================
// AST GATE CORE — Structural & Security AST Engine
// Parameterized by dialect: SQLite, MariaDB, etc.
// ==========================================

import pkg from "node-sql-parser";
const { Parser } = pkg;

const parser = new Parser();

export const DEFAULT_ALLOWED_FUNCTIONS = new Set([
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

export const MARIADB_ALLOWED_FUNCTIONS = new Set([
  "COUNT",
  "SUM",
  "AVG",
  "MIN",
  "MAX",
  "DATE_FORMAT",
  "CONCAT",
  "YEAR",
  "MONTH",
  "DAY",
  "CURDATE",
  "NOW",
  "LOWER",
  "UPPER",
  "ROUND"
]);

export const POSTGRES_ALLOWED_FUNCTIONS = new Set([
  "COUNT",
  "SUM",
  "AVG",
  "MIN",
  "MAX",
  "DATE_TRUNC",
  "DATE_PART",
  "EXTRACT",
  "TO_CHAR",
  "NOW",
  "CONCAT",
  "LOWER",
  "UPPER",
  "ROUND",
  "COALESCE",
  "NULLIF",
  "ABS"
]);

export const AGGREGATE_FUNCTIONS = new Set([
  "COUNT",
  "SUM",
  "AVG",
  "MIN",
  "MAX"
]);

const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9_]/g, "");

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

export function validateAstCore(sql, options = {}) {
  if (!sql || typeof sql !== "string") {
    return { valid: false, reason: "ast_empty_input" };
  }

  const cleanSql = sql.trim().replace(/;+$/, "").trim();
  const dialect = (options.dialect || "sqlite").toLowerCase();
  const isPg = dialect === "postgres" || dialect === "postgresql";
  const parserDb = dialect === "mariadb" ? "mariadb" : (isPg ? "postgresql" : "sqlite");
  const allowedFunctions = options.allowedFunctions || (
    dialect === "mariadb" ? MARIADB_ALLOWED_FUNCTIONS : (isPg ? POSTGRES_ALLOWED_FUNCTIONS : DEFAULT_ALLOWED_FUNCTIONS)
  );

  // A2 Check for MariaDB: reject INTO OUTFILE and INTO DUMPFILE
  if (dialect === "mariadb" && /INTO\s+(OUTFILE|DUMPFILE)/i.test(cleanSql)) {
    return { valid: false, reason: "ast_disallowed_clause:into_outfile" };
  }

  // Check for Postgres: reject COPY TO/FROM PROGRAM
  if (isPg && /COPY\s+.*\s+(FROM|TO)\s+PROGRAM/i.test(cleanSql)) {
    return { valid: false, reason: "ast_disallowed_clause:copy_program" };
  }

  let ast;
  try {
    ast = parser.astify(cleanSql, { database: parserDb });
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
      if (!allowedFunctions.has(upper)) {
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

  // Collect CTE aliases
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
    let allQueryTables = [];
    try {
      const tableList = parser.tableList(cleanSql, { database: parserDb }) || [];
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

    let invalidCol = null;
    walkAst(stmt, (node) => {
      const colRef = extractColRef(node);
      if (!colRef) return;

      const colName = colRef.column;
      const tableName = colRef.table;
      if (colName === "*" || colName === "(EXTRACT_PARAM)") return;

      if (tableName) {
        if (derivedAliases.has(norm(tableName))) return;
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

  // 3. STRICT-MODE BARE-COLUMN / AGGREGATE / GROUP-BY RULE
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

  const columns = Array.isArray(stmt.columns) ? stmt.columns : [];
  const groupBy = Array.isArray(stmt.groupby?.columns) ? stmt.groupby.columns : [];

  let hasAggregate = false;
  const bareColumns = [];

  for (let i = 0; i < columns.length; i++) {
    const col = columns[i];
    let colHasAggr = false;
    walkAst(col.expr, (node) => {
      if (node.type === "aggr_func") colHasAggr = true;
    });

    if (colHasAggr) {
      hasAggregate = true;
    } else {
      const colRef = extractColRef(col.expr);
      if (colRef) {
        bareColumns.push({
          name: colRef.column,
          table: colRef.table,
          ordinal: i + 1,
          as: col.as || null
        });
      }
    }
  }

  if (hasAggregate && bareColumns.length > 0) {
    if (groupBy.length === 0) {
      return {
        valid: false,
        reason: `ast_bare_column_without_group_by:${bareColumns[0].name}`
      };
    }

    const groupedCols = new Set();
    for (const g of groupBy) {
      if (g.type === "number") {
        groupedCols.add(`ordinal:${g.value}`);
      } else {
        const gRef = extractColRef(g);
        if (gRef) {
          groupedCols.add(norm(gRef.column));
          if (gRef.table) groupedCols.add(`${norm(gRef.table)}.${norm(gRef.column)}`);
        }
      }
    }

    for (const bare of bareColumns) {
      const bareName = norm(bare.name);
      const isDirectlyGrouped =
        groupedCols.has(bareName) ||
        (bare.table && groupedCols.has(`${norm(bare.table)}.${bareName}`)) ||
        groupedCols.has(`ordinal:${bare.ordinal}`) ||
        (bare.as && groupedCols.has(norm(bare.as)));

      if (isDirectlyGrouped) continue;

      let isPkFdSatisfied = false;
      const targetTable = bare.table
        ? norm(bare.table)
        : fromTables.length === 1
        ? norm(fromTables[0].name)
        : null;

      if (targetTable && pkByTable.has(targetTable)) {
        const tablePks = pkByTable.get(targetTable);
        if (tablePks && tablePks.size > 0) {
          const allPksGrouped = [...tablePks].every((pk) => {
            return (
              groupedCols.has(pk) ||
              groupedCols.has(`${targetTable}.${pk}`)
            );
          });
          if (allPksGrouped) {
            isPkFdSatisfied = true;
          }
        }
      }

      if (!isPkFdSatisfied) {
        return {
          valid: false,
          reason: `ast_bare_column_without_group_by:${bare.name}`
        };
      }
    }
  }

  return { valid: true, sql: cleanSql };
}
