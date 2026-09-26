// ============================================================
// DYNAMIC TIER MULTI-DIALECT VERIFICATION (PHASE D3)
// Verifies deterministic fastIntent execution on MariaDB via Dynamic Link
// and graceful cascade on unmatched queries.
// ============================================================

import assert from 'assert';
import { executeDynamicLink } from '../src/core/links/dynamic.link.js';
import { createCapabilitiesForSource } from '../src/kernel/capabilities.js';
import { mariadbAdapter } from '../src/adapters/mariadb.adapter.js';

console.log("==================================================");
console.log("   VERIFYING DYNAMIC TIER MULTI-DIALECT (D3)     ");
console.log("==================================================");

async function testDynamicMultiDialect() {
  await mariadbAdapter.connect();

  const erpSource = {
    id: "erpnext_prod",
    kind: "mariadb",
    dialect: "mariadb",
    database: "_4e5d6a7b8c9d0e1f"
  };

  const capabilities = createCapabilitiesForSource(erpSource, mariadbAdapter);

  // 1. Matched Query on MariaDB (count customers)
  console.log("\n[1] Testing deterministic fastIntent query on MariaDB via Dynamic Link...");
  const t0 = performance.now();
  const res1 = await executeDynamicLink({
    query: "count customers",
    sessionId: "dyn-md-1",
    startTime: Date.now(),
    capabilities
  });
  const elapsed1 = performance.now() - t0;

  console.log(`  Dynamic result status: ${res1.status}`);
  console.log(`  Dynamic answer:        ${res1.response?.answer}`);
  console.log(`  Dynamic source:        ${res1.response?.source}`);
  console.log(`  Dynamic meta.source:   ${res1.response?.meta?.source}`);
  console.log(`  Executed SQL:          ${res1.response?.data?.sql}`);
  console.log(`  Execution duration:    ${elapsed1.toFixed(2)}ms`);

  assert.strictEqual(res1.status, "ANSWERED", "Dynamic link must ANSWER for matched fastIntent query");
  assert.strictEqual(res1.response?.source, "dynamic", "Source must be 'dynamic'");
  assert.strictEqual(res1.response?.meta?.source, "mariadb", "meta.source must be 'mariadb'");
  assert.strictEqual(res1.response?.meta?.sourceId, "erpnext_prod", "meta.sourceId must match");
  assert(res1.response?.data?.sql?.includes("`tabCustomer`"), "SQL must target tabCustomer with backticks");
  assert(elapsed1 < 500, "Cold deterministic execution must complete in <500ms");
  console.log("  ✅ Deterministic MariaDB dynamic execution (cold) verified in", elapsed1.toFixed(2), "ms");

  const tWarm = performance.now();
  const resWarm = await executeDynamicLink({
    query: "count customers",
    sessionId: "dyn-md-warm",
    startTime: Date.now(),
    capabilities
  });
  const elapsedWarm = performance.now() - tWarm;
  console.log(`  Warm execution duration: ${elapsedWarm.toFixed(2)}ms`);
  assert(elapsedWarm < 50, "Warm execution must complete in <50ms");
  console.log("  ✅ Warm deterministic MariaDB dynamic execution verified in", elapsedWarm.toFixed(2), "ms");

  // 2. Unmatched complex query cascading gracefully
  console.log("\n[2] Testing graceful cascade on unmatched query...");
  const res2 = await executeDynamicLink({
    query: "Explain our quarterly profit margin trends across subsidiaries",
    sessionId: "dyn-md-2",
    startTime: Date.now(),
    capabilities
  });

  console.log(`  Cascade result status: ${res2.status}`);
  console.log(`  Cascade pass reason:   ${res2.reason}`);
  assert.strictEqual(res2.status, "PASS", "Unmatched query must PASS to next link (LLM)");
  assert(res2.reason.includes("dynamic_unmatched") || res2.reason.includes("table_missing"),
    "Pass reason must indicate dynamic unmatched / table missing");
  console.log("  ✅ Dynamic link cascaded gracefully to LLM tier without failure");

  await mariadbAdapter.close();

  console.log("\n==================================================");
  console.log("🏆 DYNAMIC TIER MULTI-DIALECT TESTS PASSED (100%)!");
  console.log("==================================================");
}

testDynamicMultiDialect().catch(err => {
  console.error("❌ Dynamic Multi-Dialect Test Failed:", err);
  process.exit(1);
});
