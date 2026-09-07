// ==========================================
// DISTINCT-VALUES CACHE (PHASE 3)
// Lazily queries and caches distinct TEXT values per table to drive value filters.
// Auto-invalidates on database switch via registerDatabaseSwitchHook.
// ==========================================

import { executeReadOnlySql, registerDatabaseSwitchHook } from "../config/database.js";
import { quoteIdentifier } from "./sql.builder.js";

// Cache in RAM: tableName -> Array<{ column: string, value: string }>
const distinctCache = new Map();

let cacheInitialized = false;

export function clearDistinctCache() {
  console.log("🧹 [Distinct Cache] Invalidated on DB switch.");
  distinctCache.clear();
  cacheInitialized = false;
}

// Invalidation hook: cleared at exact same point as schema cache on DB switch
if (typeof registerDatabaseSwitchHook === "function") {
  registerDatabaseSwitchHook(() => {
    clearDistinctCache();
  });
}

/**
 * Returns cached distinct values for a given table synchronously.
 *
 * @param {string} tableName
 * @returns {Array<{ column: string, value: string }>}
 */
export function getDistinct(tableName) {
  return distinctCache.get(tableName) || [];
}

/**
 * Lazily loads distinct TEXT values for all tables in the given schema.
 * Runs on read-only physical connection with LIMIT 15 per column.
 *
 * @param {object} schema - Enriched schema or raw schema map
 */
export async function ensureDistinctCacheLoaded(schema) {
  if (cacheInitialized && distinctCache.size > 0) {
    return;
  }

  if (!schema) return;

  const tables = Array.isArray(schema.tables)
    ? schema.tables
    : Object.entries(schema).map(([name, data]) => ({
        name,
        columns: data.columns || []
      }));

  for (const table of tables) {
    const tableName = table.name;
    const entries = [];

    // Filter text/string columns
    const textCols = (table.columns || []).filter((c) =>
      /char|text|clob|varchar|string/i.test(c.type || "") || (!c.type && c.type !== null)
    );

    for (const col of textCols) {
      try {
        const sql = `SELECT DISTINCT ${quoteIdentifier(col.name)} AS val FROM ${quoteIdentifier(
          tableName
        )} WHERE ${quoteIdentifier(col.name)} IS NOT NULL AND ${quoteIdentifier(
          col.name
        )} != '' LIMIT 15`;

        const rows = await executeReadOnlySql(sql);
        if (Array.isArray(rows)) {
          for (const r of rows) {
            if (r && r.val !== undefined && r.val !== null) {
              const strVal = String(r.val).trim();
              if (strVal.length > 0 && strVal.length < 100) {
                entries.push({ column: col.name, value: strVal });
              }
            }
          }
        }
      } catch (err) {
        // Soft fallback if column cannot be read
      }
    }

    distinctCache.set(tableName, entries);
  }

  cacheInitialized = true;
  console.log(`⚡ [Distinct Cache] Loaded distinct values for ${distinctCache.size} tables.`);
}
