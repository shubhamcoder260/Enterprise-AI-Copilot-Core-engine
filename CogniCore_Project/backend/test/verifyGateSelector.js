import assert from 'assert';
import { GATE_CHAIN } from '../src/kernel/gate.chain.js';
import { gateChainFor, GATE_CHAINS } from '../src/kernel/gate.selector.js';

console.log("==================================================");
console.log("       STEP 4 — VERIFYING GATE SELECTOR           ");
console.log("==================================================");

// 1. Identity equality for legacy SQLite invocations (CE-07 invariant)
console.log("\n[1] Testing legacy default SQLite identity equality...");
assert.strictEqual(gateChainFor(), GATE_CHAIN, "gateChainFor() must equal GATE_CHAIN by reference identity");
assert.strictEqual(gateChainFor(undefined), GATE_CHAIN, "gateChainFor(undefined) must equal GATE_CHAIN by reference identity");
assert.strictEqual(gateChainFor(null), GATE_CHAIN, "gateChainFor(null) must equal GATE_CHAIN by reference identity");
assert.strictEqual(gateChainFor({ dialect: 'sqlite' }), GATE_CHAIN, "gateChainFor({ dialect: 'sqlite' }) must equal GATE_CHAIN");
console.log("  ✅ gateChainFor() / gateChainFor(undefined) === GATE_CHAIN identity verified (CE-07 intact)");

// 2. MariaDB chain resolution & interface contract
console.log("\n[2] Testing MariaDB gate chain resolution and gate.type contract...");
const mariaChain = gateChainFor({ dialect: 'mariadb' });
assert.strictEqual(mariaChain.length, 3, "MariaDB chain must have 3 slots");
assert.strictEqual(mariaChain[0].name, "validator");
assert.strictEqual(mariaChain[0].type, "validate", "Slot 0 must have type 'validate'");
assert.strictEqual(mariaChain[0].dialect, "mariadb");
assert.strictEqual(mariaChain[1].name, "ast");
assert.strictEqual(mariaChain[1].type, "validate", "Slot 1 must have type 'validate'");
assert.strictEqual(mariaChain[1].dialect, "mariadb");
assert.strictEqual(mariaChain[2].name, "readonly-executor");
assert.strictEqual(mariaChain[2].type, "execute", "Slot 2 must have type 'execute'");
console.log("  ✅ MariaDB chain resolved with validator, ast, readonly-executor slots with valid gate.type");

// 2b. SQLite chain interface contract check
assert.strictEqual(GATE_CHAIN[0].type, "validate", "SQLite slot 0 must have type 'validate'");
assert.strictEqual(GATE_CHAIN[1].type, "validate", "SQLite slot 1 must have type 'validate'");
assert.strictEqual(GATE_CHAIN[2].type, "execute", "SQLite slot 2 must have type 'execute'");
console.log("  ✅ SQLite chain conforms to gate.type contract");

// 3. Strict Fail-Closed behavior on malformed or unrecognized dialects
console.log("\n[3] Testing strict fail-closed behavior on invalid/unsupported dialects...");

// 3a. Missing dialect property
assert.throws(() => {
  gateChainFor({});
}, /Invalid source descriptor: missing or malformed dialect/, "Empty object descriptor must throw");
console.log("  ✅ Rejects descriptor with missing dialect");

// 3b. Non-string dialect
assert.throws(() => {
  gateChainFor({ dialect: 123 });
}, /Invalid source descriptor: missing or malformed dialect/, "Non-string dialect must throw");
console.log("  ✅ Rejects non-string dialect");

// 3c. Empty string dialect
assert.throws(() => {
  gateChainFor({ dialect: "" });
}, /Invalid source descriptor: missing or malformed dialect/, "Empty string dialect must throw");
console.log("  ✅ Rejects empty string dialect");

// 3d. Unsupported / unrecognized dialect
assert.throws(() => {
  gateChainFor({ dialect: "unknown_engine_xyz" });
}, /Unsupported dialect: "unknown_engine_xyz"\. Refusing execution \(fail-closed\)/, "Unknown dialect must throw and refuse execution");
console.log("  ✅ Rejects unrecognized dialect 'unknown_engine_xyz' (fail-closed confirmed)");

// 3e. Postgres (deferred to D3)
assert.throws(() => {
  gateChainFor({ dialect: "postgres" });
}, /Unsupported dialect: "postgres"\. Refusing execution \(fail-closed\)/, "Postgres must throw in D0");
console.log("  ✅ Rejects currently-unconfigured dialect 'postgres' (fail-closed confirmed)");

// 4. Verification of MariaDB Validator & AST rules
console.log("\n[4] Verifying MariaDB specific gate rules...");
const validator = mariaChain[0];
const astGate = mariaChain[1];

// MariaDB validator: rejects INTO OUTFILE
const outfileRes = validator.run("SELECT * FROM `tabCustomer` INTO OUTFILE '/tmp/dump.txt'");
assert.strictEqual(outfileRes.valid, false, "INTO OUTFILE must be rejected by validator");
console.log("  ✅ MariaDB validator rejects INTO OUTFILE");

// MariaDB AST gate: accepts backticks
const backtickRes = astGate.run("SELECT `name`, `customer_name` FROM `tabCustomer`");
assert.strictEqual(backtickRes.valid, true, "Valid backtick query must pass AST gate");
console.log("  ✅ MariaDB AST gate accepts backtick identifiers");

// MariaDB AST gate: rejects INTO OUTFILE
const astOutfileRes = astGate.run("SELECT `name` FROM `tabCustomer` INTO OUTFILE '/tmp/leak.txt'");
assert.strictEqual(astOutfileRes.valid, false, "MariaDB AST gate must reject INTO OUTFILE");
console.log("  ✅ MariaDB AST gate rejects INTO OUTFILE");

// 5. Verification of 9-case MariaDB Golden Matrix (test/golden/ast_gate_mariadb_matrix.json)
console.log("\n[5] Verifying 9-case MariaDB Golden Matrix (CAP v2.2 Part VI)...");
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const matrixPath = path.join(__dirname, 'golden', 'ast_gate_mariadb_matrix.json');
const matrix = JSON.parse(fs.readFileSync(matrixPath, 'utf8'));

assert.strictEqual(matrix.length, 9, "MariaDB matrix must contain exactly 9 cases");

for (const tc of matrix) {
  const res = astGate.run(tc.sql);
  assert.strictEqual(
    res.valid,
    tc.expectedValid,
    `Matrix case ${tc.id} (${tc.description}) validity mismatch: got ${res.valid}, expected ${tc.expectedValid}`
  );
  if (tc.expectedReasonPrefix) {
    assert.ok(
      res.reason && res.reason.startsWith(tc.expectedReasonPrefix),
      `Matrix case ${tc.id} reason prefix mismatch: expected ${tc.expectedReasonPrefix}, got ${res.reason}`
    );
  }
  console.log(`  ✅ [${tc.id}] ${tc.description}`);
}

console.log("\n==================================================");
console.log("🏆 ALL GATE SELECTOR & MATRIX TESTS PASSED CLEANLY!");
console.log("==================================================");
