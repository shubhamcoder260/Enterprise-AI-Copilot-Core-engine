import assert from "assert";
import {
  seriesFromRecords,
  checkGroupingGuard,
  selectFormat
} from "../CogniCore_Project/backend/src/controllers/ai.controller.js";

console.log("=== RUNNING VISUALIZER & REPORT SYNTHESIS UNIT TESTS (V1 to V7) ===");

// V1: seriesFromRecords extracts label/value, preserves first-seen order, ensures purity
const testRecords = [
  { category: "Electronics", price: 120.5, id: 1 },
  { category: "Apparel", price: 45.0, id: 2 },
  { category: "Books", price: 15.2, id: 3 }
];
const recordsClone = JSON.parse(JSON.stringify(testRecords));
const series = seriesFromRecords(testRecords);

assert.strictEqual(series.length, 3, "V1: series length must equal records length");
assert.deepStrictEqual(series[0], { label: "Electronics", value: 120.5 }, "V1: first record mapped correctly");
assert.deepStrictEqual(series[1], { label: "Apparel", value: 45.0 }, "V1: second record mapped correctly");
assert.deepStrictEqual(testRecords, recordsClone, "V1 fail: records must not be mutated (purity)");
assert.strictEqual(seriesFromRecords([]), null, "V1: empty records returns null");
assert.strictEqual(seriesFromRecords([{ name: "Alice" }]), null, "V1: records without numeric values returns null");
console.log("✅ V1 PASS: seriesFromRecords label/value pick, order, and purity verified");

// V2: Grouping guard — GROUP BY sql -> chartSpec; flat sql + multi-row -> table + note; 1 row -> allowed
const guardedSqlPass = checkGroupingGuard(
  "SELECT category, AVG(price) FROM products GROUP BY category",
  3,
  "bar"
);
assert.strictEqual(guardedSqlPass, true, "V2: GROUP BY sql must pass grouping guard");

const guardedSqlFail = checkGroupingGuard(
  "SELECT * FROM products LIMIT 50",
  50,
  "bar"
);
assert.strictEqual(guardedSqlFail, false, "V2: flat SELECT without GROUP BY must fail grouping guard");

const guardedSingleRow = checkGroupingGuard(
  "SELECT COUNT(*) FROM products",
  1,
  "bar"
);
assert.strictEqual(guardedSingleRow, true, "V2: rowCount === 1 must pass grouping guard");

// Verify selectFormat delivers table + note when grouping guard fails
const flatContract = {
  answer: "Found 50 record(s).",
  source: "llm",
  data: {
    sql: "SELECT * FROM orders LIMIT 50",
    records: [
      { order_id: 1, amount: 50.0 },
      { order_id: 2, amount: 75.0 }
    ],
    rowCount: 50
  },
  meta: {}
};
const flatFormatted = selectFormat(flatContract, null, "Show a bar chart of all orders");
assert.strictEqual(flatFormatted.format?.kind, "table", "V2: guard failure must deliver table format");
assert.strictEqual(
  flatFormatted.format?.note,
  "Chart requested but results are not aggregated; showing table instead.",
  "V2: guard failure must attach explanatory note"
);
console.log("✅ V2 PASS: Grouping guard blocks flat SQL from rendering charts and emits table + note");

// V3: pie/bar/line end-to-end from realistic records -> valid Vega-Lite spec
const aggregatedContract = {
  answer: "Found 3 categories.",
  source: "llm",
  data: {
    sql: "SELECT category, AVG(price) FROM products GROUP BY category",
    records: [
      { category: "Electronics", avg_price: 120.5 },
      { category: "Apparel", avg_price: 45.0 },
      { category: "Books", avg_price: 15.2 }
    ],
    rowCount: 3
  },
  meta: {}
};

const barFormatted = selectFormat(aggregatedContract, null, "Show a bar chart of average product price per category");
assert.strictEqual(barFormatted.format?.kind, "chartSpec", "V3: bar chartSpec created");
assert.strictEqual(barFormatted.format?.vegaLite?.mark, "bar", "V3: mark is 'bar'");
assert.strictEqual(barFormatted.format?.vegaLite?.encoding?.x?.field, "label", "V3: x field is 'label'");
assert.strictEqual(barFormatted.format?.vegaLite?.encoding?.y?.field, "value", "V3: y field is 'value'");

const pieFormatted = selectFormat(aggregatedContract, null, "Show a pie chart of sales by category");
assert.strictEqual(pieFormatted.format?.kind, "chartSpec", "V3: pie chartSpec created");
assert.deepStrictEqual(pieFormatted.format?.vegaLite?.mark, { type: "arc", innerRadius: 0 }, "V3: mark is arc");

console.log("✅ V3 PASS: bar and pie generate valid Vega-Lite specs");

// V4: Report assembly — narrative + scalar kpi + grouped chart
const reportContract = {
  answer: "Here is your overview of customer orders.",
  source: "llm",
  data: {
    sql: "SELECT status, COUNT(*) AS count FROM orders GROUP BY status",
    value: 200,
    column: "total_orders",
    records: [
      { status: "completed", count: 150 },
      { status: "cancelled", count: 50 }
    ],
    rowCount: 2
  },
  meta: {}
};
const reportFormatted = selectFormat(reportContract, null, "Give me a summary report on orders");
assert.strictEqual(reportFormatted.format?.kind, "report", "V4: format kind must be report");
assert.strictEqual(reportFormatted.format?.narrative, "Here is your overview of customer orders.", "V4: narrative preserved");
assert.strictEqual(reportFormatted.format?.kpis?.length, 1, "V4: 1 KPI attached");
assert.strictEqual(reportFormatted.format?.kpis[0].value, 200, "V4: KPI value is 200");
assert.strictEqual(reportFormatted.format?.charts?.length, 1, "V4: 1 chartSpec attached");
assert.strictEqual(reportFormatted.format?.charts[0].vegaLite?.mark, "bar", "V4: report chart is valid bar spec");
console.log("✅ V4 PASS: Report assembly contains narrative, scalar KPI, and grouped chart");

// V5: Abstain / fallback -> NO chart, NO format fabrication
const fallbackContract = {
  answer: "I could not find an exact answer.",
  source: "fallback",
  data: { error: "unresolved" },
  meta: {}
};
const fallbackFormatted = selectFormat(fallbackContract, null, "Show a bar chart of alien spaceships");
assert.strictEqual(fallbackFormatted.format, undefined, "V5: fallback must not have format field");
console.log("✅ V5 PASS: Abstaining / fallback responses never receive chart or format fabrication");

// V6: Client hint override respected; cannot bypass grouping guard
const hintedBarContract = selectFormat(
  aggregatedContract,
  { kind: "chart", chartType: "pie" },
  "average price per category" // Plain question, but client requested pie
);
assert.strictEqual(hintedBarContract.format?.kind, "chartSpec", "V6: client hint creates chartSpec");
assert.deepStrictEqual(hintedBarContract.format?.vegaLite?.mark, { type: "arc", innerRadius: 0 }, "V6: client hint overrides chartType to pie");

// Client hint cannot bypass grouping guard on flat query
const hintedFlatContract = selectFormat(
  flatContract,
  { kind: "chart", chartType: "pie" },
  "all orders"
);
assert.strictEqual(hintedFlatContract.format?.kind, "table", "V6: client hint cannot bypass grouping guard");
assert(hintedFlatContract.format?.note.includes("not aggregated"), "V6: note explains aggregation guard");
console.log("✅ V6 PASS: Client hint override respected and cannot bypass grouping guard");

// V7: Non-chart questions receive format EXACTLY as B1 produced (sentinels untouched)
const scalarContract = {
  answer: "The count is 80.",
  source: "dynamic",
  data: { value: 80, sql: "SELECT COUNT(*) FROM students" },
  meta: {}
};
const scalarFormatted = selectFormat(scalarContract, null, "How many students are there?");
assert.strictEqual(scalarFormatted.format?.kind, "kpi", "V7: non-chart scalar produces kpi");
assert.strictEqual(scalarFormatted.format?.value, 80, "V7: kpi value is 80");
assert.strictEqual(scalarFormatted.format?.display, "80", "V7: kpi display is '80'");

const multiRowContract = {
  answer: "Showing records.",
  source: "dynamic",
  data: {
    records: [
      { id: 1, name: "Alice" },
      { id: 2, name: "Bob" }
    ]
  },
  meta: {}
};
const tableFormatted = selectFormat(multiRowContract, null, "list students");
assert.strictEqual(tableFormatted.format?.kind, "table", "V7: non-chart multi-row produces table");
assert.strictEqual(tableFormatted.format?.rowCount, 2, "V7: rowCount is 2");
console.log("✅ V7 PASS: Non-chart questions receive exact B1 formats without drift");

console.log("\nALL V1 to V7 TESTS PASSED!");
