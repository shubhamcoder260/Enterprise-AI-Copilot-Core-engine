import assert from 'assert';
import { runCoreEngine } from '../src/core/core.engine.js';
import { executeLlmLink } from '../src/core/links/llm.link.js';
import { createCapabilitiesForSource } from '../src/kernel/capabilities.js';
import { mariadbAdapter } from '../src/adapters/mariadb.adapter.js';
import { switchTo, resetOrchestratorState } from '../src/kernel/switch.orchestrator.js';

console.log("==================================================");
console.log("   STEP 6 — ORACLE BENCHMARKS & PROVENANCE AUDIT  ");
console.log("==================================================");

async function runOracleBenchmarks() {
  await mariadbAdapter.connect();

  const erpSource = {
    id: "erpnext_prod",
    kind: "mariadb",
    dialect: "mariadb",
    database: "_4e5d6a7b8c9d0e1f"
  };

  // 1. Switch to ERPNext source
  console.log("\n[1] Switching active source to ERPNext MariaDB container...");
  await switchTo(erpSource);
  const capabilities = createCapabilitiesForSource(erpSource, mariadbAdapter);
  console.log("  ✅ Switch completed to dialect: mariadb");

  // 2. Oracle Question 1: FY2024 Total Sales Invoices vs General Ledger
  console.log("\n[2] Executing Oracle Q1: FY2024 Sales Invoice grand total vs General Ledger...");
  const q1Sql = "SELECT SUM(grand_total) AS total_sales FROM `tabSales Invoice` WHERE `docstatus` = 1 AND `posting_date` >= '2024-01-01' AND `posting_date` < '2025-01-01'";
  const q1Rows = await mariadbAdapter.executeReadOnlySql(q1Sql);
  const totalSales = Number(q1Rows[0].total_sales);

  const glSql = "SELECT SUM(credit) AS gl_sales FROM `tabGL Entry` WHERE `posting_date` >= '2024-01-01' AND `posting_date` < '2025-01-01'";
  const glRows = await mariadbAdapter.executeReadOnlySql(glSql);
  const glSales = Number(glRows[0].gl_sales);

  console.log(`  Sales Invoice Grand Total: ${totalSales.toFixed(2)}`);
  console.log(`  General Ledger Credit Total: ${glSales.toFixed(2)}`);
  assert.strictEqual(totalSales, 450000, "Q1: Sales Invoice total must be 450,000.00");
  assert.strictEqual(glSales, 450000, "Q1: General Ledger balance must match 450,000.00");
  assert.strictEqual(totalSales, glSales, "Q1: Sales Invoice total must match General Ledger with zero variance!");
  console.log("  ✅ Oracle Q1 verified: Ground-truth balance confirmed against General Ledger ($450,000.00)");

  // 3. Oracle Question 2: Count of Active Customers
  console.log("\n[3] Executing Oracle Q2: Count of active customers...");
  const q2Sql = "SELECT COUNT(*) AS active_customers FROM `tabCustomer` WHERE `disabled` = 0";
  const q2Rows = await mariadbAdapter.executeReadOnlySql(q2Sql);
  const activeCustomers = Number(q2Rows[0].active_customers);

  console.log(`  Active Customers count: ${activeCustomers}`);
  assert.strictEqual(activeCustomers, 5, "Q2: Active customer count must equal exactly 5");
  console.log("  ✅ Oracle Q2 verified: Active customer count matches Customer List (5 active)");

  // 4. End-to-End Engine & Provenance Audit through the REAL executeLlmLink
  console.log("\n[4] Running End-to-End Engine Query through real executeLlmLink with Provenance Verification...");
  
  const mockLlm = {
    generateSql: async ({ prompt, model }) => {
      // Assert that the prompt passed to the LLM generator is indeed MariaDB parameterized
      assert.ok(prompt.includes("You are a strict MariaDB SQL generator."), "Prompt must specify strict MariaDB SQL generator");
      assert.ok(prompt.includes("tabSales Invoice"), "Prompt schema must include tabSales Invoice");
      assert.ok(prompt.includes("Use backticks"), "Prompt rules must specify MariaDB backtick rules");
      return {
        success: true,
        sql: q1Sql,
        model: "oracle-verified-gemma3",
        durationMs: 42
      };
    }
  };

  const erpCapabilities = createCapabilitiesForSource(erpSource);
  erpCapabilities.llm = mockLlm;

  // Run through runCoreEngine with real executeLlmLink
  const realPipeline = [
    { name: "Local LLM", execute: executeLlmLink }
  ];

  const engineRes = await runCoreEngine(
    { query: "What was our total sales invoice amount for 2024?", sessionId: "oracle-prov-1" },
    { pipeline: realPipeline, capabilities: erpCapabilities }
  );

  console.log(`  Engine response answer: ${engineRes.answer}`);
  console.log(`  Engine response source: ${engineRes.source}`);
  console.log(`  Engine response meta.source: ${engineRes.meta.source}`);
  console.log(`  Engine response meta.sourceId: ${engineRes.meta.sourceId}`);
  console.log(`  Engine response data.sql: ${engineRes.data.sql}`);

  // Provenance checks
  assert.strictEqual(engineRes.source, "llm", "Engine response source must be 'llm'");
  assert.strictEqual(engineRes.meta.source, "mariadb", "Provenance assertion: meta.source must be 'mariadb', NOT 'sqlite'!");
  assert.strictEqual(engineRes.meta.sourceId, "erpnext_prod", "Provenance assertion: sourceId must match ERPNext descriptor!");
  assert.strictEqual(engineRes.data.sql, q1Sql, "Executed SQL must match Oracle Q1 SQL");
  assert.ok(engineRes.answer.includes("450000"), "Answer must contain Oracle FY2024 total (450000)");
  // 4b. S16 Sentinel Baseline Check (Honesty Before-Picture per CAP v2.2 Section 268)
  console.log("\n[4b] Executing S16 Sentinel Baseline Query: 'total sales for the last 5 years as a graph'...");
  const s16Sql = "SELECT DATE_FORMAT(`posting_date`, '%Y') AS year, SUM(`grand_total`) AS sales FROM `tabSales Invoice` WHERE `docstatus` = 1 GROUP BY DATE_FORMAT(`posting_date`, '%Y') ORDER BY year DESC LIMIT 5";
  erpCapabilities.llm = {
    generateSql: async () => ({
      success: true,
      sql: s16Sql,
      model: "oracle-verified-gemma3",
      durationMs: 35
    })
  };

  const s16Res = await runCoreEngine(
    { query: "Show our total sales for the last 5 years as a graph", sessionId: "oracle-s16-1" },
    { pipeline: realPipeline, capabilities: erpCapabilities }
  );

  console.log("  S16 Engine response source:", s16Res.source);
  console.log("  S16 Engine response data records:", JSON.stringify(s16Res.data?.records));
  assert.strictEqual(s16Res.meta.source, "mariadb", "S16 must run against MariaDB");
  assert.ok(Array.isArray(s16Res.data?.records), "S16 must return records array");
  console.log("  ✅ S16 Sentinel Baseline recorded successfully.");

  // 5. Hygiene Teardown: Reset orchestrator state
  resetOrchestratorState();
  await mariadbAdapter.close();
  console.log("\n[5] Hygiene: Restored switch orchestrator state to default SQLite.");

  console.log("\n==================================================");
  console.log("🏆 ALL ORACLE BENCHMARKS & PROVENANCE CHECKS PASSED!");
  console.log("==================================================");
}

runOracleBenchmarks().catch(err => {
  console.error("❌ Oracle benchmarks failed:", err);
  process.exit(1);
});
