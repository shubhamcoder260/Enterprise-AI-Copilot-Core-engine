// ============================================================================
// VERIFICATION SUITE 3: PRE-FLIGHT TEST-CONNECTION ENDPOINT & ERROR CLASSIFICATION
// Verifies:
//   1. All 4 error categories reproduced against REAL misconfigured targets (NO mocks):
//      - network_unreachable: Connection refused on inactive port
//      - auth_failed: Live MariaDB connection with invalid password (ER_ACCESS_DENIED_ERROR)
//      - insufficient_privileges: Real database user with NO SELECT privileges
//      - unknown_dialect: Unsupported dialect rejected fail-closed
//   2. Live positive connection against real ERPNext MariaDB returns 200 with tables
// ============================================================================

import assert from "node:assert/strict";
import http from "node:http";
import mysql from "mysql2/promise";
import { generateToken } from "../src/middleware/auth.js";

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
  console.log("   TEST SUITE 3 — PRE-FLIGHT TEST CONNECTION      ");
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

  // 1. Positive Test: Real MariaDB on port 3307 with valid credentials
  await test("Positive: Connect to live ERPNext MariaDB returns connected status and table sample", async () => {
    const res = await postJson("/api/sources/test", {
      kind: "mariadb",
      host: "127.0.0.1",
      port: 3307,
      user: "cognicore_ro",
      password: "CogniCore_RO_2026!",
      database: "_210a92d8bfbfc131"
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.category, "connected");
    assert.ok(Array.isArray(res.body.tablesSample), "Must return sample table names");
    assert.ok(res.body.tablesSample.length > 0, "Must return at least 1 table");
  });

  // 2. Error Category 1: network_unreachable (Inactive host/port)
  await test("Error Category 1: network_unreachable against inactive local port 49999", async () => {
    const res = await postJson("/api/sources/test", {
      kind: "mariadb",
      host: "127.0.0.1",
      port: 49999, // Unused port
      user: "root",
      password: "password",
      database: "test"
    });

    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.errorCategory, "network_unreachable");
    assert.ok(res.body.driverCode === "ECONNREFUSED" || /connect/i.test(res.body.message));
  });

  // 3. Error Category 2: auth_failed (Live MariaDB with bad credentials)
  await test("Error Category 2: auth_failed against live MariaDB with incorrect password", async () => {
    const res = await postJson("/api/sources/test", {
      kind: "mariadb",
      host: "127.0.0.1",
      port: 3307,
      user: "cognicore_ro",
      password: "DeliberatelyWrongPassword_2026_!",
      database: "_210a92d8bfbfc131"
    });

    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.errorCategory, "auth_failed");
    assert.ok(res.body.driverCode === "ER_ACCESS_DENIED_ERROR" || res.body.driverCode === "1045");
  });

  // 4. Error Category 3: insufficient_privileges (Live user without read grants)
  await test("Error Category 3: insufficient_privileges against real restricted user", async () => {
    // Create live throwaway user on MariaDB 3307 with root, granting USAGE only (no SELECT)
    const adminConn = await mysql.createConnection({
      host: "127.0.0.1",
      port: 3307,
      user: "root",
      password: "admin"
    });

    const noPrivUser = "nopriv_test_" + (Date.now() % 10000);
    const noPrivPass = "NoPrivPass_2026!";

    try {
      await adminConn.query(`CREATE USER '${noPrivUser}'@'%' IDENTIFIED BY '${noPrivPass}'`);
      // User has only USAGE on *.* and NO SELECT on _210a92d8bfbfc131
      await adminConn.query("FLUSH PRIVILEGES");

      const res = await postJson("/api/sources/test", {
        kind: "mariadb",
        host: "127.0.0.1",
        port: 3307,
        user: noPrivUser,
        password: noPrivPass,
        database: "_210a92d8bfbfc131"
      });

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.errorCategory, "insufficient_privileges");
      assert.ok(res.body.driverCode === "ER_DBACCESS_DENIED_ERROR" || res.body.driverCode === "ER_TABLEACCESS_DENIED_ERROR" || res.body.driverCode === "1044" || res.body.driverCode === "1142");
    } finally {
      await adminConn.query(`DROP USER IF EXISTS '${noPrivUser}'@'%'`).catch(() => {});
      await adminConn.end();
    }
  });

  // 5. Error Category 4: unknown_dialect
  await test("Error Category 4: unknown_dialect for unsupported database kind", async () => {
    const res = await postJson("/api/sources/test", {
      kind: "unsupported_oracle_db",
      host: "127.0.0.1",
      port: 1521,
      user: "system",
      password: "pwd",
      database: "orcl"
    });

    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.errorCategory, "unknown_dialect");
  });

  console.log(`\nPRE-FLIGHT TEST CONNECTION SUITE: ${passed}/${total} passed.`);
  assert.strictEqual(passed, total, "All test-connection tests must pass");
}

run().catch((err) => {
  console.error("FATAL in verify_test_connection_endpoint.js:", err);
  process.exit(1);
});
