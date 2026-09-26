// ==========================================
// POSTGRES VALIDATOR (SIBLING VALIDATOR)
// Slot 1 in PostgreSQL GATE_CHAIN.
// Rejects DDL/DML, dangerous Postgres functions, file ops, and system catalogs.
// ==========================================

export function validatePostgresSql(sql, options = {}) {
  if (!sql || typeof sql !== "string") {
    return { valid: false, reason: "validator_empty_input" };
  }

  const cleanSql = sql.trim().replace(/;+$/, "").trim();

  // 1. Must be SELECT or WITH statement
  if (!/^\s*SELECT\b/i.test(cleanSql) && !/^\s*WITH\b/i.test(cleanSql)) {
    return { valid: false, reason: "validator_not_select" };
  }

  // 2. Reject DDL / DML / Admin statements
  const forbiddenKeywords = [
    /\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE|REPLACE)\b/i,
    /\b(GRANT|REVOKE|VACUUM|ANALYZE|REINDEX|CLUSTER)\b/i,
    /\bCOPY\b/i
  ];

  for (const pattern of forbiddenKeywords) {
    if (pattern.test(cleanSql)) {
      return { valid: false, reason: `validator_forbidden_statement:${pattern.source}` };
    }
  }

  // 3. Reject Postgres-specific dangerous vectors (User Finding 2)
  const dangerousVectors = [
    { pattern: /\b(lo_import|lo_export|lo_create|lo_unlink)\b/i, reason: "validator_forbidden_function:large_object" },
    { pattern: /\b(pg_read_file|pg_read_binary_file|pg_write_file)\b/i, reason: "validator_forbidden_function:server_file_access" },
    { pattern: /\b(dblink|dblink_exec|postgres_fdw)\b/i, reason: "validator_forbidden_function:cross_database_link" },
    { pattern: /\bpg_sleep\b/i, reason: "validator_forbidden_function:pg_sleep" },
    { pattern: /\b(information_schema|pg_catalog)\b/i, reason: "validator_forbidden_catalog_access" }
  ];

  for (const { pattern, reason } of dangerousVectors) {
    if (pattern.test(cleanSql)) {
      return { valid: false, reason };
    }
  }

  return { valid: true, sql: cleanSql };
}

export const postgresValidator = {
  name: "validator",
  type: "validate",
  dialect: "postgres",
  run: (sql, options = {}) => validatePostgresSql(sql, options)
};
