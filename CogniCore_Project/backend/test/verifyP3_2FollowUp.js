// ==========================================
// VERIFICATION TEST P3.2: FOLLOW-UP CONTEXT RESOLUTION
// ==========================================

import path from "path";
import { fileURLToPath } from "url";
import { initHistoryStore } from "../src/store/history.store.js";
import { executeReadOnlySql } from "../src/config/database.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE_URL = "http://localhost:5000";

async function postQuery({ query, sessionId }) {
  const res = await fetch(`${BASE_URL}/api/ai/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query,
      sessionId,
      organization: "college",
      role: "admin"
    })
  });
  return res.json();
}

async function switchDb(dbPath) {
  const res = await fetch(`${BASE_URL}/api/database/switch`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ databasePath: dbPath })
  });
  return res.json();
}

async function run() {
  console.log("==========================================");
  console.log("VERIFY P3.2: FOLLOW-UP QUERY VIA CONTEXT RESOLUTION");
  console.log("==========================================\n");

  const sessionId = "session-p3-followup";

  // Clean up any previous test runs for this session
  const historyDb = await initHistoryStore();
  await historyDb.run("DELETE FROM exchanges WHERE session_id = ?", [sessionId]);

  // Ensure active database is chinook.db
  const chinookPath = path.resolve(__dirname, "..", "fixtures", "chinook.db");
  await switchDb(chinookPath);

  // Turn 1: Anchor query
  const q1 = "Top 5 artists by number of tracks";
  console.log(`[Turn 1] POST /api/ai/query: "${q1}"`);
  const r1 = await postQuery({ query: q1, sessionId });
  console.log(`[Turn 1] Answer: "${r1.answer}", Source: "${r1.source}"`);
  console.log(`[Turn 1] SQL: ${r1.data?.sql}`);

  // Short pause for CPU inference queue cooldown
  await new Promise((resolve) => setTimeout(resolve, 3000));

  // Turn 2: Follow-up conversational query
  const q2 = "and for albums?";
  console.log(`\n[Turn 2] POST /api/ai/query: "${q2}"`);
  const r2 = await postQuery({ query: q2, sessionId });
  console.log(`[Turn 2] Answer: "${r2.answer}", Source: "${r2.source}"`);
  console.log(`[Turn 2] SQL: ${r2.data?.sql}`);
  console.log(`[Turn 2] Meta:`, JSON.stringify(r2.meta, null, 2));
  console.log(`[Turn 2] Records:`, JSON.stringify(r2.data?.records, null, 2));

  // Ground truth for "Top 5 artists by number of albums"
  const groundTruthRows = await executeReadOnlySql(`
    SELECT artists.Name, COUNT(albums.AlbumId) AS album_count
    FROM artists
    JOIN albums ON artists.ArtistId = albums.ArtistId
    GROUP BY artists.ArtistId
    ORDER BY album_count DESC
    LIMIT 5;
  `);
  console.log("\n[Ground Truth Top 5 Artists by Albums]:\n", groundTruthRows);

  let passed = true;
  function assert(condition, message) {
    if (condition) {
      console.log(`✅ PASS: ${message}`);
    } else {
      console.error(`❌ FAIL: ${message}`);
      passed = false;
    }
  }

  assert(r2.source === "llm", `Expected Turn 2 source === 'llm', got '${r2.source}'`);
  assert(typeof r2.data?.sql === "string" && /albums/i.test(r2.data.sql), `Turn 2 SQL references albums table (${r2.data?.sql})`);
  assert(Array.isArray(r2.data?.records) && r2.data.records.length > 0, "Turn 2 returned non-empty records array");
  assert(Number(r2.meta?.contextTurns) >= 1, `Turn 2 used previous conversation context (contextTurns >= 1, got ${r2.meta?.contextTurns})`);

  // Verify top artist matches ground truth (Iron Maiden)
  if (r2.data?.records && r2.data.records.length > 0) {
    const firstRow = r2.data.records[0];
    const rowValues = Object.values(firstRow).map(v => String(v).toLowerCase());
    const hasIronMaiden = rowValues.some(v => v.includes("iron maiden"));
    assert(hasIronMaiden, `Turn 2 top result contains 'Iron Maiden' (got: ${JSON.stringify(firstRow)})`);
  }

  console.log("\n------------------------------------------");
  console.log(passed ? "🎉 VERIFY P3.2 PASSED" : "💥 VERIFY P3.2 FAILED");
  console.log("------------------------------------------");
  process.exit(passed ? 0 : 1);
}

run().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
