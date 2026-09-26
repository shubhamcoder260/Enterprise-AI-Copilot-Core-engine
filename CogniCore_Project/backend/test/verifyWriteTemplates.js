// ============================================================================
// VERIFICATION: WRITE TEMPLATES REGISTRY (PHASE D5 EXIT CRITERION 2)
//
// Invariants Verified:
//   1. All registered templates contain ONLY named placeholders (:param).
//   2. Zero string concatenation of user input.
//   3. deepFreeze immutability confirmed (mutations throw or fail silently).
//   4. Multi-dialect rendering produces correct bind tokens (? vs $1..$n).
//   5. Strict parameter validation enforces required fields.
// ============================================================================

import assert from "node:assert/strict";
import { TEMPLATES, getTemplate, listTemplates, renderTemplate } from "../src/security/write.templates.js";

async function verifyWriteTemplates() {
  console.log("==================================================");
  console.log("   STEP D5 — VERIFY WRITE TEMPLATES REGISTRY      ");
  console.log("==================================================");

  let passed = 0;
  let total = 0;

  function test(name, fn) {
    total++;
    try {
      fn();
      console.log(`✅ [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`❌ [FAIL] ${name}: ${err.message}`);
    }
  }

  // TEST 1: Minimum 3 real templates
  test("Template Registry: minimum 3 real templates defined with required metadata", () => {
    const templates = listTemplates();
    assert.ok(templates.length >= 3, `Expected at least 3 templates, got ${templates.length}`);

    for (const t of templates) {
      assert.ok(t.id, "Template must have an id");
      assert.ok(t.description, "Template must have a description");
      assert.ok(t.allowedTable, "Template must have an allowedTable");
      assert.ok(t.requiredRole, "Template must have a requiredRole");
      assert.strictEqual(typeof t.selfApproveEligible, "boolean", "Template must declare selfApproveEligible boolean");
      assert.ok(Array.isArray(t.requiredParams) && t.requiredParams.length > 0, "Template must have requiredParams");
    }
  });

  // TEST 2: Immutability (deepFreeze)
  test("deepFreeze Immutability: attempts to modify registry or templates are rejected", () => {
    assert.ok(Object.isFrozen(TEMPLATES), "TEMPLATES root must be frozen");

    // Attempt to add new template
    assert.throws(() => {
      TEMPLATES.MALICIOUS_WRITE = { id: "MALICIOUS" };
    }, /Cannot add property|read only/i);

    // Attempt to mutate existing template
    const t = getTemplate("UPDATE_OWN_CONTACT");
    assert.ok(Object.isFrozen(t), "Individual template must be frozen");
    assert.throws(() => {
      t.allowedTable = "tabSalary Slip";
    }, /Cannot assign to read only property|read only/i);
  });

  // TEST 3: Named placeholders only (no raw injection patterns)
  test("Placeholder Safety: template SQL uses ONLY named placeholders (:param)", () => {
    const templates = listTemplates();
    for (const t of templates) {
      const allSql = [t.sql, ...Object.values(t.dialectSql || {})];
      for (const sql of allSql) {
        // Assert contains named placeholder
        assert.ok(/:[a-zA-Z0-9_]+/.test(sql), `Template ${t.id} SQL must contain named placeholders: ${sql}`);
        // Assert no unsafe concatenation artifacts
        assert.ok(!/\$\{[^}]+\}/.test(sql), `Template ${t.id} must not use string interpolation: ${sql}`);
        // Assert no inline raw quotes trying to escape
        assert.ok(!/;\s*(DROP|DELETE|TRUNCATE)/i.test(sql), `Template ${t.id} has dangerous statement chaining: ${sql}`);
      }
    }
  });

  // TEST 4: Parameter rendering with bind tokens for MariaDB/SQLite vs Postgres
  test("Driver Binding: renderTemplate produces '?' for MariaDB/SQLite and '$n' for Postgres", () => {
    const t = getTemplate("UPDATE_OWN_CONTACT");
    const params = {
      employeeId: "EMP-002",
      cellNumber: "+1-555-0199",
      personalEmail: "devon@enterprise.test"
    };

    // MariaDB
    const mRes = renderTemplate(t, params, "mariadb");
    assert.ok(mRes.sql.includes("?"), "MariaDB SQL must use '?' parameter placeholders");
    assert.strictEqual(mRes.values.length, 3);
    assert.strictEqual(mRes.values[0], "+1-555-0199");
    assert.strictEqual(mRes.values[1], "devon@enterprise.test");
    assert.strictEqual(mRes.values[2], "EMP-002");

    // SQLite
    const sRes = renderTemplate(t, params, "sqlite");
    assert.ok(sRes.sql.includes("?"), "SQLite SQL must use '?' parameter placeholders");
    assert.strictEqual(sRes.values.length, 3);

    // Postgres
    const pRes = renderTemplate(t, params, "postgres");
    assert.ok(pRes.sql.includes("$1") && pRes.sql.includes("$2") && pRes.sql.includes("$3"), "Postgres SQL must use '$1, $2, $3' bind tokens");
    assert.strictEqual(pRes.values.length, 3);
  });

  // TEST 5: Parameter enforcement (fails on missing parameters)
  test("Parameter Enforcement: throws error if required parameter is missing or empty", () => {
    const t = getTemplate("CREATE_CUSTOMER");
    assert.throws(() => {
      renderTemplate(t, { customerName: "ACME Corp" }, "mariadb");
    }, /Missing required parameter: 'customerType'/i);
  });

  console.log("==================================================");
  console.log(`WRITE TEMPLATES RESULTS: ${passed}/${total} PASSED`);
  if (passed === total) {
    console.log("🏆 ALL WRITE TEMPLATES VERIFICATION TESTS GREEN");
    console.log("==================================================");
  } else {
    console.error(`💥 ${total - passed} TESTS FAILED`);
    process.exit(1);
  }
}

verifyWriteTemplates().catch((err) => {
  console.error("FATAL ERROR:", err);
  process.exit(1);
});
