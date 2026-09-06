import path from "path";
import { fileURLToPath } from "url";
import { switchDatabase, executeReadOnlySql, connectDatabase } from "./src/config/database.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const cognicoreDb = path.join(__dirname, "cognicore.db");

async function main() {
  console.log("\n================================================================================");
  console.log("🧪 TEST SUITE: verifyLlm3ReadOnlyPhysical.js");
  console.log("================================================================================\n");

  // Step 1: Ensure we are on cognicore.db
  await switchDatabase(cognicoreDb);

  // Step 2: Read baseline CGPA values
  const baselineRows = await executeReadOnlySql("SELECT id, name, cgpa FROM students ORDER BY id;");
  console.log("📊 Baseline rows before attack:", baselineRows);
  const originalCgpa = baselineRows[0].cgpa;

  // Step 3: Attempt write on read-only connection (bypassing validator)
  console.log("\n⚠️ [ATTACK ATTEMPT] Bypassing validator and firing UPDATE on read-only connection...");
  let driverError = null;
  try {
    await executeReadOnlySql("UPDATE students SET cgpa = 10.0 WHERE id = 1;");
    console.error("❌ CRITICAL FAILURE: Read-only connection permitted an UPDATE!");
    process.exit(1);
  } catch (err) {
    driverError = err;
    console.log("🛡️ Driver caught and rejected mutation with error:", err.message);
  }

  // Step 4: Verify rows in physical database are 100% unchanged
  const postAttackRows = await executeReadOnlySql("SELECT id, name, cgpa FROM students ORDER BY id;");
  console.log("\n📊 Post-attack rows:", postAttackRows);
  const postAttackCgpa = postAttackRows[0].cgpa;

  const rejectedProperly =
    driverError !== null &&
    (driverError.message.includes("readonly") || driverError.code === "SQLITE_READONLY");
  const valueUnchanged = originalCgpa === postAttackCgpa && postAttackCgpa !== 10.0;

  console.log("\n================================================================================");
  console.log("📊 TEST 3 SUMMARY");
  console.log("================================================================================");
  console.log(`Driver error thrown      : ${rejectedProperly} ("${driverError?.message}")`);
  console.log(`Original CGPA preserved  : ${valueUnchanged} (${originalCgpa} === ${postAttackCgpa})`);

  if (rejectedProperly && valueUnchanged) {
    console.log("\n✅ SUCCESS: Physical read-only lock strictly prevented database mutation!");
  } else {
    console.error("\n❌ FAILED: Mutation was not prevented or data changed!");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Error in verifyLlm3ReadOnlyPhysical.js:", err);
  process.exit(1);
});
