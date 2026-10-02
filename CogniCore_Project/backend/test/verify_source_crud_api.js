// ============================================================================
// VERIFICATION SUITE 6: SOURCE CRUD API LIFECYCLE & ZERO-LEAKAGE AUDIT
// Verifies:
//   1. POST /api/sources validates pre-flight connectivity before persisting
//   2. GET /api/sources and GET /api/sources/:id NEVER expose raw passwords or secrets
//   3. POST /api/sources/:id/test re-tests stored, decrypted credentials
//   4. DELETE /api/sources/:id permanently removes descriptor and vaulted secrets
//   5. Built-in sources cannot be deleted
// ============================================================================

import assert from "node:assert/strict";
import http from "node:http";

import { hasCredential } from "../src/security/credential.vault.js";
import { generateToken } from "../src/middleware/auth.js";

const BASE_URL = process.env.TEST_API_URL || "http://127.0.0.1:5000";
const TEST_TOKEN = generateToken({ userId: "admin", roles: ["admin"] });

function requestJson(method, path, payload = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const data = payload ? JSON.stringify(payload) : null;
    const headers = {
      "Authorization": `Bearer ${TEST_TOKEN}`
    };
    if (data) {
      headers["Content-Type"] = "application/json";
      headers["Content-Length"] = Buffer.byteLength(data);
    }
    const req = http.request(
      url,
      { method, headers },
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
    if (data) req.write(data);
    req.end();
  });
}

async function run() {
  console.log("==================================================");
  console.log("   TEST SUITE 6 — SOURCE CRUD API VERIFICATION    ");
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

  const testSecret = "SuperSecret_CRUD_Password_2026!";
  const uniqueName = `CRUD Test MariaDB (${Date.now() % 10000})`;
  let createdId = null;

  // 1. Rejection of unconnectable source
  await test("POST /api/sources rejects unconnectable source (bad password) before persisting", async () => {
    const badRes = await requestJson("POST", "/api/sources", {
      name: "Bad Source Test",
      kind: "mariadb",
      host: "127.0.0.1",
      port: 3307,
      user: "cognicore_ro",
      password: "WrongPassword_NoPersist!",
      database: "_210a92d8bfbfc131"
    });

    assert.strictEqual(badRes.status, 400);
    assert.strictEqual(badRes.body.success, false);
    assert.strictEqual(badRes.body.errorCategory, "auth_failed");
  });

  // 2. Successful creation of real source
  await test("POST /api/sources creates and vaults valid source", async () => {
    const createRes = await requestJson("POST", "/api/sources", {
      name: uniqueName,
      kind: "mariadb",
      host: "127.0.0.1",
      port: 3307,
      user: "cognicore_ro",
      password: "CogniCore_RO_2026!",
      database: "_210a92d8bfbfc131"
    });

    assert.strictEqual(createRes.status, 201);
    assert.strictEqual(createRes.body.success, true);
    assert.ok(createRes.body.source?.id);
    createdId = createRes.body.source.id;

    // Creation response MUST NOT include password
    assert.strictEqual(createRes.body.source.password, undefined);
    assert.ok(!JSON.stringify(createRes.body).includes("CogniCore_RO_2026!"));
  });

  // 3. GET /api/sources list audit
  await test("GET /api/sources lists new source and NEVER exposes plaintext passwords", async () => {
    const listRes = await requestJson("GET", "/api/sources");
    assert.strictEqual(listRes.status, 200);
    assert.ok(Array.isArray(listRes.body.sources));

    const found = listRes.body.sources.find(s => s.id === createdId);
    assert.ok(found, `Source "${createdId}" must appear in list`);
    assert.strictEqual(found.name, uniqueName);

    // Audit ALL returned sources: none can contain password, apiKey, apiSecret
    for (const src of listRes.body.sources) {
      assert.strictEqual(src.password, undefined, `Source ${src.id} must not leak password`);
      assert.strictEqual(src.apiKey, undefined, `Source ${src.id} must not leak apiKey`);
      assert.strictEqual(src.apiSecret, undefined, `Source ${src.id} must not leak apiSecret`);
    }
  });

  // 4. GET /api/sources/:id audit
  await test("GET /api/sources/:id returns descriptor without secret", async () => {
    const getRes = await requestJson("GET", `/api/sources/${createdId}`);
    assert.strictEqual(getRes.status, 200);
    assert.strictEqual(getRes.body.source.id, createdId);
    assert.strictEqual(getRes.body.source.name, uniqueName);
    assert.strictEqual(getRes.body.source.password, undefined);
  });

  // 5. POST /api/sources/:id/test
  await test("POST /api/sources/:id/test re-tests live connectivity using vaulted credentials", async () => {
    const testRes = await requestJson("POST", `/api/sources/${createdId}/test`);
    assert.strictEqual(testRes.status, 200);
    assert.strictEqual(testRes.body.success, true);
    assert.strictEqual(testRes.body.status, "connected");
  });

  // 6. Built-in protection
  await test("DELETE /api/sources/erpnext_v16 rejects deletion of built-in source", async () => {
    const delBuiltinRes = await requestJson("DELETE", "/api/sources/erpnext_v16");
    assert.strictEqual(delBuiltinRes.status, 400);
    assert.ok(delBuiltinRes.body.error.includes("Cannot delete built-in source"));
  });

  // 7. DELETE /api/sources/:id
  await test("DELETE /api/sources/:id permanently deletes source and purges vaulted credential", async () => {
    const delRes = await requestJson("DELETE", `/api/sources/${createdId}`);
    assert.strictEqual(delRes.status, 200);
    assert.strictEqual(delRes.body.success, true);

    // Confirm 404 on subsequent get
    const getAfter = await requestJson("GET", `/api/sources/${createdId}`);
    assert.strictEqual(getAfter.status, 404);

    // Confirm vaulted credentials purged
    const hasCred = hasCredential(createdId);
    assert.strictEqual(hasCred, false, "Vault must permanently purge deleted credentials");
  });

  console.log(`\nSOURCE CRUD API SUITE: ${passed}/${total} passed.`);
  assert.strictEqual(passed, total, "All CRUD API tests must pass");
}

run().catch((err) => {
  console.error("FATAL in verify_source_crud_api.js:", err);
  process.exit(1);
});
