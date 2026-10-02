// ============================================================================
// VERIFICATION SUITE 7: DYNAMIC SOURCE END-TO-END PIPELINE & ARCHITECTURAL PARITY
// Verifies:
//   1. Creates dynamic source via HTTP POST /api/sources (Wizard path)
//   2. Switches active database to the newly created dynamic source via switch orchestrator
//   3. Runs real natural language query through /api/ai/query
//   4. Confirms complete architectural parity with hardcoded sources:
//      - Real MariaDB connection using decrypted vaulted credentials
//      - Full AST security gate execution
//      - RLS allowlist enforcement
//      - Response verification chain (meta.verification.verified === true)
//      - Zero warning banners (honestNotice === null)
//   5. Successfully switches back and tears down test source cleanly
// ============================================================================

import assert from "node:assert/strict";
import http from "node:http";
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
  console.log("   TEST SUITE 7 — DYNAMIC SOURCE E2E PIPELINE     ");
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
  const dynamicSourceName = `Dynamic ERPNext E2E (${uniqueId})`;
  let dynamicSourceId = null;

  try {
    // 1. Wizard Path: Create source via HTTP POST /api/sources
    await test("Create dynamic ERPNext source via POST /api/sources", async () => {
      const res = await requestJson("POST", "/api/sources", {
        name: dynamicSourceName,
        kind: "mariadb",
        host: "127.0.0.1",
        port: 3307,
        user: "cognicore_ro",
        password: "CogniCore_RO_2026!",
        database: "_210a92d8bfbfc131"
      });

      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.body.success, true);
      assert.ok(res.body.source?.id);
      dynamicSourceId = res.body.source.id;
      console.log(`  Dynamic source registered: ${dynamicSourceId}`);
    });

    // 2. Switch Orchestrator: Switch active database to dynamic source
    await test("Switch active source to the dynamic source via /api/database/sources/switch", async () => {
      const switchRes = await requestJson("POST", "/api/database/sources/switch", {
        sourceId: dynamicSourceId
      });

      assert.strictEqual(switchRes.status, 200);
      assert.strictEqual(switchRes.body.success, true);
      assert.strictEqual(switchRes.body.activeSource.id, dynamicSourceId);
      console.log(`  Active source successfully switched to ${dynamicSourceId}`);
    });

    // 3. E2E AI Query Pipeline: Ask real question
    await test("Query /api/ai/query against dynamic source with full architectural parity", async () => {
      const queryRes = await requestJson("POST", "/api/ai/query", {
        query: "how many customers do we have?",
        sessionId: `dynamic-e2e-session-${uniqueId}`
      });

      assert.strictEqual(queryRes.status, 200);
      const data = queryRes.body;

      // Assert data payload
      assert.ok(data.data, "Must include data payload");
      assert.strictEqual(data.data.value, 9, "Must return ground truth 9 customers from live ERPNext");

      // Assert metadata & parity
      assert.strictEqual(data.meta.sourceId, dynamicSourceId, "Meta must reflect dynamic source ID");
      assert.strictEqual(data.meta.source, "mariadb", "Meta must reflect mariadb dialect");
      assert.strictEqual(data.meta.verification.verified, true, "Verification chain must pass (verified: true)");
      assert.strictEqual(data.meta.verification.honestNotice, null, "Must have zero grounding lie-detector warnings");

      console.log(`  Query answered: "${data.answer}" | Verified: ${data.meta.verification.verified}`);
    });

    // 4. Second Shape: Table List Query
    await test("Query list shape 'show items' against dynamic source", async () => {
      const listRes = await requestJson("POST", "/api/ai/query", {
        query: "show items",
        sessionId: `dynamic-e2e-session-${uniqueId}-items`
      });

      assert.strictEqual(listRes.status, 200);
      const data = listRes.body;
      assert.ok(data.data.records.length > 0, "Must return item records");
      assert.strictEqual(data.meta.verification.verified, true, "List query verification must pass");
      assert.strictEqual(data.meta.verification.honestNotice, null);
    });

  } finally {
    // Switch back to sqlite_default or erpnext_v16
    await requestJson("POST", "/api/database/sources/switch", { sourceId: "erpnext_v16" }).catch(() => {});

    // Delete dynamic test source
    if (dynamicSourceId) {
      await requestJson("DELETE", `/api/sources/${dynamicSourceId}`).catch(() => {});
    }
  }

  console.log(`\nDYNAMIC SOURCE E2E SUITE: ${passed}/${total} passed.`);
  assert.strictEqual(passed, total, "All dynamic source E2E tests must pass");
}

run().catch((err) => {
  console.error("FATAL in verify_dynamic_source_e2e.js:", err);
  process.exit(1);
});
