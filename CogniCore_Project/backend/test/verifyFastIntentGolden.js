import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import assert from 'assert';
import { tryRoute } from '../src/core/fastIntent.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const goldenPath = path.join(__dirname, 'golden', 'fast_intent_golden.json');
const goldenCases = JSON.parse(fs.readFileSync(goldenPath, 'utf8'));

// Synthetic Schema (identical to golden generator)
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

console.log("==================================================");
console.log("  VERIFYING FAST INTENT GOLDEN CORPUS (RE-PIN #4) ");
console.log("==================================================");

let passed = 0;
let failed = 0;

for (const c of goldenCases) {
  const plan = tryRoute(c.query, mockDeps);

  try {
    assert.deepStrictEqual(plan, c.expectedPlan, `Mismatch for ${c.id}: ${c.desc}`);
    console.log(`✅ [${c.id}] ${c.desc}: 100% equivalence verified`);
    passed++;
  } catch (err) {
    console.error(`❌ [${c.id}] ${c.desc} FAILED:`);
    console.error(`   Query: "${c.query}"`);
    console.error(`   Expected:`, JSON.stringify(c.expectedPlan, null, 2));
    console.error(`   Actual:  `, JSON.stringify(plan, null, 2));
    failed++;
  }
}

console.log("==================================================");
console.log(`Summary: ${passed} passed, ${failed} failed (Total: ${goldenCases.length})`);
console.log("==================================================");

if (failed > 0) {
  process.exit(1);
} else {
  console.log("🏆 FAST INTENT GOLDEN VERIFICATION: 100% PASS");
  process.exit(0);
}
