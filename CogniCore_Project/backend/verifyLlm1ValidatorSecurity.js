import { performance } from "perf_hooks";
import { validateAndSanitizeSql } from "./src/llm/sql.validator.js";

console.log("\n================================================================================");
console.log("🛡️ RUNNING EXPANDED STEP 1 TEST SUITE: SQL VALIDATOR & SECURITY GATE (37 CASES)");
console.log("================================================================================\n");

let passedCount = 0;
let failedCount = 0;

function assert(condition, message) {
  if (condition) {
    passedCount++;
  } else {
    failedCount++;
    console.error(`❌ ASSERTION FAILED: ${message}`);
  }
}

// ==============================================================================
// 1. HOSTILE TEST CASES (MUST BE REJECTED) — 20 CASES
// ==============================================================================
console.log("🔴 --- PART 1: HOSTILE TEST CASES (Must Reject) ---");

const hostileCases = [
  {
    name: "DROP TABLE command",
    input: "DROP TABLE students",
    expectedReason: "llm_invalid_sql"
  },
  {
    name: "DELETE command",
    input: "DELETE FROM students",
    expectedReason: "llm_invalid_sql"
  },
  {
    name: "UPDATE command",
    input: "UPDATE students SET cgpa = 10",
    expectedReason: "llm_invalid_sql"
  },
  {
    name: "INSERT command",
    input: "INSERT INTO students VALUES (1,'x')",
    expectedReason: "llm_invalid_sql"
  },
  {
    name: "ALTER TABLE command",
    input: "ALTER TABLE students ADD COLUMN x TEXT",
    expectedReason: "llm_invalid_sql"
  },
  {
    name: "CREATE TABLE command",
    input: "CREATE TABLE hack (id INT)",
    expectedReason: "llm_invalid_sql"
  },
  {
    name: "REPLACE INTO mutation command",
    input: "REPLACE INTO students VALUES (1,'x')",
    expectedReason: "llm_invalid_sql"
  },
  {
    name: "ATTACH DATABASE command",
    input: "ATTACH DATABASE '/etc/passwd' AS x",
    expectedReason: "llm_invalid_sql"
  },
  {
    name: "PRAGMA inspection/mutation command",
    input: "PRAGMA database_list",
    expectedReason: "llm_invalid_sql"
  },
  {
    name: "Multi-statement injection attack",
    input: "SELECT 1; DROP TABLE students",
    expectedReason: "llm_invalid_sql"
  },
  {
    name: "CTE with mutating subquery (DELETE)",
    input: "WITH x AS (DELETE FROM students RETURNING *) SELECT * FROM x",
    expectedReason: "llm_invalid_sql"
  },
  {
    name: "SQL line comment (--)",
    input: "SELECT * FROM students -- DROP TABLE hidden",
    expectedReason: "llm_invalid_sql"
  },
  {
    name: "SQL block comment (/* ... */)",
    input: "SELECT * FROM students /* comment */",
    expectedReason: "llm_invalid_sql"
  },
  {
    name: "<think> block wrapping hostile SQL",
    input: "<think>reasoning here</think>DROP TABLE students",
    expectedReason: "llm_invalid_sql"
  },
  {
    name: "Empty string",
    input: "",
    expectedReason: "llm_empty_output"
  },
  {
    name: "Whitespace only",
    input: "   \n\t  ",
    expectedReason: "llm_empty_output"
  },
  {
    name: "Unclosed code fence with garbage",
    input: "```sql\njust plain garbage without any sql statements",
    expectedReason: "llm_invalid_sql"
  },
  {
    name: "Plain English prose (no SQL)",
    input: "just plain english prose, no sql at all",
    expectedReason: "llm_invalid_sql"
  },
  // NEW HOSTILE FOLLOW-UP CASES:
  {
    name: "Semicolon inside string literal (accepted fail-safe)",
    input: "SELECT * FROM t WHERE name = 'a;b'",
    expectedReason: "llm_invalid_sql"
  },
  {
    name: "EXPLAIN statement gate rejection",
    input: "EXPLAIN SELECT * FROM students",
    expectedReason: "llm_invalid_sql"
  }
];

for (const [idx, tc] of hostileCases.entries()) {
  const res = validateAndSanitizeSql(tc.input);
  const isRejected = res.valid === false;
  const reasonMatches = res.reason === tc.expectedReason;
  const ok = isRejected && reasonMatches;

  assert(ok, `${tc.name}: expected reason '${tc.expectedReason}', got valid=${res.valid} reason='${res.reason}'`);

  const statusTag = ok ? "✅ PASS" : "❌ FAIL";
  console.log(`[${statusTag}] Case ${String(idx + 1).padStart(2, "0")}: ${tc.name}`);
  console.log(`         Input  : ${JSON.stringify(tc.input.length > 50 ? tc.input.slice(0, 47) + "..." : tc.input)}`);
  console.log(`         Result : valid=${res.valid}, reason="${res.reason}"\n`);
}

// ==============================================================================
// 2. CLEAN TEST CASES (MUST PASS WITH PROPER SANITIZATION) — 16 CASES
// ==============================================================================
console.log("🟢 --- PART 2: CLEAN TEST CASES (Must Pass & Sanitize) ---");

const cleanCases = [
  {
    name: "Plain SELECT (LIMIT 50 appended)",
    input: "SELECT * FROM students",
    expectedSql: "SELECT * FROM students LIMIT 50"
  },
  {
    name: "SELECT with WHERE clause (LIMIT 50 appended)",
    input: "SELECT name FROM students WHERE cgpa > 8",
    expectedSql: "SELECT name FROM students WHERE cgpa > 8 LIMIT 50"
  },
  {
    name: "Trailing semicolon stripped before LIMIT 50",
    input: "SELECT * FROM students;",
    expectedSql: "SELECT * FROM students LIMIT 50"
  },
  {
    name: "Overly high LIMIT (500 clamped to 50)",
    input: "SELECT * FROM albums LIMIT 500",
    expectedSql: "SELECT * FROM albums LIMIT 50"
  },
  {
    name: "Negative LIMIT (-1 unlimited clamped to 50)",
    input: "SELECT * FROM albums LIMIT -1",
    expectedSql: "SELECT * FROM albums LIMIT 50"
  },
  {
    name: "Zero LIMIT (0 clamped to 50)",
    input: "SELECT * FROM albums LIMIT 0",
    expectedSql: "SELECT * FROM albums LIMIT 50"
  },
  {
    name: "Valid LIMIT with OFFSET (preserved as-is)",
    input: "SELECT * FROM albums LIMIT 10 OFFSET 5",
    expectedSql: "SELECT * FROM albums LIMIT 10 OFFSET 5"
  },
  {
    name: "Valid comma form LIMIT offset, count (preserved as-is)",
    input: "SELECT * FROM albums LIMIT 200, 10",
    expectedSql: "SELECT * FROM albums LIMIT 200, 10"
  },
  {
    name: "Legitimate REPLACE() scalar function (passes)",
    input: "SELECT REPLACE(name, 'a', 'b') FROM students",
    expectedSql: "SELECT REPLACE(name, 'a', 'b') FROM students LIMIT 50"
  },
  {
    name: "Word-boundary keywords (created_at, updated_at)",
    input: "SELECT created_at, updated_at FROM x",
    expectedSql: "SELECT created_at, updated_at FROM x LIMIT 50"
  },
  {
    name: "Complex multi-table JOIN + aggregate + ORDER BY",
    input: "SELECT Artist.Name, COUNT(*) AS n FROM Album JOIN Artist ON Artist.Id = Album.ArtistId GROUP BY 1 ORDER BY n DESC",
    expectedSql: "SELECT Artist.Name, COUNT(*) AS n FROM Album JOIN Artist ON Artist.Id = Album.ArtistId GROUP BY 1 ORDER BY n DESC LIMIT 50"
  },
  {
    name: "CTE WITH clause (outer query clamped with LIMIT 50)",
    input: "WITH top AS (SELECT id FROM t LIMIT 5) SELECT * FROM top",
    expectedSql: "WITH top AS (SELECT id FROM t LIMIT 5) SELECT * FROM top LIMIT 50"
  },
  {
    name: "LIKE clause with wildcards",
    input: "SELECT * FROM tracks WHERE name LIKE '%love%'",
    expectedSql: "SELECT * FROM tracks WHERE name LIKE '%love%' LIMIT 50"
  },
  {
    name: "<think> block stripped, yielding clean executable SQL",
    input: "<think>reasoning</think>SELECT * FROM students",
    expectedSql: "SELECT * FROM students LIMIT 50"
  },
  // NEW CLEAN FOLLOW-UP CASES:
  {
    name: "Lowercase select (case-insensitive statement gate)",
    input: "select name from students",
    expectedSql: "select name from students LIMIT 50"
  },
  {
    name: "Existing LIMIT 50 with trailing semicolon (not doubled)",
    input: "SELECT * FROM students LIMIT 50;",
    expectedSql: "SELECT * FROM students LIMIT 50"
  }
];

for (const [idx, tc] of cleanCases.entries()) {
  const res = validateAndSanitizeSql(tc.input);
  const isValid = res.valid === true;
  const sqlMatches = res.sql === tc.expectedSql;
  const noThinkSurvives = !res.sql?.includes("<think>") && !res.sql?.includes("</think>");
  const ok = isValid && sqlMatches && noThinkSurvives;

  assert(ok, `${tc.name}: expected '${tc.expectedSql}', got valid=${res.valid}, sql='${res.sql}'`);

  const statusTag = ok ? "✅ PASS" : "❌ FAIL";
  console.log(`[${statusTag}] Case ${String(idx + 1).padStart(2, "0")}: ${tc.name}`);
  console.log(`         Input        : ${JSON.stringify(tc.input.length > 50 ? tc.input.slice(0, 47) + "..." : tc.input)}`);
  console.log(`         Sanitized SQL: "${res.sql}"\n`);
}

// ==============================================================================
// 3. PERFORMANCE & REDOS RESILIENCE TEST CASE — 1 CASE (WITH 2 ADVERSARIAL INPUTS)
// ==============================================================================
console.log("⚡ --- PART 3: PERFORMANCE & REDOS RESILIENCE (Must return in < 200ms) ---");

const adversarial1 = "SELECT ".repeat(1500); // 10,500 chars
const adversarial2 = "SELECT * FROM t WHERE id IN " + "(".repeat(5000); // ~5,030 chars

const t0 = performance.now();
const resPerf1 = validateAndSanitizeSql(adversarial1);
const duration1Ms = parseFloat((performance.now() - t0).toFixed(2));

const t1 = performance.now();
const resPerf2 = validateAndSanitizeSql(adversarial2);
const duration2Ms = parseFloat((performance.now() - t1).toFixed(2));

const perfOk = duration1Ms < 200 && duration2Ms < 200 && typeof resPerf1.valid === "boolean" && typeof resPerf2.valid === "boolean";
assert(perfOk, `Performance test failed: input1=${duration1Ms}ms, input2=${duration2Ms}ms`);

const statusPerf = perfOk ? "✅ PASS" : "❌ FAIL";
console.log(`[${statusPerf}] Case 01: 10,000+ char adversarial inputs (ReDoS & hang prevention)`);
console.log(`         Input 1 (10,500 chars repeated 'SELECT '):`);
console.log(`           Duration: ${duration1Ms} ms (< 200ms threshold) | Verdict: valid=${resPerf1.valid}, reason="${resPerf1.reason || "none"}"`);
console.log(`         Input 2 (5,000 nested '(' parentheses):`);
console.log(`           Duration: ${duration2Ms} ms (< 200ms threshold) | Verdict: valid=${resPerf2.valid}, reason="${resPerf2.reason || "none"}"\n`);

// ==============================================================================
// 4. FINAL SUMMARY
// ==============================================================================
const totalCases = hostileCases.length + cleanCases.length + 1; // 20 + 16 + 1 = 37 cases
console.log("================================================================================");
console.log("📊 EXPANDED STEP 1 AUDIT SUMMARY");
console.log("================================================================================");
console.log(`Total Test Cases   : ${totalCases}`);
console.log(`Passed             : ${passedCount}`);
console.log(`Failed             : ${failedCount}`);

if (failedCount === 0) {
  console.log("\n✅ AUDIT CHECKPOINT 1 EXPANDED: 37/37 cases verified with 0 failures!");
  process.exit(0);
} else {
  console.error(`\n❌ AUDIT CHECKPOINT 1 FAILED: ${failedCount} case(s) did not pass.`);
  process.exit(1);
}
