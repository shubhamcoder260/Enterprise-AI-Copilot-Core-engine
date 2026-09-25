// ==========================================
// AST GATE (MARIADB SIBLING GATE)
// Specialized AST gate for MariaDB / MySQL.
// Enforces backtick grammar, MariaDB functions, and INTO OUTFILE/DUMPFILE rejection.
// ==========================================

import { validateAstCore, MARIADB_ALLOWED_FUNCTIONS } from "./ast.gate.core.js";

export function validateMariaDbAst(sql, options = {}) {
  return validateAstCore(sql, {
    ...options,
    dialect: "mariadb",
    allowedFunctions: MARIADB_ALLOWED_FUNCTIONS
  });
}

export const astGateMariadb = {
  name: "ast",
  type: "validate",
  dialect: "mariadb",
  run: (sql, options = {}) => validateMariaDbAst(sql, options)
};
