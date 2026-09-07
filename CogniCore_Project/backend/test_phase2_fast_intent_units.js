// ==========================================
// TEST: PHASE 2 FAST INTENT SYNTHETIC UNIT TESTS
// ≥8 synthetic cases:
//   1. count
//   2. list + id filter
//   3. bottomN + typo ("attendence" -> "attendance_percentage")
//   4. threshold filter
//   5. value-match filter
//   6. "per department" guard -> null
//   7. unmatched number -> null (numeric coverage guard)
//   8. unknown table -> null
//   9. topN limit
//
// Invariants verified:
//   • Every generated SQL string passes sql.validator.js
// ==========================================

import { tryRoute } from "./src/core/fastIntent.js";
import { validateAndSanitizeSql } from "./src/llm/sql.validator.js";

// Mock enriched schema
const mockSchema = {
  tables: [
    {
      name: "students",
      columns: [
        { name: "student_id", type: "INTEGER", pk: true },
        { name: "name", type: "TEXT" },
        { name: "section", type: "TEXT" },
        { name: "attendance_percentage", type: "REAL" }
      ]
    },
    {
      name: "departments",
      columns: [
        { name: "dept_id", type: "INTEGER", pk: true },
        { name: "dept_name", type: "TEXT" }
      ]
    },
    {
      name: "attendance",
      columns: [
        { name: "attendance_id", type: "INTEGER", pk: true },
        { name: "student_id", type: "INTEGER" },
        { name: "date", type: "TEXT" },
        { name: "status", type: "TEXT" }
      ]
    }
  ]
};

const mockDistinct = {
  students: [
    { column: "section", value: "A" },
    { column: "section", value: "B" }
  ],
  attendance: [
    { column: "status", value: "Present" },
    { column: "status", value: "Absent" },
    { column: "status", value: "Late" }
  ],
  departments: [
    { column: "dept_name", value: "Computer Science" },
    { column: "dept_name", value: "Mechanical" }
  ]
};

const mockDeps = {
  getSchema: () => mockSchema,
  getDistinct: (table) => mockDistinct[table] || [],
  isLongFormat: (table) => table === "attendance"
};

const TEST_CASES = [
  {
    name: "1. Count records",
    query: "how many students are there",
    assertPlan: (p) => p && p.shape === "count" && p.sql.includes('SELECT COUNT(*) AS result FROM "students"')
  },
  {
    name: "2. List + ID filter",
    query: "find student id = 80 absent days",
    assertPlan: (p) => p && p.shape === "list" && p.sql.includes('"student_id" = ?') && p.params.includes(80)
  },
  {
    name: "3. BottomN + Typo tolerance",
    query: "lowest attendence top 5",
    assertPlan: (p) => p && p.shape === "bottomN" && p.sql.includes('ORDER BY "attendance_percentage" ASC') && p.params.includes(5)
  },
  {
    name: "4. Threshold filter",
    query: "students with attendance_percentage more than 75",
    assertPlan: (p) => p && (p.shape === "list" || p.shape === "threshold_filter") && p.sql.includes('"attendance_percentage" > ?') && p.params.includes(75)
  },
  {
    name: "5. Value-match filter",
    query: "show attendance records with status Present",
    assertPlan: (p) => p && p.shape === "list" && p.sql.includes('"status" = ?') && p.params.includes("Present")
  },
  {
    name: "6. 'per department' guard → null (cascade)",
    query: "calculate average attendance per department",
    assertPlan: (p) => p === null
  },
  {
    name: "7. Unmatched number guard → null (cascade)",
    query: "show students 42 and 99 in computer science",
    assertPlan: (p) => p === null // 99 cannot be consumed into the single ID filter
  },
  {
    name: "8. Unknown table → null (cascade)",
    query: "how many unicorns are in the database",
    assertPlan: (p) => p === null
  },
  {
    name: "9. TopN shape with limit",
    query: "top 10 students by attendance_percentage",
    assertPlan: (p) => p && p.shape === "topN" && p.sql.includes('ORDER BY "attendance_percentage" DESC') && p.params.includes(10)
  }
];

function runTests() {
  console.log("==========================================");
  console.log("   PHASE 2: FAST INTENT SYNTHETIC TESTS   ");
  console.log("==========================================\n");

  let passed = 0;

  for (const tc of TEST_CASES) {
    const plan = tryRoute(tc.query, mockDeps);
    const ok = tc.assertPlan(plan);

    // If SQL was generated, test against frozen sql.validator.js
    let valOk = true;
    if (plan && plan.sql) {
      const val = validateAndSanitizeSql(plan.sql);
      valOk = val.valid;
      if (!valOk) {
        console.error(`❌ [Validator Gate Failed] ${tc.name}: ${val.reason} on "${plan.sql}"`);
      }
    }

    if (ok && valOk) {
      console.log(`✅ PASS: ${tc.name}`);
      if (plan) console.log(`   ↳ SQL: ${plan.sql} | params: ${JSON.stringify(plan.params)}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${tc.name}`);
      console.error(`   ↳ Got plan:`, plan);
    }
  }

  console.log(`\nResults: ${passed}/${TEST_CASES.length} synthetic unit tests passed.`);

  if (passed !== TEST_CASES.length) {
    process.exit(1);
  }
  process.exit(0);
}

runTests();
