// ==========================================
// TEST: PHASE 3 DISTINCT CACHE STALENESS
// Populates cache on DB A, switches to DB B, asserts no stale values from DB A.
// ==========================================

import path from "path";
import { fileURLToPath } from "url";
import { switchDatabase, getActiveDatabasePath } from "../src/config/database.js";
import { readDatabaseSchema } from "../src/core/schema.reader.js";
import {
  ensureDistinctCacheLoaded,
  getDistinct,
  clearDistinctCache
} from "../src/core/distinct.cache.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const COLLEGE_DB = path.resolve(
  __dirname,
  "../uploads/1788767199100-college_attendance_(3).db"
);
const CHINOOK_DB = path.resolve(__dirname, "..", "fixtures", "chinook.db");

async function runStalenessTest() {
  console.log("==========================================");
  console.log("   PHASE 3: DISTINCT CACHE STALENESS TEST ");
  console.log("==========================================\n");

  const originalDb = getActiveDatabasePath();

  try {
    // Step 1: Switch to College Attendance DB (DB A)
    console.log("1. Switching to College Attendance DB (DB A)...");
    await switchDatabase(COLLEGE_DB);
    const schemaA = await readDatabaseSchema(true);
    await ensureDistinctCacheLoaded(schemaA);

    const attendanceVals = getDistinct("attendance");
    console.log(`   Cached distinct values for 'attendance':`, attendanceVals.map(v => v.value));
    if (!attendanceVals.some(v => v.value === "Present")) {
      throw new Error("Expected 'Present' in cached values for DB A");
    }
    console.log("   ✅ DB A cache populated successfully.\n");

    // Step 2: Switch to Chinook DB (DB B)
    console.log("2. Switching to Chinook DB (DB B)...");
    await switchDatabase(CHINOOK_DB);

    // Assert cache is invalidated immediately upon switch
    const staleAttendanceVals = getDistinct("attendance");
    console.log(`   Cached distinct values for 'attendance' after switch:`, staleAttendanceVals);
    if (staleAttendanceVals.length !== 0) {
      throw new Error("CRITICAL BUG: Cache survived database switch!");
    }
    console.log("   ✅ Assert: Cache was cleared immediately on switch.\n");

    // Step 3: Populate DB B cache
    console.log("3. Populating cache for Chinook DB (DB B)...");
    const schemaB = await readDatabaseSchema(true);
    await ensureDistinctCacheLoaded(schemaB);

    const artistsVals = getDistinct("artists");
    console.log(`   Cached distinct values for 'artists':`, artistsVals.slice(0, 3).map(v => v.value));
    
    // Step 4: Ensure no cross-contamination between DB A and DB B
    const crossCheckAttendance = getDistinct("attendance");
    if (crossCheckAttendance.length !== 0) {
      throw new Error("CRITICAL BUG: Stale table 'attendance' appeared in DB B cache!");
    }
    console.log("   ✅ Assert: No stale match from DB A in DB B.\n");

    console.log("🎉 Phase 3 Staleness Test: PASSED!");
  } finally {
    // Restore original DB
    if (originalDb) {
      console.log(`\nRestoring original DB: ${originalDb}`);
      await switchDatabase(originalDb);
    }
  }
}

runStalenessTest().catch((err) => {
  console.error("❌ Staleness Test Failed:", err);
  process.exit(1);
});
