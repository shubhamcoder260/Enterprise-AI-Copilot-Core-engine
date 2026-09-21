import assert from "assert";
import { SEMANTIC_PROFILE } from "../CogniCore_Project/backend/src/config/semantic.profile.js";
import { findMatchingTable } from "../CogniCore_Project/backend/src/core/schema.resolver.js";
import { formatSchemaForPrompt } from "../CogniCore_Project/backend/src/llm/sql.prompt.js";

console.log("=== RUNNING VERIFY SCHEMA ALIASES TESTS (A-U1 to A-U6) ===");

// A-U1: SEMANTIC_PROFILE.schemaAliases is frozen and contains all expected aliases
assert(Object.isFrozen(SEMANTIC_PROFILE.schemaAliases), "A-U1 fail: schemaAliases must be frozen");
assert.strictEqual(SEMANTIC_PROFILE.schemaAliases.stus, "students");
assert.strictEqual(SEMANTIC_PROFILE.schemaAliases.enrs, "enrollments");
assert.strictEqual(SEMANTIC_PROFILE.schemaAliases.depts, "departments");
assert.strictEqual(SEMANTIC_PROFILE.schemaAliases.crss, "courses");
assert.strictEqual(SEMANTIC_PROFILE.schemaAliases.profs, "instructors");
assert.strictEqual(SEMANTIC_PROFILE.schemaAliases.mcs, "machines");
assert.strictEqual(SEMANTIC_PROFILE.schemaAliases.prod, "products");
assert.strictEqual(SEMANTIC_PROFILE.schemaAliases.dfc, "defects");
assert.strictEqual(SEMANTIC_PROFILE.schemaAliases.accts, "accounts");
assert.strictEqual(SEMANTIC_PROFILE.schemaAliases.brs, "branches");
assert.strictEqual(SEMANTIC_PROFILE.schemaAliases.lns, "loans");
assert.strictEqual(SEMANTIC_PROFILE.schemaAliases.txns, "transactions");
assert.strictEqual(SEMANTIC_PROFILE.schemaAliases.rst, "restaurants");
assert.strictEqual(SEMANTIC_PROFILE.schemaAliases.ords, "orders");
assert.strictEqual(SEMANTIC_PROFILE.schemaAliases.cst, "customers");
assert.strictEqual(SEMANTIC_PROFILE.schemaAliases.oi, "order_items");
assert.strictEqual(SEMANTIC_PROFILE.schemaAliases.cur, "couriers");
assert.strictEqual(SEMANTIC_PROFILE.schemaAliases.mnu, "menus");
assert.strictEqual(SEMANTIC_PROFILE.schemaAliases.pts, "patients");
assert.strictEqual(SEMANTIC_PROFILE.schemaAliases.docs, "doctors");
assert.strictEqual(SEMANTIC_PROFILE.schemaAliases.vsts, "visits");
assert.strictEqual(SEMANTIC_PROFILE.schemaAliases.dx, "diagnoses");
assert.strictEqual(SEMANTIC_PROFILE.schemaAliases.rx, "prescriptions");
console.log("✅ A-U1 PASS: schemaAliases is frozen with 23 aliases");

// A-U2: Schema resolver matches exact normalized alias
const mockH2Schema = {
  docs: { columns: [{ name: "doc_id" }] },
  pts: { columns: [{ name: "pt_id" }] },
  vsts: { columns: [{ name: "vst_id" }] }
};
const matchedTablePts = findMatchingTable("list all patients", mockH2Schema);
assert.strictEqual(matchedTablePts, "pts", "A-U2 fail: 'patients' should resolve to 'pts'");
const matchedTableDocs = findMatchingTable("how many doctors are registered", mockH2Schema);
assert.strictEqual(matchedTableDocs, "docs", "A-U2 fail: 'doctors' should resolve to 'docs'");
console.log("✅ A-U2 PASS: findMatchingTable resolves 'patients' -> 'pts' and 'doctors' -> 'docs'");

// A-U3: Direct table name still takes priority or matches directly
const directMatch = findMatchingTable("select from docs", mockH2Schema);
assert.strictEqual(directMatch, "docs", "A-U3 fail: direct table name 'docs' must match");
console.log("✅ A-U3 PASS: Direct table name matches directly");

// A-U4: Non-existent alias or table returns null
const noMatch = findMatchingTable("show all airplanes", mockH2Schema);
assert.strictEqual(noMatch, null, "A-U4 fail: non-matching query must return null");
console.log("✅ A-U4 PASS: Non-existent alias returns null");

// A-U5: Substring or prefix does not falsely match (exact normalized word matching)
const partialMatch = findMatchingTable("impatient care center", mockH2Schema);
assert.strictEqual(partialMatch, null, "A-U5 fail: 'impatient' should not match alias 'patients'");
console.log("✅ A-U5 PASS: Substring does not falsely match");

// A-U6: formatSchemaForPrompt injects alias note for active schema table
const promptText = formatSchemaForPrompt({
  pts: { columns: [{ name: "pt_id", type: "INTEGER" }] }
});
assert(promptText.includes('Note: pts — table represents "patients"'), "A-U6 fail: prompt must include alias note");
console.log("✅ A-U6 PASS: formatSchemaForPrompt injects alias note");

console.log("\nALL A-U1 to A-U6 TESTS PASSED!");
