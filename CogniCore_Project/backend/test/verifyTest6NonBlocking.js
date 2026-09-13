import path from "path";
import { fileURLToPath } from "url";
import { performance } from "perf_hooks";
import { switchDatabase } from "../src/config/database.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const cognicoreDb = path.join(__dirname, "..", "fixtures", "cognicore.db");
const chinookDb = path.join(__dirname, "..", "fixtures", "chinook.db");

async function runTest6() {
  console.log("\n========================================================");
  console.log("🧪 TEST 6: NON-BLOCKING EVENT LOOP PROOF");
  console.log("========================================================\n");

  const TARGET_INTERVAL_MS = 50;
  const tickRecords = [];
  let currentPhase = "BEFORE_SWITCH";
  let tickCount = 0;
  let lastTickTime = performance.now();

  const intervalId = setInterval(() => {
    const now = performance.now();
    const deltaMs = now - lastTickTime;
    lastTickTime = now;
    tickCount++;

    tickRecords.push({
      tick: tickCount,
      phase: currentPhase,
      time: new Date().toISOString().slice(11, 23),
      deltaMs: parseFloat(deltaMs.toFixed(2))
    });
  }, TARGET_INTERVAL_MS);

  // Wait 200ms to collect 4 baseline ticks
  await new Promise((r) => setTimeout(r, 200));

  console.log("▶️ Triggering switchDatabase() during active 50ms interval...");
  currentPhase = "DURING_SWITCH";
  const switchStart = performance.now();

  // Execute the database switch
  await switchDatabase(chinookDb);

  const switchDuration = (performance.now() - switchStart).toFixed(2);
  console.log(`✅ switchDatabase() completed in ${switchDuration} ms`);

  currentPhase = "AFTER_SWITCH";

  // Collect 4 more ticks after the switch
  await new Promise((r) => setTimeout(r, 200));

  clearInterval(intervalId);

  // Restore database
  await switchDatabase(cognicoreDb);

  console.log("\n📋 INTERVAL TICKS SPANNING DATABASE SWITCH (Target: ~50ms):");
  console.log("------------------------------------------------------------------");
  console.log("| Tick | Phase         | Timestamp    | Delta (ms) | Drift vs 50ms |");
  console.log("------------------------------------------------------------------");
  for (const t of tickRecords) {
    const drift = (t.deltaMs - TARGET_INTERVAL_MS).toFixed(2);
    const paddedPhase = t.phase.padEnd(13, " ");
    const paddedTick = String(t.tick).padStart(4, " ");
    const paddedDelta = String(t.deltaMs.toFixed(1)).padStart(10, " ");
    const paddedDrift = (drift >= 0 ? `+${drift}` : drift).padStart(13, " ");
    console.log(`| ${paddedTick} | ${paddedPhase} | ${t.time} | ${paddedDelta} | ${paddedDrift} |`);
  }
  console.log("------------------------------------------------------------------");

  const duringTicks = tickRecords.filter((t) => t.phase === "DURING_SWITCH");
  const maxDelta = Math.max(...tickRecords.map((t) => t.deltaMs));

  console.log("\n========================================================");
  console.log("📊 TEST 6 VERIFICATION SUMMARY");
  console.log("========================================================");
  console.log(`Target Interval        : ${TARGET_INTERVAL_MS} ms`);
  console.log(`Total Ticks Captured   : ${tickRecords.length}`);
  console.log(`Ticks During Switch    : ${duringTicks.length}`);
  console.log(`Max Tick Gap Observed  : ${maxDelta.toFixed(2)} ms`);

  // An unblocked Node event loop will stay well below a synchronous freeze (e.g. < 70ms vs 50ms target)
  if (maxDelta < 85) {
    console.log("\n✅ SUCCESS: Event loop remained completely unblocked! Gaps stayed ~50ms throughout switch.");
  } else {
    console.error(`\n❌ FAILED: Event loop stalled! Max gap was ${maxDelta}ms`);
    process.exit(1);
  }
}

runTest6().catch((err) => {
  console.error("Test 6 error:", err);
  process.exit(1);
});
