// ============================================================
// CAPABILITIES CORE — the dependency injection seam for infra services.
// Handlers receive these as parameters; they never import
// drivers/clients directly. Second DB dialect or LLM backend
// = a second entry here, zero handler changes.
// ============================================================

import * as databaseModule from "../config/database.js";
import * as llmClientModule from "../llm/llm.client.js";
import { mariadbAdapter, createMariaDbAdapter } from "../adapters/mariadb.adapter.js";
import { postgresAdapter, createPostgresAdapter } from "../adapters/postgres.adapter.js";

const sourceAdapters = new Map();

function getAdapterForSource(descriptor) {
  if (!descriptor || !descriptor.id) return null;
  const key = `${descriptor.dialect}:${descriptor.id}`;
  if (!sourceAdapters.has(key)) {
    if (descriptor.dialect === "mariadb") {
      sourceAdapters.set(key, createMariaDbAdapter({ sourceDescriptor: descriptor }));
    } else if (descriptor.dialect === "postgres" || descriptor.dialect === "postgresql") {
      sourceAdapters.set(key, createPostgresAdapter({ sourceDescriptor: descriptor }));
    }
  }
  return sourceAdapters.get(key);
}

export function createDefaultCapabilities() {
  return {
    db: databaseModule,
    llm: llmClientModule,
    source: { id: "sqlite_default", dialect: "sqlite", kind: "sqlite" }
  };
}

export function createCapabilitiesForSource(descriptor, customDbAdapter = null) {
  const dialect = descriptor?.dialect ? descriptor.dialect.toLowerCase() : "sqlite";

  let defaultDbAdapter = databaseModule;
  if (dialect === "mariadb") {
    defaultDbAdapter = (descriptor && descriptor.id !== "erpnext_prod") ? (getAdapterForSource(descriptor) || mariadbAdapter) : mariadbAdapter;
  } else if (dialect === "postgres" || dialect === "postgresql") {
    defaultDbAdapter = (descriptor && descriptor.id !== "postgres_default") ? (getAdapterForSource(descriptor) || postgresAdapter) : postgresAdapter;
  }

  return {
    db: customDbAdapter || defaultDbAdapter,
    llm: llmClientModule,
    source: descriptor || { id: "sqlite_default", dialect: "sqlite", kind: "sqlite" }
  };
}

export const capabilities = createDefaultCapabilities();
