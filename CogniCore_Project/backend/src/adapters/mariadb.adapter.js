// ============================================================
// MARIADB PROTOCOL ADAPTER
// Connects to MariaDB using mysql2/promise as read-only user.
// Enforces pool-level ANSI_QUOTES lifecycle hook on every connection.
// Conforms to uniform deepFreeze contract:
// { connect(desc), queryReadOnly(sql, params), executeReadOnlySql(sql, params), close(), meta() }
// ============================================================

import mysql from 'mysql2/promise';
import { deepFreeze } from './dialects/index.js';
import { resolveCredentials } from '../config/credentials.js';

export function createMariaDbAdapter(config = {}) {
  let pool = null;
  let activeDescriptor = null;

  function redactError(err) {
    if (!err) return err;
    const msg = String(err.message || err);
    // Redact password or user credentials if present
    const cleanMsg = msg
      .replace(/password[:=]\s*\S+/gi, 'password=***')
      .replace(/user[:=]\s*\S+/gi, 'user=***');
    const safeError = new Error(cleanMsg);
    safeError.code = err.code;
    return safeError;
  }

  const adapter = {
    dialect: "mariadb",

    async connect(sourceDescriptor = {}) {
      activeDescriptor = sourceDescriptor;

      const creds = sourceDescriptor.credentialRef
        ? resolveCredentials(sourceDescriptor.credentialRef)
        : {};

      const host = sourceDescriptor.host || creds.host || process.env.ERPNEXT_DB_HOST || '127.0.0.1';
      const port = Number(sourceDescriptor.port || creds.port || process.env.ERPNEXT_DB_PORT || 3306);
      const user = sourceDescriptor.user || creds.user || process.env.ERPNEXT_DB_USER || 'cognicore_ro';
      const password = sourceDescriptor.password || creds.password || process.env.ERPNEXT_DB_PASSWORD || 'cognicore_ro_password';
      const database = sourceDescriptor.database || creds.database || process.env.ERPNEXT_DB_NAME || '_4e5d6a7b8c9d0e1f';

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
        connectionLimit: 10,
        queueLimit: 0,
        connectTimeout: 5000,
        decimalNumbers: true,
        ...config
      });

      pool.on('error', (err) => {
        console.warn("⚠️ [MariaDB Pool] Connection pool error:", err.message);
      });

      // INVARIANT A1: Pool-wide lifecycle hook setting ANSI_QUOTES on EVERY physical connection
      pool.on('connection', (connection) => {
        connection.query("SET SESSION sql_mode = CONCAT(@@sql_mode, ',ANSI_QUOTES')");
      });

      // Quick ping test
      try {
        const conn = await pool.getConnection();
        conn.release();
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
        // Enforce 15-second query timeout
        const [rows] = await pool.query({
          sql,
          values: params,
          timeout: 15000
        });
        return rows;
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
        dialect: "mariadb",
        readOnlyMechanism: "GRANT SELECT ONLY",
        ansiQuotesHook: "pool.on('connection')",
        database: activeDescriptor?.database || process.env.ERPNEXT_DB_NAME || '_4e5d6a7b8c9d0e1f'
      };
    }
  };

  return deepFreeze(adapter);
}

export const mariadbAdapter = createMariaDbAdapter();
