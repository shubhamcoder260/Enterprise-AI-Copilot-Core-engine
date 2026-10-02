// ============================================================
// DBA GRANT SCRIPT GENERATOR (PART 3)
// Generates copy-pasteable, least-privilege SELECT-only scripts for DBAs.
// Invariant:
//   - Strictly uses placeholders for passwords (NEVER accepts or outputs real passwords).
//   - Rigorously validates identifiers against injection attacks.
// ============================================================

export const PLACEHOLDER_PASSWORD = "<ENTER_STRONG_PASSWORD_HERE>";

function validateIdentifier(id, fieldName) {
  if (!id || typeof id !== "string" || !/^[a-zA-Z0-9_]+$/.test(id.trim())) {
    throw new Error(`Invalid ${fieldName}: "${id}". Must contain only alphanumeric characters and underscores.`);
  }
  return id.trim();
}

function validateHostIp(ip) {
  if (!ip || typeof ip !== "string") return "%";
  const trimmed = ip.trim();
  if (!/^[a-zA-Z0-9_.%:-]+$/.test(trimmed)) {
    throw new Error(`Invalid server IP or host pattern: "${ip}".`);
  }
  return trimmed;
}

/**
 * Returns raw SQL statements array for execution (used by auto-provisioner).
 */
export function generateGrantStatements({ kind, databaseName, readOnlyUsername, password, cognicoreServerIp = "%" }) {
  const dialect = (kind || "").toLowerCase().trim();
  const db = validateIdentifier(databaseName, "databaseName");
  const user = validateIdentifier(readOnlyUsername, "readOnlyUsername");
  const host = validateHostIp(cognicoreServerIp);
  const pwd = password || PLACEHOLDER_PASSWORD;

  if (dialect === "mariadb" || dialect === "mysql") {
    // Escape single quotes in password if any
    const safePwd = pwd.replace(/'/g, "\\'");
    return [
      `CREATE USER IF NOT EXISTS '${user}'@'${host}' IDENTIFIED BY '${safePwd}'`,
      `GRANT SELECT ON \`${db}\`.* TO '${user}'@'${host}'`,
      `FLUSH PRIVILEGES`
    ];
  }

  if (dialect === "postgres" || dialect === "postgresql") {
    const safePwd = pwd.replace(/'/g, "''");
    return [
      `CREATE ROLE "${user}" WITH LOGIN PASSWORD '${safePwd}'`,
      `GRANT CONNECT ON DATABASE "${db}" TO "${user}"`,
      `GRANT USAGE ON SCHEMA public TO "${user}"`,
      `GRANT SELECT ON ALL TABLES IN SCHEMA public TO "${user}"`,
      `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO "${user}"`
    ];
  }

  throw new Error(`Unsupported database kind "${kind}". Supported kinds: mariadb, postgres.`);
}

/**
 * Generates copy-pasteable script with placeholder password for DBA.
 */
export function generateDbaScript({ kind, databaseName, readOnlyUsername, cognicoreServerIp = "%" }) {
  const dialect = (kind || "").toLowerCase().trim();
  const db = validateIdentifier(databaseName, "databaseName");
  const user = validateIdentifier(readOnlyUsername, "readOnlyUsername");
  const host = validateHostIp(cognicoreServerIp);

  const statements = generateGrantStatements({
    kind: dialect,
    databaseName: db,
    readOnlyUsername: user,
    password: PLACEHOLDER_PASSWORD,
    cognicoreServerIp: host
  });

  const banner = [
    `-- ============================================================================`,
    `-- CogniCore Least-Privilege Read-Only Setup Script (${dialect.toUpperCase()})`,
    `-- Target Database: ${db} | Read-Only Role: ${user}`,
    `-- SECURITY: Replace "${PLACEHOLDER_PASSWORD}" with your secret password.`,
    `-- ============================================================================`,
    ``
  ].join("\n");

  const formattedSql = statements.map(s => s + ";").join("\n\n");
  const script = `${banner}${formattedSql}\n`;

  return {
    kind: dialect,
    databaseName: db,
    readOnlyUsername: user,
    cognicoreServerIp: host,
    script
  };
}
