// ==========================================
// MARIADB SCHEMA READER (PHASE D0d)
// Generic metadata extraction from MariaDB information_schema
// Preserves verbatim identifiers (tabSales Invoice), docstatus flags, and foreign keys.
// Returns IDENTICAL contract shape as SQLite schema reader.
// ==========================================

import crypto from "crypto";
import { mariadbAdapter } from "../adapters/mariadb.adapter.js";
import { truncate } from "./schema.reader.js";

const mariaSchemaCache = new Map();

export function clearMariaDbSchemaCache() {
  mariaSchemaCache.clear();
}

/**
 * Extracts and enriches schema metadata from MariaDB information_schema.
 * Conforms 100% to the universal schema contract shape.
 *
 * @param {object} [adapterInstance] - Protocol adapter (defaults to mariadbAdapter)
 * @param {object} [options] - Options { database, maxSampleValues, maxRowsToSample, forceRefresh }
 * @returns {Promise<object>} Enriched schema map
 */
export async function getMariaDbEnrichedSchema(adapterInstance = null, options = {}) {
  const adapter = adapterInstance || mariadbAdapter;
  const database = options.database || process.env.ERPNEXT_DB_NAME || "_4e5d6a7b8c9d0e1f";
  const { maxSampleValues = 8, maxRowsToSample = 10000, forceRefresh = false } = options;

  const cacheKey = `mariadb:${database}`;
  if (!forceRefresh && mariaSchemaCache.has(cacheKey)) {
    return mariaSchemaCache.get(cacheKey).schema;
  }

  // 1. Fetch tables
  const tableRows = await adapter.queryReadOnly(
    `SELECT TABLE_NAME, TABLE_ROWS 
     FROM information_schema.TABLES 
     WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE'
     ORDER BY TABLE_NAME`,
    [database]
  );

  // 2. Fetch columns
  const columnRows = await adapter.queryReadOnly(
    `SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE, COLUMN_KEY, IS_NULLABLE
     FROM information_schema.COLUMNS 
     WHERE TABLE_SCHEMA = ? 
     ORDER BY TABLE_NAME, ORDINAL_POSITION`,
    [database]
  );

  // 3. Fetch foreign keys
  const fkRows = await adapter.queryReadOnly(
    `SELECT TABLE_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
     FROM information_schema.KEY_COLUMN_USAGE 
     WHERE TABLE_SCHEMA = ? AND REFERENCED_TABLE_NAME IS NOT NULL`,
    [database]
  );

  // Group columns by table
  const colsByTable = new Map();
  for (const c of columnRows) {
    if (!colsByTable.has(c.TABLE_NAME)) {
      colsByTable.set(c.TABLE_NAME, []);
    }
    colsByTable.get(c.TABLE_NAME).push(c);
  }

  // Group foreign keys by table
  const fksByTable = new Map();
  for (const fk of fkRows) {
    if (!fksByTable.has(fk.TABLE_NAME)) {
      fksByTable.set(fk.TABLE_NAME, []);
    }
    fksByTable.get(fk.TABLE_NAME).push({
      id: fksByTable.get(fk.TABLE_NAME).length,
      seq: 0,
      table: fk.REFERENCED_TABLE_NAME,
      toTable: fk.REFERENCED_TABLE_NAME,
      from: fk.COLUMN_NAME,
      to: fk.REFERENCED_COLUMN_NAME,
      toColumn: fk.REFERENCED_COLUMN_NAME,
      onUpdate: "NO ACTION",
      onDelete: "NO ACTION",
      match: "NONE"
    });
  }

  const schema = {};

  for (const t of tableRows) {
    const tableName = t.TABLE_NAME; // Verbatim preservation of table name
    const rowCount = Number(t.TABLE_ROWS || 0);
    const rawCols = colsByTable.get(tableName) || [];
    const fks = fksByTable.get(tableName) || [];
    const shouldSample = rowCount > 0 && rowCount <= maxRowsToSample;

    const enrichedColumns = [];
    let hasDocstatus = false;

    for (const col of rawCols) {
      const colName = col.COLUMN_NAME;
      if (colName === "docstatus") hasDocstatus = true;

      const isText = /char|text|enum|set/i.test(col.DATA_TYPE);
      const isPk = col.COLUMN_KEY === "PRI";
      let sampleValues = null;

      if (shouldSample && isText && !isPk) {
        try {
          const rows = await adapter.queryReadOnly(
            `SELECT DISTINCT \`${colName}\` AS v 
             FROM \`${tableName}\` 
             WHERE \`${colName}\` IS NOT NULL AND \`${colName}\` != '' 
             LIMIT ?`,
            [maxSampleValues]
          );
          if (Array.isArray(rows) && rows.length > 0) {
            sampleValues = rows
              .map((r) => truncate(String(r.v), 60))
              .filter((v) => v.length > 0);
          }
        } catch {
          // Skip column gracefully if unreadable
        }
      }

      const sampleStatus = shouldSample
        ? sampleValues && sampleValues.length > 0
          ? "sampled"
          : "no_distinct_values"
        : rowCount > maxRowsToSample
        ? "not_sampled_large_table"
        : "empty_table";

      enrichedColumns.push({
        name: colName,
        type: col.DATA_TYPE.toUpperCase(),
        pk: isPk,
        primaryKey: isPk,
        notNull: col.IS_NULLABLE === "NO",
        sampleValues,
        sampleStatus
      });
    }

    schema[tableName] = {
      columns: enrichedColumns,
      foreignKeys: fks,
      rowCount,
      isSampled: shouldSample,
      samplingSkippedReason:
        rowCount > maxRowsToSample
          ? "table_too_large"
          : rowCount === 0
          ? "empty_table"
          : null,
      isDocType: tableName.startsWith("tab"),
      hasDocstatus
    };
  }

  const hash = crypto
    .createHash("md5")
    .update(JSON.stringify(Object.keys(schema).sort()))
    .digest("hex");

  mariaSchemaCache.set(cacheKey, { hash, schema, builtAt: Date.now() });
  return schema;
}
