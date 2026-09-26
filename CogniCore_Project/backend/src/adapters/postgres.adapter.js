// ============================================================
// POSTGRESQL PROTOCOL ADAPTER
// Connects to PostgreSQL using pg.Pool as dedicated read-only role (cognicore_ro).
// Enforces session SET default_transaction_read_only = ON as defense-in-depth.
// Conforms to uniform deepFreeze contract:
// { connect(desc), queryReadOnly(sql, params), executeReadOnlySql(sql, params), close(), meta() }
// ============================================================

import pkg from 'pg';
const { Pool } = pkg;
import { deepFreeze } from './dialects/index.js';
import { resolveCredentials } from '../config/credentials.js';

function convertPlaceholders(sql) {
  if (!sql.includes("?")) return sql;
  let idx = 1;
  return sql.replace(/'[^']*'|\?/g, (match) => {
    if (match === "?") return `$${idx++}`;
    return match;
  });
}

function redactError(err) {
  if (!err) return err;
  const msg = String(err.message || err);
  const cleanMsg = msg
    .replace(/password[:=]\s*\S+/gi, 'password=***')
    .replace(/user[:=]\s*\S+/gi, 'user=***');
  const safeError = new Error(cleanMsg);
  safeError.code = err.code;
  safeError.severity = err.severity;
  safeError.detail = err.detail;
  return safeError;
}

export function createPostgresAdapter(config = {}) {
  let pool = null;
  let activeDescriptor = null;

  const adapter = {
    dialect: "postgres",

    async connect(sourceDescriptor = {}) {
      activeDescriptor = sourceDescriptor;

      const creds = sourceDescriptor.credentialRef
        ? resolveCredentials(sourceDescriptor.credentialRef)
        : {};

      const host = sourceDescriptor.host || creds.host || process.env.PGHOST || process.env.POSTGRES_HOST || '127.0.0.1';
      const port = Number(sourceDescriptor.port || creds.port || process.env.PGPORT || process.env.POSTGRES_PORT || 5432);
      const user = sourceDescriptor.user || creds.user || process.env.PGUSER || process.env.POSTGRES_USER || 'cognicore_ro';
      const password = sourceDescriptor.password || creds.password || process.env.PGPASSWORD || process.env.POSTGRES_PASSWORD || 'cognicore_ro_password';
      const database = sourceDescriptor.database || creds.database || process.env.PGDATABASE || process.env.POSTGRES_DB || 'cognicore_pg_test';

      if (pool) {
        await pool.end();
      }

      pool = new Pool({
        host,
        port,
        user,
        password,
        database,
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
        statement_timeout: 15000,
        options: "-c default_transaction_read_only=on",
        ...config
      });

      pool.on('error', (err) => {
        console.warn("⚠️ [Postgres Pool] Unexpected client error:", err.message);
      });

      // Quick health-check ping
      try {
        const client = await pool.connect();
        try {
          await client.query('SELECT 1 AS ping');
        } finally {
          client.release();
        }
      } catch (err) {
        throw redactError(err);
      }

      return pool;
    },

    async queryReadOnly(sql, params = []) {
      if (!pool) {
        await this.connect(activeDescriptor || {});
      }

      try {
        const pgSql = convertPlaceholders(sql);
        const res = await pool.query(pgSql, params);
        return res.rows;
      } catch (err) {
        throw redactError(err);
      }
    },

    async executeReadOnlySql(sql, params = []) {
      return await this.queryReadOnly(sql, params);
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
        connected: pool !== null,
        database: activeDescriptor?.database || "cognicore_pg_test"
      };
    }
  };

  return deepFreeze(adapter);
}

export const postgresAdapter = createPostgresAdapter();
