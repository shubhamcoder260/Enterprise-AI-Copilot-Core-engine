// ==========================================
// VERIFICATION TEST 5: Complex JOIN / Aggregation (chinook.db)
// ==========================================

import { runCoreEngine } from "./src/core/core.engine.js";
import { executeReadOnlySql, switchDatabase } from "./src/config/database.js";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function runTest() {
  console.log("==========================================");
  console.log("TEST 5: COMPLEX JOIN & AGGREGATION VIA LOCAL LLM");
  console.log("==========================================\n");

  // 1. Switch database to chinook.db
  const chinookPath = path.resolve(__dirname, "chinook.db");
  console.log(`[Test] Switching to chinook.db: ${chinookPath}`);
  await switchDatabase(chinookPath);

  const query = "Which 5 artists have the most tracks?";
  console.log(`[Test] Submitting query: "${query}"`);

  const startTime = Date.now();
  const response = await runCoreEngine({
    query,
    organization: "music_store",
    role: "analyst",
    sessionId: "test-session-5"
  });
  const elapsed = Date.now() - startTime;

  console.log("\n[Test] Engine Response Envelope:");
  console.log(JSON.stringify(response, null, 2));

  // Ground truth query
  const groundTruthRows = await executeReadOnlySql(`
    SELECT artists.Name, COUNT(tracks.TrackId) AS track_count
    FROM artists
    JOIN albums ON artists.ArtistId = albums.ArtistId
    JOIN tracks ON albums.AlbumId = tracks.AlbumId
    GROUP BY artists.ArtistId
    ORDER BY track_count DESC
    LIMIT 5;
  `);

  console.log("\n[Test] Ground Truth Rows:", groundTruthRows);

  let passed = true;

  function assert(condition, message) {
    if (condition) {
      console.log(`✅ PASS: ${message}`);
    } else {
      console.error(`❌ FAIL: ${message}`);
      passed = false;
    }
  }

  assert(response.source === "llm", `Expected response.source === 'llm', got '${response.source}'`);
  assert(response.meta?.engineMode === "local_llm", `Expected meta.engineMode === 'local_llm', got '${response.meta?.engineMode}'`);
  assert(typeof response.data?.sql === "string", "Expected data.sql to be string");

  const sqlUpper = (response.data?.sql || "").toUpperCase();
  assert(sqlUpper.includes("JOIN"), "Expected SQL to contain JOIN");
  assert(sqlUpper.includes("GROUP BY"), "Expected SQL to contain GROUP BY");
  assert(sqlUpper.includes("ORDER BY"), "Expected SQL to contain ORDER BY");
  assert(sqlUpper.includes("DESC"), "Expected SQL to contain DESC");
  assert(sqlUpper.includes("LIMIT 5") || sqlUpper.includes("LIMIT 50"), "Expected SQL to have LIMIT clause");

  assert(Array.isArray(response.data?.records), "Expected data.records to be an array");
  assert(response.data?.rowCount === 5, `Expected rowCount === 5, got ${response.data?.rowCount}`);

  // Check top artist is Iron Maiden with 213 tracks
  const firstRow = response.data?.records?.[0] || {};
  const artistNameVal = Object.values(firstRow).find(v => typeof v === "string" && v.toLowerCase().includes("iron maiden"));
  assert(Boolean(artistNameVal), `Expected top artist to be Iron Maiden, got ${JSON.stringify(firstRow)}`);

  const trackCountVal = Object.values(firstRow).find(v => v === 213 || v === "213");
  assert(Boolean(trackCountVal), `Expected top track count to be 213, got ${JSON.stringify(firstRow)}`);

  console.log("\n==========================================");
  if (passed) {
    console.log(`🎉 TEST 5 PASSED: Complex JOIN verified in ${elapsed}ms`);
  } else {
    console.error("💥 TEST 5 FAILED");
    process.exit(1);
  }
  console.log("==========================================");
}

runTest().catch((err) => {
  console.error("FATAL in test 5:", err);
  process.exit(1);
});
