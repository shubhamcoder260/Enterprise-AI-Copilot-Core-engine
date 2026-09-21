import React, { useRef, useEffect } from "react";
import * as vega from "vega";
import * as vegaLite from "vega-lite";

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
        width: 460,
        height: 220,
        autosize: { type: "fit", contains: "padding" },
        ...spec
      };

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
 * KPI Metric Card
 */
export function KpiCard({ kpi, fallbackLabel }) {
  if (!kpi && fallbackLabel === undefined) return null;
  const label = kpi?.label || fallbackLabel;
  const display = kpi?.display !== undefined ? kpi.display : String(kpi?.value ?? "");

  return (
    <div
      className="kpi-card"
      style={{
        background: "linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)",
        color: "white",
        borderRadius: "12px",
        padding: "16px 20px",
        display: "inline-flex",
        flexDirection: "column",
        minWidth: "160px",
        boxShadow: "0 4px 12px rgba(79, 70, 229, 0.15)",
        marginTop: "10px"
      }}
    >
      {label && (
        <span style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.5px", opacity: 0.85, marginBottom: "4px" }}>
          {label}
        </span>
      )}
      <span style={{ fontSize: "28px", fontWeight: "bold", fontFamily: "system-ui, -apple-system, sans-serif" }}>
        {display}
      </span>
    </div>
  );
}

/**
 * Data Table Renderer (with optional grouping-guard note banner)
 */
export function DataTable({ columns, rows, records, note }) {
  let cols = [];
  let tableRows = [];

  if (Array.isArray(columns) && Array.isArray(rows)) {
    cols = columns;
    tableRows = rows;
  } else if (Array.isArray(records) && records.length > 0) {
    cols = Object.keys(records[0] || {});
    tableRows = records.map((r) => cols.map((c) => r[c]));
  }

  return (
    <div className="table-visualizer" style={{ marginTop: "12px" }}>
      {note && (
        <div
          className="format-note-banner"
          style={{
            background: "#eff6ff",
            border: "1px solid #bfdbfe",
            color: "#1d4ed8",
            padding: "8px 12px",
            borderRadius: "8px",
            fontSize: "12px",
            marginBottom: "10px",
            display: "flex",
            alignItems: "center",
            gap: "6px"
          }}
        >
          <span>ℹ️</span>
          <span>{note}</span>
        </div>
      )}

      {cols.length > 0 ? (
        <details open className="table-wrapper">
          <summary style={{ fontSize: "12px", color: "#64748b", cursor: "pointer", marginBottom: "6px" }}>
            Data Table ({tableRows.length} {tableRows.length === 1 ? "row" : "rows"})
          </summary>
          <table className="data-table">
            <thead>
              <tr>
                {cols.map((col) => (
                  <th key={col}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableRows.map((row, rIdx) => (
                <tr key={rIdx}>
                  {cols.map((col, cIdx) => (
                    <td key={cIdx}>{String(row[cIdx] ?? "")}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
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
