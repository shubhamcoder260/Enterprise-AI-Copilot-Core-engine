import { connectDatabase, registerDatabaseSwitchHook } from "../config/database.js";

// ==========================================
// IN-MEMORY SCHEMA CACHE
// ==========================================
let schemaCache = null;

let cacheStats = {
  hits: 0,
  misses: 0,
  dbReads: 0,
  pragmaCalls: 0
};

export function clearSchemaCache() {
  console.log("🧹 Schema cache invalidated.");
  schemaCache = null;
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
 * Reads database schema with in-memory caching:
 * - Cache HIT: returns cached schema immediately without PRAGMA calls or terminal spam
 * - Cache MISS: queries sqlite_master & PRAGMA table_info, stores in cache, logs once
 */
export async function readDatabaseSchema(forceRefresh = false) {
  if (schemaCache && !forceRefresh) {
    cacheStats.hits++;
    console.log(
      `⚡ [SCHEMA CACHE HIT] Served from memory | Cache Hits: ${cacheStats.hits} | DB Reads: ${cacheStats.dbReads} | PRAGMA Calls: ${cacheStats.pragmaCalls}`
    );
    return schemaCache;
  }

  cacheStats.misses++;
  cacheStats.dbReads++;
  console.log(
    `🔍 [SCHEMA CACHE MISS] Reading schema from SQLite | DB Reads: ${cacheStats.dbReads} | Misses: ${cacheStats.misses}`
  );
  const db = await connectDatabase();

  const tables = await db.all(`
    SELECT name
    FROM sqlite_master
    WHERE type = 'table'
    AND name NOT LIKE 'sqlite_%'
    ORDER BY name
  `);

  const schema = {};

  for (const table of tables) {
    const tableName = table.name;
    cacheStats.pragmaCalls++;

    const columns = await db.all(
      `PRAGMA table_info("${tableName.replace(/"/g, '""')}")`
    );

    schema[tableName] = columns.map((column) => ({
      name: column.name,
      type: column.type,
      primaryKey: column.pk === 1,
      notNull: column.notnull === 1
    }));
  }

  console.log(
    `📊 [Schema Cache Loaded] Cached ${tables.length} table(s) with ${tables.length} PRAGMA calls | Total DB Reads: ${cacheStats.dbReads} | Total PRAGMAs: ${cacheStats.pragmaCalls}`
  );

  schemaCache = schema;
  return schemaCache;
}