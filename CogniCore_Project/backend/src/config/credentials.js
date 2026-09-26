// ============================================================
// CREDENTIALS PROVIDER (LAYER 1)
// Resolves database and API secrets from process.env via credentialRef.
// Invariant: Secrets live ONLY in backend/.env; NEVER in descriptors or logs.
// ============================================================

import "dotenv/config";

export function resolveCredentials(credentialRef) {
  if (!credentialRef) return {};

  switch (credentialRef) {
    case "env:erpnext":
    case "erpnext":
      return {
        host: process.env.ERPNEXT_DB_HOST || "127.0.0.1",
        port: parseInt(process.env.ERPNEXT_DB_PORT || "3306", 10),
        user: process.env.ERPNEXT_DB_USER || "cognicore_ro",
        password: process.env.ERPNEXT_DB_PASSWORD || "cognicore_ro_password",
        database: process.env.ERPNEXT_DB_NAME || "_4e5d6a7b8c9d0e1f",
        apiKey: process.env.ERPNEXT_API_KEY || "",
        apiSecret: process.env.ERPNEXT_API_SECRET || ""
      };

    case "env:postgres":
    case "postgres":
      return {
        host: process.env.PGHOST || process.env.POSTGRES_HOST || "127.0.0.1",
        port: parseInt(process.env.PGPORT || process.env.POSTGRES_PORT || "5432", 10),
        user: process.env.PGUSER || process.env.POSTGRES_USER || "cognicore_ro",
        password: process.env.PGPASSWORD || process.env.POSTGRES_PASSWORD || "cognicore_ro_password",
        database: process.env.PGDATABASE || process.env.POSTGRES_DB || "cognicore_pg_test"
      };

    case "env:erpnext_write":
    case "erpnext_write":
      return {
        host: process.env.ERPNEXT_WRITE_DB_HOST || process.env.ERPNEXT_DB_HOST || "127.0.0.1",
        port: parseInt(process.env.ERPNEXT_WRITE_DB_PORT || process.env.ERPNEXT_DB_PORT || "3306", 10),
        user: process.env.ERPNEXT_WRITE_DB_USER || "cognicore_write",
        password: process.env.ERPNEXT_WRITE_DB_PASSWORD || "cognicore_write_password",
        database: process.env.ERPNEXT_WRITE_DB_NAME || process.env.ERPNEXT_DB_NAME || "_4e5d6a7b8c9d0e1f"
      };

    case "env:postgres_write":
    case "postgres_write":
      return {
        host: process.env.PG_WRITE_HOST || process.env.PGHOST || "127.0.0.1",
        port: parseInt(process.env.PG_WRITE_PORT || process.env.PGPORT || "5432", 10),
        user: process.env.PG_WRITE_USER || "cognicore_write",
        password: process.env.PG_WRITE_PASSWORD || "cognicore_write_password",
        database: process.env.PG_WRITE_DB || process.env.PGDATABASE || "cognicore_pg_test"
      };

    case "env:sqlite":
    case "sqlite":
      return {};

    default:
      return {};
  }
}
