// ==========================================
// AST GATE (POSTGRESQL SIBLING GATE)
// Specialized AST gate for PostgreSQL.
// Enforces double-quote identifier grammar, Postgres function whitelist,
// and blocks COPY PROGRAM, large objects (lo_*), server file access, and dblink.
// ==========================================

import { validateAstCore, POSTGRES_ALLOWED_FUNCTIONS } from "./ast.gate.core.js";

export function validatePostgresAst(sql, options = {}) {
  if (!sql || typeof sql !== "string") {
    return { valid: false, reason: "ast_empty_input" };
  }

  const cleanSql = sql.trim().replace(/;+$/, "").trim();

  // Multi-statement injection check
  if (/;\s*\S+/.test(cleanSql)) {
    return { valid: false, reason: "ast_multiple_statements_disallowed" };
  }

  // Pre-screen dangerous statement types before parser
  if (/^\s*(copy|insert|update|delete|drop|alter|create|truncate|grant|revoke)\b/i.test(cleanSql)) {
    if (/^\s*copy\b/i.test(cleanSql)) {
      if (/copy\s+.*\s+(to|from)\s+program/i.test(cleanSql)) {
        return { valid: false, reason: "ast_disallowed_clause:copy_program" };
      }
      return { valid: false, reason: "ast_disallowed_statement_type:copy" };
    }
    return { valid: false, reason: "ast_disallowed_statement_type" };
  }

  // Pre-screen Postgres dangerous vectors (User Finding 2)
  if (/copy\s+.*\s+(to|from)\s+program/i.test(cleanSql)) {
    return { valid: false, reason: "ast_disallowed_clause:copy_program" };
  }
  if (/\b(lo_import|lo_export|lo_create|lo_unlink)\b/i.test(cleanSql)) {
    return { valid: false, reason: "ast_disallowed_function:large_object" };
  }
  if (/\b(pg_read_file|pg_read_binary_file|pg_write_file)\b/i.test(cleanSql)) {
    return { valid: false, reason: "ast_disallowed_function:server_file_access" };
  }
  if (/\b(dblink|dblink_exec|postgres_fdw)\b/i.test(cleanSql)) {
    return { valid: false, reason: "ast_disallowed_function:cross_database_link" };
  }

  return validateAstCore(cleanSql, {
    ...options,
    dialect: "postgres",
    allowedFunctions: POSTGRES_ALLOWED_FUNCTIONS
  });
}

export const astGatePostgres = {
  name: "ast",
  type: "validate",
  dialect: "postgres",
  run: (sql, options = {}) => validatePostgresAst(sql, options)
};
