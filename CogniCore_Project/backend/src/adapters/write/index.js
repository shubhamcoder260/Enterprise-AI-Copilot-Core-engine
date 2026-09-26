// ============================================================
// WRITE ADAPTER FACTORY REGISTRY (PHASE D5 ACTION GATEWAY)
// Resolves write adapters strictly per dialect.
// ============================================================

import { createMariaDbWriteAdapter } from "./mariadb.write-adapter.js";
import { createPostgresWriteAdapter } from "./postgres.write-adapter.js";
import { createSqliteWriteAdapter } from "./sqlite.write-adapter.js";

const writeAdapters = new Map();

/**
 * Returns or instantiates a write adapter for the given dialect.
 *
 * @param {string} dialect - 'mariadb' | 'postgres' | 'sqlite'
 * @param {object} [config]
 * @returns {object} Write adapter instance
 */
export function getWriteAdapter(dialect = "mariadb", config = {}) {
  const d = String(dialect).toLowerCase();

  if (d === "mariadb" || d === "mysql") {
    if (!writeAdapters.has("mariadb")) {
      writeAdapters.set("mariadb", createMariaDbWriteAdapter(config));
    }
    return writeAdapters.get("mariadb");
  }

  if (d === "postgres" || d === "postgresql") {
    if (!writeAdapters.has("postgres")) {
      writeAdapters.set("postgres", createPostgresWriteAdapter(config));
    }
    return writeAdapters.get("postgres");
  }

  if (d === "sqlite" || d === "sqlite3") {
    if (!writeAdapters.has("sqlite")) {
      writeAdapters.set("sqlite", createSqliteWriteAdapter(config));
    }
    return writeAdapters.get("sqlite");
  }

  throw new Error(`Unsupported write dialect: '${dialect}'`);
}
