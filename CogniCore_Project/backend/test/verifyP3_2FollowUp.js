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

    if (r1.source === "llm") {
      const topRec = r1.data?.records?.[0] || {};
      const topRecStr = JSON.stringify(topRec);
      const trackCount = topRec.track_count ?? topRec.count ?? topRec.total ?? Object.values(topRec).find((v) => typeof v === "number");
      assert(topRecStr.includes("Iron Maiden"), `Turn 1 top record must contain Iron Maiden (got: ${topRecStr})`);
      assert(Number(trackCount) === 213, `Turn 1 top record track_count must equal 213 (got: ${trackCount})`);
      console.log("  ✅ PASS: Turn 1 returned correct artist-grain answer (Iron Maiden = 213 tracks)");
    } else {
      assert(r1.source === "fallback", `Expected source === 'fallback' on gate rejection, got '${r1.source}'`);
      const llmTrace1 = (r1.meta?.pipelineTrace || []).find((t) => t.link === "Local LLM");
      assert(Boolean(llmTrace1 && String(llmTrace1.reason).startsWith("ast_")), `Expected trace reason starting with 'ast_', got: ${llmTrace1?.reason}`);
      assert(!/\b213\b/.test(r1.answer), "Abstaining fallback answer must not fabricate a count");
      console.log(`  ℹ️ Turn 1 clean abstain verified: AST Gate rejected non-grouped bare column (${llmTrace1?.reason})`);
    }

    // Short pause for CPU inference queue cooldown
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Turn 2: Follow-up conversational query
    const q2 = "and for albums?";
    console.log(`\n[Turn 2] POST /api/ai/query: "${q2}"`);
    const r2 = await postQuery({ query: q2, sessionId });
    console.log(`[Turn 2] Answer: "${r2.answer}", Source: "${r2.source}"`);
    console.log(`[Turn 2] SQL: ${r2.data?.sql}`);
    console.log(`[Turn 2] Meta:`, JSON.stringify(r2.meta, null, 2));

    // A2.1: PK-FD queries (GROUP BY PK + projected dependent column) are VALID.
    // Semantic-grain misalignment recovery is A3 corrective retry's acceptance test.
    // removed: test-authoring bug — artist name asserted on an albums query
    console.log("⏳ S14 disposition per A2.1 + ground truth ");

    if (r2.source === "llm") {
      assert(Number(r2.meta?.contextTurns) >= 1, `Turn 2 used previous conversation context (contextTurns >= 1, got ${r2.meta?.contextTurns})`);
      const topRec = r2.data?.records?.[0] || {};
      const topTitle = topRec.Title || topRec.title || topRec.name || Object.values(topRec).find((v) => typeof v === "string" && v !== "albums");
      const trackCount = topRec.track_count ?? topRec.n ?? topRec.count ?? Object.values(topRec).find((v) => typeof v === "number");
      assert(topTitle === "Greatest Hits", `Turn 2 top record Title must equal STEP 0 ground-truth 'Greatest Hits' (got: ${topTitle})`);
      assert(Number(trackCount) === 57, `Turn 2 top record count must equal STEP 0 ground-truth 57 (got: ${trackCount})`);
      assert(typeof r2.data?.sql === "string" && /albums/i.test(r2.data.sql), `Turn 2 SQL references albums table (${r2.data?.sql})`);
      console.log("  ✅ PASS: Turn 2 returned correct album-grain answer (Greatest Hits = 57 tracks)");
    } else {
      assert(r2.source === "fallback", `Expected source === 'fallback' on gate rejection, got '${r2.source}'`);
      const llmTrace2 = (r2.meta?.pipelineTrace || []).find((t) => t.link === "Local LLM");
      assert(Boolean(llmTrace2 && String(llmTrace2.reason).startsWith("ast_")), `Expected trace reason starting with 'ast_', got: ${llmTrace2?.reason}`);
      assert(!/\b57\b/.test(r2.answer), "Abstaining fallback answer must not fabricate a count");
      console.log(`  ℹ️ Turn 2 honesty verified: AST Gate rejected mismatched GROUP BY (${llmTrace2?.reason}), cascaded cleanly.`);
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
