// ==========================================
// POSTGRES SCHEMA READER (PHASE D3e)
// Generic metadata extraction from PostgreSQL information_schema.
// Preserves exact case identifiers, primary keys, and foreign keys.
// Returns IDENTICAL contract shape as SQLite/MariaDB schema readers.
// ==========================================

import crypto from "crypto";
import { postgresAdapter } from "../adapters/postgres.adapter.js";
import { truncate } from "./schema.reader.js";

const pgSchemaCache = new Map();

export function clearPostgresSchemaCache() {
  pgSchemaCache.clear();
}

/**
 * Extracts and enriches schema metadata from PostgreSQL information_schema.
 * Conforms 100% to the universal schema contract shape.
 *
 * @param {object} [adapterInstance] - Protocol adapter (defaults to postgresAdapter)
 * @param {object} [options] - Options { schemaName, maxSampleValues, maxRowsToSample, forceRefresh }
 * @returns {Promise<object>} Enriched schema map
 */
export async function getPostgresEnrichedSchema(adapterInstance = null, options = {}) {
  const adapter = adapterInstance || postgresAdapter;
  const schemaName = options.schemaName || "public";
  const { maxSampleValues = 8, maxRowsToSample = 10000, forceRefresh = false } = options;

  const cacheKey = `postgres:${schemaName}`;
  if (!forceRefresh && pgSchemaCache.has(cacheKey)) {
    return pgSchemaCache.get(cacheKey).schema;
  }

  // 1. Fetch tables
  const tableRows = await adapter.queryReadOnly(
    `SELECT table_name 
     FROM information_schema.tables 
     WHERE table_schema = ? AND table_type = 'BASE TABLE'
     ORDER BY table_name`,
    [schemaName]
  );

  // 2. Fetch columns
  const columnRows = await adapter.queryReadOnly(
    `SELECT table_name, column_name, data_type, is_nullable
     FROM information_schema.columns 
     WHERE table_schema = ? 
     ORDER BY table_name, ordinal_position`,
    [schemaName]
  );

  // 3. Fetch primary keys
  const pkRows = await adapter.queryReadOnly(
    `SELECT kcu.table_name, kcu.column_name
     FROM information_schema.table_constraints tc
     JOIN information_schema.key_column_usage kcu
       ON tc.constraint_name = kcu.constraint_name
       AND tc.table_schema = kcu.table_schema
     WHERE tc.constraint_type = 'PRIMARY KEY' AND tc.table_schema = ?`,
    [schemaName]
  );
  const pkSet = new Set(pkRows.map((r) => `${r.table_name}:${r.column_name}`));

  // 4. Fetch foreign keys
  const fkRows = await adapter.queryReadOnly(
    `SELECT 
       kcu.table_name, 
       kcu.column_name, 
       kcu_target.table_name AS referenced_table_name, 
       kcu_target.column_name AS referenced_column_name
     FROM information_schema.referential_constraints rc
     JOIN information_schema.key_column_usage kcu
       ON rc.constraint_name = kcu.constraint_name
       AND rc.constraint_schema = kcu.constraint_schema
     JOIN information_schema.key_column_usage kcu_target
       ON rc.unique_constraint_name = kcu_target.constraint_name
       AND rc.unique_constraint_schema = kcu_target.constraint_schema
     WHERE rc.constraint_schema = ?`,
    [schemaName]
  );

  // Group columns by table
  const colsByTable = new Map();
  for (const c of columnRows) {
    if (!colsByTable.has(c.table_name)) {
      colsByTable.set(c.table_name, []);
    }
    colsByTable.get(c.table_name).push(c);
  }

  // Group foreign keys by table
  const fksByTable = new Map();
  for (const fk of fkRows) {
    if (!fksByTable.has(fk.table_name)) {
      fksByTable.set(fk.table_name, []);
    }
    fksByTable.get(fk.table_name).push({
      id: fksByTable.get(fk.table_name).length,
      seq: 0,
      table: fk.referenced_table_name,
      toTable: fk.referenced_table_name,
      from: fk.column_name,
      to: fk.referenced_column_name,
      toColumn: fk.referenced_column_name,
      onUpdate: "NO ACTION",
      onDelete: "NO ACTION",
      match: "NONE"
    });
  }

  const schema = {};

  for (const t of tableRows) {
    const tableName = t.table_name;
    const rawCols = colsByTable.get(tableName) || [];
    const fks = fksByTable.get(tableName) || [];

    // Approximate or count rows
    let rowCount = 0;
    try {
      const countRes = await adapter.queryReadOnly(`SELECT COUNT(*) AS count FROM "${tableName}"`);
      rowCount = Number(countRes[0]?.count || 0);
    } catch {
      rowCount = 0;
    }

    const shouldSample = rowCount > 0 && rowCount <= maxRowsToSample;
    const enrichedColumns = [];

    for (const col of rawCols) {
      const colName = col.column_name;
      const isPk = pkSet.has(`${tableName}:${colName}`);
      const isText = /char|text|varchar/i.test(col.data_type);
      let sampleValues = null;

      if (shouldSample && isText && !isPk) {
        try {
          const rows = await adapter.queryReadOnly(
            `SELECT DISTINCT "${colName}" AS v 
             FROM "${tableName}" 
             WHERE "${colName}" IS NOT NULL 
             LIMIT ?`,
            [maxSampleValues]
          );
          if (Array.isArray(rows) && rows.length > 0) {
            sampleValues = rows
              .map((r) => truncate(String(r.v), 60))
              .filter((v) => v.length > 0);
          }
        } catch {
          // Skip column sample gracefully
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
        type: col.data_type.toUpperCase(),
        pk: isPk,
        primaryKey: isPk,
        notNull: col.is_nullable === "NO",
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
          : null
    };
  }

  const hash = crypto
    .createHash("md5")
    .update(JSON.stringify(Object.keys(schema).sort()))
    .digest("hex");

  pgSchemaCache.set(cacheKey, { hash, schema, builtAt: Date.now() });
  return schema;
}
