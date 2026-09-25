import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { tryRoute } from '../src/core/fastIntent.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const goldenDir = path.join(__dirname, 'golden');

if (!fs.existsSync(goldenDir)) {
  fs.mkdirSync(goldenDir, { recursive: true });
}

// 1. Synthetic Schema (from test_phase2_fast_intent_units.js)
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

// 2. Test Cases to Capture
const CASES = [
  // Synthetic Unit Suite (9 cases)
  { id: "FI-01", query: "how many students are there", desc: "Count records" },
  { id: "FI-02", query: "find student id = 80 absent days", desc: "List + ID filter" },
  { id: "FI-03", query: "lowest attendence top 5", desc: "BottomN + Typo tolerance" },
  { id: "FI-04", query: "students with attendance_percentage more than 75", desc: "Threshold filter" },
  { id: "FI-05", query: "show attendance records with status Present", desc: "Value-match filter" },
  { id: "FI-06", query: "calculate average attendance per department", desc: "'per department' guard -> null" },
  { id: "FI-07", query: "show students 42 and 99 in computer science", desc: "Unmatched number guard -> null" },
  { id: "FI-08", query: "how many unicorns are in the database", desc: "Unknown table -> null" },
  { id: "FI-09", query: "top 10 students by attendance_percentage", desc: "TopN shape with limit" },

  // College & Extended NL Cases
  { id: "FI-10", query: "how many student are there", desc: "Count students singular" },
  { id: "FI-11", query: "find student with id 15", desc: "List by student id 15" },
  { id: "FI-12", query: "calculate average attendance_percentage", desc: "Average aggregate without grouping" },
  { id: "FI-13", query: "what percentage of attendance has status Present", desc: "Percentage query" },
  { id: "FI-14", query: "average absent percentage", desc: "Absent derivation or fallback" },
  { id: "FI-15", query: "lowest attendence top 5 (calculate the lowest attendance by student id)", desc: "Lowest attendance top 5 complex prompt" },
  { id: "FI-16", query: "calculate average no. of student absent more than 10 days", desc: "Ambiguous query -> cascade" },
  { id: "FI-17", query: "show students with section A", desc: "Filter by categorical section A" },
  { id: "FI-18", query: "display students with attendance_percentage above 80", desc: "Threshold filter above 80" }
];

function generateGolden() {
  console.log("Generating fast_intent_golden.json...");
  const records = [];

  for (const c of CASES) {
    const plan = tryRoute(c.query, mockDeps);
    records.push({
      id: c.id,
      query: c.query,
      desc: c.desc,
      expectedPlan: plan
    });
    console.log(`Captured ${c.id}: ${c.desc} -> ${plan ? plan.shape + " (" + plan.sql + ")" : "null"}`);
  }

  const outPath = path.join(goldenDir, 'fast_intent_golden.json');
  fs.writeFileSync(outPath, JSON.stringify(records, null, 2) + '\n', 'utf8');
  console.log(`\n✅ Saved ${records.length} golden records to ${outPath}`);
}

generateGolden();
