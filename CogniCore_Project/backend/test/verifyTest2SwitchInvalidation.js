import path from "path";
import { fileURLToPath } from "url";
import { switchDatabase } from "../src/config/database.js";
import { runDynamicQuery } from "../src/core/dynamic.query.engine.js";
import {
  clearSchemaCache,
  resetSchemaCacheStats,
  getSchemaCacheStats,
  readDatabaseSchema
} from "../src/core/schema.reader.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const cognicoreDb = path.join(__dirname, "..", "fixtures", "cognicore.db");
const chinookDb = path.join(__dirname, "..", "fixtures", "chinook.db");

async function runTest2() {
  console.log("\n========================================================");
  console.log("🧪 TEST 2: CACHE INVALIDATION ON DATABASE SWITCH");
  console.log("========================================================\n");

  // Step 1: Ensure we start on cognicore.db with a fresh cache
  await switchDatabase(cognicoreDb);
  resetSchemaCacheStats();

  console.log("--- Initial State on cognicore.db ---");
  console.log("Active DB:", cognicoreDb);
  console.log("Initial Stats:", getSchemaCacheStats());

  // Step 2: Query against cognicore.db to populate cache
  console.log("\n▶️ [STEP 2.1] Querying cognicore.db: 'show records from students'");
  await runDynamicQuery("show records from students");
  const statsAfterCognicore = getSchemaCacheStats();
  const schemaCognicore = await readDatabaseSchema();
  const tablesCognicore = Object.keys(schemaCognicore);

  console.log("\n📌 Stats after querying cognicore.db:", statsAfterCognicore);
  console.log("📋 Cached Tables for cognicore.db:", tablesCognicore);

  // Step 3: Switch database to chinook.db
  console.log("\n▶️ [STEP 2.2] Calling switchDatabase() to chinook.db...");
  await switchDatabase(chinookDb);

  // Step 4: Run a query against chinook.db
  console.log("\n▶️ [STEP 2.3] Querying chinook.db: 'how many artists'");
  const chinookResult = await runDynamicQuery("how many artists");
  const statsAfterChinook = getSchemaCacheStats();
  const schemaChinook = await readDatabaseSchema();
  const tablesChinook = Object.keys(schemaChinook);

  console.log("\n📌 Stats after querying chinook.db:", statsAfterChinook);
  console.log("📋 Cached Tables for chinook.db (first 5):", tablesChinook.slice(0, 5));
  console.log("📋 Total Tables in chinook.db:", tablesChinook.length);
  console.log("💬 Query Answer:", chinookResult.answer);

  // Step 5: Verification assertions
  console.log("\n========================================================");
  console.log("📊 TEST 2 VERIFICATION SUMMARY");
  console.log("========================================================");
  console.log(`cognicore.db DB Schema Reads : ${statsAfterCognicore.dbReads}`);
  console.log(`chinook.db DB Schema Reads   : ${statsAfterChinook.dbReads - statsAfterCognicore.dbReads}`);
  console.log(`Total DB Schema Reads        : ${statsAfterChinook.dbReads}`);
  console.log(`Tables in DB 1 (cognicore)   : [${tablesCognicore.join(", ")}]`);
  console.log(`Does chinook have 'students'? : ${tablesChinook.includes("students")}`);
  console.log(`Does chinook have 'artists'?  : ${tablesChinook.includes("Artist") || tablesChinook.includes("artists") || tablesChinook.includes("Artist") || tablesChinook.some(t => t.toLowerCase() === "artist" || t.toLowerCase() === "artists")}`);

  // Restore back to cognicore.db
  await switchDatabase(cognicoreDb);
  console.log("\n🔄 Restored active database to cognicore.db");

  const readIncremented = statsAfterChinook.dbReads > statsAfterCognicore.dbReads;
  const tablesSwitched = !tablesChinook.includes("students") && (tablesChinook.includes("Artist") || tablesChinook.some(t => t.toLowerCase().includes("artist")));

  if (readIncremented && tablesSwitched) {
    console.log("\n✅ SUCCESS: Cache was invalidated on switch, read count incremented, and new schema matches new database!");
  } else {
    console.error("\n❌ FAILED: Schema was not properly refreshed or matched old database!");
    process.exit(1);
  }
}

runTest2().catch((err) => {
  console.error("Test 2 error:", err);
  process.exit(1);
});
