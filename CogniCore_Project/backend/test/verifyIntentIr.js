import assert from 'assert';
import { parseIntentIR, detectGrain, detectVisualization } from '../src/core/intent.ir.js';

console.log("==================================================");
console.log("     VERIFYING INTENT-IR LIGHT & CONFIDENCE LADDER ");
console.log("==================================================");

const mockSchema = {
  tables: [
    {
      name: "students",
      columns: [
        { name: "student_id", type: "INTEGER" },
        { name: "name", type: "TEXT" },
        { name: "attendance_percentage", type: "REAL" }
      ]
    },
    {
      name: "tabSales Invoice",
      columns: [
        { name: "name", type: "VARCHAR(140)" },
        { name: "posting_date", type: "DATE" },
        { name: "due_date", type: "DATE" },
        { name: "grand_total", type: "DECIMAL(21,9)" },
        { name: "net_total", type: "DECIMAL(21,9)" }
      ]
    },
    {
      name: "logs_without_dates",
      columns: [
        { name: "id", type: "INTEGER" },
        { name: "message", type: "TEXT" }
      ]
    }
  ]
};

let passed = 0;

// Test 1: Visualization Detection
const v1 = detectVisualization("Show our sales as a graph");
assert.strictEqual(v1.requested, true);
assert.strictEqual(v1.type, "chart");

const v2 = detectVisualization("Show bar chart of revenue");
assert.strictEqual(v2.requested, true);
assert.strictEqual(v2.type, "bar");

const v3 = detectVisualization("Just list all students");
assert.strictEqual(v3, null);
console.log("✅ 1. Visualization detection verified");
passed++;

// Test 2: Grain Detection
const g1 = detectGrain("total sales for the last 5 years as a graph");
assert.strictEqual(g1.type, "temporal");
assert.strictEqual(g1.unit, "year");
assert.strictEqual(g1.count, 5);

const g2 = detectGrain("sales in 2024");
assert.strictEqual(g2.type, "temporal");
assert.strictEqual(g2.exactValue, "2024");

const g3 = detectGrain("average attendance per department", mockSchema.tables[0]);
assert.strictEqual(g3.type, "categorical");
assert.strictEqual(g3.dimension, "department");
console.log("✅ 2. Grain detection verified");
passed++;

// Test 3: HIGH Confidence
const irHigh = parseIntentIR("how many students are there", { schema: mockSchema });
assert.strictEqual(irHigh.confidence, "HIGH");
assert.strictEqual(irHigh.primaryTable, "students");
assert.strictEqual(irHigh.metric, "COUNT");
console.log("✅ 3. HIGH confidence rung verified");
passed++;

// Test 4: S16 Query Intent-IR Parse (Sales for last 5 years as a graph)
const irS16 = parseIntentIR("total sales for the last 5 years as a graph", { schema: mockSchema });
assert.strictEqual(irS16.primaryTable, "tabSales Invoice");
assert.strictEqual(irS16.metric, "SUM");
assert.strictEqual(irS16.targetColumn, "grand_total");
assert.strictEqual(irS16.grain.type, "temporal");
assert.strictEqual(irS16.grain.unit, "year");
assert.strictEqual(irS16.grain.count, 5);
assert.strictEqual(irS16.grain.column, "posting_date");
assert.strictEqual(irS16.visual.requested, true);
assert.strictEqual(irS16.confidence, "HIGH");
console.log("✅ 4. S16 Query normalized Intent-IR verified");
passed++;

// Test 5: UNRESOLVABLE — Unknown Table
const irUnresolvable = parseIntentIR("how many unicorns exist", { schema: mockSchema });
assert.strictEqual(irUnresolvable.confidence, "UNRESOLVABLE");
assert.ok(irUnresolvable.refusalReason.includes("No database table matches"));
console.log("✅ 5. UNRESOLVABLE (unknown entity) verified");
passed++;

// Test 6: UNRESOLVABLE — Temporal grain requested on table with NO date column
const irNoDate = parseIntentIR("show logs_without_dates for the last 5 years", { schema: mockSchema });
assert.strictEqual(irNoDate.confidence, "UNRESOLVABLE");
assert.ok(irNoDate.refusalReason.includes("does not contain any date or timestamp column"));
console.log("✅ 6. UNRESOLVABLE (missing dimension column) verified");
passed++;

// Test 7: AMBIGUOUS — Competing date columns with no canonical hint
const ambiguousTableSchema = {
  tables: [
    {
      name: "events",
      columns: [
        { name: "start_time", type: "DATETIME" },
        { name: "end_time", type: "DATETIME" },
        { name: "score", type: "INTEGER" }
      ]
    }
  ]
};
const irAmbiguous = parseIntentIR("show events in 2024", { schema: ambiguousTableSchema });
assert.strictEqual(irAmbiguous.confidence, "AMBIGUOUS");
assert.ok(irAmbiguous.clarificationPrompt.includes("multiple date columns"));
console.log("✅ 7. AMBIGUOUS (clarification prompt emitted) verified");
passed++;

console.log("==================================================");
console.log(`Summary: ${passed}/7 Intent-IR tests passed.`);
console.log("🏆 INTENT-IR VERIFICATION COMPLETE");
console.log("==================================================");
