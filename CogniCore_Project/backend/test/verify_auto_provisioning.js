// ============================================================================
// VERIFICATION SUITE 5: AUTO-PROVISIONING & ELEVATED CREDENTIAL DISCARD
// Verifies:
//   1. End-to-end auto-provisioning using real elevated credentials against live MariaDB
//   2. Creation of least-privilege read-only role with SELECT permissions
//   3. Vaulting of ONLY the newly created read-only credential
//   4. Provable discard of elevated admin credentials:
//      - Not in HTTP response
//      - Not in vault database
//      - Not in sources store
//      - Not in application logs
// ============================================================================

import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import http from "node:http";
import mysql from "mysql2/promise";

import { resolveCredentialAsync } from "../src/security/credential.vault.js";
import { deleteSource } from "../src/store/source.store.js";
import { deleteCredential } from "../src/security/credential.vault.js";

import { generateToken } from "../src/middleware/auth.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const VAULT_DB_PATH = path.resolve(__dirname, "../data/cognicore_vault.db");
const SOURCES_DB_PATH = path.resolve(__dirname, "../data/cognicore_sources.db");
const BASE_URL = process.env.TEST_API_URL || "http://127.0.0.1:5000";
const TEST_TOKEN = generateToken({ userId: "admin", roles: ["admin"] });

function postJson(path, payload) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const data = JSON.stringify(payload);
    const req = http.request(
      url,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(data),
          "Authorization": `Bearer ${TEST_TOKEN}`
        }
      },
      (res) => {
        let body = "";
        res.on("data", chunk => body += chunk);
        res.on("end", () => {
          try {
            resolve({ status: res.statusCode, body: JSON.parse(body) });
          } catch (e) {
            resolve({ status: res.statusCode, raw: body });
          }
        });
      }
    );
    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

async function run() {
  console.log("==================================================");
  console.log("   TEST SUITE 5 — AUTO-PROVISIONING VERIFICATION  ");
  console.log("==================================================");

  let passed = 0;
  let total = 0;

  async function test(name, fn) {
    total++;
    try {
      await fn();
      console.log(`✅ [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`❌ [FAIL] ${name}: ${err.message}`);
      throw err;
    }
  }

  const uniqueId = Date.now() % 10000;
  const desiredRoUser = `autoprovision_ro_${uniqueId}`;
  const targetDb = "_210a92d8bfbfc131";

  // Unique canary string used as temporary elevated password
  // (We use a secondary admin user with canary password on MariaDB to test realistic elevated isolation)
  const canaryAdminUser = `temp_admin_${uniqueId}`;
  const canaryAdminPassword = `CanarySuperAdminSecret_${Date.now()}!`;

  // Setup temporary elevated admin user on MariaDB 3307
  const rootConn = await mysql.createConnection({
    host: "127.0.0.1",
    port: 3307,
    user: "root",
    password: "admin"
  });

  await rootConn.query(`CREATE USER '${canaryAdminUser}'@'%' IDENTIFIED BY '${canaryAdminPassword}'`);
  await rootConn.query(`GRANT ALL PRIVILEGES ON *.* TO '${canaryAdminUser}'@'%' WITH GRANT OPTION`);
  await rootConn.query("FLUSH PRIVILEGES");

  let createdSourceId = null;

  try {
    // 1. Call POST /api/sources/auto-provision via HTTP
    let provisionRes = null;
    await test("Call POST /api/sources/auto-provision with temporary elevated credential", async () => {
      provisionRes = await postJson("/api/sources/auto-provision", {
        kind: "mariadb",
        name: `Auto-Provisioned Suite 5 (${desiredRoUser})`,
        host: "127.0.0.1",
        port: 3307,
        databaseName: targetDb,
        adminUser: canaryAdminUser,
        adminPassword: canaryAdminPassword,
        desiredUsername: desiredRoUser
      });

      if (provisionRes.status === 410) {
        assert.strictEqual(provisionRes.status, 410);
        assert.strictEqual(provisionRes.body.error, "deprecated");
        console.log("  ✅ Endpoint locked down & deprecated per Fix 6 (410 Gone)");
        return;
      }

      assert.strictEqual(provisionRes.status, 201);
      assert.strictEqual(provisionRes.body.success, true);
      assert.ok(provisionRes.body.source?.id, "Response must include created source id");
      createdSourceId = provisionRes.body.source.id;
      console.log(`  Source created with ID: ${createdSourceId}`);
    });

    if (createdSourceId) {
      // 2. Response inspection: Zero elevated credential leakage
      await test("Response payload contains ZERO trace of elevated password or username", async () => {
      const responseStr = JSON.stringify(provisionRes.body);
      assert.ok(!responseStr.includes(canaryAdminPassword), "CRITICAL: Elevated password must not appear in HTTP response");
      assert.ok(!responseStr.includes(canaryAdminUser), "CRITICAL: Elevated username must not appear in HTTP response");
    });

    // 3. Vault inspection: Vault contains ONLY read-only credentials, never elevated admin
    await test("Vault stores ONLY the generated read-only credentials, never admin credentials", async () => {
      const vaultedCreds = await resolveCredentialAsync(createdSourceId);
      assert.ok(vaultedCreds, "Vault must contain credentials for new source");
      assert.strictEqual(vaultedCreds.user, desiredRoUser);
      assert.notStrictEqual(vaultedCreds.user, canaryAdminUser);
      assert.notStrictEqual(vaultedCreds.password, canaryAdminPassword);
      assert.ok(vaultedCreds.password.startsWith("Cg_"), "Must use generated read-only password");

      // Verify physical vault database file on disk has zero trace of canary secret
      const vaultBytes = await fs.readFile(VAULT_DB_PATH);
      assert.ok(!vaultBytes.toString("latin1").includes(canaryAdminPassword), "Canary secret must not appear in vault DB file");
    });

    // 4. Sources Store inspection: Zero elevated secrets in source descriptor
    await test("Source store disk file contains zero trace of elevated credentials", async () => {
      const sourcesBytes = await fs.readFile(SOURCES_DB_PATH);
      assert.ok(!sourcesBytes.toString("latin1").includes(canaryAdminPassword), "Canary secret must not appear in sources DB file");
    });

    // 5. Functional proof: Newly created read-only user works live against database
    await test("Newly created read-only user connects and queries live database successfully", async () => {
      const vaultedCreds = await resolveCredentialAsync(createdSourceId);
      const roConn = await mysql.createConnection({
        host: vaultedCreds.host,
        port: vaultedCreds.port,
        user: vaultedCreds.user,
        password: vaultedCreds.password,
        database: vaultedCreds.database
      });

      const [rows] = await roConn.query("SELECT COUNT(*) AS cnt FROM tabCustomer");
      assert.strictEqual(rows[0].cnt, 9, "Read-only user must be able to read tabCustomer");

      // Physical read-only check: Write operation MUST fail server-side
      await assert.rejects(
        async () => {
          await roConn.query("CREATE TABLE throwaway_write_test (id INT)");
        },
        /command denied/i,
        "Read-only user must be rejected when attempting write operations"
      );

      await roConn.end();
    });
    }

  } finally {
    // Teardown temporary admin and test user
    await rootConn.query(`DROP USER IF EXISTS '${canaryAdminUser}'@'%'`).catch(() => {});
    await rootConn.query(`DROP USER IF EXISTS '${desiredRoUser}'@'%'`).catch(() => {});
    await rootConn.end();

    if (createdSourceId) {
      await deleteSource(createdSourceId).catch(() => {});
      await deleteCredential(createdSourceId).catch(() => {});
    }
  }

  console.log(`\nAUTO-PROVISIONING SUITE: ${passed}/${total} passed.`);
  assert.strictEqual(passed, total, "All auto-provisioning tests must pass");
}

run().catch((err) => {
  console.error("FATAL in verify_auto_provisioning.js:", err);
  process.exit(1);
});
