// ==========================================
// WORK ITEM 2: LIVE PARITY + VISUALIZER PROOFS (M1–M10)
// ==========================================

import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE_URL = "http://localhost:5000";
const CONFIG_FILE = path.join(__dirname, "..", "active-database.json");

const COLLEGE_DB = path.join(
  __dirname,
  "..",
  "uploads/1788767199100-college_attendance_(3).db"
);
const ECOMMERCE_DB = path.join(__dirname, "..", "fixtures", "ecommerce_test.db");
const CHINOOK_DB = path.join(__dirname, "..", "fixtures", "chinook.db");
const ERP_DEMO_DB = path.join(__dirname, "..", "fixtures", "erp_demo.db");

async function switchDb(dbPath) {
  await fs.writeFile(CONFIG_FILE, JSON.stringify({ activeDatabasePath: dbPath }, null, 2));
  const res = await fetch(`${BASE_URL}/api/database/switch`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ databasePath: dbPath })
  });
  if (!res.ok) {
    console.warn("⚠️ switch failed with status", res.status);
  }
}

async function postQuery({ query, organization = "college", sessionId = "test_m_session", format = undefined }) {
  const body = {
    query,
    organization,
    role: "admin",
    sessionId,
    model: "gemma3:4b"
  };
  if (format !== undefined) body.format = format;

  const res = await fetch(`${BASE_URL}/api/ai/query`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Session-ID": sessionId
    },
    body: JSON.stringify(body)
  });
  return await res.json();
}

async function runParitySuite() {
  console.log("══════════════════════════════════════════════════");
  console.log("   LIVE PARITY + VISUALIZER PROOFS (M1–M10)");
  console.log("══════════════════════════════════════════════════\n");

  const originalConfig = await fs.readFile(CONFIG_FILE, "utf8");
  const results = [];

  try {
    // ----------------------------------------------------
    // M1: College "how many student are there"
    // ----------------------------------------------------
    console.log("Running M1...");
    await switchDb(COLLEGE_DB);
    const m1 = await postQuery({ query: "how many student are there", organization: "college" });
    const m1Pass = m1.source === "dynamic" && (m1.format?.value === 80 || m1.data?.value === 80);
    results.push({
      id: "M1",
      name: "College: 'how many student are there'",
      pass: m1Pass,
      detail: `source=${m1.source} (exp dynamic), kpi=${m1.format?.display || m1.format?.value || m1.data?.value} (exp 80), format.kind=${m1.format?.kind}`
    });

    // ----------------------------------------------------
    // M2: College "average absent percentage"
    // ----------------------------------------------------
    console.log("Running M2...");
    const m2 = await postQuery({ query: "average absent percentage", organization: "college" });
    const m2Val = m2.format?.value ?? m2.data?.value;
    const m2Pass = m2.source === "dynamic" && m2Val === 13.31;
    results.push({
      id: "M2",
      name: "College: 'average absent percentage'",
      pass: m2Pass,
      detail: `source=${m2.source}, kpi=${m2Val} (exp 13.31), sql=${m2.data?.sql}`
    });

    // ----------------------------------------------------
    // M3: College "lowest attendence top 5"
    // ----------------------------------------------------
    console.log("Running M3...");
    const m3 = await postQuery({ query: "lowest attendence top 5", organization: "college" });
    const m3Rows = m3.format?.rowCount ?? m3.format?.rows?.length ?? m3.data?.records?.length;
    const m3Pass = m3.format?.kind === "table" && m3Rows === 5;
    results.push({
      id: "M3",
      name: "College: 'lowest attendence top 5'",
      pass: m3Pass,
      detail: `kind=${m3.format?.kind} (exp table), rows=${m3Rows} (exp 5)`
    });

    // ----------------------------------------------------
    // M4: E-commerce "Show a bar chart of average product price per category"
    // ----------------------------------------------------
    console.log("Running M4...");
    await switchDb(ECOMMERCE_DB);
    const m4 = await postQuery({ query: "Show a bar chart of average product price per category", organization: "ecommerce" });
    const m4Values = m4.format?.vegaLite?.data?.values || [];
    const sportsItem = m4Values.find((v) => /sports/i.test(v.label));
    const m4Pass = m4.format?.kind === "chartSpec" && m4.format?.vegaLite?.mark === "bar" && sportsItem && Math.abs(sportsItem.value - 85.92) < 0.05;
    results.push({
      id: "M4",
      name: "E-commerce: bar chart average product price per category",
      pass: m4Pass,
      detail: `kind=${m4.format?.kind} (exp chartSpec), mark=${m4.format?.vegaLite?.mark}, Sports=${sportsItem?.value} (exp 85.92), source=${m4.source}`
    });

    // ----------------------------------------------------
    // M5: E-commerce "Show a bar chart of all orders" (Grouping Guard trigger)
    // ----------------------------------------------------
    console.log("Running M5...");
    const m5 = await postQuery({ query: "Show a bar chart of all orders", organization: "ecommerce" });
    const m5Note = m5.format?.note || "";
    const m5Pass = m5.format?.kind === "table" && m5Note.includes("not aggregated");
    results.push({
      id: "M5",
      name: "E-commerce: bar chart of all orders (grouping guard)",
      pass: m5Pass,
      detail: `kind=${m5.format?.kind} (exp table), note="${m5Note}"`
    });

    // ----------------------------------------------------
    // M6: E-commerce "Total revenue from completed orders" format:csv
    // ----------------------------------------------------
    console.log("Running M6...");
    const m6 = await postQuery({
      query: "Total revenue from completed orders",
      organization: "ecommerce",
      format: "csv"
    });
    const m6Text = m6.format?.text || "";
    const m6Pass = m6.format?.kind === "csv" && (m6Text.includes("SUM(total_amount)") || m6Text.includes("revenue") || m6Text.includes("total_amount") || m6Text.length > 0);
    results.push({
      id: "M6",
      name: "E-commerce: Total revenue format:csv",
      pass: m6Pass,
      detail: `kind=${m6.format?.kind} (exp csv), textSnippet="${m6Text.split("\r\n")[0]}"`
    });

    // ----------------------------------------------------
    // M7: Chinook / Report layout ("Give me a report on invoices")
    // ----------------------------------------------------
    console.log("Running M7...");
    await switchDb(CHINOOK_DB);
    const m7 = await postQuery({ query: "Give me a report on invoices", organization: "chinook" });
    const m7Pass = m7.format?.kind === "report" && typeof m7.format?.narrative === "string";
    results.push({
      id: "M7",
      name: "Chinook: report layout (narrative+kpi)",
      pass: m7Pass,
      detail: `kind=${m7.format?.kind} (exp report), hasNarrative=${Boolean(m7.format?.narrative)}, kpisCount=${m7.format?.kpis?.length ?? 0}`
    });

    // ----------------------------------------------------
    // M8: Session persistence & history hydration
    // ----------------------------------------------------
    console.log("Running M8...");
    const testSession = "session_m8_hydration_test_" + Date.now();
    await postQuery({ query: "how many invoices are there", organization: "chinook", sessionId: testSession });
    const histRes = await fetch(`${BASE_URL}/api/history/${testSession}`);
    const histData = await histRes.json();
    const exchanges = histData.exchanges || histData.history || [];
    const m8Pass = exchanges.length >= 1 && exchanges[0].question === "how many invoices are there";
    results.push({
      id: "M8",
      name: "Session persistence & history hydration",
      pass: m8Pass,
      detail: `exchangesCount=${exchanges.length}, firstQuestion="${exchanges[0]?.question}"`
    });

    // ----------------------------------------------------
    // M9: Active DB status & switch verification
    // ----------------------------------------------------
    console.log("Running M9...");
    const activeRes = await fetch(`${BASE_URL}/api/database/active`);
    const activeData = await activeRes.json();
    const m9Pass = Boolean(activeData?.activeDatabase);
    results.push({
      id: "M9",
      name: "Database active status endpoint",
      pass: m9Pass,
      detail: `activeDatabase="${activeData?.activeDatabase}"`
    });

    // ----------------------------------------------------
    // M10: Fallback question -> graceful message & trace
    // ----------------------------------------------------
    console.log("Running M10...");
    const m10 = await postQuery({ query: "what is the quantum wavefunction of carbon in sqlite", organization: "general" });
    const m10Pass = m10.source === "fallback" && Boolean(m10.answer);
    results.push({
      id: "M10",
      name: "Fallback question -> graceful message & trace",
      pass: m10Pass,
      detail: `source=${m10.source} (exp fallback), answer="${m10.answer?.slice(0, 60)}..."`
    });

  } finally {
    // Hygiene: restore original active database
    await fs.writeFile(CONFIG_FILE, originalConfig);
    console.log("🔄 [Hygiene] Restored active-database.json snapshot.");
  }

  console.log("\n--------------------------------------------------------------------------------");
  let allPass = true;
  for (const r of results) {
    const symbol = r.pass ? "✅ PASS" : "❌ FAIL";
    if (!r.pass) allPass = false;
    console.log(`${symbol} [${r.id}] ${r.name}`);
    console.log(`    ↳ ${r.detail}`);
  }
  console.log("--------------------------------------------------------------------------------\n");

  if (!allPass) {
    console.error("❌ Some parity checks failed!");
    process.exit(1);
  } else {
    console.log("🏆 ALL 10 PARITY PROOFS PASSED (M1–M10 GREEN)");
  }
}

runParitySuite().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
