// ==========================================
// RESULT SANITY (PHASE A3 - MECHANISM 2)
// Guards against nonsensical aggregates on boolean-shaped columns (S9).
// Checks scalar SUM/AVG results against column type & distinct values {0, 1}.
// COUNT is strictly exempt.
// ==========================================

import { quoteIdentifier } from "./sql.builder.js";

// In-memory cache for boolean-shaped columns: "table.column" -> boolean
const booleanColCache = new Map();

/**
 * Checks whether a column is boolean-shaped (distinct values are {0, 1} or type is boolean).
 */
async function isColumnBooleanShaped(tableName, colName, schema, db) {
  const cacheKey = `${tableName || ""}.${colName}`.toLowerCase();
  if (booleanColCache.has(cacheKey)) {
    return booleanColCache.get(cacheKey);
  }

  // 1. Schema type check
  const schemaTables = Array.isArray(schema?.tables)
    ? schema.tables
    : typeof schema === "object" && schema !== null
    ? Object.entries(schema).map(([name, def]) => ({ name, ...def }))
    : [];

  const norm = (s) => (s ? String(s).toLowerCase().replace(/[`"\[\]]/g, "").trim() : "");
  const normCol = norm(colName);
  const normTbl = norm(tableName);

  let matchedColDef = null;
  for (const st of schemaTables) {
    if (!normTbl || norm(st.name) === normTbl) {
      const c = (st.columns || []).find((col) => norm(col.name || col) === normCol);
      if (c) {
        matchedColDef = c;
        if (!tableName) tableName = st.name;
        break;
      }
    }
  }

  if (matchedColDef && typeof matchedColDef === "object") {
    const typeStr = String(matchedColDef.type || "").toUpperCase();
    if (/BOOL|BOOLEAN|BIT|TINYINT\(1\)/i.test(typeStr)) {
      booleanColCache.set(cacheKey, true);
      return true;
    }
    // Check if sampleValues has only 0 and 1
    if (Array.isArray(matchedColDef.sampleValues) && matchedColDef.sampleValues.length > 0) {
      const samples = matchedColDef.sampleValues.map((v) => String(v).toLowerCase().trim());
      const isBoolSamples = samples.every((v) => ["0", "1", "true", "false"].includes(v));
      if (isBoolSamples && samples.length <= 2) {
        booleanColCache.set(cacheKey, true);
        return true;
      }
    }
  }

  // 2. Query distinct values from db if available and table is known
  if (db && tableName && typeof db.executeReadOnlySql === "function") {
    try {
      const qTable = quoteIdentifier(tableName);
      const qCol = quoteIdentifier(colName);
      const sql = `SELECT DISTINCT ${qCol} AS val FROM ${qTable} WHERE ${qCol} IS NOT NULL LIMIT 5`;
      const rows = await db.executeReadOnlySql(sql);
      if (Array.isArray(rows) && rows.length > 0 && rows.length <= 2) {
        const values = rows.map((r) => r.val);
        const isBinary = values.every(
          (v) => v === 0 || v === 1 || v === true || v === false || v === "0" || v === "1"
        );
        if (isBinary) {
          booleanColCache.set(cacheKey, true);
          return true;
        }
      }
    } catch {
      // Soft ignore query failure
    }
  }

  booleanColCache.set(cacheKey, false);
  return false;
}

/**
 * Validates that scalar SUM/AVG operations are not running on boolean flags.
 *
 * @param {object} params
 * @param {string} params.sql - Executed SQL
 * @param {Array} params.rows - Executed rows
 * @param {string} params.query - User natural language query
 * @param {object} params.schema - Enriched or raw database schema
 * @param {object} params.db - Database capability
 * @returns {Promise<{ valid: boolean, reason?: string }>}
 */
export async function checkResultSanity({ sql, rows, query, schema, db }) {
  if (!sql || !Array.isArray(rows)) {
    return { valid: true };
  }

  // Only check scalar results (single row, single value/metric)
  const isScalar = rows.length === 1 && Object.keys(rows[0]).length === 1;
  if (!isScalar) {
    return { valid: true };
  }

  // Extract SUM or AVG function and target column (COUNT is strictly exempt)
  const aggMatch = sql.match(
    /\b(SUM|AVG)\s*\(\s*(?:DISTINCT\s+)?(?:[`"\[]?([a-zA-Z0-9_]+)[`"\]]?\.)?[`"\[]?([a-zA-Z0-9_]+)[`"\]]?\s*\)/i
  );

  if (!aggMatch) {
    return { valid: true };
  }

  const [, fnName, rawTable, rawCol] = aggMatch;
  if (!rawCol || rawCol === "*") {
    return { valid: true };
  }

  const norm = (s) => (s ? String(s).toLowerCase().replace(/[`"\[\]]/g, "").trim() : "");
  const colName = rawCol;
  const tableName = rawTable || null;
  const colNorm = norm(colName);

  // Check if question explicitly names that column — never over-decline literal queries (e.g. "sum of is_vip")
  const qLower = (query || "").toLowerCase();
  const colTokens = colNorm.split("_").filter((t) => t.length > 0);
  const namesExplicitly =
    qLower.includes(colNorm) ||
    qLower.includes(colNorm.replace(/_/g, " ")) ||
    (colTokens.length > 1 && colTokens.every((t) => qLower.includes(t)));

  if (namesExplicitly) {
    return { valid: true };
  }

  // Check if target column is boolean-shaped
  const isBool = await isColumnBooleanShaped(tableName, colName, schema, db);
  if (isBool) {
    return {
      valid: false,
      reason: `boolean_aggregate_suspicion:${colName}`
    };
  }

  return { valid: true };
}
