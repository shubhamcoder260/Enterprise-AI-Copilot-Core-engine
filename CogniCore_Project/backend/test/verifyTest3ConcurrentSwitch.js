import path from "path";
import { fileURLToPath } from "url";
import fs from "fs/promises";
import { switchDatabase, getActiveDatabasePath } from "../src/config/database.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const cognicoreDb = path.join(__dirname, "..", "fixtures", "cognicore.db");
const chinookDb = path.join(__dirname, "..", "fixtures", "chinook.db");
const configFile = path.join(__dirname, "..", "active-database.json");

async function runTest3() {
  console.log("\n========================================================");
  console.log("🧪 TEST 3: CONCURRENT SWITCH RACE");
  console.log("========================================================\n");

  console.log("Firing two switchDatabase() calls concurrently (Promise.all, not awaited sequentially)...");
  console.log("Call A target:", cognicoreDb);
  console.log("Call B target:", chinookDb);

  // Fire both simultaneously without awaiting sequentially
  const [resA, resB] = await Promise.all([
    switchDatabase(cognicoreDb),
    switchDatabase(chinookDb)
  ]);

  console.log("\n✅ Both concurrent switch calls resolved.");
  console.log("In-memory active database:", getActiveDatabasePath());

  // Check active-database.json
  const rawContent = await fs.readFile(configFile, "utf8");
  console.log("\n📄 Content of active-database.json:");
  console.log(rawContent);

  // Parse to verify it is valid, coherent JSON
  let parsed;
  try {
    parsed = JSON.parse(rawContent);
    console.log("✅ JSON is valid!");
    console.log("Persisted activeDatabasePath:", parsed.activeDatabasePath);
  } catch (err) {
    console.error("❌ Invalid JSON in active-database.json:", err.message);
    process.exit(1);
  }

  const isCoherent =
    parsed.activeDatabasePath === cognicoreDb ||
    parsed.activeDatabasePath === chinookDb;

  if (isCoherent) {
    console.log(`\n✅ SUCCESS: File is valid, coherent JSON with single complete path: ${parsed.activeDatabasePath}`);
  } else {
    console.error("\n❌ FAILED: File content was corrupted or interleaved!");
    process.exit(1);
  }
}

runTest3().catch((err) => {
  console.error("Test 3 error:", err);
  process.exit(1);
});
