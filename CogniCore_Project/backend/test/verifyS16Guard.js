import assert from 'assert';
import { parseIntentIR } from '../src/core/intent.ir.js';
import { validateChartGrounding, enrichResultWithGrounding } from '../src/core/grounding.guard.js';

console.log("==================================================");
console.log("       VERIFYING S16 GROUNDING GUARD (CAP v2.2)   ");
console.log("==================================================");

const mockSchema = {
  tables: [
    {
      name: "tabSales Invoice",
      columns: [
        { name: "name", type: "VARCHAR(140)" },
        { name: "posting_date", type: "DATE" },
        { name: "grand_total", type: "DECIMAL(21,9)" }
      ]
    },
    {
      name: "students",
      columns: [
        { name: "student_id", type: "INTEGER" },
        { name: "name", type: "TEXT" }
      ]
    }
  ]
};

// Mock adapter simulating ERPNext MariaDB with 2 years of data (2023-2024)
const mockAdapter = {
  queryReadOnly: async (sql) => {
    // Return 2 distinct years
    return {
      records: [
        {
          min_date: "2023-05-15",
          max_date: "2024-11-20",
          distinct_years: 2
        }
      ]
    };
  }
};

let passed = 0;

async function runTests() {
  // Test 1: S16 Query Grounding with Partial Data Span
  const irS16 = parseIntentIR("total sales for the last 5 years as a graph", { schema: mockSchema });
  const verdict = await validateChartGrounding(irS16, { schema: mockSchema, adapter: mockAdapter });

  assert.strictEqual(verdict.grounded, true);
  assert.strictEqual(verdict.action, "PROCEED");
  assert.ok(verdict.honestAnnotation, "Expected honestAnnotation for partial span");
  assert.strictEqual(verdict.honestAnnotation.partial, true);
  assert.strictEqual(verdict.honestAnnotation.requestedSpanYears, 5);
  assert.strictEqual(verdict.honestAnnotation.availableSpanYears, 2);
  assert.ok(verdict.honestAnnotation.coverageNotice.includes("fewer than the requested 5 years"));
  console.log("✅ 1. S16 Partial span detection verified (2 vs 5 years)");
  passed++;

  // Test 2: Result Enrichment with Grounding Notice
  const rawResult = {
    answer: "Total sales: $480,000 across 2023 and 2024.",
    meta: {},
    data: { records: [{ year: "2024", sales: 450000 }] }
  };
  const enriched = enrichResultWithGrounding(rawResult, verdict);
  assert.ok(enriched.meta.grounding);
  assert.strictEqual(enriched.meta.grounding.partial, true);
  assert.ok(enriched.answer.includes("Note: The database contains records for 2 years"));
  console.log("✅ 2. Result enrichment with honest caveat verified");
  passed++;

  // Test 3: Missing date column for temporal grain
  const irNoDate = parseIntentIR("show students for the last 5 years", { schema: mockSchema });
  const verdictNoDate = await validateChartGrounding(irNoDate, { schema: mockSchema, adapter: mockAdapter });
  assert.strictEqual(verdictNoDate.grounded, false);
  assert.strictEqual(verdictNoDate.action, "REFUSE");
  assert.ok(verdictNoDate.reason.includes("does not contain any date or timestamp column"));
  console.log("✅ 3. Refusal on missing temporal column verified");
  passed++;

  // Test 4: Missing table
  const irFakeTable = {
    confidence: "HIGH",
    primaryTable: "nonexistent_table",
    targetColumn: "amount",
    grain: null
  };
  const verdictFake = await validateChartGrounding(irFakeTable, { schema: mockSchema });
  assert.strictEqual(verdictFake.grounded, false);
  assert.strictEqual(verdictFake.action, "REFUSE");
  console.log("✅ 4. Refusal on non-existent table verified");
  passed++;

  console.log("==================================================");
  console.log(`Summary: ${passed}/4 S16 Grounding Guard tests passed.`);
  console.log("🏆 S16 GROUNDING GUARD VERIFIED");
  console.log("==================================================");
}

runTests().catch((err) => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});
