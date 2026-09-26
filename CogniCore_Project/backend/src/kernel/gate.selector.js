// ============================================================
// GATE SELECTOR — Dynamic Dialect Security Gate Selector
// Selects security gate chain by inspecting source descriptor dialect.
// Invariant: Strictly FAILS CLOSED on unknown/malformed dialects.
// Legacy default: gateChainFor(undefined) === GATE_CHAIN by identity.
// ============================================================

import { GATE_CHAIN } from "./gate.chain.js";
import { mariadbValidator } from "../llm/mariadb.validator.js";
import { astGateMariadb } from "./ast.gate.mariadb.js";
import { mariadbAdapter } from "../adapters/mariadb.adapter.js";
import { postgresValidator } from "../llm/postgres.validator.js";
import { astGatePostgres } from "./ast.gate.postgres.js";
import { postgresAdapter } from "../adapters/postgres.adapter.js";
import { deepFreeze } from "../adapters/dialects/index.js";

export const readonlyExecutorMariaDB = {
  name: "readonly-executor",
  type: "execute",
  run: async (sql, options = {}) => {
    // Per A5 Binding Hazard: dynamically resolve adapter from options.capabilities or active adapter
    const adapter = options?.capabilities?.db || mariadbAdapter;
    return await adapter.executeReadOnlySql(sql, options?.params || []);
  }
};

export const readonlyExecutorPostgres = {
  name: "readonly-executor",
  type: "execute",
  run: async (sql, options = {}) => {
    const adapter = options?.capabilities?.db || postgresAdapter;
    return await adapter.executeReadOnlySql(sql, options?.params || []);
  }
};

export const GATE_CHAINS = deepFreeze({
  sqlite: GATE_CHAIN, // Identity equality: === GATE_CHAIN
  mariadb: [mariadbValidator, astGateMariadb, readonlyExecutorMariaDB],
  postgres: [postgresValidator, astGatePostgres, readonlyExecutorPostgres],
  postgresql: [postgresValidator, astGatePostgres, readonlyExecutorPostgres]
});

/**
 * Resolves the gate chain for a given source descriptor.
 *
 * @param {object|undefined|null} sourceDescriptor - { dialect, ... }
 * @returns {Array} Security gate chain
 * @throws {Error} If dialect is missing, malformed, or unrecognized (fail-closed)
 */
export function gateChainFor(sourceDescriptor) {
  // Legacy non-parameterized calls default to SQLite (preserving CE-07 golden equivalence)
  if (sourceDescriptor === undefined || sourceDescriptor === null) {
    return GATE_CHAINS.sqlite;
  }

  const dialect = sourceDescriptor.dialect;
  if (!dialect || typeof dialect !== "string") {
    throw new Error("[Security Gate] Invalid source descriptor: missing or malformed dialect");
  }

  const chain = GATE_CHAINS[dialect.toLowerCase()];
  if (!chain) {
    // Fail-closed: Never fall back to SQLite when an external dialect fails to match
    throw new Error(`[Security Gate] Unsupported dialect: "${dialect}". Refusing execution (fail-closed)`);
  }

  return chain;
}
