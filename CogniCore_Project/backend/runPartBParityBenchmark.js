// ==========================================
// PART B: PARITY BENCHMARK (HTTP API END-TO-END)
// ==========================================

import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function switchDb(dbName) {
  const fullPath = path.resolve(__dirname, dbName);
  const res = await fetch("http://localhost:5000/api/database/switch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ databasePath: fullPath })
  });
  const data = await res.json();
  console.log(`\n[DB Switch] Active DB is now: ${data.activeDatabase}`);
}

async function queryApi(query, organization = "college", sessionId = "part-b") {
  await new Promise(r => setTimeout(r, 300));
  const start = Date.now();
  const res = await fetch("http://localhost:5000/api/ai/query", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, organization, sessionId })
  });
  const data = await res.json();
  const clientElapsed = Date.now() - start;
  return { ...data, clientElapsed };
}


async function runBenchmark() {
  console.log("==========================================");
  console.log("PART B: PARITY BENCHMARK (REAL USER HTTP API)");
  console.log("==========================================");

  const results = [];

  // Query A: Students with CGPA above 8.5
  await switchDb("cognicore.db");
  console.log("\n--- [Query A] 'Students with CGPA above 8.5' on cognicore.db ---");
  const resA = await queryApi("Students with CGPA above 8.5", "college", "part-b-a");
  console.log("Answer:", resA.answer);
  console.log("Source:", resA.source, "| Mode:", resA.meta?.engineMode, "| Duration:", resA.meta?.processingMs, "ms");
  // Ground truth: 3 students (Aarav 9.1, Maya 8.6, Kiran 9.4)
  const isCorrectA = resA.data?.records?.length === 3 || resA.answer?.includes("3");
  results.push({
    id: "a",
    query: "Students with CGPA above 8.5",
    db: "cognicore.db",
    link: resA.source,
    correct: isCorrectA,
    durationMs: resA.meta?.processingMs || resA.clientElapsed,
    raw: resA
  });

  // Query B: Foreign students not from India graduating in 2026
  console.log("\n--- [Query B] 'Foreign students not from India graduating in 2026' on cognicore.db ---");
  const resB = await queryApi("Foreign students not from India graduating in 2026", "college", "part-b-b");
  console.log("Answer:", resB.answer);
  console.log("Source:", resB.source, "| Mode:", resB.meta?.engineMode, "| Duration:", resB.meta?.processingMs, "ms");
  // Ground truth: 2 students (Maya Nepal 2026, Anita Sri Lanka 2026)
  const isCorrectB = resB.data?.records?.length === 2 || resB.answer?.includes("2");
  results.push({
    id: "b",
    query: "Foreign students not from India graduating in 2026",
    db: "cognicore.db",
    link: resB.source,
    correct: isCorrectB,
    durationMs: resB.meta?.processingMs || resB.clientElapsed,
    raw: resB
  });

  // Query C: Cardiology visits in January 2025
  console.log("\n--- [Query C] 'Cardiology visits in January 2025' on cognicore.db ---");
  const resC = await queryApi("Cardiology visits in January 2025", "hospital", "part-b-c");
  console.log("Answer:", resC.answer);
  console.log("Source:", resC.source, "| Mode:", resC.meta?.engineMode, "| Duration:", resC.meta?.processingMs, "ms");
  // Ground truth: 0 visits in Jan 2025 (all are Sep 2026)
  const isCorrectC = (resC.data?.records?.length === 0 || resC.data?.count === 0 || /0\s+visit|no\s+record|found\s+0/i.test(resC.answer));
  results.push({
    id: "c",
    query: "Cardiology visits in January 2025",
    db: "cognicore.db",
    link: resC.source,
    correct: isCorrectC,
    durationMs: resC.meta?.processingMs || resC.clientElapsed,
    raw: resC
  });

  // Switch to chinook.db
  await switchDb("chinook.db");

  // Query D: Top 5 artists by number of tracks
  console.log("\n--- [Query D] 'Top 5 artists by number of tracks' on chinook.db ---");
  const resD = await queryApi("Top 5 artists by number of tracks", "music_store", "part-b-d");
  console.log("Answer:", resD.answer);
  console.log("SQL:", resD.data?.sql);
  console.log("Source:", resD.source, "| Mode:", resD.meta?.engineMode, "| Duration:", resD.meta?.processingMs, "ms");
  const firstD = resD.data?.records?.[0] || {};
  const isCorrectD = (resD.data?.records?.length === 5) &&
    Object.values(firstD).some(v => typeof v === "string" && v.toLowerCase().includes("iron maiden"));
  results.push({
    id: "d",
    query: "Top 5 artists by number of tracks",
    db: "chinook.db",
    link: resD.source,
    correct: isCorrectD,
    durationMs: resD.meta?.processingMs || resD.clientElapsed,
    raw: resD
  });

  // Query E: Which artist has the most albums?
  console.log("\n--- [Query E] 'Which artist has the most albums?' on chinook.db ---");
  const resE = await queryApi("Which artist has the most albums?", "music_store", "part-b-e");
  console.log("Answer:", resE.answer);
  console.log("SQL:", resE.data?.sql);
  console.log("Source:", resE.source, "| Mode:", resE.meta?.engineMode, "| Duration:", resE.meta?.processingMs, "ms");
  const firstE = resE.data?.records?.[0] || {};
  const isCorrectE = Object.values(firstE).some(v => typeof v === "string" && v.toLowerCase().includes("iron maiden")) &&
    Object.values(firstE).some(v => v === 21 || v === "21");
  results.push({
    id: "e",
    query: "Which artist has the most albums?",
    db: "chinook.db",
    link: resE.source,
    correct: isCorrectE,
    durationMs: resE.meta?.processingMs || resE.clientElapsed,
    raw: resE
  });

  // Query F: Total revenue per country
  console.log("\n--- [Query F] 'Total revenue per country' on chinook.db ---");
  const resF = await queryApi("Total revenue per country", "music_store", "part-b-f");
  console.log("Answer:", resF.answer);
  console.log("SQL:", resF.data?.sql);
  console.log("Source:", resF.source, "| Mode:", resF.meta?.engineMode, "| Duration:", resF.meta?.processingMs, "ms");
  const firstF = resF.data?.records?.[0] || {};
  const isCorrectF = Object.values(firstF).some(v => typeof v === "string" && v.toLowerCase().includes("usa")) &&
    Object.values(firstF).some(v => Math.round(Number(v)) === 523);
  results.push({
    id: "f",
    query: "Total revenue per country",
    db: "chinook.db",
    link: resF.source,
    correct: isCorrectF,
    durationMs: resF.meta?.processingMs || resF.clientElapsed,
    raw: resF
  });

  console.log("\n==========================================");
  console.log("PART B BENCHMARK RESULTS SUMMARY TABLE");
  console.log("==========================================");
  console.table(results.map(r => ({
    Query: r.query,
    DB: r.db,
    Link: r.link,
    Correct: r.correct ? "YES" : "NO",
    "Duration (ms)": r.durationMs
  })));

  const anyFailedJoin = [results[3], results[4], results[5]].some(r => !r.correct);
  if (anyFailedJoin) {
    console.error("🚨 ALERT: One of (d)-(f) failed! Per rules: report and STOP — do not touch the prompt without review.");
    process.exit(1);
  } else {
    console.log("🎉 ALL PART B BENCHMARKS PASSED!");
  }
}

runBenchmark().catch(err => {
  console.error("FATAL in benchmark:", err);
  process.exit(1);
});
