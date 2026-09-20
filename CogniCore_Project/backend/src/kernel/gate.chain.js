// ============================================================
// GATE CHAIN — additive-only. Order is LAW: validation BEFORE
// execution, always. Position 1 = frozen validator (never edited).
// Reserved slot = AST gate (add-on #2). Last = read-only execution.
// ============================================================

import { validateAndSanitizeSql } from "../llm/sql.validator.js";
import { astGate } from "./ast.gate.js";
import { executeReadOnlySql } from "../config/database.js";

export const GATE_CHAIN = [
  { name: "validator", type: "validate", run: validateAndSanitizeSql },
  { name: "ast", type: "validate", run: astGate },
  { name: "readonly-executor", type: "execute", run: executeReadOnlySql }
];
