// ==========================================
// AST GATE (SECURITY & STRUCTURAL CONTRACT GATE)
// Tier-2 Re-pin #3: Extracted to ast.gate.core.js
// Backward-compatible shim for SQLite callers.
// ==========================================

import { validateAstCore, DEFAULT_ALLOWED_FUNCTIONS, AGGREGATE_FUNCTIONS } from "./ast.gate.core.js";

export const ALLOWED_FUNCTIONS = DEFAULT_ALLOWED_FUNCTIONS;
export { AGGREGATE_FUNCTIONS };

export function validateAst(sql, options = {}) {
  return validateAstCore(sql, { ...options, dialect: "sqlite" });
}

export const astGate = validateAst;
