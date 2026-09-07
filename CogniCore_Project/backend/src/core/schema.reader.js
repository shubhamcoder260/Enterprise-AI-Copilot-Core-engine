// ==========================================
// SCHEMA READER & ENRICHMENT LAYER (PHASE A)
// Generic metadata extraction from any SQLite file with drift detection and sample values
// ==========================================

import crypto from "crypto";
import { connectDatabase, registerDatabaseSwitchHook, getActiveDatabasePath } from "../config/database.js";

// In-memory schema cache: cacheKey -> { hash, schema, builtAt }
const schemaCache = new Map();

let cacheStats = {
  hits: 0,
  misses: 0,
  dbReads: 0,
  pragmaCalls: 0
};

export function clearSchemaCache() {
  console.log("🧹 Schema cache invalidated.");
  schemaCache.clear();
}

export function getSchemaCacheStats() {
  return { ...cacheStats };
}

export function resetSchemaCacheStats() {
  cacheStats = { hits: 0, misses: 0, dbReads: 0, pragmaCalls: 0 };
}

// Automatically clear cache whenever active database switches
if (typeof registerDatabaseSwitchHook === "function") {
  registerDatabaseSwitchHook(() => {
    clearSchemaCache();
  });
}

/**
 * Driver-agnostic query helper supporting async sqlite and sync/async better-sqlite3
 */
async function queryAll(db, sql, params = []) {
  if (typeof db.all === "function") {
    return await db.all(sql, params);
  }
  if (typeof db.prepare === "function") {
    const stmt = db.prepare(sql);
    return typeof stmt.all === "function" ? stmt.all(...params) : [];
  }
  throw new Error("Unsupported SQLite database driver");
}

async function queryGet(db, sql, params = []) {
  if (typeof db.get === "function") {
    return await db.get(sql, params);
  }
  if (typeof db.prepare === "function") {
    const stmt = db.prepare(sql);
    return typeof stmt.get === "function" ? stmt.get(...params) : null;
  }
  throw new Error("Unsupported SQLite database driver");
}

/**
 * Truncates a string to avoid prompt token explosion
 */
export function truncate(str, n = 60) {
  if (str === null || str === undefined) return "";
  const s = String(str);
  return s.length > n ? s.slice(0, n) + "…" : s;
}

/**
 * Computes deterministic MD5 hash of the database DDL from sqlite_master
 */
export async function computeSchemaHash(db) {
  const raw = await queryAll(
    db,
    `SELECT sql FROM sqlite_master WHERE sql IS NOT NULL ORDER BY name`
  );
  return crypto.createHash("md5").update(JSON.stringify(raw)).digest("hex");
}

/**
 * Pulls enriched generic schema metadata from any SQLite database file:
 * - Table row counts
 * - Column types, PKs, NOT NULL constraints
 * - Foreign key constraints
 * - Sample distinct values for text/categorical columns (bounded to maxSampleValues)
 * - Safe on large tables (>maxRowsToSample skips full scans)
 * - Auto-invalidates on schema drift (DDL hash changes)
 *
 * @param {object} [dbInstance] - Active SQLite database connection
 * @param {object} [options] - Configuration options
 * @returns {Promise<object>} Enriched schema map
 */
export async function getEnrichedSchema(dbInstance, options = {}) {
  const db = dbInstance || (await connectDatabase());
  const {
    maxSampleValues = 8,
    maxRowsToSample = 50000,
    forceRefresh = false,
    cacheKey = (typeof getActiveDatabasePath === "function" ? getActiveDatabasePath() : "default") || "default"
  } = options;

  // Schema drift check via DDL hash
  const currentHash = await computeSchemaHash(db);
  const cached = schemaCache.get(cacheKey);

  if (!forceRefresh && cached && cached.hash === currentHash) {
    cacheStats.hits++;
    console.log(
      `⚡ [SCHEMA CACHE HIT] Served from memory | Cache Hits: ${cacheStats.hits} | DB Reads: ${cacheStats.dbReads} | PRAGMA Calls: ${cacheStats.pragmaCalls}`
    );
    return cached.schema;
  }

  cacheStats.misses++;
  cacheStats.dbReads++;
  console.log(
    `🔍 [SCHEMA CACHE MISS] Enriching schema from SQLite | DB Reads: ${cacheStats.dbReads} | Misses: ${cacheStats.misses}`
  );

  const tables = await queryAll(
    db,
    `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name`
  );

  const schema = {};

  for (const tableRow of tables) {
    const table = tableRow.name;
    const escapedTable = table.replace(/"/g, '""');
    cacheStats.pragmaCalls++;

    const columns = await queryAll(db, `PRAGMA table_info("${escapedTable}")`);
    
    let fks = [];
    try {
      cacheStats.pragmaCalls++;
      const fkRows = await queryAll(db, `PRAGMA foreign_key_list("${escapedTable}")`);
      if (Array.isArray(fkRows)) {
        fks = fkRows.map((fk) => ({
          from: fk.from,
          toTable: fk.table,
          toColumn: fk.to
        }));
      }
    } catch {}

    // Guard: skip sampling on huge tables to avoid slow full scans
    let rowCount = 0;
    try {
      const rowCountRow = await queryGet(db, `SELECT COUNT(*) AS c FROM "${escapedTable}"`);
      rowCount = rowCountRow?.c ?? rowCountRow?.["COUNT(*)"] ?? 0;
    } catch {
      rowCount = 0;
    }

    const shouldSample = rowCount > 0 && rowCount <= maxRowsToSample;

    const enrichedColumns = [];
    for (const col of columns) {
      let sampleValues = null;
      // BLOB/binary guard: only sample string/text columns
      if (shouldSample && (/CHAR|TEXT|CLOB|VARCHAR/i.test(col.type) || (!col.type && col.type !== null))) {
        try {
          const escapedCol = col.name.replace(/"/g, '""');
          const rows = await queryAll(
            db,
            `SELECT DISTINCT "${escapedCol}" AS v FROM "${escapedTable}" WHERE "${escapedCol}" IS NOT NULL AND "${escapedCol}" != '' LIMIT ?`,
            [maxSampleValues]
          );
          if (Array.isArray(rows) && rows.length > 0) {
            sampleValues = rows
              .map((r) => truncate(String(r.v), 60))
              .filter((v) => v.length > 0);
          }
        } catch {
          // Column unreadable or special type, skip gracefully
        }
      }

      const sampleStatus = shouldSample
        ? (sampleValues && sampleValues.length > 0 ? "sampled" : "no_distinct_values")
        : (rowCount > maxRowsToSample ? "not_sampled_large_table" : "empty_table");

      enrichedColumns.push({
        name: col.name,
        type: col.type,
        pk: !!col.pk,
        primaryKey: col.pk >= 1,
        notNull: col.notnull === 1,
        sampleValues,
        sampleStatus
      });
    }

    const tableEntry = {
      columns: enrichedColumns,
      foreignKeys: fks,
      rowCount: rowCount,
      isSampled: shouldSample,
      samplingSkippedReason: rowCount > maxRowsToSample ? "table_too_large" : (rowCount === 0 ? "empty_table" : null)
    };

    schema[table] = tableEntry;
  }

  console.log(
    `📊 [Schema Enriched] Cached ${tables.length} table(s) with ${cacheStats.pragmaCalls} PRAGMA calls | Total DB Reads: ${cacheStats.dbReads}`
  );

  schemaCache.set(cacheKey, { hash: currentHash, schema, builtAt: Date.now() });
  return schema;
}

/**
 * Standard reader wrapper maintaining backward compatibility across core engine & tests
 */
export async function readDatabaseSchema(forceRefresh = false) {
  return await getEnrichedSchema(null, { forceRefresh });
}