// ============================================================
// CAPABILITIES — the only seam for infra services.
// Handlers receive these as parameters; they never import
// drivers/clients directly. Second DB dialect or LLM backend
// = a second entry here, zero handler changes.
// ============================================================

import * as databaseModule from "../config/database.js";
import * as llmClientModule from "../llm/llm.client.js";

export const capabilities = {
  db: databaseModule,
  llm: llmClientModule
};
