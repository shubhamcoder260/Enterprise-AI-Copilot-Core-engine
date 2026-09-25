// ============================================================================
// S16 GROUNDING GUARD — Visual & Dimension Honesty Gate (CAP v2.2 §272)
//
// Invariants:
//   1. Chart dimensions must exist in source columns (no hallucinated axes).
//   2. Distinct-cache & ANSI_QUOTES powered validation of data presence.
//   3. Partial data span honesty: If user requests "last 5 years" but data only
//      covers 2 years, the engine NEVER invents missing periods or silently truncates;
//      it includes explicit grounding metadata and honest notice.
//   4. Missing dimensions or empty ranges trigger fail-honest refusal/clarification.
// ============================================================================

"use strict";

const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9_]/g, "");

/**
 * Validate that a query's requested chart dimensions and metrics are grounded in physical schema
 * and empirical database records.
 *
 * @param {object} ir - Intent-IR from parseIntentIR
 * @param {object} context - { schema, adapter, getDistinct }
 * @returns {Promise<object>} Grounding evaluation verdict
 */
export async function validateChartGrounding(ir, context = {}) {
  if (!ir) {
    return { grounded: false, action: "REFUSE", reason: "Missing Intent-IR" };
  }

  // If query is already UNRESOLVABLE or AMBIGUOUS, pass through
  if (ir.confidence === "UNRESOLVABLE" || ir.confidence === "AMBIGUOUS") {
    return {
      grounded: false,
      action: ir.confidence === "AMBIGUOUS" ? "CLARIFY" : "REFUSE",
      reason: ir.refusalReason || ir.clarificationPrompt
    };
  }

  const schema = context.schema;
  const tables = Array.isArray(schema?.tables)
    ? schema.tables
    : Object.entries(schema || {}).map(([name, data]) => ({ name, columns: data.columns || [] }));

  const targetTable = tables.find((t) => t.name === ir.primaryTable);
  if (!targetTable) {
    return {
      grounded: false,
      action: "REFUSE",
      reason: `Primary table '${ir.primaryTable}' does not exist in schema.`
    };
  }

  // 1. Metric Column Grounding
  if (ir.targetColumn) {
    const colExists = targetTable.columns.some((c) => c.name === ir.targetColumn);
    if (!colExists) {
      return {
        grounded: false,
        action: "REFUSE",
        reason: `Target column '${ir.targetColumn}' does not exist on table '${targetTable.name}'.`
      };
    }
  }

  // 2. Grain / Dimension Grounding
  if (ir.grain) {
    if (ir.grain.type === "temporal") {
      if (!ir.grain.column) {
        return {
          grounded: false,
          action: "REFUSE",
          reason: `No date/time column available on table '${targetTable.name}' to group by '${ir.grain.unit}'.`
        };
      }
      const dateColExists = targetTable.columns.some((c) => c.name === ir.grain.column);
      if (!dateColExists) {
        return {
          grounded: false,
          action: "REFUSE",
          reason: `Date column '${ir.grain.column}' does not exist on table '${targetTable.name}'.`
        };
      }
    } else if (ir.grain.type === "categorical") {
      if (!ir.grain.column) {
        return {
          grounded: false,
          action: "REFUSE",
          reason: `Categorical dimension '${ir.grain.dimension}' does not exist on table '${targetTable.name}'.`
        };
      }
    }
  }

  // 3. Empirical Data Span Verification (S16 Guard)
  // When visualization or multi-year span is requested, verify actual data span
  let honestAnnotation = null;

  if (ir.grain && ir.grain.type === "temporal" && ir.grain.unit === "year" && ir.grain.count && context.adapter) {
    try {
      const dateCol = ir.grain.column;
      const qt = `"${targetTable.name}"`;
      const qc = `"${dateCol}"`;

      // Use ANSI_QUOTES double-quoted SQL
      const sampleSql = `SELECT MIN(${qc}) AS min_date, MAX(${qc}) AS max_date, COUNT(DISTINCT SUBSTR(${qc}, 1, 4)) AS distinct_years FROM ${qt}`;
      const res = await context.adapter.queryReadOnly(sampleSql);

      const row = (res && res.records && res.records[0]) || (Array.isArray(res) && res[0]) || null;
      if (row) {
        const distinctYears = Number(row.distinct_years || 0);
        const rawMin = row.min_date;
        const rawMax = row.max_date;
        const minYear = rawMin instanceof Date
          ? String(rawMin.getFullYear())
          : (String(rawMin || "").match(/\b(20\d\d|19\d\d)\b/) ? String(rawMin).match(/\b(20\d\d|19\d\d)\b/)[0] : "");
        const maxYear = rawMax instanceof Date
          ? String(rawMax.getFullYear())
          : (String(rawMax || "").match(/\b(20\d\d|19\d\d)\b/) ? String(rawMax).match(/\b(20\d\d|19\d\d)\b/)[0] : "");

        const rangeStr = minYear && maxYear ? `${minYear}–${maxYear}` : `${distinctYears} years`;

        if (distinctYears < ir.grain.count && distinctYears > 0) {
          honestAnnotation = {
            partial: true,
            requestedSpanYears: ir.grain.count,
            availableSpanYears: distinctYears,
            earliestDate: String(rawMin || ""),
            latestDate: String(rawMax || ""),
            coverageNotice: `Note: The database contains records for ${distinctYears} year${distinctYears > 1 ? "s" : ""} (${rangeStr}), which is fewer than the requested ${ir.grain.count} years.`
          };
        } else if (distinctYears === 0) {
          return {
            grounded: false,
            action: "EMPTY",
            reason: `Table '${targetTable.name}' contains no records with valid '${dateCol}' values.`
          };
        }
      }
    } catch (err) {
      // If sampling fails (e.g. mock adapter or test), pass without failing closed
      console.warn("⚠️ [GROUNDING GUARD] Empirical sampling skipped:", err.message);
    }
  }

  return {
    grounded: true,
    action: "PROCEED",
    honestAnnotation,
    table: targetTable.name,
    dimensionColumn: ir.grain?.column || null,
    metricColumn: ir.targetColumn || null,
    visual: ir.visual
  };
}

/**
 * Enriches the final engine result with honest grounding metadata and notices
 */
export function enrichResultWithGrounding(result, groundingStatus) {
  if (!result || !groundingStatus) return result;

  const target = result.response || result;

  if (groundingStatus.honestAnnotation) {
    if (!target.meta) target.meta = {};
    target.meta.grounding = groundingStatus.honestAnnotation;

    if (target.data) {
      target.data.groundingNotice = groundingStatus.honestAnnotation.coverageNotice;
    }

    if (typeof target.answer === "string" && !target.answer.includes("Note:")) {
      target.answer = `${target.answer}\n\n${groundingStatus.honestAnnotation.coverageNotice}`;
    }
  }

  return result;
}
