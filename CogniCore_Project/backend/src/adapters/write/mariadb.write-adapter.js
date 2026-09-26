// ============================================================
// MARIADB WRITE ADAPTER (PHASE D5 ACTION GATEWAY)
// Connects strictly as cognicore_write user with INSERT/UPDATE privileges.
// Exposes ONLY executeWrite(template, params, dryRun).
// Accepts ZERO freeform SQL — strictly executes hand-authored templates.
// ============================================================

import mysql from "mysql2/promise";
import { deepFreeze } from "../dialects/index.js";
import { resolveCredentials } from "../../config/credentials.js";
import { renderTemplate } from "../../security/write.templates.js";

export function createMariaDbWriteAdapter(config = {}) {
  let pool = null;
  let activeDescriptor = null;

  function redactError(err) {
    if (!err) return err;
    const msg = String(err.message || err);
    const cleanMsg = msg
      .replace(/password[:=]\s*\S+/gi, "password=***")
      .replace(/user[:=]\s*\S+/gi, "user=***");
    const safeError = new Error(cleanMsg);
    safeError.code = err.code;
    return safeError;
  }

  const adapter = {
    dialect: "mariadb",
    role: "write",

    async connect(sourceDescriptor = {}) {
      activeDescriptor = sourceDescriptor;

      const credRef = sourceDescriptor.credentialRef || "env:erpnext_write";
      const creds = resolveCredentials(credRef);

      const host = sourceDescriptor.host || creds.host || process.env.ERPNEXT_WRITE_DB_HOST || "127.0.0.1";
      const port = Number(sourceDescriptor.port || creds.port || process.env.ERPNEXT_WRITE_DB_PORT || 3306);
      const user = sourceDescriptor.user || creds.user || process.env.ERPNEXT_WRITE_DB_USER || "cognicore_write";
      const password = sourceDescriptor.password || creds.password || process.env.ERPNEXT_WRITE_DB_PASSWORD || "cognicore_write_password";
      const database = sourceDescriptor.database || creds.database || process.env.ERPNEXT_WRITE_DB_NAME || "_4e5d6a7b8c9d0e1f";

      if (pool) {
        await pool.end();
      }

      pool = mysql.createPool({
        host,
        port,
        user,
        password,
        database,
        waitForConnections: true,
        connectionLimit: 5,
        queueLimit: 0,
        connectTimeout: 5000,
        ...config
      });

      return this;
    },

    async executeWrite(template, params = {}, dryRun = false) {
      if (!template || !template.id) {
        throw new Error("Invalid template passed to executeWrite: template object is required.");
      }

      const rendered = renderTemplate(template, params, "mariadb");

      if (dryRun) {
        return {
          dryRun: true,
          sql: rendered.sql,
          params: rendered.values,
          estimatedRows: rendered.estimatedRows || 1
        };
      }

      if (!pool) {
        await this.connect(activeDescriptor || {});
      }

      const startTime = Date.now();
      try {
        const [result] = await pool.execute(rendered.sql, rendered.values);
        const durationMs = Date.now() - startTime;

        return {
          dryRun: false,
          sql: rendered.sql,
          params: rendered.values,
          affectedRows: result?.affectedRows || 0,
          changedRows: result?.changedRows || 0,
          insertId: result?.insertId || null,
          durationMs
        };
      } catch (err) {
        throw redactError(err);
      }
    },

    async close() {
      if (pool) {
        await pool.end();
        pool = null;
      }
    },

    meta() {
      return {
        dialect: "mariadb",
        mode: "write",
        user: activeDescriptor?.user || "cognicore_write",
        connected: pool !== null
      };
    }
  };

  return deepFreeze(adapter);
}
