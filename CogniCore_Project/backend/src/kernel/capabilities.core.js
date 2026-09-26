// ============================================================
// CAPABILITIES CORE — the dependency injection seam for infra services.
// Handlers receive these as parameters; they never import
// drivers/clients directly. Second DB dialect or LLM backend
// = a second entry here, zero handler changes.
// ============================================================

import * as databaseModule from "../config/database.js";
import * as llmClientModule from "../llm/llm.client.js";
import { mariadbAdapter } from "../adapters/mariadb.adapter.js";
import { postgresAdapter } from "../adapters/postgres.adapter.js";

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
    defaultDbAdapter = mariadbAdapter;
  } else if (dialect === "postgres" || dialect === "postgresql") {
    defaultDbAdapter = postgresAdapter;
  }

  return {
    db: customDbAdapter || defaultDbAdapter,
    llm: llmClientModule,
    source: descriptor || { id: "sqlite_default", dialect: "sqlite", kind: "sqlite" }
  };
}

export const capabilities = createDefaultCapabilities();
