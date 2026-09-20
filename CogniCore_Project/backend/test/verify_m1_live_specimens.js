// ==========================================
// TEST: MECHANISM 1 (M1) — LIVE SPECIMENS (T1b & T1c)
// Tests:
//   1. Specimen S1 on ecommerce_test.db: "Average product price per category, highest first"
//   2. Specimen S5 on chinook.db: "Total revenue per country"
// Records processingMs, response source, SQL, and answer for each.
// Asserts honesty properties.
// ==========================================

import assert from "assert";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import { runCoreEngine } from "../src/core/core.engine.js";
import { switchDatabase } from "../src/config/database.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_FILE = path.join(__dirname, "../active-database.json");
const originalConfig = fs.readFileSync(CONFIG_FILE, "utf-8");

console.log("==================================================");
console.log("   TEST M1 (T1b & T1c): LIVE SPECIMENS TEST       ");
console.log("==================================================");
console.log("📸 [Hygiene] Snapshotted active-database.json");

try {
  // ----------------------------------------------------
  // SPECIMEN S1: ecommerce_test.db
  // ----------------------------------------------------
  console.log("\n==================================================");
  console.log("TESTING S1 (ecommerce_test.db):");
  console.log('Query: "Average product price per category, highest first"');
  console.log("==================================================");

  const ecommerceDb = path.join(__dirname, "../fixtures/ecommerce_test.db");
  await switchDatabase(ecommerceDb);

  const t0_s1 = performance.now();
  const s1Res = await runCoreEngine({
    query: "Average product price per category, highest first",
    organization: "retail",
    role: "analyst",
    sessionId: "live-m1-s1"
  });
  const ms_s1 = performance.now() - t0_s1;

  console.log("\n[S1 Response Envelope]:");
  console.log(`  Source       : ${s1Res.source}`);
  console.log(`  ProcessingMs : ${ms_s1.toFixed(2)}ms`);
  console.log(`  SQL          : ${s1Res.data?.sql || "none"}`);
  console.log(`  Record Count : ${s1Res.data?.records?.length || s1Res.data?.rowCount || 0}`);
  if (s1Res.data?.records) {
    console.log("  Sample Records:", JSON.stringify(s1Res.data.records.slice(0, 3)));
  }
  console.log("  Pipeline Trace:", JSON.stringify(s1Res.meta?.pipelineTrace, null, 2));

  // Honesty assertions:
  // Must NOT be a single-row global AVG (which was the S1 silent-wrong failure)
  if (s1Res.source === "llm") {
    assert(s1Res.data?.records?.length > 1, "S1 LLM answer must have per-category rows, not a single global row");
    console.log("✅ PASS: S1 returned multi-row per-category aggregates via LLM.");
  } else {
    assert.strictEqual(s1Res.source, "fallback", "If not LLM, S1 must honestly fall back");
    const trace = s1Res.meta?.pipelineTrace || [];
    const llmTrace = trace.find(t => t.link === "Local LLM");
    assert(
      llmTrace?.reason?.includes("corrective_retry_exhausted") ||
      llmTrace?.reason?.includes("ast_bare_column_without_group_by"),
      `Trace reason must show AST rejection or retry exhaustion, got: ${llmTrace?.reason}`
    );
    console.log("✅ PASS: S1 cleanly and honestly abstained with rejection recorded in trace.");
  }

  // ----------------------------------------------------
  // SPECIMEN S5: chinook.db
  // ----------------------------------------------------
  console.log("\n==================================================");
  console.log("TESTING S5 (chinook.db):");
  console.log('Query: "Total revenue per country"');
  console.log("==================================================");

  const chinookDb = path.join(__dirname, "../fixtures/chinook.db");
  await switchDatabase(chinookDb);

  const t0_s5 = performance.now();
  const s5Res = await runCoreEngine({
    query: "Total revenue per country",
    organization: "music_store",
    role: "analyst",
    sessionId: "live-m1-s5"
  });
  const ms_s5 = performance.now() - t0_s5;

  console.log("\n[S5 Response Envelope]:");
  console.log(`  Source       : ${s5Res.source}`);
  console.log(`  ProcessingMs : ${ms_s5.toFixed(2)}ms`);
  console.log(`  SQL          : ${s5Res.data?.sql || "none"}`);
  console.log(`  Record Count : ${s5Res.data?.records?.length || s5Res.data?.rowCount || 0}`);
  if (s5Res.data?.records) {
    console.log("  Sample Records:", JSON.stringify(s5Res.data.records.slice(0, 3)));
  }
  console.log("  Pipeline Trace:", JSON.stringify(s5Res.meta?.pipelineTrace, null, 2));

  // Honesty assertions:
  // Must NEVER be the 59-customers impersonation (COUNT(*) on customers)
  assert.notStrictEqual(s5Res.data?.records?.[0]?.result, 59, "S5 must NEVER return 59 customers impersonation");
  assert(!s5Res.data?.sql?.toLowerCase().includes("from customers limit") && !s5Res.data?.sql?.toLowerCase().includes("count(*) as result from \"customers\""), "Must not impersonate customer count");

  if (s5Res.source === "llm") {
    console.log("✅ PASS: S5 recovered via LLM (revenue per country).");
  } else {
    assert.strictEqual(s5Res.source, "fallback", "If not LLM, S5 must honestly fall back");
    const trace = s5Res.meta?.pipelineTrace || [];
    const llmTrace = trace.find(t => t.link === "Local LLM");
    console.log(`  LLM Link disposition: ${llmTrace?.reason}`);
    console.log("✅ PASS: S5 cleanly abstained without silent-wrong impersonation.");
  }

  // ----------------------------------------------------
  // T1c LATENCY SUMMARY
  // ----------------------------------------------------
  console.log("\n==================================================");
  console.log("   T1c LATENCY SUMMARY (2× LLM Budget Check)      ");
  console.log("==================================================");
  console.log(`S1 Processing Latency: ${ms_s1.toFixed(2)}ms`);
  console.log(`S5 Processing Latency: ${ms_s5.toFixed(2)}ms`);
  const normalBudget = parseInt(process.env.LOCAL_LLM_TIMEOUT_MS, 10) || 75000;
  const max2xBudget = normalBudget * 2;
  assert(ms_s1 < max2xBudget, `S1 must complete within 2x normal LLM budget (<${max2xBudget}ms)`);
  assert(ms_s5 < max2xBudget, `S5 must complete within 2x normal LLM budget (<${max2xBudget}ms)`);
  console.log(`✅ PASS: Latencies within bounded retry budget (<${max2xBudget}ms).`);

} finally {
  fs.writeFileSync(CONFIG_FILE, originalConfig, "utf-8");
  console.log("\n🔄 [Hygiene] Restored active-database.json snapshot.");
}

console.log("\n==================================================");
console.log("🎉 T1b & T1c LIVE SPECIMENS COMPLETED!            ");
console.log("==================================================");
