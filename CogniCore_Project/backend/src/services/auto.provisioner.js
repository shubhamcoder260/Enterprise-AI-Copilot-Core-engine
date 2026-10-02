// ============================================================
// AUTO PROVISIONER SERVICE (PART 4)
// Optional, one-time auto-provisioning of least-privilege read-only users.
// Invariant:
//   - Uses elevated admin credentials ONCE and explicitly purges them from memory.
//   - Stores ONLY the resulting read-only credentials in the encrypted vault.
//   - Never logs or persists admin credentials under any condition.
// ============================================================

import crypto from "crypto";
import mysql from "mysql2/promise";
import pkg from "pg";
const { Client: PgClient } = pkg;

import { generateGrantStatements } from "./grant.script.generator.js";
import { testConnection } from "./connection.tester.js";
import { storeCredential } from "../security/credential.vault.js";
import { registerSource } from "../config/sources.js";

function generateSecurePassword() {
  const bytes = crypto.randomBytes(18).toString("base64url");
  return `Cg_${bytes}_!26`;
}

export async function autoProvisionReadOnlyUser(params = {}) {
  // Extract and isolate elevated credentials
  let {
    kind,
    name: sourceName,
    host = "127.0.0.1",
    port,
    databaseName,
    adminUser,
    adminPassword,
    desiredUsername,
    cognicoreServerIp = "%"
  } = params;

  const dialect = (kind || "").toLowerCase().trim();
  const dbPort = port ? Number(port) : (dialect === "mariadb" ? 3306 : 5432);
  const roUsername = desiredUsername || `cognicore_ro_${Date.now() % 10000}`;
  const roPassword = generateSecurePassword();

  let adminClient = null;

  try {
    const grantStatements = generateGrantStatements({
      kind: dialect,
      databaseName,
      readOnlyUsername: roUsername,
      password: roPassword,
      cognicoreServerIp
    });

    // 1. Connect once using elevated credential
    if (dialect === "mariadb" || dialect === "mysql") {
      adminClient = await mysql.createConnection({
        host,
        port: dbPort,
        user: adminUser,
        password: adminPassword,
        connectTimeout: 5000
      });

      for (const statement of grantStatements) {
        await adminClient.query(statement);
      }
      await adminClient.end();
      adminClient = null;
    } else if (dialect === "postgres" || dialect === "postgresql") {
      adminClient = new PgClient({
        host,
        port: dbPort,
        user: adminUser,
        password: adminPassword,
        database: databaseName,
        connectionTimeoutMillis: 5000
      });

      await adminClient.connect();
      for (const statement of grantStatements) {
        await adminClient.query(statement);
      }
      await adminClient.end();
      adminClient = null;
    } else {
      throw new Error(`Unsupported auto-provision dialect "${dialect}".`);
    }

    // 2. Pre-flight test the newly created read-only user
    const testResult = await testConnection({
      kind: dialect,
      host,
      port: dbPort,
      user: roUsername,
      password: roPassword,
      database: databaseName
    });

    if (!testResult.success) {
      throw new Error(`Auto-provision verification failed: ${testResult.message}`);
    }

    // 3. Vault ONLY the read-only credentials
    const sourceId = `src_${dialect}_${Date.now()}`;
    await storeCredential(sourceId, {
      host,
      port: dbPort,
      user: roUsername,
      password: roPassword,
      database: databaseName
    });

    // 4. Save and register new source descriptor
    const sourceDescriptor = {
      id: sourceId,
      name: sourceName || `Auto-Provisioned ${dialect.toUpperCase()} (${databaseName})`,
      kind: dialect,
      dialect,
      credentialRef: `vault:${sourceId}`,
      profileRef: dialect === "mariadb" ? "erpnext" : dialect,
      host,
      port: dbPort,
      database: databaseName,
      status: "connected"
    };

    await registerSource(sourceDescriptor, { persist: true });

    return {
      success: true,
      message: `Successfully provisioned read-only role "${roUsername}" and connected source.`,
      source: {
        id: sourceDescriptor.id,
        name: sourceDescriptor.name,
        kind: sourceDescriptor.kind,
        dialect: sourceDescriptor.dialect,
        database: sourceDescriptor.database,
        status: sourceDescriptor.status
      }
    };
  } finally {
    // SECURITY INVARIANT: Explicit memory purge of elevated credentials
    if (adminClient) {
      try {
        if (typeof adminClient.end === "function") await adminClient.end();
      } catch {}
      adminClient = null;
    }
    adminPassword = null;
    params.adminPassword = null;
  }
}
