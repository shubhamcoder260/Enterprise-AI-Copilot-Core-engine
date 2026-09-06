import path from "path";
import { fileURLToPath } from "url";
import { switchDatabase, getActiveDatabasePath } from "./src/config/database.js";
import { runDynamicQuery } from "./src/core/dynamic.query.engine.js";
import {
  clearSchemaCache,
  resetSchemaCacheStats,
  getSchemaCacheStats,
  readDatabaseSchema
} from "./src/core/schema.reader.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const cognicoreDb = path.join(__dirname, "cognicore.db");
const badDbPath = path.join(__dirname, "nonexistent_corrupt_database_99999.db");

async function runTest4() {
  console.log("\n========================================================");
  console.log("🧪 TEST 4: FAILED-SWITCH CACHE CONSISTENCY");
  console.log("========================================================\n");

  // Step 1: Establish known baseline on cognicore.db
  await switchDatabase(cognicoreDb);
  resetSchemaCacheStats();

  console.log("▶️ [STEP 4.1] Establishing baseline query on cognicore.db...");
  const initialResult = await runDynamicQuery("how many students");
  const initialSchema = await readDatabaseSchema();
  const initialTables = Object.keys(initialSchema);

  console.log("Active DB before failed switch:", getActiveDatabasePath());
  console.log("Cached Tables before switch   :", initialTables);
  console.log("Query Answer before switch    :", initialResult.answer);

  // Step 2: Attempt switchDatabase() with bad/nonexistent path
  console.log("\n▶️ [STEP 4.2] Calling switchDatabase() with nonexistent path:", badDbPath);
  let switchError = null;
  try {
    await switchDatabase(badDbPath);
  } catch (err) {
    switchError = err;
    console.log("Caught expected switch failure error:", err.message);
  }

  if (!switchError) {
    console.error("❌ ERROR: switchDatabase should have thrown on nonexistent file!");
    process.exit(1);
  }

  // Step 3: Check in-memory active database path
  const currentActivePath = getActiveDatabasePath();
  console.log("\n▶️ [STEP 4.3] Active database path after failed switch:", currentActivePath);

  // Step 4: Run dynamic query after failed switch
  console.log("\n▶️ [STEP 4.4] Executing query after failed switch: 'show records from students'");
  const postFailResult = await runDynamicQuery("show records from students");
  const postFailSchema = await readDatabaseSchema();
  const postFailTables = Object.keys(postFailSchema);

  console.log("Post-fail cached tables :", postFailTables);
  console.log("Post-fail query answer  :", postFailResult.answer);
  console.log("Post-fail query success :", postFailResult.success);
  console.log("Post-fail stats         :", getSchemaCacheStats());

  // Step 5: Assert consistency
  console.log("\n========================================================");
  console.log("📊 TEST 4 VERIFICATION SUMMARY");
  console.log("========================================================");
  console.log(`Switch rejected error msg       : "${switchError.message}"`);
  console.log(`Active DB remained unchanged     : ${currentActivePath === cognicoreDb}`);
  console.log(`Schema cache tables match DB     : ${postFailTables.includes("students") && postFailTables.includes("hospital_visits")}`);
  console.log(`Query succeeded against active DB: ${postFailResult.success}`);

  const passed =
    currentActivePath === cognicoreDb &&
    postFailResult.success &&
    postFailTables.includes("students");

  if (passed) {
    console.log("\n✅ SUCCESS: Failed switch maintained perfect cache consistency with the active DB connection!");
  } else {
    console.error("\n❌ FAILED: State mismatch after failed switch!");
    process.exit(1);
  }
}

runTest4().catch((err) => {
  console.error("Test 4 error:", err);
  process.exit(1);
});
