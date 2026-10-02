// ============================================================================
// VERIFICATION: LIVE DOCSTATUS WIRING INTEGRATION TEST
// Verifies through live HTTP requests against real MariaDB source (erpnext_v16)
// that:
//   1. Master DocTypes (tabCustomer, tabItem) produce SQL with NO docstatus clause
//   2. Submittable DocTypes (tabSales Invoice, tabSales Order) DO inject docstatus = 1
// Exercises the exact end-to-end pipeline (HTTP -> ai.controller -> core.engine -> fastIntent/dynamic -> MariaDB)
// ============================================================================

import assert from "node:assert/strict";
import { generateToken } from "../src/middleware/auth.js";

const BASE_URL = process.env.TEST_API_URL || "http://localhost:5000";
const TEST_TOKEN = generateToken({ userId: "admin", roles: ["admin"] });

async function runLiveDocstatusWiringTests() {
  console.log("==================================================");
  console.log("   STEP 3 — VERIFY LIVE DOCSTATUS WIRING TEST     ");
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

  // 1. Switch active source to erpnext_v16
  console.log("\n[1] Switching active source to erpnext_v16...");
  const switchRes = await fetch(`${BASE_URL}/api/database/sources/switch`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${TEST_TOKEN}`
    },
    body: JSON.stringify({ sourceId: "erpnext_v16" })
  });
  assert.strictEqual(switchRes.status, 200, "Switch to erpnext_v16 must return 200");
  const switchData = await switchRes.json();
  assert.strictEqual(switchData.activeSource.id, "erpnext_v16");
  console.log("  ✅ Switched active source to erpnext_v16 successfully");

  try {
    // 2. Query Master DocType: Customers (tabCustomer)
    await test("Master DocType (Customer) count has NO docstatus filter and returns 9 records", async () => {
      const res = await fetch(`${BASE_URL}/api/ai/query`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${TEST_TOKEN}`
        },
        body: JSON.stringify({
          query: "how many customers do we have?",
          sessionId: "live-wiring-test-customer"
        })
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();

      assert.ok(data.data, "Response must include data payload");
      assert.strictEqual(data.data.table, "tabCustomer", "Table must be tabCustomer");
      assert.strictEqual(data.data.value, 9, "Customer count on erpnext_v16 must be 9");
      assert.ok(!data.data.sql.includes("docstatus"), `SQL must NOT contain docstatus filter: ${data.data.sql}`);
      assert.match(data.data.sql, /^SELECT COUNT\(\*\) AS result FROM `tabCustomer`$/i);
    });

    // 3. Query Master DocType: Items (tabItem)
    await test("Master DocType (Item) count has NO docstatus filter", async () => {
      const res = await fetch(`${BASE_URL}/api/ai/query`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${TEST_TOKEN}`
        },
        body: JSON.stringify({
          query: "how many items do we have?",
          sessionId: "live-wiring-test-item"
        })
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();

      assert.ok(data.data, "Response must include data payload");
      assert.strictEqual(data.data.table, "tabItem", "Table must be tabItem");
      assert.ok(!data.data.sql.includes("docstatus"), `SQL must NOT contain docstatus filter: ${data.data.sql}`);
      assert.match(data.data.sql, /^SELECT COUNT\(\*\) AS result FROM `tabItem`$/i);
    });

    // 4. Query Submittable DocType: Sales Invoices (tabSales Invoice)
    await test("Submittable DocType (Sales Invoice) count DOES inject docstatus filter", async () => {
      const res = await fetch(`${BASE_URL}/api/ai/query`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${TEST_TOKEN}`
        },
        body: JSON.stringify({
          query: "how many sales invoices do we have?",
          sessionId: "live-wiring-test-sales-inv"
        })
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();

      assert.ok(data.data, "Response must include data payload");
      assert.strictEqual(data.data.table, "tabSales Invoice", "Table must be tabSales Invoice");
      assert.ok(data.data.sql.includes("docstatus"), `SQL must contain docstatus filter: ${data.data.sql}`);
      assert.match(data.data.sql, /`docstatus`\s*=\s*\?/i);
    });

    // 5. Query Submittable DocType: Sales Orders (tabSales Order)
    await test("Submittable DocType (Sales Order) count DOES inject docstatus filter", async () => {
      const res = await fetch(`${BASE_URL}/api/ai/query`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${TEST_TOKEN}`
        },
        body: JSON.stringify({
          query: "how many sales orders do we have?",
          sessionId: "live-wiring-test-sales-ord"
        })
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();

      assert.ok(data.data, "Response must include data payload");
      assert.strictEqual(data.data.table, "tabSales Order", "Table must be tabSales Order");
      assert.ok(data.data.sql.includes("docstatus"), `SQL must contain docstatus filter: ${data.data.sql}`);
      assert.match(data.data.sql, /`docstatus`\s*=\s*\?/i);
    });

  } finally {
    // Teardown: Revert active source back to SQLite
    console.log("\n[Teardown] Reverting active source to sqlite_default...");
    await fetch(`${BASE_URL}/api/database/sources/switch`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${TEST_TOKEN}`
      },
      body: JSON.stringify({ sourceId: "sqlite_default" })
    });
    console.log("  ✅ Reverted active source to SQLite");
  }

  console.log("\n==================================================");
  console.log(`🏆 ALL ${passed}/${total} LIVE DOCSTATUS WIRING TESTS PASSED!`);
  console.log("==================================================");
}

runLiveDocstatusWiringTests().catch((err) => {
  console.error("FATAL: Live docstatus wiring test failed:", err);
  process.exit(1);
});
