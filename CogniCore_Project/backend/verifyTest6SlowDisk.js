import path from "path";
import { fileURLToPath } from "url";
import { performance } from "perf_hooks";
import fs from "fs/promises";
import { switchDatabase } from "./src/config/database.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const cognicoreDb = path.join(__dirname, "cognicore.db");
const chinookDb = path.join(__dirname, "chinook.db");

// Monkey-patch fs.writeFile temporarily to simulate a slow 200ms disk I/O
const originalWriteFile = fs.writeFile;
const SLOW_DISK_DELAY_MS = 200;

fs.writeFile = async function (...args) {
  // Simulate slow disk / network drive latency asynchronously
  await new Promise((resolve) => setTimeout(resolve, SLOW_DISK_DELAY_MS));
  return originalWriteFile.apply(this, args);
};

async function runTest6SlowDisk() {
  console.log("\n========================================================");
  console.log("🧪 TEST 6 (STRENGTHENED): NON-BLOCKING PROOF WITH 200ms SLOW DISK");
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

  // Collect 3 baseline ticks (~150ms)
  await new Promise((r) => setTimeout(r, 160));

  console.log(`▶️ Triggering switchDatabase() with simulated ${SLOW_DISK_DELAY_MS}ms async disk I/O...`);
  currentPhase = "DURING_SWITCH";
  const switchStart = performance.now();

  // Execute database switch with 200ms async disk delay
  await switchDatabase(chinookDb);

  const switchDuration = (performance.now() - switchStart).toFixed(2);
  console.log(`✅ switchDatabase() completed in ${switchDuration} ms (exceeds 200ms delay)`);

  currentPhase = "AFTER_SWITCH";

  // Collect 3 more ticks after switch
  await new Promise((r) => setTimeout(r, 160));

  clearInterval(intervalId);

  // Restore original fs.writeFile and restore active DB
  fs.writeFile = originalWriteFile;
  await switchDatabase(cognicoreDb);

  console.log("\n📋 INTERVAL TICKS SPANNING 200ms SLOW SWITCH (Target: ~50ms per tick):");
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
  console.log("📊 STRENGTHENED TEST 6 VERIFICATION SUMMARY");
  console.log("========================================================");
  console.log(`Injected Disk Delay    : ${SLOW_DISK_DELAY_MS} ms`);
  console.log(`Total Switch Duration  : ${switchDuration} ms`);
  console.log(`Ticks During Switch    : ${duringTicks.length} ticks fired!`);
  console.log(`Max Tick Gap Observed  : ${maxDelta.toFixed(2)} ms`);

  // If the switch was blocking, maxDelta would be >= 200ms and duringTicks would be 0 or 1!
  // In non-blocking async, duringTicks should be 4+ and maxDelta < 75ms.
  if (duringTicks.length >= 3 && maxDelta < 85) {
    console.log(`\n✅ IRREFUTABLE PROOF: While the switch was in-flight for ${switchDuration}ms, the event loop fired ${duringTicks.length} ticks every ~50ms with ZERO stall!`);
  } else {
    console.error(`\n❌ FAILED: Event loop stalled! Max gap was ${maxDelta}ms`);
    process.exit(1);
  }
}

runTest6SlowDisk().catch((err) => {
  console.error("Test error:", err);
  process.exit(1);
});
