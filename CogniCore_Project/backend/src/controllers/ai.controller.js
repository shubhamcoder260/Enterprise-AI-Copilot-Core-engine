import crypto from "crypto";
import { runCoreEngine } from "../core/core.engine.js";
import { recordExchange, getFullHistory } from "../store/history.store.js";
import { formatFor } from "../kernel/formatter.registry.js";
import { detectPresentationIntent } from "../core/presentation.intent.js";


import { acquireQueryLease, getActiveSource } from "../kernel/switch.orchestrator.js";
import { createCapabilitiesForSource } from "../kernel/capabilities.js";

export async function handleQuery(req, res) {
  const startTime = Date.now();
  const sessionId =
    (req.body && req.body.sessionId && String(req.body.sessionId).trim()) ||
    (req.headers["x-session-id"] && String(req.headers["x-session-id"]).trim()) ||
    crypto.randomUUID();

  const organization = req.body?.organization || "college";
  const role = req.body?.role || "admin";
  const model = req.body?.model;

  const lease = await acquireQueryLease();

  try {
    const { query } = req.body || {};

    if (!query || typeof query !== "string" || !query.trim()) {
      return res.status(400).json({
        answer: "Please provide a valid query.",
        source: "error",
        data: { error: "empty_query" },
        meta: {
          sessionId,
          organization,
          role,
          engineMode: "error",
          processingMs: Date.now() - startTime
        }
      });
    }

    const activeSource = getActiveSource();
    const capabilities = createCapabilitiesForSource(activeSource);

    const result = await runCoreEngine(
      { query, organization, role, sessionId, model },
      { capabilities }
    );

    // Step 2: Record exchange in persistent history store (fail-safe)
    try {
      await recordExchange({
        sessionId,
        question: query,
        answer: result.answer,
        source: result.source,
        sql: result.data?.sql || null,
        model: result.meta?.model || null
      });
    } catch (histErr) {
      console.warn("⚠️ [History] Error recording exchange:", histErr.message);
    }

    // Step 3: Wire polymorphic presentation format (B1/B6)
    // Fail-safe: format failure NEVER breaks an answer. Try/catch at wiring point.
    const finalResponse = selectFormat(result, req.body?.format, query);

    // Returns standard { answer, source, data, meta, [format] }
    res.json(finalResponse);
  } catch (error) {
    console.error("AI Controller Error:", error);
    res.status(500).json({
      answer: `An error occurred while processing your query: ${error.message}`,
      source: "error",
      data: { error: error.message },
      meta: {
        sessionId,
        organization,
        role,
        engineMode: "error",
        processingMs: Date.now() - startTime
      }
    });
  } finally {
    lease.release();
  }
}

export async function getAvailableModels(req, res) {
  const baseUrl = process.env.LOCAL_LLM_URL || "http://localhost:11434";
  const defaultModel = process.env.LOCAL_LLM_MODEL || "gemma3:4b";

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(`${baseUrl}/api/tags`, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller.signal
    });

    clearTimeout(timer);

    if (!response.ok) {
      return res.json({
        available: false,
        current: defaultModel,
        models: [defaultModel]
      });
    }

    const data = await response.json();
    let modelNames = Array.isArray(data?.models)
      ? data.models
          .filter((m) => !Array.isArray(m.capabilities) || m.capabilities.includes("completion"))
          .map((m) => m.name)
          .filter(Boolean)
      : [];

    if (!modelNames.includes(defaultModel)) {
      modelNames.unshift(defaultModel);
    }

    return res.json({
      available: true,
      current: defaultModel,
      models: modelNames
    });
  } catch {
    clearTimeout(timer);
    return res.json({
      available: false,
      current: defaultModel,
      models: [defaultModel]
    });
  }
}

export async function getSessionHistory(req, res) {
  const sessionId = req.params?.sessionId;
  if (!sessionId) {
    return res.status(400).json({ error: "Missing sessionId parameter" });
  }

  try {
    const exchanges = await getFullHistory(sessionId, 100);
    return res.status(200).json({
      success: true,
      sessionId,
      count: exchanges.length,
      exchanges,
      history: exchanges
    });
  } catch (err) {
    console.warn("⚠️ [History] Error fetching session history:", err.message);
    return res.status(200).json({
      success: false,
      sessionId,
      count: 0,
      exchanges: [],
      history: []
    });
  }
}

/**
 * Extracts a series array [{ label, value }, ...] from tabular records.
 * Rules: First string column = labels, first numeric column = values (first-seen key order).
 * If < 1 row, or no numeric column exists, returns null.
 * Pure function: never mutates input records.
 *
 * @param {Array<object>} records
 * @returns {Array<{ label: string, value: number }>|null}
 */
export function seriesFromRecords(records) {
  if (!Array.isArray(records) || records.length < 1) return null;

  // Find first string column and first numeric column across keys of first record
  const firstRow = records[0];
  if (!firstRow || typeof firstRow !== "object") return null;

  const keys = Object.keys(firstRow);
  let labelCol = null;
  let valueCol = null;

  for (const k of keys) {
    const val = firstRow[k];
    const num = typeof val === "number" ? val : (!Number.isNaN(Number(val)) && typeof val === "string" && val.trim() !== "" ? Number(val) : NaN);
    if (valueCol === null && !Number.isNaN(num) && !/year|date|time|id/i.test(k)) {
      valueCol = k;
    } else if (labelCol === null && (typeof val === "string" || /year|date|time|name|id/i.test(k))) {
      labelCol = k;
    }
  }

  // If no string column was found, look for any non-value column to act as label
  if (labelCol === null) {
    for (const k of keys) {
      if (k !== valueCol) {
        labelCol = k;
        break;
      }
    }
  }

  // Must have a valid numeric value column
  if (!valueCol) return null;

  const series = [];
  for (const row of records) {
    if (!row || typeof row !== "object") continue;
    const rawVal = row[valueCol];
    const numVal = typeof rawVal === "number" ? rawVal : Number(rawVal);
    if (Number.isNaN(numVal)) continue;
    const rawLabel = labelCol !== null && row[labelCol] !== undefined ? String(row[labelCol]) : String(series.length + 1);
    series.push({
      label: rawLabel,
      value: numVal
    });
  }

  if (series.length === 0) return null;
  return series;
}

/**
 * Checks whether records represent an aggregated result suitable for a chart.
 * THE GROUPING GUARD (honesty control):
 * Bar/pie chartSpec requires data.sql to contain GROUP BY (case-insensitive) OR rowCount === 1.
 * Line chart requires GROUP BY OR rowCount === 1 OR a date/time first column.
 * A chart of raw ungrouped rows implies aggregation that didn't happen — that is a misleading-authority visual bug.
 *
 * @param {string} sql
 * @param {number} rowCount
 * @param {string} chartType
 * @param {Array<object>} records
 * @returns {boolean}
 */
export function checkGroupingGuard(sql, rowCount, chartType = "bar", records = []) {
  if (rowCount === 1) return true;
  const sqlStr = typeof sql === "string" ? sql : "";
  const hasGroupBy = /\bGROUP\s+BY\b/i.test(sqlStr);
  if (hasGroupBy) return true;

  if (chartType === "line" && Array.isArray(records) && records.length > 0) {
    const firstRow = records[0];
    const keys = Object.keys(firstRow || {});
    const firstKey = keys[0] || "";
    const firstVal = String(firstRow[firstKey] || "");
    const isDateCol = /date|time|year|month|day/i.test(firstKey) || /^\d{4}-\d{2}/.test(firstVal);
    if (isDateCol) return true;
  }

  return false;
}

/**
 * Selects and attaches a presentation format to the standard contract envelope.
 *
 * PRIME INVARIANT: formatters are presentation only. They NEVER alter data/meta/answer/source.
 * FAIL-SAFE: Any error or unsupported shape returns the contract unchanged without a format field.
 *
 * @param {object} contract - Standard { answer, source, data, meta }
 * @param {string|object} [hint] - Optional user/client format hint (e.g. "csv" or { kind: "chart", chartType: "pie" })
 * @param {string} [query] - Natural language user question
 * @returns {object} { answer, source, data, meta, [format] }
 */
export function selectFormat(contract, hint, query = "") {
  if (!contract || typeof contract !== "object") return contract;

  // Never format fallback, error, or abstaining responses as charts or reports
  if (contract.source === "fallback" || contract.source === "error") {
    return contract;
  }

  try {
    const data = contract.data;
    if (!data || typeof data !== "object") return contract;

    const rawRecords = Array.isArray(data.records) ? data.records : [];
    const sql = data.sql || "";
    const rowCount = typeof data.rowCount === "number" ? data.rowCount : rawRecords.length;

    // Detect presentation intent from question
    const pIntent = detectPresentationIntent(query);

    // Client hint override handling
    let hintChartType = null;
    let isCsvHint = false;
    if (typeof hint === "string") {
      if (hint.toLowerCase() === "csv") isCsvHint = true;
    } else if (hint && typeof hint === "object") {
      if (hint.kind === "chart" && typeof hint.chartType === "string") {
        hintChartType = hint.chartType.toLowerCase();
      }
    }

    let formatObj = null;

    // 1. CSV hint handling
    if (isCsvHint) {
      if (rawRecords.length > 0) {
        const tableShape = formatFor("table", { records: rawRecords });
        if (tableShape && Array.isArray(tableShape.columns) && Array.isArray(tableShape.rows)) {
          formatObj = formatFor("csv", { columns: tableShape.columns, rows: tableShape.rows });
        }
      }
    }

    // 2. Chart presentation intent or client chart hint
    if (!formatObj && (pIntent.chart || hintChartType)) {
      const targetChartType = hintChartType || pIntent.chartType || "bar";
      const series = seriesFromRecords(rawRecords);

      if (series && series.length > 0) {
        const guardPassed = checkGroupingGuard(sql, rowCount, targetChartType, rawRecords);
        if (guardPassed) {
          formatObj = formatFor("chartSpec", {
            chartType: targetChartType,
            title: query || "Query Visualization",
            series
          });
        } else {
          // GROUPING GUARD FAILED: deliver table + note, NOT a misleading chart
          const tableShape = formatFor("table", { records: rawRecords });
          if (tableShape) {
            formatObj = {
              ...tableShape,
              note: "Chart requested but results are not aggregated; showing table instead."
            };
          }
        }
      }
    }

    // 3. Report presentation intent
    if (!formatObj && pIntent.report) {
      const kpis = [];
      if (typeof data.value === "number" && !Number.isNaN(data.value)) {
        const kpi = formatFor("kpi", { label: data.column || null, value: data.value });
        if (kpi) kpis.push(kpi);
      } else if (rawRecords.length === 1 && typeof rawRecords[0] === "object") {
        const keys = Object.keys(rawRecords[0]);
        const firstVal = rawRecords[0][keys[0]];
        if (keys.length === 1 && typeof firstVal === "number" && !Number.isNaN(firstVal)) {
          const kpi = formatFor("kpi", { label: keys[0], value: firstVal });
          if (kpi) kpis.push(kpi);
        }
      }

      const charts = [];
      const series = seriesFromRecords(rawRecords);
      if (series && checkGroupingGuard(sql, rowCount, "bar", rawRecords)) {
        const chart = formatFor("chartSpec", {
          chartType: "bar",
          title: query || "Report Overview",
          series
        });
        if (chart) charts.push(chart);
      }

      formatObj = formatFor("report", {
        narrative: contract.answer || "",
        kpis,
        charts
      });
    }

    // 4. Default B1 auto-selection if no special presentation matched
    if (!formatObj) {
      if (rawRecords.length > 0) {
        if (rawRecords.length === 1 && typeof data.value === "number" && !Number.isNaN(data.value)) {
          formatObj = formatFor("kpi", { label: data.column || null, value: data.value });
        } else if (rawRecords.length === 1 && typeof rawRecords[0] === "object") {
          const keys = Object.keys(rawRecords[0]);
          const firstVal = rawRecords[0][keys[0]];
          if (keys.length === 1 && typeof firstVal === "number" && !Number.isNaN(firstVal)) {
            formatObj = formatFor("kpi", { label: keys[0], value: firstVal });
          } else {
            formatObj = formatFor("table", { records: rawRecords });
          }
        } else {
          formatObj = formatFor("table", { records: rawRecords });
        }
      } else if (typeof data.value === "number" && !Number.isNaN(data.value)) {
        formatObj = formatFor("kpi", { label: data.column || null, value: data.value });
      } else if (Array.isArray(data.records)) {
        formatObj = formatFor("table", { records: rawRecords });
      }
    }

    if (formatObj && typeof formatObj === "object") {
      return {
        ...contract,
        format: formatObj
      };
    }

    return contract;
  } catch (err) {
    console.warn("⚠️ [Format Registry] Fail-safe format failure:", err.message);
    return contract;
  }
}



