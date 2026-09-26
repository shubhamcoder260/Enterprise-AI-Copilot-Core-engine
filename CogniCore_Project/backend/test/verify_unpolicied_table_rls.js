import assert from "assert";
import { evaluateRlsPolicy, enforceRlsOnAst, RLS_VERDICT } from "../src/security/rls.policy.js";
import { validateAstCore } from "../src/kernel/ast.gate.core.js";

console.log("==================================================");
console.log("   VERIFYING RLS FAIL-CLOSED ON UNPOLICIED TABLES ");
console.log("==================================================");

let passed = 0;
let total = 0;

function test(description, fn) {
  total++;
  try {
    fn();
    console.log(`✅ [PASS] ${description}`);
    passed++;
  } catch (err) {
    console.error(`❌ [FAIL] ${description}:`, err.message);
    throw err;
  }
}

// 1. Direct evaluateRlsPolicy checks
test("evaluateRlsPolicy rejects unpolicied ERPNext table (tabBank Account)", () => {
  const res = evaluateRlsPolicy({
    tableName: "tabBank Account",
    identity: { userId: "devon", roles: ["Employee"] },
    dialect: "mariadb"
  });
  assert.strictEqual(res.verdict, RLS_VERDICT.REJECT_FORBIDDEN);
  assert.strictEqual(res.error, "rls_forbidden:unpolicied_table");
  assert.ok(res.reason.includes("fail-closed default"));
});

test("evaluateRlsPolicy rejects arbitrary made-up table (secret_legal_archive_2026)", () => {
  const res = evaluateRlsPolicy({
    tableName: "secret_legal_archive_2026",
    identity: { userId: "admin", roles: ["System Manager"] },
    dialect: "postgres"
  });
  assert.strictEqual(res.verdict, RLS_VERDICT.REJECT_FORBIDDEN);
  assert.strictEqual(res.error, "rls_forbidden:unpolicied_table");
  assert.ok(res.reason.includes("fail-closed default"));
});

test("evaluateRlsPolicy rejects unpolicied table even with null/anonymous identity", () => {
  const res = evaluateRlsPolicy({
    tableName: "tax_filings",
    identity: null,
    dialect: "sqlite"
  });
  assert.strictEqual(res.verdict, RLS_VERDICT.REJECT_FORBIDDEN);
  assert.strictEqual(res.error, "rls_forbidden:unpolicied_table");
});

test("evaluateRlsPolicy permits explicitly allowlisted table (tabCustomer)", () => {
  const res = evaluateRlsPolicy({
    tableName: "tabCustomer",
    identity: { userId: "devon", roles: ["Employee"] },
    dialect: "mariadb"
  });
  assert.strictEqual(res.verdict, RLS_VERDICT.ALLOW);
  assert.strictEqual(res.injectedPredicate, null);
});

test("evaluateRlsPolicy permits explicitly allowlisted table (students)", () => {
  const res = evaluateRlsPolicy({
    tableName: "students",
    identity: { userId: "student1", roles: ["Student"] },
    dialect: "sqlite"
  });
  assert.strictEqual(res.verdict, RLS_VERDICT.ALLOW);
  assert.strictEqual(res.injectedPredicate, null);
});

// 2. enforceRlsOnAst checks
test("enforceRlsOnAst rejects query touching unpolicied table", () => {
  const res = enforceRlsOnAst({
    tables: ["tabBank Account"],
    sql: "SELECT * FROM `tabBank Account`",
    identity: { userId: "devon", roles: ["Employee"] },
    dialect: "mariadb"
  });
  assert.strictEqual(res.allowed, false);
  assert.strictEqual(res.verdict, RLS_VERDICT.REJECT_FORBIDDEN);
  assert.strictEqual(res.error, "rls_forbidden:unpolicied_table");
});

test("enforceRlsOnAst rejects multi-table query touching both allowlisted and unpolicied tables", () => {
  const res = enforceRlsOnAst({
    tables: ["tabCustomer", "tabInternalAuditLog"],
    sql: "SELECT c.name, a.notes FROM `tabCustomer` c JOIN `tabInternalAuditLog` a ON c.id = a.cid",
    identity: { userId: "devon", roles: ["Employee"] },
    dialect: "mariadb"
  });
  assert.strictEqual(res.allowed, false);
  assert.strictEqual(res.error, "rls_forbidden:unpolicied_table");
});

// 3. validateAstCore integration checks across dialects
test("validateAstCore (MariaDB) rejects query on unpolicied table with zero execution", () => {
  const res = validateAstCore("SELECT * FROM `tabExecutiveCompensation`", {
    dialect: "mariadb",
    identity: { userId: "devon", roles: ["Employee"] }
  });
  assert.strictEqual(res.valid, false);
  assert.strictEqual(res.reason, "rls_forbidden:unpolicied_table");
  assert.strictEqual(res.verdict, RLS_VERDICT.REJECT_FORBIDDEN);
});

test("validateAstCore (PostgreSQL) rejects query on unpolicied table", () => {
  const res = validateAstCore('SELECT * FROM "confidential_legal_docs"', {
    dialect: "postgres",
    identity: { userId: "devon", roles: ["Employee"] }
  });
  assert.strictEqual(res.valid, false);
  assert.strictEqual(res.reason, "rls_forbidden:unpolicied_table");
  assert.strictEqual(res.verdict, RLS_VERDICT.REJECT_FORBIDDEN);
});

test("validateAstCore (SQLite) rejects query on unpolicied table", () => {
  const res = validateAstCore('SELECT * FROM "faculty_salaries"', {
    dialect: "sqlite",
    identity: { userId: "student1", roles: ["Student"] }
  });
  assert.strictEqual(res.valid, false);
  assert.strictEqual(res.reason, "rls_forbidden:unpolicied_table");
  assert.strictEqual(res.verdict, RLS_VERDICT.REJECT_FORBIDDEN);
});

console.log("==================================================");
console.log(`RESULTS: ${passed}/${total} PASSED`);
if (passed === total) {
  console.log("🏆 ALL RLS FAIL-CLOSED UNPOLICIED TABLE TESTS GREEN");
} else {
  console.error("🚨 SOME TESTS FAILED");
  process.exit(1);
}
console.log("==================================================");
