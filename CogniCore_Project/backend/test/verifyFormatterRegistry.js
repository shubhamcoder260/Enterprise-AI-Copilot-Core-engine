// ==========================================
// TEST SUITE: POLYMORPHIC FORMATTER REGISTRY (U1–U14)
//
// Hard assertions covering:
//   U1  kpi: raw value preserved; display digits match (float 2dp); null -> null
//   U2  table: column union order first-seen; rowCount; empty -> empty table
//   U3  chartSpec bar: valid spec, x=ordinal/y=quantitative; 1-point series -> null
//   U4  chartSpec pie: theta/color encoding present
//   U5  report: assembles; drops invalid members without throwing
//   U6  csv basic: header + rows, \r\n
//   U7  csv quoting: cell with comma AND quote AND newline -> correct doubling
//   U8  csv INJECTION: "=1+1" -> "'=1+1"; "+cmd" -> "'+cmd"; "@x" -> "'@x"; "-2" string -> "'-2"; numeric -2 NOT prefixed
//   U9  unknown kind: formatFor("javascript") -> null; formatFor("proto") -> null; formatFor("constructor") -> null
//   U10 determinism: formatFor("csv", X) twice -> JSON.stringify identical
//   U11 purity: deep-freeze input; formatter must not mutate (JSON.stringify before === after)
//   U12 selectFormat auto: scalar contract -> kpi; records contract -> table; neither -> no format field
//   U13 selectFormat hint: format:"csv" -> csv kind; format:"csv" with no records -> no format field; hint NEVER mutates data/meta
//   U14 fail-safe: formatter error -> selectFormat returns contract unchanged, no format field, no throw
// ==========================================

import assert from "assert";
import { formatFor, FORMAT_REGISTRY } from "../src/kernel/formatter.registry.js";
import { selectFormat } from "../src/controllers/ai.controller.js";

console.log("==================================================");
console.log(" 🧪 RUNNING FORMATTER REGISTRY UNIT TESTS (U1-U14)");
console.log("==================================================");

let passed = 0;
let total = 0;

function runTest(name, fn) {
  total++;
  try {
    fn();
    console.log(`[✅ PASS] ${name}`);
    passed++;
  } catch (err) {
    console.error(`[❌ FAIL] ${name}`);
    console.error(err);
  }
}

// Helper: recursive deep freeze
function deepFreeze(obj) {
  if (obj === null || typeof obj !== "object") return obj;
  Object.freeze(obj);
  for (const key of Object.keys(obj)) {
    deepFreeze(obj[key]);
  }
  return obj;
}

// U1 kpi
runTest("U1: kpi: raw value preserved, display float 2dp, null value returns null", () => {
  const intRes = formatFor("kpi", { label: "Count", value: 42 });
  assert.deepStrictEqual(intRes, { kind: "kpi", label: "Count", value: 42, display: "42" });

  const floatRes = formatFor("kpi", { label: "Revenue", value: 284446.654321 });
  assert.strictEqual(floatRes.value, 284446.654321, "Raw value must remain unrounded");
  assert.strictEqual(floatRes.display, "284446.65", "Display string must match float 2dp without thousands separators");

  const nullRes = formatFor("kpi", { label: "Empty", value: null });
  assert.strictEqual(nullRes, null, "Null value must return null");

  const undefRes = formatFor("kpi", { label: "Undef", value: undefined });
  assert.strictEqual(undefRes, null, "Undefined value must return null");
});

// U2 table
runTest("U2: table: column union first-seen, rowCount, empty -> empty table", () => {
  const records = [
    { id: 1, name: "Alice" },
    { name: "Bob", age: 30 },
    { city: "NYC", id: 3 }
  ];
  const res = formatFor("table", { records });
  assert.strictEqual(res.kind, "table");
  assert.deepStrictEqual(res.columns, ["id", "name", "age", "city"]);
  assert.strictEqual(res.rowCount, 3);
  assert.deepStrictEqual(res.rows, [
    [1, "Alice", null, null],
    [null, "Bob", 30, null],
    [3, null, null, "NYC"]
  ]);

  const emptyRes = formatFor("table", { records: [] });
  assert.deepStrictEqual(emptyRes, { kind: "table", columns: [], rows: [], rowCount: 0 });
});

// U3 chartSpec bar
runTest("U3: chartSpec bar: valid Vega-Lite spec, x=ordinal/y=quantitative, <2 points -> null", () => {
  const validBar = formatFor("chartSpec", {
    chartType: "bar",
    title: "Monthly Revenue",
    series: [
      { label: "Jan", value: 100 },
      { label: "Feb", value: 200 }
    ]
  });
  assert.strictEqual(validBar.kind, "chartSpec");
  assert.strictEqual(validBar.vegaLite.mark, "bar");
  assert.strictEqual(validBar.vegaLite.title, "Monthly Revenue");
  assert.strictEqual(validBar.vegaLite.encoding.x.field, "label");
  assert.strictEqual(validBar.vegaLite.encoding.x.type, "ordinal");
  assert.strictEqual(validBar.vegaLite.encoding.y.field, "value");
  assert.strictEqual(validBar.vegaLite.encoding.y.type, "quantitative");

  const singlePoint = formatFor("chartSpec", {
    chartType: "bar",
    title: "Single",
    series: [{ label: "Jan", value: 100 }]
  });
  assert.strictEqual(singlePoint, null, "Bar chart with < 2 series points must return null");
});

// U4 chartSpec pie
runTest("U4: chartSpec pie: theta/color encoding present, <1 point -> null", () => {
  const validPie = formatFor("chartSpec", {
    chartType: "pie",
    title: "Market Share",
    series: [{ label: "Apple", value: 45 }]
  });
  assert.strictEqual(validPie.kind, "chartSpec");
  assert.strictEqual(validPie.vegaLite.encoding.theta.field, "value");
  assert.strictEqual(validPie.vegaLite.encoding.theta.type, "quantitative");
  assert.strictEqual(validPie.vegaLite.encoding.color.field, "label");
  assert.strictEqual(validPie.vegaLite.encoding.color.type, "nominal");

  const zeroPoint = formatFor("chartSpec", {
    chartType: "pie",
    series: []
  });
  assert.strictEqual(zeroPoint, null, "Pie chart with < 1 series points must return null");
});

// U5 report
runTest("U5: report: assembles narrative + kpis + charts; drops invalid members without throwing", () => {
  const kpiValid = formatFor("kpi", { label: "Total", value: 100 });
  const chartValid = formatFor("chartSpec", {
    chartType: "bar",
    series: [{ label: "A", value: 1 }, { label: "B", value: 2 }]
  });

  const rep = formatFor("report", {
    narrative: "Quarterly summary.",
    kpis: [kpiValid, { kind: "invalid", value: "bad" }, null],
    charts: [chartValid, { fake: 123 }]
  });

  assert.strictEqual(rep.kind, "report");
  assert.strictEqual(rep.narrative, "Quarterly summary.");
  assert.strictEqual(rep.kpis.length, 1);
  assert.deepStrictEqual(rep.kpis[0], kpiValid);
  assert.strictEqual(rep.charts.length, 1);
  assert.deepStrictEqual(rep.charts[0], chartValid);
});

// U6 csv basic
runTest("U6: csv basic: header + rows joined with comma and CRLF", () => {
  const res = formatFor("csv", {
    columns: ["id", "name"],
    rows: [[1, "Alice"], [2, "Bob"]]
  });
  assert.strictEqual(res.kind, "csv");
  assert.strictEqual(res.text, "id,name\r\n1,Alice\r\n2,Bob");
});

// U7 csv quoting
runTest("U7: csv quoting: cell with comma, quote, and newline doubled appropriately", () => {
  const res = formatFor("csv", {
    columns: ["note"],
    rows: [['hello, "world"\nnext line']]
  });
  assert.strictEqual(res.text, 'note\r\n"hello, ""world""\nnext line"');
});

// U8 csv INJECTION
runTest("U8: csv INJECTION: formula prefix neutralized on string cells; numeric -2 unaffected", () => {
  const res = formatFor("csv", {
    columns: ["cmd", "num", "tab"],
    rows: [
      ["=1+1", -2, "\tsecret"],
      ["+cmd", "+5", "@alert"],
      ["-danger", 10, null]
    ]
  });

  // Expected rows:
  // Row 1:
  // "=1+1" -> "'=1+1"
  // -2 (number) -> "-2" (NOT prefixed with single quote)
  // "\tsecret" -> "\tsecret" (starts with tab) -> "'\tsecret"
  // Row 2:
  // "+cmd" -> "'+cmd"
  // "+5" (string starting with +) -> "'+5"
  // "@alert" -> "'@alert"
  // Row 3:
  // "-danger" (string starting with -) -> "'-danger"
  // 10 -> "10"
  // null -> ""
  const lines = res.text.split("\r\n");
  assert.strictEqual(lines[0], "cmd,num,tab");
  assert.strictEqual(lines[1], "'=1+1,-2,'\tsecret");
  assert.strictEqual(lines[2], "'+cmd,'+5,'@alert");
  assert.strictEqual(lines[3], "'-danger,10,");
});

// U9 unknown kind
runTest("U9: unknown kind / prototype pollution returns null", () => {
  assert.strictEqual(formatFor("javascript", {}), null);
  assert.strictEqual(formatFor("proto", {}), null);
  assert.strictEqual(formatFor("__proto__", {}), null);
  assert.strictEqual(formatFor("constructor", {}), null);
  assert.strictEqual(formatFor("toString", {}), null);
});

// U10 determinism
runTest("U10: determinism: calling formatFor twice yields byte-identical JSON", () => {
  const input = { columns: ["a", "b"], rows: [[1, 2], [3, 4]] };
  const first = JSON.stringify(formatFor("csv", input));
  const second = JSON.stringify(formatFor("csv", input));
  assert.strictEqual(first, second);
});

// U11 purity
runTest("U11: purity: deep-frozen input is untouched by formatters", () => {
  const input = deepFreeze({
    chartType: "bar",
    title: "Immutable",
    series: [
      { label: "X", value: 10 },
      { label: "Y", value: 20 }
    ]
  });

  const beforeStr = JSON.stringify(input);
  const res = formatFor("chartSpec", input);
  const afterStr = JSON.stringify(input);

  assert.strictEqual(beforeStr, afterStr, "Input must not be mutated");
  assert.strictEqual(res.kind, "chartSpec");
});

// U12 selectFormat auto
runTest("U12: selectFormat auto: scalar -> kpi; records -> table; neither -> no format field", () => {
  const scalarContract = {
    answer: "The result is 10.",
    source: "dynamic",
    data: { value: 10, sql: "SELECT 10" },
    meta: { sessionId: "s1" }
  };
  const scalarFormatted = selectFormat(scalarContract);
  assert.deepStrictEqual(scalarFormatted.format, {
    kind: "kpi",
    label: null,
    value: 10,
    display: "10"
  });
  assert.strictEqual(scalarFormatted.answer, scalarContract.answer);
  assert.strictEqual(scalarFormatted.source, scalarContract.source);
  assert.strictEqual(scalarFormatted.data, scalarContract.data);
  assert.strictEqual(scalarFormatted.meta, scalarContract.meta);

  const tableContract = {
    answer: "Found 2 records.",
    source: "dynamic",
    data: { records: [{ a: 1 }, { a: 2 }] },
    meta: { sessionId: "s2" }
  };
  const tableFormatted = selectFormat(tableContract);
  assert.strictEqual(tableFormatted.format.kind, "table");
  assert.strictEqual(tableFormatted.format.rowCount, 2);

  const neitherContract = {
    answer: "Fallback text",
    source: "fallback",
    data: { error: "none" },
    meta: { sessionId: "s3" }
  };
  const neitherFormatted = selectFormat(neitherContract);
  assert.strictEqual(neitherFormatted.format, undefined, "Neither contract must not have format field");
});

// U13 selectFormat hint
runTest("U13: selectFormat hint: format:csv on table data -> csv kind; without records -> no format", () => {
  const tableContract = {
    answer: "Found records.",
    source: "dynamic",
    data: { records: [{ id: 1, name: "Alpha" }] },
    meta: { sessionId: "s4" }
  };

  const csvFormatted = selectFormat(tableContract, "csv");
  assert.strictEqual(csvFormatted.format.kind, "csv");
  assert.strictEqual(csvFormatted.format.text, "id,name\r\n1,Alpha");
  assert.deepStrictEqual(csvFormatted.data, tableContract.data, "Data must remain untouched");
  assert.deepStrictEqual(csvFormatted.meta, tableContract.meta, "Meta must remain untouched");

  const noRecordsContract = {
    answer: "Scalar only",
    source: "dynamic",
    data: { value: 100 },
    meta: { sessionId: "s5" }
  };
  const noCsv = selectFormat(noRecordsContract, "csv");
  // Cannot csv non-tabular data -> auto fallback to kpi
  assert.strictEqual(noCsv.format.kind, "kpi");
});

// U14 fail-safe
runTest("U14: fail-safe: throwing input or internal error returns contract without format field and without throwing", () => {
  const badContract = {
    answer: "Safe answer",
    source: "dynamic",
    data: {
      get value() {
        throw new Error("Simulated getter explosion");
      }
    },
    meta: { sessionId: "s6" }
  };

  let res;
  assert.doesNotThrow(() => {
    res = selectFormat(badContract);
  });
  assert.strictEqual(res.answer, "Safe answer");
  assert.strictEqual(res.format, undefined, "On error, contract ships without format field");
});

console.log("==================================================");
console.log(`📊 TEST RESULTS: ${passed}/${total} assertions PASSED`);
console.log("==================================================");

if (passed !== total) {
  process.exit(1);
}
