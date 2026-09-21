// ==========================================
// POLYMORPHIC FORMATTER REGISTRY (B1)
//
// PRESENTATION ONLY — THE PRIME INVARIANT:
// A formatter NEVER alters data values. data.sql, data.value, data.records,
// meta — byte-untouched. Formatters are pure functions: same input -> identical
// output, no Date.now(), no Math.random(), no I/O, no mutation of inputs.
//
// THE REGISTRY IS CLOSED-SHAPE (same doctrine as gate chain):
// A frozen, reviewed map. NO runtime registerFormatter()-style API.
// ==========================================

/**
 * KPI Formatter — for scalar metric results
 * input: { label, value } (value: number)
 * output: { kind: "kpi", label, value, display }
 *
 * RULES: value is raw number. display is string of same digits — integers as-is,
 * floats via Number(v.toFixed(2)) stringified — NO thousands separators.
 * Null/undefined/NaN/non-numeric value -> return null.
 */
function formatKpi(input) {
  if (!input || typeof input !== "object") return null;
  const { label, value } = input;
  if (value === null || value === undefined) return null;
  if (typeof value !== "number" || Number.isNaN(value)) return null;

  let display;
  if (Number.isInteger(value)) {
    display = String(value);
  } else {
    display = String(Number(value.toFixed(2)));
  }

  return {
    kind: "kpi",
    label: label !== undefined ? label : null,
    value,
    display
  };
}

/**
 * Table Formatter — for row-set results
 * input: { records: [ {...}, ... ] }
 * output: { kind: "table", columns: [...union of keys, first-seen order...], rows: [[cell,...]...], rowCount }
 *
 * Cells preserved verbatim (numbers stay numbers, strings stay strings).
 * Empty records -> { kind: "table", columns: [], rows: [], rowCount: 0 }.
 */
function formatTable(input) {
  if (!input || typeof input !== "object") return null;
  const records = Array.isArray(input.records) ? input.records : [];
  if (records.length === 0) {
    return {
      kind: "table",
      columns: [],
      rows: [],
      rowCount: 0
    };
  }

  // Union of keys in first-seen order
  const colSet = new Set();
  for (const row of records) {
    if (row && typeof row === "object") {
      for (const k of Object.keys(row)) {
        colSet.add(k);
      }
    }
  }
  const columns = Array.from(colSet);

  const rows = records.map((row) => {
    if (!row || typeof row !== "object") {
      return columns.map(() => null);
    }
    return columns.map((col) => (row[col] !== undefined ? row[col] : null));
  });

  return {
    kind: "table",
    columns,
    rows,
    rowCount: rows.length
  };
}

/**
 * ChartSpec Formatter — bar/line/pie from a series
 * input: { chartType: "bar"|"line"|"pie", title, series: [{ label, value }, ...] }
 * output: { kind: "chartSpec", vegaLite: { ...minimal valid Vega-Lite spec... } }
 *
 * bar/line: mark + encoding x:label (ordinal), y:value (quantitative).
 * pie: theta/value + color/label.
 * <2 series points (non-pie) or <1 (pie) -> return null.
 */
function formatChartSpec(input) {
  if (!input || typeof input !== "object") return null;
  const { chartType, title, series } = input;
  if (!Array.isArray(series)) return null;

  const validTypes = new Set(["bar", "line", "pie"]);
  if (!validTypes.has(chartType)) return null;

  if (chartType === "pie") {
    if (series.length < 1) return null;
  } else {
    if (series.length < 2) return null;
  }

  // Validate each point
  for (const pt of series) {
    if (!pt || typeof pt !== "object") return null;
    if (pt.label === undefined || pt.value === undefined || typeof pt.value !== "number" || Number.isNaN(pt.value)) {
      return null;
    }
  }

  // Copy points to prevent mutation/leak
  const values = series.map((pt) => ({
    label: String(pt.label),
    value: pt.value
  }));

  const data = { values };
  let spec = {
    $schema: "https://vega.github.io/schema/vega-lite/v5.json",
    data
  };

  if (title) {
    spec.title = String(title);
  }

  if (chartType === "bar") {
    spec.mark = "bar";
    spec.encoding = {
      x: { field: "label", type: "ordinal" },
      y: { field: "value", type: "quantitative" }
    };
  } else if (chartType === "line") {
    spec.mark = "line";
    spec.encoding = {
      x: { field: "label", type: "ordinal" },
      y: { field: "value", type: "quantitative" }
    };
  } else if (chartType === "pie") {
    spec.mark = { type: "arc", innerRadius: 0 };
    spec.encoding = {
      theta: { field: "value", type: "quantitative" },
      color: { field: "label", type: "nominal" }
    };
  }

  return {
    kind: "chartSpec",
    vegaLite: spec
  };
}

/**
 * Report Formatter — narrative + kpis + charts assembly
 * input: { narrative, kpis: [kpi-output...], charts: [chartSpec-output...] }
 * output: { kind: "report", narrative, kpis, charts }
 *
 * Pass-through assembly, validated shapes; invalid member kinds -> drop the member, never throw.
 */
function formatReport(input) {
  if (!input || typeof input !== "object") return null;
  const narrative = typeof input.narrative === "string" ? input.narrative : "";

  const kpis = [];
  if (Array.isArray(input.kpis)) {
    for (const k of input.kpis) {
      if (k && typeof k === "object" && k.kind === "kpi" && typeof k.value === "number") {
        kpis.push(k);
      }
    }
  }

  const charts = [];
  if (Array.isArray(input.charts)) {
    for (const c of input.charts) {
      if (c && typeof c === "object" && c.kind === "chartSpec" && c.vegaLite) {
        charts.push(c);
      }
    }
  }

  return {
    kind: "report",
    narrative,
    kpis,
    charts
  };
}

/**
 * CSV Formatter — RFC 4180 export with SPREADSHEET FORMULA-INJECTION NEUTRALIZATION
 * input: { columns: [...], rows: [[...]] }
 * output: { kind: "csv", text: "..." }
 *
 * RULES: cells joined with ",", rows with "\r\n".
 * Cell containing comma, double-quote, or newline -> wrap in quotes, double inner quotes.
 * INJECTION GUARD: cell whose first char is one of = + - @ (or starts with tab/CR) ->
 * prefix with single quote BEFORE any quoting.
 * NOTE: numeric -2 cells must NOT be prefixed (only string cells starting with -).
 */
function formatCsv(input) {
  if (!input || typeof input !== "object") return null;
  const columns = Array.isArray(input.columns) ? input.columns : [];
  const rows = Array.isArray(input.rows) ? input.rows : [];

  function sanitizeCell(rawCell) {
    if (rawCell === null || rawCell === undefined) {
      return "";
    }

    let isString = typeof rawCell === "string";
    let strVal = String(rawCell);

    // Injection Guard:
    // Only prefix if it is a string starting with =, +, -, @, \t, \r
    // If rawCell is a number (e.g. -2, +5), it is NOT prefixed.
    if (isString && /^[=+\-@\t\r]/.test(strVal)) {
      strVal = "'" + strVal;
    }

    // RFC 4180 quoting: if contains comma, quote, or newline (\r or \n)
    if (/[",\r\n]/.test(strVal)) {
      strVal = `"${strVal.replace(/"/g, '""')}"`;
    }

    return strVal;
  }

  const lines = [];

  // Header line
  if (columns.length > 0) {
    lines.push(columns.map(sanitizeCell).join(","));
  }

  // Data rows
  for (const row of rows) {
    if (Array.isArray(row)) {
      lines.push(row.map(sanitizeCell).join(","));
    }
  }

  return {
    kind: "csv",
    text: lines.join("\r\n")
  };
}

export const FORMAT_REGISTRY = Object.freeze({
  kpi: Object.freeze({ run: formatKpi }),
  table: Object.freeze({ run: formatTable }),
  chartSpec: Object.freeze({ run: formatChartSpec }),
  report: Object.freeze({ run: formatReport }),
  csv: Object.freeze({ run: formatCsv })
});

export function formatFor(kind, input) {
  if (typeof kind !== "string") return null;
  // Exact-key lookup ONLY via Object.hasOwn / Object.prototype.hasOwnProperty
  if (!Object.prototype.hasOwnProperty.call(FORMAT_REGISTRY, kind)) {
    return null;
  }
  const f = FORMAT_REGISTRY[kind];
  if (!f || typeof f.run !== "function") return null;
  try {
    return f.run(input);
  } catch {
    return null;
  }
}
