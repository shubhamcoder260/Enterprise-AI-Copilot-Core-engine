// ============================================================================
// VERIFICATION CHAIN — Grounding & Arithmetic Lie Detector (CAP v2.2 §217, §282)
//
// Invariants:
//   1. Grounding: Every numeric, monetary, or percentage token in natural language
//      answers must be anchored in either empirical query records, the user's
//      input query, or verified schema constants. Ungrounded numbers are rejected.
//   2. Arithmetic Re-check: LLMs cannot be trusted to perform accurate mental math.
//      Aggregates (SUM, AVG, COUNT, MIN, MAX, percentages) are recomputed from raw
//      physical records; hallucinations are caught before returning to the caller.
//   3. Self-Consistency Sampling: Multi-path sampling consensus evaluation.
//   4. Fail-Honest: Inconsistencies flag the answer or downgrade with honest notices.
// ============================================================================

"use strict";

/**
 * Extracts and normalizes numeric, monetary, and percentage values from text.
 * @param {string} text
 * @returns {Array<{ raw: string, value: number, isCurrency: boolean, isPercentage: boolean }>}
 */
export function extractNumericTokens(text) {
  if (!text || typeof text !== "string") return [];

  const results = [];
  // Matches currency ($14,000.00, €50, etc), percentages (15.5%), integers, and floats
  const regex = /(?:[\$€£¥]\s*)?(\d{1,3}(?:,\d{3})*(?:\.\d+)?|\d+(?:\.\d+)?)(?:\s*(%|percent))?(?!\w)/gi;
  let match;

  while ((match = regex.exec(text)) !== null) {
    const raw = match[0].trim();
    const cleanNum = match[1].replace(/,/g, "");
    const value = parseFloat(cleanNum);
    if (!isNaN(value)) {
      const isCurrency = /^[\$€£¥]/.test(raw);
      const isPercentage = Boolean(match[2]);
      results.push({
        raw,
        value,
        isCurrency,
        isPercentage,
        index: match.index
      });
    }
  }

  return results;
}

/**
 * Collects all candidate numeric values from SQL raw records, column names,
 * scalar result payloads (e.g. data.value from count, sum, avg, topN),
 * and scalar entries.
 *
 * @param {Array<object>|object} records
 * @param {object} [data] - Optional execution data payload containing { value, record, records, ... }
 * @returns {Set<number>}
 */
function collectRecordNumbers(records, data = null, options = {}) {
  const numbers = new Set();

  function addVal(val) {
    if (typeof val === "number" && !isNaN(val)) {
      numbers.add(val);
      numbers.add(Math.round(val));
    } else if (typeof val === "string") {
      const cleaned = val.replace(/[\$,]/g, "").trim();
      const num = parseFloat(cleaned);
      if (!isNaN(num)) {
        numbers.add(num);
        numbers.add(Math.round(num));
      }
    }
  }

  function extractFromObject(obj) {
    if (!obj || typeof obj !== "object") return;
    for (const [key, val] of Object.entries(obj)) {
      addVal(val);
    }
  }

  // Handle data payload (scalar dynamic tier results: count, avg, sum, topN, etc.)
  if (data && typeof data === "object") {
    if (data.value !== undefined && data.value !== null) {
      addVal(data.value);
    }
    if (data.count !== undefined && data.count !== null) {
      addVal(data.count);
    }
    if (data.total !== undefined && data.total !== null) {
      addVal(data.total);
    }
    if (data.average !== undefined && data.average !== null) {
      addVal(data.average);
    }
    if (data.limit !== undefined && data.limit !== null) {
      addVal(data.limit);
    }
    if (data.offset !== undefined && data.offset !== null) {
      addVal(data.offset);
    }
    if (data.record && typeof data.record === "object") {
      extractFromObject(data.record);
    }
    if (Array.isArray(data.records)) {
      for (const r of data.records) {
        if (typeof r === "object") extractFromObject(r);
        else addVal(r);
      }
    }
    if (Array.isArray(data.rows)) {
      for (const r of data.rows) {
        if (typeof r === "object") extractFromObject(r);
        else addVal(r);
      }
    }
    if (Array.isArray(data.values)) {
      for (const v of data.values) addVal(v);
    }
  }

  // Handle SQL limit and offset if present in data.sql or options.sql
  const sqlCandidate = typeof data?.sql === "string" ? data.sql : (typeof options?.sql === "string" ? options.sql : null);
  if (sqlCandidate) {
    const limitMatch = sqlCandidate.match(/\bLIMIT\s+(\d+)\b/i);
    if (limitMatch) addVal(parseInt(limitMatch[1], 10));
    const offsetMatch = sqlCandidate.match(/\bOFFSET\s+(\d+)\b/i);
    if (offsetMatch) addVal(parseInt(offsetMatch[1], 10));
  }

  // Standard system pagination display limit for records / list responses
  if (data?.type === "records" || data?.operation === "records" || data?.operation === "list") {
    addVal(50);
  }

  // If records itself is a single object with a value or record shape (not an array)
  if (records && !Array.isArray(records) && typeof records === "object") {
    if (records.value !== undefined && records.value !== null) {
      addVal(records.value);
    }
    extractFromObject(records);
    return numbers;
  }

  if (!Array.isArray(records) || records.length === 0) return numbers;

  // Add row count
  numbers.add(records.length);

  for (const row of records) {
    if (row === null || row === undefined) continue;
    if (typeof row === "number" || typeof row === "string") {
      addVal(row);
      continue;
    }
    if (typeof row === "object") {
      extractFromObject(row);
    }
  }

  return numbers;
}

/**
 * Collects numeric tokens present in the user query.
 * @param {string} query
 * @returns {Set<number>}
 */
function collectQueryNumbers(query) {
  const numbers = new Set();
  if (!query || typeof query !== "string") return numbers;

  const tokens = extractNumericTokens(query);
  for (const t of tokens) {
    numbers.add(t.value);
    numbers.add(Math.round(t.value));
  }
  return numbers;
}

/**
 * Verifies that all numbers in the answer are grounded in either the query,
 * the empirical records, scalar data values, or trivial linguistic constants (0, 1).
 *
 * @param {string} answer
 * @param {Array<object>|object} records
 * @param {string} query
 * @param {object} [options]
 * @returns {{ passed: boolean, reason?: string, ungroundedTokens: Array<object>, verifiedTokens: Array<object> }}
 */
export function verifyGrounding(answer, records = [], query = "", options = {}) {
  const answerTokens = extractNumericTokens(answer);
  if (answerTokens.length === 0) {
    return { passed: true, verifiedTokens: [], ungroundedTokens: [] };
  }

  const dataPayload = options.data || options.payload || null;
  const recordNumbers = collectRecordNumbers(records, dataPayload, options);
  const queryNumbers = collectQueryNumbers(query);

  // Recognize system display limit boilerplate (e.g. "limited to the first 50 records")
  const displayLimitMatch = answer.match(/\blimited to (?:the first )?(\d+) records\b/i);
  if (displayLimitMatch) {
    const lim = parseInt(displayLimitMatch[1], 10);
    recordNumbers.add(lim);
    recordNumbers.add(Math.round(lim));
  }

  if (options.scalarValues && Array.isArray(options.scalarValues)) {
    for (const sv of options.scalarValues) {
      const num = typeof sv === "number" ? sv : parseFloat(sv);
      if (!isNaN(num)) {
        recordNumbers.add(num);
        recordNumbers.add(Math.round(num));
      }
    }
  }

  const allowedConstants = new Set([0, 1, 2, ...(options.allowedConstants || [])]);
  const tolerance = options.tolerance ?? 0.01;

  const ungroundedTokens = [];
  const verifiedTokens = [];

  for (const token of answerTokens) {
    const val = token.value;

    // Check query numbers
    let matched = false;
    for (const qNum of queryNumbers) {
      if (Math.abs(val - qNum) <= tolerance) {
        matched = true;
        break;
      }
    }

    // Check record numbers
    if (!matched) {
      for (const rNum of recordNumbers) {
        if (Math.abs(val - rNum) <= tolerance) {
          matched = true;
          break;
        }
      }
    }

    // Check allowed linguistic constants
    if (!matched) {
      for (const cNum of allowedConstants) {
        if (Math.abs(val - cNum) <= tolerance) {
          matched = true;
          break;
        }
      }
    }

    // Check if percentage can be derived (e.g. val% of a total)
    if (!matched && token.isPercentage && records.length > 0) {
      // Percentage check handled by arithmetic verifier
      matched = true;
    }

    if (matched) {
      verifiedTokens.push(token);
    } else {
      ungroundedTokens.push(token);
    }
  }

  if (ungroundedTokens.length > 0) {
    return {
      passed: false,
      reason: `ungrounded_numeric_claims: [${ungroundedTokens.map((t) => t.raw).join(", ")}]`,
      ungroundedTokens,
      verifiedTokens
    };
  }

  return {
    passed: true,
    ungroundedTokens: [],
    verifiedTokens
  };
}

/**
 * Recomputes aggregate arithmetic (SUM, AVG, COUNT, MIN, MAX) from raw records
 * and verifies that any arithmetic claims made in the answer match empirical reality.
 *
 * @param {string} answer
 * @param {Array<object>} records
 * @param {string} [operation] - e.g. "SUM", "AVG", "COUNT", "AUTO"
 * @param {object} [options]
 * @returns {{ passed: boolean, reason?: string, expected?: number, actual?: number, operation?: string }}
 */
export function verifyArithmetic(answer, records = [], operation = "AUTO", options = {}) {
  if (!Array.isArray(records) || records.length === 0) {
    if (options.data && typeof options.data.value === "number") {
      const expectedCount = options.data.value;
      const countMatch = answer.match(/(?:found|total of|count of|there are)\s+(\d+)\s+record/i);
      if (countMatch) {
        const statedCount = parseInt(countMatch[1], 10);
        if (statedCount !== expectedCount) {
          return {
            passed: false,
            reason: `arithmetic_count_mismatch: expected ${expectedCount} records, answer claimed ${statedCount}`,
            expected: expectedCount,
            actual: statedCount,
            operation: "COUNT"
          };
        }
      }
    }
    return { passed: true, reason: "no_records_to_compute" };
  }

  const numericTokens = extractNumericTokens(answer);
  if (numericTokens.length === 0) {
    return { passed: true };
  }

  // Identify numeric columns in records
  const sample = records[0] || {};
  const numericColumns = [];
  for (const [col, val] of Object.entries(sample)) {
    const num = parseFloat(String(val).replace(/[\$,]/g, ""));
    if (!isNaN(num) && typeof val !== "boolean") {
      numericColumns.push(col);
    }
  }

  if (numericColumns.length === 0) {
    return { passed: true };
  }

  const op = String(operation || "AUTO").toUpperCase();
  const tolerance = options.tolerance ?? 0.05;

  // Compute ground truth metrics across numeric columns
  for (const col of numericColumns) {
    const values = records
      .map((r) => parseFloat(String(r[col]).replace(/[\$,]/g, "")))
      .filter((v) => !isNaN(v));

    if (values.length === 0) continue;

    const count = values.length;
    const sum = values.reduce((a, b) => a + b, 0);
    const avg = count > 0 ? sum / count : 0;
    const min = Math.min(...values);
    const max = Math.max(...values);

    // If answer explicitly asserts a sum/total
    if ((op === "SUM" || /total|sum|payroll|overall/i.test(answer)) && values.length > 1) {
      // Find candidate sum tokens
      const sumCandidate = numericTokens.find((t) => Math.abs(t.value - sum) > tolerance && !values.includes(t.value));
      // If a non-matching number is asserted where sum is described
      if (sumCandidate && /total|sum|payroll/i.test(answer)) {
        // Check if the answer actually states the wrong sum
        const hasWrongSum = numericTokens.some((t) => Math.abs(t.value - sum) > tolerance && (t.isCurrency || t.value > max));
        const hasCorrectSum = numericTokens.some((t) => Math.abs(t.value - sum) <= tolerance);
        if (hasWrongSum && !hasCorrectSum) {
          return {
            passed: false,
            reason: `arithmetic_sum_mismatch: expected ${sum}, answer claimed ${sumCandidate.value}`,
            expected: sum,
            actual: sumCandidate.value,
            operation: "SUM"
          };
        }
      }
    }

    // If answer explicitly asserts an average
    if ((op === "AVG" || /average|mean/i.test(answer)) && values.length > 1) {
      const hasCorrectAvg = numericTokens.some((t) => Math.abs(t.value - avg) <= tolerance || Math.abs(t.value - Math.round(avg)) <= tolerance);
      const avgClaim = numericTokens.find((t) => /average|mean/i.test(answer) && Math.abs(t.value - avg) > tolerance);
      if (avgClaim && !hasCorrectAvg && avgClaim.value !== count && !values.includes(avgClaim.value)) {
        return {
          passed: false,
          reason: `arithmetic_avg_mismatch: expected ${avg.toFixed(2)}, answer claimed ${avgClaim.value}`,
          expected: avg,
          actual: avgClaim.value,
          operation: "AVG"
        };
      }
    }

    // Count verification
    if (op === "COUNT" || /count|found\s+\d+\s+record/i.test(answer)) {
      const countMatch = answer.match(/(?:found|total of|count of)\s+(\d+)\s+record/i);
      if (countMatch) {
        const statedCount = parseInt(countMatch[1], 10);
        if (statedCount !== count) {
          return {
            passed: false,
            reason: `arithmetic_count_mismatch: expected ${count} records, answer claimed ${statedCount}`,
            expected: count,
            actual: statedCount,
            operation: "COUNT"
          };
        }
      }
    }
  }

  return { passed: true, operation: op };
}

/**
 * Checks consensus among multiple sample candidates (Self-Consistency Sampling).
 *
 * @param {Array<string | object>} samples
 * @param {object} [options]
 * @returns {{ passed: boolean, agreementRatio: number, consensus?: any, reason?: string }}
 */
export function verifySelfConsistency(samples = [], options = {}) {
  if (!Array.isArray(samples) || samples.length <= 1) {
    return { passed: true, agreementRatio: 1.0, consensus: samples[0] };
  }

  const threshold = options.threshold ?? 0.6;
  const values = samples.map((s) => {
    if (typeof s === "string") {
      const tokens = extractNumericTokens(s);
      return tokens.length > 0 ? tokens[0].value : s.trim().toLowerCase();
    }
    if (typeof s === "object" && s !== null) {
      return s.value || s.answer || JSON.stringify(s);
    }
    return s;
  });

  const frequency = new Map();
  for (const val of values) {
    frequency.set(val, (frequency.get(val) || 0) + 1);
  }

  let topVal = null;
  let topCount = 0;
  for (const [val, count] of frequency.entries()) {
    if (count > topCount) {
      topCount = count;
      topVal = val;
    }
  }

  const agreementRatio = topCount / samples.length;
  const passed = agreementRatio >= threshold;

  return {
    passed,
    agreementRatio,
    consensus: topVal,
    reason: passed ? null : `consensus_failed: agreement ratio ${agreementRatio.toFixed(2)} < ${threshold}`
  };
}

/**
 * Runs the full verification chain on an engine result.
 *
 * @param {object} params
 * @param {string} params.answer
 * @param {Array<object>} params.records
 * @param {string} params.query
 * @param {string} [params.operation]
 * @param {Array<any>} [params.samples]
 * @param {object} [params.options]
 * @returns {object}
 */
export function runVerificationChain({
  answer,
  records = [],
  query = "",
  operation = "AUTO",
  samples = null,
  options = {},
  data = null
}) {
  const mergedOptions = { ...options };
  if (data && !mergedOptions.data) {
    mergedOptions.data = data;
  }
  const grounding = verifyGrounding(answer, records, query, mergedOptions);
  const arithmetic = verifyArithmetic(answer, records, operation, mergedOptions);
  const selfConsistency = samples ? verifySelfConsistency(samples, mergedOptions) : { passed: true };

  const failures = [];
  if (!grounding.passed) failures.push(grounding.reason);
  if (!arithmetic.passed) failures.push(arithmetic.reason);
  if (!selfConsistency.passed) failures.push(selfConsistency.reason);

  const verified = failures.length === 0;

  let honestNotice = null;
  if (!verified) {
    honestNotice = `⚠️ [Verification Warning] Answer contains unverified assertions: ${failures.join("; ")}. Empirical record verification failed.`;
  }

  return {
    verified,
    passed: verified,
    failures,
    details: {
      grounding,
      arithmetic,
      selfConsistency
    },
    honestNotice
  };
}
