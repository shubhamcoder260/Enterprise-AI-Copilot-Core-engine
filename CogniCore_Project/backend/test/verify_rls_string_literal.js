// ============================================================
// VERIFICATION: RLS STRING-LITERAL EXPLOIT TEST (V1 1a)
// Verifies that RLS AST-based injection handles WHERE-keywords
// inside string literals correctly without SQL corruption or leakage.
// ============================================================

import assert from "assert";
import { validateAstCore } from "../src/kernel/ast.gate.core.js";
import { enforceRlsOnAst, injectRlsPredicate } from "../src/security/rls.policy.js";

console.log("==================================================");
console.log("  V1 — RLS STRING-LITERAL EXPLOIT VERIFICATION    ");
console.log("==================================================");

// Target hostile / edge-case SQL containing WHERE inside string literal
const testSql = "SELECT * FROM tabEmployee WHERE note_text = 'WHERE employee_id = 1'";

// 1. Direct AST Gate Validation
console.log("\n[1] Testing validateAstCore AST Parsing...");
const astResult = validateAstCore(testSql, { dialect: "mariadb" });
console.log("AST Gate Output:", JSON.stringify(astResult));

assert.strictEqual(astResult.valid, true, "Query must parse as valid SQL");
assert.ok(
  astResult.sql.includes("note_text = 'WHERE employee_id = 1'"),
  "String literal must be preserved intact without corruption"
);
console.log("✅ [1a-1] validateAstCore parsed the string literal with embedded WHERE keyword cleanly.");

// 2. Direct RLS AST Predicate Injection
console.log("\n[2] Testing RLS AST Predicate Injection on Query...");
const injectedSql = injectRlsPredicate(testSql, "`employee` = 'EMP-001'", "mariadb");
console.log("Injected SQL Output:", injectedSql);

// Verify that the injected predicate is joined via AND at the top level
// and the string literal is NOT replaced or mutated.
assert.ok(
  injectedSql.includes("`note_text` = 'WHERE employee_id = 1'") ||
  injectedSql.includes("note_text = 'WHERE employee_id = 1'"),
  "String literal must not be corrupted by WHERE matching"
);
assert.ok(
  injectedSql.includes("`employee` = 'EMP-001'"),
  "RLS predicate must be injected"
);
console.log("✅ [1a-2] injectRlsPredicate preserved string literal and added RLS predicate.");

// 3. Testing enforceRlsOnAst with Protected Table containing String Literal
console.log("\n[3] Testing enforceRlsOnAst on Protected Salary Table...");
const salarySql = "SELECT * FROM `tabSalary Slip` WHERE note_text = 'WHERE employee_id = 1'";
const rlsResult = enforceRlsOnAst({
  tables: ["tabSalary Slip"],
  sql: salarySql,
  identity: { userId: "john_doe", employeeId: "EMP-001", roles: ["Employee"] },
  dialect: "mariadb"
});
console.log("enforceRlsOnAst Output:", JSON.stringify(rlsResult, null, 2));

assert.strictEqual(rlsResult.allowed, true, "Query must be allowed with injection");
assert.strictEqual(rlsResult.verdict, "INJECT_PREDICATE", "Verdict must be INJECT_PREDICATE");
assert.ok(
  rlsResult.transformedSql.includes("`employee` = 'EMP-001'"),
  "Transformed SQL must inject authenticated employee restriction"
);
assert.ok(
  rlsResult.transformedSql.includes("note_text = 'WHERE employee_id = 1'") ||
  rlsResult.transformedSql.includes("`note_text` = 'WHERE employee_id = 1'"),
  "String literal must remain uncorrupted"
);
console.log("✅ [1a-3] enforceRlsOnAst scoped the query strictly to callerEmpId while preserving string literal.");

console.log("\n==================================================");
console.log("🏆 V1 1a UNIT VERIFICATION PASSED: ZERO STRING CORRUPTION");
console.log("==================================================");
