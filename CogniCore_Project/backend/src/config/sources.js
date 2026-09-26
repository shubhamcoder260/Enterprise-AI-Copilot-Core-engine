// ============================================================
// SOURCE REGISTRY (LAYER 1)
// Catalog of available database and service sources.
// Invariant: Handlers NEVER import this file directly.
// Descriptors contain metadata and credential references, NEVER raw secrets.
// ============================================================

import { getActiveDatabasePath } from "./database.js";
import { resolveCredentials } from "./credentials.js";

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
  sourcesCatalog.set(postgresSource.id, postgresSource);
}

initCatalog();

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

export function registerSource(sourceDescriptor) {
  if (!sourceDescriptor || !sourceDescriptor.id) {
    throw new Error("Invalid source descriptor: missing id");
  }
  sourcesCatalog.set(sourceDescriptor.id, { ...sourceDescriptor });
  return { ...sourceDescriptor };
}

export function getHydratedSource(id) {
  const source = getSourceById(id);
  if (!source) return null;
  const creds = resolveCredentials(source.credentialRef);
  return {
    ...source,
    ...creds
  };
}
