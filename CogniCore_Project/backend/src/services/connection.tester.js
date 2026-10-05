// ============================================================
// CONNECTION TESTER SERVICE (PART 2)
// Pre-flight test-connection engine reusing existing adapters.
// Discovers real read access, maps precise error categories, and closes pools immediately.
// ============================================================

import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { createMariaDbAdapter } from "../adapters/mariadb.adapter.js";
import { createPostgresAdapter } from "../adapters/postgres.adapter.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ERROR_CATEGORIES = Object.freeze({
  NETWORK_UNREACHABLE: "network_unreachable",
  AUTH_FAILED: "auth_failed",
  INSUFFICIENT_PRIVILEGES: "insufficient_privileges",
  DATABASE_NOT_FOUND: "database_not_found",
  UNKNOWN_DIALECT: "unknown_dialect",
  INVALID_PARAMETERS: "invalid_parameters"
});

function classifyDriverError(err, dialect) {
  if (!err) return { category: "unknown_error", message: "Unknown error occurred" };

  const code = String(err.code || err.sqlState || "");
  const msg = String(err.message || "");

  // Network unreachable patterns
  if (
    code === "ECONNREFUSED" ||
    code === "ENOTFOUND" ||
    code === "EHOSTUNREACH" ||
    code === "ETIMEDOUT" ||
    code === "PROTOCOL_CONNECTION_LOST" ||
    /connect ECONNREFUSED/i.test(msg) ||
    /getaddrinfo ENOTFOUND/i.test(msg) ||
    /ETIMEDOUT/i.test(msg)
  ) {
    return {
      category: ERROR_CATEGORIES.NETWORK_UNREACHABLE,
      message: `Database server is unreachable: ${msg}`,
      driverCode: code || "ECONNREFUSED"
    };
  }

  // MariaDB specific error codes
  if (
    code === "ER_TABLEACCESS_DENIED_ERROR" ||
    code === "ER_DBACCESS_DENIED_ERROR" ||
    code === "1044" ||
    code === "1142" ||
    code === "1143" ||
    /access denied for user .* to database/i.test(msg) ||
    /command denied to user/i.test(msg)
  ) {
    return {
      category: ERROR_CATEGORIES.INSUFFICIENT_PRIVILEGES,
      message: `Insufficient privileges: Read permissions denied on target database. (${msg})`,
      driverCode: code || "1044"
    };
  }

  if (
    code === "ER_ACCESS_DENIED_ERROR" ||
    code === "1045" ||
    /access denied for user .* \(using password:/i.test(msg) ||
    /access denied for user/i.test(msg)
  ) {
    return {
      category: ERROR_CATEGORIES.AUTH_FAILED,
      message: `Authentication failed: Invalid username or password. (${msg})`,
      driverCode: code || "1045"
    };
  }

  if (code === "ER_BAD_DB_ERROR" || code === "1049" || /unknown database/i.test(msg)) {
    return {
      category: ERROR_CATEGORIES.DATABASE_NOT_FOUND,
      message: `Database does not exist: ${msg}`,
      driverCode: code || "1049"
    };
  }

  // PostgreSQL specific error codes (Postgres error codes are standard 5-character strings)
  if (code === "28P01" || code === "28000" || /password authentication failed/i.test(msg)) {
    return {
      category: ERROR_CATEGORIES.AUTH_FAILED,
      message: `Authentication failed: Invalid PostgreSQL role or password. (${msg})`,
      driverCode: code
    };
  }
  if (code === "3D000" || /database .* does not exist/i.test(msg)) {
    return {
      category: ERROR_CATEGORIES.DATABASE_NOT_FOUND,
      message: `PostgreSQL database does not exist: ${msg}`,
      driverCode: code
    };
  }
  if (code === "42501" || /permission denied for/i.test(msg)) {
    return {
      category: ERROR_CATEGORIES.INSUFFICIENT_PRIVILEGES,
      message: `Insufficient privileges: PostgreSQL role lacks SELECT permissions. (${msg})`,
      driverCode: code
    };
  }

  return {
    category: "connection_failed",
    message: msg || "Failed to establish database connection",
    driverCode: code || "UNKNOWN"
  };
}

export async function testConnection(params = {}) {
  const { kind, dialect: rawDialect, host, port, user, password, database, path: sqlitePath } = params;
  const dialect = (rawDialect || kind || "").toLowerCase().trim();

  if (!dialect) {
    return {
      success: false,
      errorCategory: ERROR_CATEGORIES.INVALID_PARAMETERS,
      message: "Missing connection kind or dialect."
    };
  }

  // 1. SQLite dialect test
  if (dialect === "sqlite") {
    if (!sqlitePath) {
      return {
        success: false,
        errorCategory: ERROR_CATEGORIES.INVALID_PARAMETERS,
        message: "Missing path parameter for SQLite database."
      };
    }

    const forbiddenExtensions = [".enc", ".log", ".json", ".db.bak", ".vault", ".key", ".env"];
    if (forbiddenExtensions.some((ext) => sqlitePath.toLowerCase().endsWith(ext))) {
      return {
        success: false,
        errorCategory: ERROR_CATEGORIES.INVALID_PARAMETERS,
        message: "Access to internal artifacts or encrypted files is forbidden."
      };
    }

    const resolvedPath = path.resolve(sqlitePath);
    const allowedDirs = [
      path.resolve(__dirname, "../../uploads"),
      path.resolve(__dirname, "../../fixtures"),
      path.resolve(__dirname, "../../test/fixtures")
    ];

    const isAllowed = allowedDirs.some((dir) => resolvedPath.startsWith(dir));
    if (!isAllowed) {
      return {
        success: false,
        errorCategory: ERROR_CATEGORIES.INVALID_PARAMETERS,
        message: "Requested database file is outside allowed directories."
      };
    }

    try {
      await fs.access(resolvedPath);
      const handle = await fs.open(resolvedPath, "r");
      const buffer = Buffer.alloc(16);
      await handle.read(buffer, 0, 16, 0);
      await handle.close();
      const header = buffer.toString("utf8", 0, 15);
      if (header !== "SQLite format 3") {
        return {
          success: false,
          errorCategory: ERROR_CATEGORIES.INVALID_PARAMETERS,
          message: "The specified file is not a valid SQLite database (missing SQLite 3 header)."
        };
      }
      return {
        success: true,
        category: "connected",
        message: "SQLite database file verified successfully."
      };
    } catch (err) {
      return {
        success: false,
        errorCategory: ERROR_CATEGORIES.NETWORK_UNREACHABLE,
        message: `Cannot access SQLite file at ${resolvedPath}: ${err.message}`
      };
    }
  }

  // 2. MariaDB / MySQL dialect test
  if (dialect === "mariadb" || dialect === "mysql") {
    const adapter = createMariaDbAdapter({
      sourceDescriptor: {
        host: host || "127.0.0.1",
        port: port ? Number(port) : 3306,
        user: user || "",
        password: password || "",
        database: database || ""
      }
    });

    try {
      await adapter.connect();
      // Run minimal introspection test to confirm read permissions
      const rows = await adapter.queryReadOnly(
        "SELECT table_name FROM information_schema.tables WHERE table_schema = ? LIMIT 2",
        [database]
      );
      const sampleTables = Array.isArray(rows) ? rows.map(r => r.table_name || r.TABLE_NAME) : [];
      return {
        success: true,
        category: "connected",
        message: "MariaDB connection verified successfully with active read permissions.",
        tablesSample: sampleTables
      };
    } catch (err) {
      const classified = classifyDriverError(err, "mariadb");
      return {
        success: false,
        errorCategory: classified.category,
        message: classified.message,
        driverCode: classified.driverCode
      };
    } finally {
      // INVARIANT: Explicitly close and discard connection pool immediately
      await adapter.close().catch(() => {});
    }
  }

  // 3. PostgreSQL dialect test
  if (dialect === "postgres" || dialect === "postgresql") {
    const adapter = createPostgresAdapter({
      host: host || "127.0.0.1",
      port: port ? Number(port) : 5432,
      user: user || "",
      password: password || "",
      database: database || ""
    });

    try {
      await adapter.connect({
        host: host || "127.0.0.1",
        port: port ? Number(port) : 5432,
        user: user || "",
        password: password || "",
        database: database || ""
      });
      // Run minimal introspection test to confirm read permissions
      const rows = await adapter.queryReadOnly(
        "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' LIMIT 2"
      );
      const sampleTables = Array.isArray(rows) ? rows.map(r => r.table_name) : [];
      return {
        success: true,
        category: "connected",
        message: "PostgreSQL connection verified successfully with active read permissions.",
        tablesSample: sampleTables
      };
    } catch (err) {
      const classified = classifyDriverError(err, "postgres");
      return {
        success: false,
        errorCategory: classified.category,
        message: classified.message,
        driverCode: classified.driverCode
      };
    } finally {
      await adapter.close().catch(() => {});
    }
  }

  return {
    success: false,
    errorCategory: ERROR_CATEGORIES.UNKNOWN_DIALECT,
    message: `Unsupported dialect "${dialect}". Supported dialects are: mariadb, postgres, sqlite.`
  };
}
