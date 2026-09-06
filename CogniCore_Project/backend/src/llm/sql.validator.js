// ==========================================
// SQL VALIDATOR & SANITIZER (SECURITY GATE)
// Pure function, zero dependencies, hostile by default
// ==========================================

const FORBIDDEN_KEYWORDS = [
  "INSERT",
  "UPDATE",
  "DELETE",
  "DROP",
  "ALTER",
  "CREATE",
  "ATTACH",
  "DETACH",
  "TRUNCATE",
  "PRAGMA",
  "VACUUM",
  "REINDEX",
  "GRANT",
  "REVOKE",
  "LOAD_EXTENSION"
];

const FORBIDDEN_KEYWORDS_REGEX = new RegExp(
  `\\b(?:${FORBIDDEN_KEYWORDS.join("|")})\\b`,
  "i"
);

const MUTATION_REPLACE_REGEX = /\bREPLACE\s+INTO\b/i;

const LIMIT_REGEX = /\bLIMIT\s+([-\d]+)(?:\s+OFFSET\s+(\d+)|,\s*([-\d]+))?\s*$/i;

/**
 * Validates and sanitizes raw LLM-generated SQL strings.
 *
 * @param {string} rawString
 * @returns {{ valid: boolean, sql?: string, reason?: string }}
 */
export function validateAndSanitizeSql(rawString) {
  // 1. Preprocess: basic validation, strip <think>...</think>, strip markdown fences, trim
  if (rawString === null || rawString === undefined || typeof rawString !== "string") {
    return { valid: false, reason: "llm_empty_output" };
  }

  let text = rawString.trim();

  // Strip <think>...</think> blocks (dotall, case-insensitive)
  text = text.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();

  // Strip markdown code fences (```sql ... ``` or unclosed ```sql ...)
  if (text.includes("```")) {
    const fenceMatch = text.match(/```(?:sql|sqlite)?\s*([\s\S]*?)(?:```|$)/i);
    if (fenceMatch && fenceMatch[1] !== undefined) {
      text = fenceMatch[1].trim();
    } else {
      text = text.replace(/```[a-zA-Z]*/g, "").replace(/```/g, "").trim();
    }
  }

  text = text.trim();

  if (!text) {
    return { valid: false, reason: "llm_empty_output" };
  }

  // 2. Statement-type gate: must begin with SELECT or WITH
  if (!/^(?:SELECT|WITH)\b/i.test(text)) {
    return { valid: false, reason: "llm_invalid_sql" };
  }

  // 3. Forbidden keyword scan (whole-word bounded)
  if (FORBIDDEN_KEYWORDS_REGEX.test(text)) {
    return { valid: false, reason: "llm_invalid_sql" };
  }

  // Special case: REPLACE INTO (mutation form rejected, REPLACE(...) function allowed)
  if (MUTATION_REPLACE_REGEX.test(text)) {
    return { valid: false, reason: "llm_invalid_sql" };
  }

  // 4. Comment rejection: reject any statement containing -- or /*
  if (text.includes("--") || text.includes("/*")) {
    return { valid: false, reason: "llm_invalid_sql" };
  }

  // 5. Multi-statement rejection: reject any ; not at the very end
  if (text.includes(";")) {
    if (!text.endsWith(";")) {
      return { valid: false, reason: "llm_invalid_sql" };
    }
    const withoutTrailing = text.slice(0, -1);
    if (withoutTrailing.includes(";")) {
      return { valid: false, reason: "llm_invalid_sql" };
    }
    // Strip trailing semicolon before limit clamping
    text = withoutTrailing.trim();
  }

  // 6. LIMIT clamping (applies after semicolon strip)
  const limitMatch = text.match(LIMIT_REGEX);

  if (!limitMatch) {
    // No LIMIT present -> append LIMIT 50
    text = `${text} LIMIT 50`;
  } else {
    const isCommaForm = limitMatch[3] !== undefined;

    if (isCommaForm) {
      // Form: LIMIT <offset>, <count>
      const offset = limitMatch[1];
      const count = parseInt(limitMatch[3], 10);

      if (isNaN(count) || count <= 0 || count > 100) {
        text = text.replace(LIMIT_REGEX, `LIMIT ${offset}, 50`);
      }
    } else {
      // Form: LIMIT <count> [OFFSET <offset>]
      const count = parseInt(limitMatch[1], 10);
      const offset = limitMatch[2];

      if (isNaN(count) || count <= 0 || count > 100) {
        if (offset !== undefined) {
          text = text.replace(LIMIT_REGEX, `LIMIT 50 OFFSET ${offset}`);
        } else {
          text = text.replace(LIMIT_REGEX, "LIMIT 50");
        }
      }
    }
  }

  return {
    valid: true,
    sql: text
  };
}
