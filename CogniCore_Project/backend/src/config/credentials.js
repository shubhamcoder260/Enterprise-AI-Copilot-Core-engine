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

    case "env:sqlite":
    case "sqlite":
      return {};

    default:
      return {};
  }
}
