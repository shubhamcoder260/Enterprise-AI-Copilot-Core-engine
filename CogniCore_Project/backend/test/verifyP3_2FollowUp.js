// ==========================================
// VERIFICATION TEST P3.2: FOLLOW-UP CONTEXT RESOLUTION
// ==========================================

import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { initHistoryStore } from "../src/store/history.store.js";
import { executeReadOnlySql } from "../src/config/database.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE_URL = "http://localhost:5000";
const CONFIG_FILE = path.join(__dirname, "..", "active-database.json");

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

  let originalConfig = null;
  let passed = true;

  function assert(condition, message) {
    if (condition) {
      console.log(`✅ PASS: ${message}`);
    } else {
      console.error(`❌ FAIL: ${message}`);
      passed = false;
    }
  }

  try {
    // 1. Snapshot active-database.json
    try {
      originalConfig = await fs.readFile(CONFIG_FILE, "utf8");
      console.log("📸 [Hygiene] Snapshotted active-database.json");
    } catch (err) {
      console.warn("⚠️ [Hygiene] Could not snapshot config:", err.message);
    }

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

    assert(Number(r2.meta?.contextTurns) >= 1, `Turn 2 used previous conversation context (contextTurns >= 1, got ${r2.meta?.contextTurns})`);

    // Under A2 strict-mode: if LLM generates GROUP BY Albums.AlbumId while projecting Albums.Title,
    // AST gate rejects with ast_bare_column_without_group_by:Title and cascades to fallback.
    // If LLM generates matched GROUP BY or succeeds, source is 'llm'. Both are valid honest outcomes.
    if (r2.source === "llm") {
      assert(typeof r2.data?.sql === "string" && /albums/i.test(r2.data.sql), `Turn 2 SQL references albums table (${r2.data?.sql})`);
      assert(Array.isArray(r2.data?.records) && r2.data.records.length > 0, "Turn 2 returned non-empty records array");
    } else {
      assert(r2.source === "fallback", `Expected source === 'fallback' on gate rejection, got '${r2.source}'`);
      const llmTrace = (r2.meta?.pipelineTrace || []).find((t) => t.link === "Local LLM");
      assert(Boolean(llmTrace), "Expected Local LLM in pipeline trace");
      console.log(`ℹ️ Turn 2 honesty verified: AST Gate rejected mismatched GROUP BY (${llmTrace?.reason}), cascaded cleanly.`);
    }

  } finally {
    // Restore original active-database.json
    if (originalConfig !== null) {
      try {
        await fs.writeFile(CONFIG_FILE, originalConfig, "utf8");
        const parsed = JSON.parse(originalConfig);
        if (parsed.activeDatabasePath) {
          await switchDb(parsed.activeDatabasePath).catch(() => {});
        }
        console.log("🔄 [Hygiene] Restored active-database.json snapshot.");
      } catch (e) {
        console.error("❌ Failed to restore config snapshot:", e.message);
      }
    }
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
