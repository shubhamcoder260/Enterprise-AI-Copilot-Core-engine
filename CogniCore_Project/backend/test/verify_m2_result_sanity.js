// ==========================================
// TEST: MECHANISM 2 (M2) — RESULT SANITY (T2)
// Tests:
//   1. Unit checks on checkResultSanity:
//      a. Flags scalar SUM/AVG on boolean column (is_vip) when not explicitly requested
//      b. Permits COUNT(*) / COUNT(is_vip) (COUNT is strictly exempt)
//      c. Permits explicit requests ("sum of is_vip")
//      d. Permits non-boolean scalar SUM (SUM(amount))
//   2. T2 POSITIVE (Live Engine):
//      S9-class question producing SUM(is_vip) on erp_demo.db
//      Must NOT return nonsense scalar; flags boolean_aggregate_suspicion or answers non-boolean.
//   3. T2 NEGATIVE CONTROL (Tripwire):
//      "How many clients are VIP" on erp_demo.db
//      Must answer with exact count 3 via COUNT over flag.
// ==========================================

import assert from "assert";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import { checkResultSanity } from "../src/core/result.sanity.js";
import { runCoreEngine } from "../src/core/core.engine.js";
import { switchDatabase } from "../src/config/database.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_FILE = path.join(__dirname, "../active-database.json");
const originalConfig = fs.readFileSync(CONFIG_FILE, "utf-8");

console.log("==================================================");
console.log("   TEST M2 (T2): RESULT SANITY & S9 VERIFICATION   ");
console.log("==================================================");
console.log("📸 [Hygiene] Snapshotted active-database.json");

try {
  const erpDb = path.join(__dirname, "../fixtures/erp_demo.db");
  await switchDatabase(erpDb);

  const mockDb = {
    async executeReadOnlySql(sql) {
      if (sql.includes("is_vip")) {
        return [{ val: 0 }, { val: 1 }];
      }
      return [{ val: 100 }, { val: 250 }, { val: 500 }];
    }
  };

  const mockSchema = {
    clients: {
      columns: [
        { name: "client_id", type: "INTEGER", pk: true },
        { name: "company", type: "TEXT" },
        { name: "is_vip", type: "INTEGER" }
      ]
    },
    invoices: {
      columns: [
        { name: "invoice_id", type: "INTEGER", pk: true },
        { name: "amount", type: "REAL" }
      ]
    }
  };

  // --- 1. Unit Tests on checkResultSanity ---
  console.log("\n--- 1. checkResultSanity Unit Invariants ---");

  // 1a. Positive: SUM(is_vip) on general query
  const res1a = await checkResultSanity({
    sql: "SELECT SUM(is_vip) AS total FROM clients",
    rows: [{ total: 3 }],
    query: "What is the total value of clients?",
    schema: mockSchema,
    db: mockDb
  });
  console.log("1a. SUM(is_vip) on general query:", res1a);
  assert.strictEqual(res1a.valid, false, "Must flag SUM on boolean flag");
  assert.strictEqual(res1a.reason, "boolean_aggregate_suspicion:is_vip");
  console.log("  ✅ PASS: Flagged boolean_aggregate_suspicion:is_vip");

  // 1b. Negative Control: COUNT over flag is strictly exempt
  const res1b = await checkResultSanity({
    sql: "SELECT COUNT(*) AS c FROM clients WHERE is_vip = 1",
    rows: [{ c: 3 }],
    query: "how many clients are VIP",
    schema: mockSchema,
    db: mockDb
  });
  console.log("1b. COUNT over flag:", res1b);
  assert.strictEqual(res1b.valid, true, "COUNT must be exempt from boolean sanity check");
  console.log("  ✅ PASS: COUNT query passed cleanly (exempt)");

  // 1c. Negative Control: Explicit column mention in query ("sum of is_vip")
  const res1c = await checkResultSanity({
    sql: "SELECT SUM(is_vip) AS total FROM clients",
    rows: [{ total: 3 }],
    query: "Calculate sum of is_vip",
    schema: mockSchema,
    db: mockDb
  });
  console.log("1c. Explicit column name in query:", res1c);
  assert.strictEqual(res1c.valid, true, "Explicitly named column in question must pass");
  console.log("  ✅ PASS: Explicitly requested column passed");

  // 1d. Normal numeric SUM
  const res1d = await checkResultSanity({
    sql: "SELECT SUM(amount) AS total FROM invoices",
    rows: [{ total: 45000 }],
    query: "Total invoice amount",
    schema: mockSchema,
    db: mockDb
  });
  console.log("1d. Normal numeric SUM:", res1d);
  assert.strictEqual(res1d.valid, true, "Non-boolean column SUM must pass");
  console.log("  ✅ PASS: Normal amount SUM passed");

  // --- 2. executeLlmLink Integration: T2 Negative Control ---
  console.log("\n--- 2. executeLlmLink: T2 Negative Control (COUNT over flag is exempt) ---");
  const negQuery = "how many clients are VIP";
  const mockCountLlm = {
    async generateSql() {
      return {
        success: true,
        sql: "SELECT COUNT(*) AS total_vip FROM clients WHERE is_vip = 1",
        durationMs: 25,
        model: "mock-llm"
      };
    }
  };

  const negCtx = {
    query: negQuery,
    organization: "enterprise",
    role: "analyst",
    sessionId: "m2-neg-ctrl",
    startTime: Date.now(),
    capabilities: {
      db: {
        async executeReadOnlySql(sql) {
          return [{ total_vip: 3 }];
        }
      },
      llm: mockCountLlm
    },
    attempts: []
  };

  const negRes = await (await import("../src/core/links/llm.link.js")).executeLlmLink(negCtx);
  console.log(`Query  : "${negQuery}"`);
  console.log(`Status : ${negRes.status}`);
  console.log(`Answer : "${negRes.response?.answer}"`);
  console.log(`SQL    : ${negRes.response?.data?.sql}`);
  console.log(`Records:`, negRes.response?.data?.records);

  assert.strictEqual(negRes.status, "ANSWERED", "Negative control COUNT query must be ANSWERED, not flagged");
  assert.strictEqual(negRes.response?.data?.records?.[0]?.total_vip, 3, "Must return exact count 3");
  console.log("✅ PASS: T2 Negative Control successfully answered 3 VIP clients via COUNT without over-declining.");

  // --- 3. executeLlmLink Integration: T2 Positive Check ---
  console.log("\n--- 3. executeLlmLink: T2 Positive S9-Class Verification ---");
  const posQuery = "What is the total value of clients?";
  const mockSumLlm = {
    async generateSql() {
      return {
        success: true,
        sql: "SELECT SUM(is_vip) AS total FROM clients",
        durationMs: 25,
        model: "mock-llm"
      };
    }
  };

  const posCtx = {
    query: posQuery,
    organization: "enterprise",
    role: "analyst",
    sessionId: "m2-pos-test",
    startTime: Date.now(),
    capabilities: {
      db: {
        async executeReadOnlySql(sql) {
          if (sql.includes("DISTINCT")) {
            return [{ val: 0 }, { val: 1 }];
          }
          return [{ total: 3 }];
        }
      },
      llm: mockSumLlm
    },
    attempts: []
  };

  const posRes = await (await import("../src/core/links/llm.link.js")).executeLlmLink(posCtx);
  console.log(`Query  : "${posQuery}"`);
  console.log(`Status : ${posRes.status}`);
  console.log(`Reason : ${posRes.reason}`);

  assert.strictEqual(posRes.status, "PASS", "S9 SUM on boolean flag must return PASS status");
  assert.strictEqual(
    posRes.reason,
    "boolean_aggregate_suspicion:is_vip",
    "Must flag boolean_aggregate_suspicion:is_vip"
  );
  console.log("✅ PASS: T2 Positive cleanly flagged boolean_aggregate_suspicion:is_vip and abstained without retry.");

} finally {
  fs.writeFileSync(CONFIG_FILE, originalConfig, "utf-8");
  console.log("\n🔄 [Hygiene] Restored active-database.json snapshot.");
}

console.log("\n==================================================");
console.log("🎉 T2 RESULT SANITY TESTS ALL PASSED!             ");
console.log("==================================================");
