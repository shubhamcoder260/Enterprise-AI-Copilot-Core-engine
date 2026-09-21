// ==========================================
// PRESENTATION INTENT DETECTOR
// Pure, deterministic detection of visualization and report presentation intents.
//
// INVARIANT 1: PURE FUNCTION. Accepts question string, returns closed-shape object.
// INVARIANT 2: EXACT TOKEN MATCHING. Exact matching against normalized tokens
//              prevents substring traps (e.g. "percentage" ≠ "chart").
// INVARIANT 3: DEFAULT QUIET. Plain questions return all false (leaves 99% path untouched).
// ==========================================

import { normalizeWord, getWords } from "./schema.resolver.js";

const CHART_TRIGGERS = new Set(["chart", "graph", "visualize", "visualise", "plot"]);
const REPORT_TRIGGERS = new Set(["report", "dashboard"]);

/**
 * Detects whether the natural language question requests chart or report presentation.
 *
 * @param {string} question - Natural language user query
 * @returns {{ chart: boolean, chartType: "bar"|"line"|"pie"|null, report: boolean }}
 */
export function detectPresentationIntent(question = "") {
  const words = getWords(question).map(normalizeWord);
  const wordSet = new Set(words);

  let chart = false;
  let chartType = null;
  let report = false;

  // Check chart triggers
  for (const trigger of CHART_TRIGGERS) {
    if (wordSet.has(trigger)) {
      chart = true;
      break;
    }
  }

  if (chart) {
    if (wordSet.has("pie")) {
      chartType = "pie";
    } else if (wordSet.has("line")) {
      chartType = "line";
    } else if (wordSet.has("bar")) {
      chartType = "bar";
    } else {
      // Default chart type for bare "chart", "graph", "plot", "visualize"
      chartType = "bar";
    }
  }

  // Check report triggers ("report", "dashboard", or "summary report")
  for (const trigger of REPORT_TRIGGERS) {
    if (wordSet.has(trigger)) {
      report = true;
      break;
    }
  }

  return {
    chart,
    chartType,
    report
  };
}
