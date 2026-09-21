import React from "react";
import {
  VegaLiteChart,
  KpiCard,
  DataTable,
  CsvDownload,
  ReportLayout
} from "../lib/formatRenderers.jsx";

export default function Visualizer({ result, onInspectSql }) {
  if (!result || typeof result !== "object") return null;

  const { format, data } = result;

  return (
    <div className="cognicore-visualizer">
      {/* 1. POLYMORPHIC FORMAT DISPATCH */}
      {format?.kind === "kpi" && (
        <KpiCard kpi={format} />
      )}

      {format?.kind === "table" && (
        <DataTable
          columns={format.columns}
          rows={format.rows}
          note={format.note}
        />
      )}

      {format?.kind === "chartSpec" && format.vegaLite && (
        <VegaLiteChart
          spec={format.vegaLite}
          title={format.vegaLite?.title}
        />
      )}

      {format?.kind === "report" && (
        <ReportLayout report={format} />
      )}

      {format?.kind === "csv" && (
        <CsvDownload csvText={format.text} />
      )}

      {/* 2. UNFORMATTED / FALLBACK DATA RENDERING (NO FORMAT FIELD OR LEGACY SHAPE) */}
      {!format && data?.records && data.records.length > 0 && (
        <DataTable records={data.records} />
      )}

      {!format && data?.value !== undefined && !data?.records && (
        <KpiCard
          kpi={{
            label: data.column || data.type || null,
            value: data.value,
            display: String(data.value)
          }}
        />
      )}
    </div>
  );
}
