import { spawnSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const suites = [
  { name: "1. Security & Object-Level Authorization (IDOR)", script: "test/verify_authorization_security.js" },
  { name: "2. Comprehensive E2E Requirements Battery (R1 - R7)", script: "test/verify_academic_e2e_full.js" },
  { name: "3. Core USPs (Debarment Forecast, Backtest, Ledger Verify, Outbox, What-If)", script: "test/verify_usps.js" },
  { name: "4. AST Gate & Hostile Injection Defense (DROP/UPDATE/Stacking)", script: "test/verify_ast_gate.js" }
];

console.log("\n======================================================================");
console.log("    UNIVERSITY X ACADEMIC MONITORING SYSTEM — MASTER PROOF SUITE       ");
console.log("======================================================================");

let allPassed = true;

for (const suite of suites) {
  console.log(`\n▶ EXECUTING SUITE: ${suite.name}`);
  const scriptPath = path.resolve(__dirname, "..", suite.script);
  const result = spawnSync("node", [scriptPath], {
    stdio: "inherit",
    cwd: path.resolve(__dirname, ".."),
    env: process.env
  });

  if (result.status !== 0) {
    console.error(`❌ FAILED: ${suite.name}`);
    allPassed = false;
    process.exit(result.status || 1);
  }
}

console.log("\n======================================================================");
console.log("🏆 ALL MASTER VERIFICATION BATTERIES PASSED CLEANLY WITH ZERO DEFECTS  ");
console.log("======================================================================\n");
