// ============================================================
// POSTGRESQL WRITE ADAPTER (PHASE D5 ACTION GATEWAY)
// Connects strictly as cognicore_write role with INSERT/UPDATE privileges.
// Exposes ONLY executeWrite(template, params, dryRun).
// Accepts ZERO freeform SQL — strictly executes hand-authored templates.
// ============================================================

import pg from "pg";
import { deepFreeze } from "../dialects/index.js";
import { resolveCredentials } from "../../config/credentials.js";
import { renderTemplate } from "../../security/write.templates.js";

const { Pool } = pg;

export function createPostgresWriteAdapter(config = {}) {
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
    dialect: "postgres",
    role: "write",

    async connect(sourceDescriptor = {}) {
      activeDescriptor = sourceDescriptor;

      const credRef = sourceDescriptor.credentialRef || "env:postgres_write";
      const creds = resolveCredentials(credRef);

      const host = sourceDescriptor.host || creds.host || process.env.PG_WRITE_HOST || "127.0.0.1";
      const port = Number(sourceDescriptor.port || creds.port || process.env.PG_WRITE_PORT || 5432);
      const user = sourceDescriptor.user || creds.user || process.env.PG_WRITE_USER || "cognicore_write";
      const password = sourceDescriptor.password || creds.password || process.env.PG_WRITE_PASSWORD || "cognicore_write_password";
      const database = sourceDescriptor.database || creds.database || process.env.PG_WRITE_DB || "cognicore_pg_test";

      if (pool) {
        await pool.end();
      }

      pool = new Pool({
        host,
        port,
        user,
        password,
        database,
        max: 5,
        connectionTimeoutMillis: 5000,
        ...config
      });

      return this;
    },

    async executeWrite(template, params = {}, dryRun = false) {
      if (!template || !template.id) {
        throw new Error("Invalid template passed to executeWrite: template object is required.");
      }

      const rendered = renderTemplate(template, params, "postgres");

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
        const result = await pool.query(rendered.sql, rendered.values);
        const durationMs = Date.now() - startTime;

        return {
          dryRun: false,
          sql: rendered.sql,
          params: rendered.values,
          affectedRows: result?.rowCount || 0,
          durationMs
        };
      } catch (err) {
        throw redactError(err);
      }
    },

    async proposeWrite(template, params = {}, dryRun = true) {
      return this.executeWrite(template, params, dryRun);
    },

    async executeApprovedWrite(template, params = {}) {
      return this.executeWrite(template, params, false);
    },

    async close() {
      if (pool) {
        await pool.end();
        pool = null;
      }
    },

    meta() {
      return {
        dialect: "postgres",
        mode: "write",
        user: activeDescriptor?.user || "cognicore_write",
        connected: pool !== null
      };
    }
  };

  return deepFreeze(adapter);
}
