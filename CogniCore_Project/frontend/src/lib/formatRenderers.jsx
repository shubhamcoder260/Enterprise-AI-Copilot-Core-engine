import React, { useRef, useEffect } from "react";
import * as vega from "vega";
import * as vegaLite from "vega-lite";

/**
 * Prettify database column/table names into human-readable presentation labels
 */
export function prettifyLabel(label, fallbackTable) {
  if (!label || label === "count" || label === "result") {
    if (fallbackTable) {
      return prettifyLabel(fallbackTable);
    }
    return label ? label.charAt(0).toUpperCase() + label.slice(1) : "Result";
  }

  const raw = String(label).trim();
  const lower = raw.toLowerCase().replace(/[^a-z0-9_]/g, "");

  const KNOWN_LABELS = {
    customers: "Customers",
    customer: "Customer",
    customer_name: "Customer Name",
    tabcustomer: "Customers",
    tabsalesinvoice: "Sales Invoices",
    sales_invoices: "Sales Invoices",
    sales_invoice: "Sales Invoice",
    base_total: "Total Sales",
    grand_total: "Grand Total",
    net_total: "Net Total",
    total_amount: "Total Sales",
    posting_date: "Posting Date",
    posting_year: "Posting Year",
    postingdate: "Posting Date",
    postingyear: "Posting Year",
    docstatus: "Status",
    status: "Status",
    item_code: "Item Code",
    item_name: "Product Name",
    item_group: "Item Group",
    description: "Description",
    stock_uom: "UOM",
    students: "Students",
    attendance_percentage: "Attendance %",
    student_id: "Student ID",
    y: "Posting Year"
  };

  if (KNOWN_LABELS[lower]) return KNOWN_LABELS[lower];

  const aggMatch = raw.match(/^(?:sum|avg|count|min|max)\((.*?)\)$/i);
  if (aggMatch) {
    const inner = aggMatch[1].trim();
    const innerLower = inner.toLowerCase().replace(/[^a-z0-9_]/g, "");
    if (KNOWN_LABELS[innerLower]) {
      return KNOWN_LABELS[innerLower];
    }
    const cleanInner = inner.replace(/^tab/i, "").replace(/_/g, " ").trim();
    const prefix = raw.slice(0, 3).toUpperCase();
    if (prefix === "SUM" && /total|amount|sum/i.test(cleanInner)) {
      return cleanInner.replace(/\b\w/g, (c) => c.toUpperCase());
    }
    const prefixWord = prefix === "SUM" ? "Total " : prefix === "AVG" ? "Average " : "";
    return (prefixWord + cleanInner).replace(/\b\w/g, (c) => c.toUpperCase());
  }

  let s = raw
    .replace(/^tab/i, "")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Vega-Lite Chart Renderer using vega and vega-lite
 */
export function VegaLiteChart({ spec, title }) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current || !spec) return;

    let view = null;
    let isMounted = true;

    try {
      // Compile Vega-Lite v5 spec into Vega runtime spec
      const compileTarget = {
        width: 480,
        height: 220,
        autosize: { type: "fit", contains: "padding" },
        ...spec
      };

      // Enhance axis labels and formatting (Feature 2b)
      if (compileTarget.encoding) {
        if (compileTarget.encoding.x) {
          let xTitle = compileTarget.encoding.x.title;
          if (!xTitle) {
            const rawX = compileTarget.encoding.x.field || "Dimension";
            if (rawX === "label" || rawX === "Dimension") {
              const sample = compileTarget.data?.values?.[0]?.label;
              if (sample && /^\d{4}$/.test(String(sample).trim())) {
                xTitle = "Year";
              } else if (title && /\byears?\b/i.test(title)) {
                xTitle = "Year";
              } else if (title && /\bstatus\b/i.test(title)) {
                xTitle = "Status";
              } else {
                xTitle = "Category";
              }
            } else {
              xTitle = prettifyLabel(rawX);
            }
          } else {
            xTitle = prettifyLabel(xTitle);
          }

          compileTarget.encoding.x = {
            ...compileTarget.encoding.x,
            title: xTitle,
            axis: {
              title: xTitle,
              labelAngle: -25,
              labelFontSize: 11,
              titleFontSize: 12,
              ...(compileTarget.encoding.x.axis || {})
            }
          };
        }
        if (compileTarget.encoding.y) {
          let yTitle = compileTarget.encoding.y.title;
          if (!yTitle) {
            const rawY = compileTarget.encoding.y.field || "Value";
            if (rawY === "value" || rawY === "Value") {
              if (title && /\bsales\b/i.test(title)) {
                yTitle = "Total Sales";
              } else if (title && /\borders?\b/i.test(title)) {
                yTitle = "Order Count";
              } else if (title && /\bamount|total|sum\b/i.test(title)) {
                yTitle = "Total";
              } else if (title && /\bcount\b/i.test(title)) {
                yTitle = "Count";
              } else {
                yTitle = "Total";
              }
            } else {
              yTitle = prettifyLabel(rawY);
            }
          } else {
            yTitle = prettifyLabel(yTitle);
          }

          compileTarget.encoding.y = {
            ...compileTarget.encoding.y,
            title: yTitle,
            axis: {
              title: yTitle,
              format: compileTarget.encoding.y.axis?.format || ",.2~f",
              titleFontSize: 12,
              ...(compileTarget.encoding.y.axis || {})
            }
          };
        }
        if (compileTarget.encoding.tooltip && Array.isArray(compileTarget.encoding.tooltip)) {
          compileTarget.encoding.tooltip = compileTarget.encoding.tooltip.map((t) => ({
            ...t,
            title: prettifyLabel(t.title || t.field),
            format: t.type === "quantitative" ? ",.2f" : undefined
          }));
        }
      }

      const compiled = vegaLite.compile(compileTarget);
      const vegaSpec = compiled.spec;

      const runtime = vega.parse(vegaSpec);
      view = new vega.View(runtime, {
        renderer: "svg",
        container: containerRef.current,
        hover: true
      });

      view.runAsync().catch((err) => {
        console.warn("Vega runAsync error:", err);
      });
    } catch (err) {
      console.error("Vega-Lite compilation failed:", err);
      if (containerRef.current && isMounted) {
        containerRef.current.innerHTML = `<div style="color: #ef4444; padding: 8px; font-size: 12px;">Failed to render chart: ${err.message}</div>`;
      }
    }

    return () => {
      isMounted = false;
      if (view) {
        try {
          view.finalize();
        } catch {}
      }
    };
  }, [spec]);

  return (
    <div className="chart-wrapper" style={{ marginTop: "12px", background: "white", padding: "14px", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
      {title && (
        <h4 style={{ fontSize: "13px", fontWeight: 600, color: "#1e293b", marginBottom: "10px" }}>
          {title}
        </h4>
      )}
      <div ref={containerRef} className="vega-container" style={{ width: "100%", overflowX: "auto" }} />
    </div>
  );
}

/**
 * KPI Metric Card (Feature 2a)
 */
export function KpiCard({ kpi, fallbackLabel, table }) {
  if (!kpi && fallbackLabel === undefined) return null;
  const rawLabel = kpi?.label || fallbackLabel;
  const label = prettifyLabel(rawLabel, table || kpi?.table);
  const rawValue = kpi?.value;
  let display = kpi?.display !== undefined ? kpi.display : String(rawValue ?? "");

  // Format percentage metrics with % symbol if not already present
  if (
    /percent|pct|rate|\b%/i.test(String(rawLabel || "")) ||
    /percent|pct|rate|\b%/i.test(String(label || ""))
  ) {
    if (!display.includes("%") && !isNaN(parseFloat(display))) {
      display = `${display}%`;
    }
  }

  return (
    <div
      className="kpi-card"
      style={{
        background: "linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)",
        color: "white",
        borderRadius: "12px",
        padding: "18px 24px",
        display: "inline-flex",
        flexDirection: "column",
        minWidth: "180px",
        boxShadow: "0 4px 14px rgba(79, 70, 229, 0.2)",
        marginTop: "10px"
      }}
    >
      {label && (
        <span
          style={{
            fontSize: "12px",
            textTransform: "uppercase",
            letterSpacing: "0.8px",
            opacity: 0.9,
            marginBottom: "6px",
            fontWeight: 600
          }}
        >
          {label}
        </span>
      )}
      <span
        style={{
          fontSize: "32px",
          fontWeight: "800",
          fontFamily: "system-ui, -apple-system, sans-serif",
          letterSpacing: "-0.5px"
        }}
      >
        {display}
      </span>
    </div>
  );
}

/**
 * Data Table Renderer (Feature 2c & 2d)
 */
export function DataTable({ columns, rows, records, note, table }) {
  let cols = [];
  let tableRows = [];

  if (Array.isArray(columns) && Array.isArray(rows)) {
    cols = columns;
    tableRows = rows;
  } else if (Array.isArray(records) && records.length > 0) {
    cols = Object.keys(records[0] || {});
    tableRows = records.map((r) => cols.map((c) => r[c]));
  }

  function isNumericCol(colIdx) {
    let checked = 0;
    for (const r of tableRows) {
      if (r[colIdx] !== null && r[colIdx] !== undefined && r[colIdx] !== "") {
        checked++;
        const val = r[colIdx];
        if (typeof val === "number") continue;
        if (typeof val === "string" && /^-?\d+(\.\d+)?$/.test(val.trim())) continue;
        return false;
      }
    }
    return checked > 0;
  }

  function formatCellValue(val) {
    if (val === null || val === undefined) return "—";
    if (typeof val === "number") {
      return Number.isInteger(val) ? String(val) : val.toLocaleString("en-US", { maximumFractionDigits: 2 });
    }
    if (typeof val === "string") {
      if (/^\d{4}-\d{2}-\d{2}/.test(val.trim())) {
        try {
          const d = new Date(val);
          if (!isNaN(d.getTime())) {
            return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
          }
        } catch {}
      }
      if (/^-?\d+\.\d+$/.test(val.trim())) {
        const num = parseFloat(val);
        if (!isNaN(num)) {
          return num.toLocaleString("en-US", { maximumFractionDigits: 2 });
        }
      }
    }
    return String(val);
  }

  const numericColFlags = cols.map((_, i) => isNumericCol(i));

  return (
    <div className="table-visualizer" style={{ marginTop: "12px" }}>
      {note && (
        <div
          className="format-note-banner"
          style={{
            background: "#fffbeb",
            border: "1px solid #fef08a",
            color: "#854d0e",
            padding: "8px 12px",
            borderRadius: "8px",
            fontSize: "12px",
            marginBottom: "10px",
            display: "flex",
            alignItems: "center",
            gap: "6px"
          }}
        >
          <span>⚠️</span>
          <span>{note}</span>
        </div>
      )}

      {cols.length > 0 ? (
        <details open className="table-wrapper">
          <summary style={{ fontSize: "12px", color: "#64748b", cursor: "pointer", marginBottom: "6px", fontWeight: 500 }}>
            Data Table ({tableRows.length} {tableRows.length === 1 ? "row" : "rows"})
          </summary>
          <div
            style={{
              overflowX: "auto",
              overflowY: "auto",
              maxHeight: "360px",
              border: "1px solid #e2e8f0",
              borderRadius: "8px",
              position: "relative"
            }}
          >
            <table className="data-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
              <thead
                style={{
                  background: "#f8fafc",
                  borderBottom: "1px solid #e2e8f0",
                  position: "sticky",
                  top: 0,
                  zIndex: 2
                }}
              >
                <tr>
                  {cols.map((col, idx) => (
                    <th
                      key={col}
                      style={{
                        padding: "10px 14px",
                        textAlign: numericColFlags[idx] ? "right" : "left",
                        color: "#475569",
                        fontWeight: 600,
                        whiteSpace: "nowrap",
                        background: "#f8fafc"
                      }}
                    >
                      {prettifyLabel(col, table)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tableRows.map((row, rIdx) => (
                  <tr
                    key={rIdx}
                    style={{
                      borderBottom: rIdx < tableRows.length - 1 ? "1px solid #f1f5f9" : "none",
                      background: rIdx % 2 === 0 ? "white" : "#fafafa"
                    }}
                  >
                    {cols.map((col, cIdx) => (
                      <td
                        key={cIdx}
                        style={{
                          padding: "8px 14px",
                          textAlign: numericColFlags[cIdx] ? "right" : "left",
                          color: "#1e293b",
                          fontVariantNumeric: numericColFlags[cIdx] ? "tabular-nums" : "normal"
                        }}
                      >
                        {formatCellValue(row[cIdx])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      ) : (
        <p style={{ fontSize: "12px", color: "#94a3b8" }}>No rows to display.</p>
      )}
    </div>
  );
}

/**
 * CSV Download & Preview Component
 */
export function CsvDownload({ csvText, filename = "query_results.csv" }) {
  function handleDownload() {
    if (!csvText) return;
    const blob = new Blob([csvText], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  const lines = csvText ? csvText.split(/\r?\n/) : [];
  const previewLine = lines[0] || "";

  return (
    <div
      className="csv-export-box"
      style={{
        marginTop: "12px",
        background: "#f8fafc",
        border: "1px solid #e2e8f0",
        borderRadius: "10px",
        padding: "14px 16px",
        display: "flex",
        flexDirection: "column",
        gap: "10px"
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "8px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span style={{ fontSize: "16px" }}>📄</span>
          <span style={{ fontSize: "12px", fontWeight: 600, color: "#334155" }}>
            CSV Data Export ({lines.length > 1 ? `${lines.length - 1} rows` : "0 rows"})
          </span>
        </div>
        <button
          className="csv-download-btn"
          onClick={handleDownload}
          style={{
            background: "#059669",
            color: "white",
            border: "none",
            borderRadius: "6px",
            padding: "6px 12px",
            fontSize: "12px",
            fontWeight: 600,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "4px"
          }}
        >
          ⬇ Download CSV
        </button>
      </div>

      {previewLine && (
        <div style={{ fontSize: "11px", color: "#64748b", fontFamily: "monospace", overflowX: "auto", whiteSpace: "nowrap" }}>
          <span style={{ fontWeight: 600, color: "#475569" }}>Preview: </span>
          <code>{previewLine.length > 80 ? previewLine.slice(0, 80) + "..." : previewLine}</code>
        </div>
      )}
    </div>
  );
}

/**
 * Report Layout Renderer (Narrative + KPI Row + Charts Stack)
 */
export function ReportLayout({ report }) {
  if (!report) return null;

  return (
    <div
      className="report-layout"
      style={{
        marginTop: "14px",
        background: "#ffffff",
        border: "1px solid #e2e8f0",
        borderRadius: "12px",
        padding: "18px",
        display: "flex",
        flexDirection: "column",
        gap: "16px"
      }}
    >
      {report.narrative && (
        <div className="report-narrative" style={{ fontSize: "14px", color: "#1e293b", lineHeight: 1.6 }}>
          {report.narrative}
        </div>
      )}

      {Array.isArray(report.kpis) && report.kpis.length > 0 && (
        <div
          className="report-kpi-grid"
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "12px"
          }}
        >
          {report.kpis.map((kpi, idx) => (
            <KpiCard key={idx} kpi={kpi} />
          ))}
        </div>
      )}

      {Array.isArray(report.charts) && report.charts.length > 0 && (
        <div className="report-charts-stack" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {report.charts.map((ch, idx) => (
            <VegaLiteChart
              key={idx}
              spec={ch.vegaLite}
              title={ch.vegaLite?.title}
            />
          ))}
        </div>
      )}
    </div>
  );
}
