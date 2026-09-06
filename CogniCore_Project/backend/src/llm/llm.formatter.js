// ==========================================
// LLM RESPONSE FORMATTER
// Formats arbitrary row shapes returned by LLM-generated SQL
// ==========================================

/**
 * Formats raw SQL execution rows into the standard CogniCore response contract.
 *
 * @param {object} params
 * @param {string} params.sql - Final executed SQL statement
 * @param {Array<object>} params.rows - Raw result rows from SQLite
 * @param {string} params.model - Model name actually used
 * @param {number} params.llmDurationMs - Inference duration in ms
 * @param {object} [params.extraMeta] - Additional metadata (sessionId, organization, role, processingMs)
 * @returns {object} Standard envelope { answer, source, data, meta }
 */
export function formatLlmResponse({
  sql,
  rows,
  model,
  llmDurationMs,
  extraMeta = {}
}) {
  const records = Array.isArray(rows) ? rows : [];
  const rowCount = records.length;
  let answer = "";

  if (rowCount === 0) {
    // Rule 1: Empty result set
    answer = "No records matched your question.";
  } else if (rowCount === 1) {
    const keys = Object.keys(records[0]);
    if (keys.length === 1) {
      const key = keys[0];
      const val = records[0][key];
      const isNumeric =
        typeof val === "number" ||
        (typeof val === "string" && val.trim() !== "" && !isNaN(Number(val)));

      if (isNumeric && val !== null) {
        // Rule 2: Single row, single numeric column
        if (/count|total|number/i.test(key)) {
          answer = `There are ${val} record(s) matching your request.`;
        } else {
          answer = `The result is ${val}.`;
        }
      } else {
        // Single row, single non-numeric column
        answer = `Found ${rowCount} record(s) matching your request.`;
      }
    } else {
      // Single row, multiple columns
      answer = `Found ${rowCount} record(s) matching your request.`;
    }
  } else {
    // Rule 3: Multiple rows
    answer = `Found ${rowCount} record(s) matching your request.`;
  }

  return {
    answer,
    source: "llm",
    data: {
      type: "llm_query",
      sql: String(sql || ""),
      records,
      rowCount
    },
    meta: {
      engineMode: "local_llm",
      model: model || "unknown",
      llmDurationMs: Number(llmDurationMs) || 0,
      ...extraMeta
    }
  };
}
