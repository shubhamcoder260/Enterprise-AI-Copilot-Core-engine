// ==========================================
// GUARD MARKERS — Canonical Structural Token Matching
// Shared between fastIntent.js and sql.builder.js to guarantee
// identical rejection of GROUP BY / count-by / grouping queries.
// ==========================================

/**
 * Detects if a query contains a count-by ranking marker like:
 * "top 5 suppliers by number of products supplied" (S2)
 * "top 10 customers by total spend"
 * "highest 3 doctors by count of visits"
 *
 * Notice the noun between digit and "by" (e.g. "5 suppliers by"):
 * \d+(?:\s+[a-z0-9_]+)?\s+by\s+(?:number|count|amount|total|sum|avg|average)\s+of
 */
export const COUNT_BY_MARKER_REGEX =
  /\b(?:top|bottom|highest|lowest)\s+\d+(?:\s+[a-z0-9_]+)?\s+by\s+(?:number|count|amount|total|sum|avg|average)\s+of\b/i;

/**
 * Detects generic aggregate verbs paired with grouping prepositions:
 * "average salary per department"
 * "total fees for each doctor"
 * "count of students every year"
 * "sum of sales by category"
 */
export const AGGREGATE_GROUPING_REGEX =
  /\b(?:average|mean|sum|total|count)\b[\s\S]*?\b(?:per|each|every|group\s+by)\s+[a-z0-9_]+\b/i;

/**
 * Checks if a query requires GROUP BY aggregation that single-table scalar builders cannot fulfill.
 *
 * @param {string} query
 * @param {object} [table] - Schema table object (if known)
 * @returns {{ requiresGroupBy: boolean, reason?: string }}
 */
export function checkGroupByRequired(query, table) {
  const q = String(query || "").trim();

  // 1. S2-style count-by ranking markers
  if (COUNT_BY_MARKER_REGEX.test(q)) {
    return {
      requiresGroupBy: true,
      reason: "count_by_marker_requires_group_by"
    };
  }

  // 2. Aggregate verb + per / each / every / group by
  if (AGGREGATE_GROUPING_REGEX.test(q)) {
    return {
      requiresGroupBy: true,
      reason: "aggregate_preposition_requires_group_by"
    };
  }

  // 3. "by <noun>" grouping marker (e.g. "average score by department")
  // Guarded: if the "by X" target is an existing scalar column on the candidate table
  // and the query is an ORDER BY (like College Q5 "lowest attendance top 5 by student id"),
  // it is NOT a GROUP BY.
  const byMatch = q.match(/\bby\s+([a-z0-9_]+(?:\s+id)?)\b/i);
  if (byMatch) {
    const targetWord = byMatch[1].toLowerCase().replace(/\s+/g, "_");
    const isScalarIdOrder = /^(?:id|student_id|emp_id|patient_id|user_id)$/i.test(targetWord);
    const hasOrderingPrefix = /\b(?:top|bottom|highest|lowest|order|sorted)\b/i.test(q);

    // If it's pure scalar ordering like "top 5 by student_id", allow through
    if (isScalarIdOrder && hasOrderingPrefix) {
      return { requiresGroupBy: false };
    }

    // Otherwise, if aggregate verb is present ("average ... by department"), it requires GROUP BY
    const hasAggVerb = /\b(?:average|mean|sum|total|count)\b/i.test(q);
    if (hasAggVerb) {
      return {
        requiresGroupBy: true,
        reason: "aggregate_by_entity_requires_group_by"
      };
    }
  }

  return { requiresGroupBy: false };
}
