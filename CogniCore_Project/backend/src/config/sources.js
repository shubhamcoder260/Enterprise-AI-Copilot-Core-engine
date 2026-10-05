// ============================================================
// SOURCE REGISTRY (LAYER 1)
// Catalog of available database and service sources.
// Invariant: Handlers NEVER import this file directly.
// Descriptors contain metadata and credential references, NEVER raw secrets.
// Thin in-memory cache populated from built-ins and source.store.js.
// ============================================================

import { getActiveDatabasePath } from "./database.js";
import { resolveCredentials } from "./credentials.js";
import { getAllSources, saveSource as persistSource, deleteSource as deletePersistedSource } from "../store/source.store.js";

const sourcesCatalog = new Map();

// Built-in initial sources
function initCatalog() {
  const sqlitePath = getActiveDatabasePath();
  const sqliteSource = {
    id: "sqlite_default",
    name: "SQLite (Local)",
    kind: "sqlite",
    dialect: "sqlite",
    credentialRef: "env:sqlite",
    profileRef: "sqlite",
    path: sqlitePath,
    status: "active"
  };

  const erpnextSource = {
    id: "erpnext_prod",
    name: "ERPNext v15 (MariaDB)",
    kind: "mariadb",
    dialect: "mariadb",
    credentialRef: "env:erpnext",
    profileRef: "erpnext",
    status: "available"
  };

  const erpnextV16Source = {
    id: "erpnext_v16",
    name: "ERPNext v16 (MariaDB 11.8)",
    kind: "mariadb",
    dialect: "mariadb",
    credentialRef: "env:erpnext16",
    profileRef: "erpnext",
    status: "available"
  };

  const postgresSource = {
    id: "postgres_default",
    name: "PostgreSQL (Enterprise)",
    kind: "postgres",
    dialect: "postgres",
    credentialRef: "env:postgres",
    profileRef: "postgres",
    status: "available"
  };

  sourcesCatalog.set(sqliteSource.id, sqliteSource);
  sourcesCatalog.set(erpnextSource.id, erpnextSource);
  sourcesCatalog.set(erpnextV16Source.id, erpnextV16Source);
  sourcesCatalog.set(postgresSource.id, postgresSource);
}

initCatalog();

export async function syncSourcesFromStore() {
  try {
    const persisted = await getAllSources();
    if (Array.isArray(persisted)) {
      for (const s of persisted) {
        if (s && s.id) {
          sourcesCatalog.set(s.id, { ...s });
        }
      }
    }
  } catch (err) {
    // Soft log during startup if store not initialized yet
    console.warn("ℹ️ [Source Registry] Store sync deferred:", err.message);
  }
}

// Auto-trigger sync on module initialization
syncSourcesFromStore().catch(() => {});

export function getRegisteredSources() {
  // Refresh sqlite path dynamically
  const sqlite = sourcesCatalog.get("sqlite_default");
  if (sqlite) {
    sqlite.path = getActiveDatabasePath();
  }
  return Array.from(sourcesCatalog.values()).map(s => ({ ...s }));
}

export function getSourceById(id) {
  const source = sourcesCatalog.get(id);
  if (!source) return null;
  return { ...source };
}

export async function registerSource(sourceDescriptor, options = {}) {
  if (!sourceDescriptor || !sourceDescriptor.id) {
    throw new Error("Invalid source descriptor: missing id");
  }
  sourcesCatalog.set(sourceDescriptor.id, { ...sourceDescriptor });
  if (options.persist !== false) {
    await persistSource(sourceDescriptor);
  }
  return { ...sourceDescriptor };
}

export async function removeSource(id) {
  if (!id) return false;
  // Built-in sources cannot be deleted
  const builtIns = new Set(["sqlite_default", "erpnext_prod", "erpnext_v16", "postgres_default"]);
  if (builtIns.has(id)) {
    throw new Error(`Cannot delete built-in source "${id}".`);
  }
  sourcesCatalog.delete(id);
  return await deletePersistedSource(id);
}

function getHydratedSource(id) {
  const source = getSourceById(id);
  if (!source) return null;
  const creds = resolveCredentials(source.credentialRef);
  return {
    ...source,
    ...creds
  };
}
