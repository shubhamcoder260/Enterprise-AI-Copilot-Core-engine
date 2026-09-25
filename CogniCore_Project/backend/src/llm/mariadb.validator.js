// ==========================================
// MARIADB VALIDATOR (SIBLING VALIDATOR)
// Slot 1 in MariaDB GATE_CHAIN.
// Rejects DDL/DML, system schema calls, and file operations.
// ==========================================

export function validateMariaDbSql(sql, options = {}) {
  if (!sql || typeof sql !== "string") {
    return { valid: false, reason: "validator_empty_input" };
  }

  const cleanSql = sql.trim().replace(/;+$/, "").trim();

  // 1. Must be SELECT statement
  if (!/^\s*SELECT\b/i.test(cleanSql) && !/^\s*WITH\b/i.test(cleanSql)) {
    return { valid: false, reason: "validator_not_select" };
  }

  // 2. Reject DDL / DML / System calls
  const forbiddenPatterns = [
    /\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE|REPLACE)\b/i,
    /\b(GRANT|REVOKE|FLUSH|SHOW|DESCRIBE|EXPLAIN)\b/i,
    /\bINTO\s+(OUTFILE|DUMPFILE)\b/i,
    /\bLOAD_FILE\b/i,
    /\bBENCHMARK\s*\(/i,
    /\bSLEEP\s*\(/i,
    /\bINFORMATION_SCHEMA\b/i,
    /\bMYSQL\./i,
    /\bPERFORMANCE_SCHEMA\b/i
  ];

  for (const pattern of forbiddenPatterns) {
    if (pattern.test(cleanSql)) {
      return { valid: false, reason: `validator_forbidden_pattern:${pattern.source}` };
    }
  }

  return { valid: true, sql: cleanSql };
}

export const mariadbValidator = {
  name: "validator",
  type: "validate",
  dialect: "mariadb",
  run: (sql, options = {}) => validateMariaDbSql(sql, options)
};
