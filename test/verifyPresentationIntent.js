import assert from "assert";
import { detectPresentationIntent } from "../CogniCore_Project/backend/src/core/presentation.intent.js";

console.log("=== RUNNING PRESENTATION INTENT DETECTOR TESTS ===");

// Test 1: Positive chart triggers
const bar1 = detectPresentationIntent("Show a bar chart of average product price per category");
assert.strictEqual(bar1.chart, true, "bar1: chart must be true");
assert.strictEqual(bar1.chartType, "bar", "bar1: chartType must be 'bar'");
assert.strictEqual(bar1.report, false, "bar1: report must be false");
console.log("✅ PASS: 'bar chart' detected as chart=true, chartType='bar'");

const pie1 = detectPresentationIntent("Show a pie chart of orders by status");
assert.strictEqual(pie1.chart, true, "pie1: chart must be true");
assert.strictEqual(pie1.chartType, "pie", "pie1: chartType must be 'pie'");
console.log("✅ PASS: 'pie chart' detected as chart=true, chartType='pie'");

const line1 = detectPresentationIntent("plot a line graph of revenue over time");
assert.strictEqual(line1.chart, true, "line1: chart must be true");
assert.strictEqual(line1.chartType, "line", "line1: chartType must be 'line'");
console.log("✅ PASS: 'line graph' detected as chart=true, chartType='line'");

const bareGraph = detectPresentationIntent("visualize total sales by country");
assert.strictEqual(bareGraph.chart, true, "bareGraph: chart must be true");
assert.strictEqual(bareGraph.chartType, "bar", "bareGraph: default chartType must be 'bar'");
console.log("✅ PASS: bare 'visualize' defaults to chartType='bar'");

// Test 2: Positive report triggers
const rep1 = detectPresentationIntent("Give me a report on orders");
assert.strictEqual(rep1.report, true, "rep1: report must be true");
assert.strictEqual(rep1.chart, false, "rep1: chart must be false");
console.log("✅ PASS: 'report on orders' detected as report=true, chart=false");

const dash1 = detectPresentationIntent("show executive dashboard for clients");
assert.strictEqual(dash1.report, true, "dash1: report must be true");
console.log("✅ PASS: 'dashboard' detected as report=true");

// Test 3: Dual trigger (both chart and report)
const dual1 = detectPresentationIntent("Give me a summary report with a bar chart of sales");
assert.strictEqual(dual1.chart, true, "dual1: chart must be true");
assert.strictEqual(dual1.chartType, "bar", "dual1: chartType must be 'bar'");
assert.strictEqual(dual1.report, true, "dual1: report must be true");
console.log("✅ PASS: dual trigger detected both chart and report");

// Test 4: Strict negative triggers — NO false positives on percentage, count, sentinel questions
const neg1 = detectPresentationIntent("what percentage of orders were cancelled?");
assert.strictEqual(neg1.chart, false, "neg1: percentage must not trigger chart");
assert.strictEqual(neg1.report, false, "neg1: percentage must not trigger report");
console.log("✅ PASS: 'percentage' does NOT trigger chart or report");

const neg2 = detectPresentationIntent("lowest attendence top 5");
assert.strictEqual(neg2.chart, false, "neg2: sentinel must not trigger chart");
assert.strictEqual(neg2.report, false, "neg2: sentinel must not trigger report");
console.log("✅ PASS: Q5 sentinel 'lowest attendence top 5' stays false");

const neg3 = detectPresentationIntent("average absent percentage");
assert.strictEqual(neg3.chart, false, "neg3: average absent percentage must stay false");
assert.strictEqual(neg3.report, false, "neg3: average absent percentage must stay false");
console.log("✅ PASS: 'average absent percentage' stays false");

const neg4 = detectPresentationIntent("How many students are there?");
assert.strictEqual(neg4.chart, false, "neg4: plain count must stay false");
assert.strictEqual(neg4.report, false, "neg4: plain count must stay false");
console.log("✅ PASS: plain count stays false");

console.log("\nALL PRESENTATION INTENT TESTS PASSED!");
