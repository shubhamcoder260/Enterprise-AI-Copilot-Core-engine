// ==========================================
// LIMIT & OFFSET CLAMPER (SHARED HELPER)
// Pure function, zero dependencies.
// Clamps LIMIT (max 100, default 50) and OFFSET (max 10000).
// Sibling validator security hardening (V12).
// ==========================================

const LIMIT_REGEX = /\bLIMIT\s+([-\d]+)(?:\s+OFFSET\s+(\d+)|,\s*([-\d]+))?\s*$/i;

/**
 * Clamps or appends LIMIT and clamps OFFSET on a single SELECT statement.
 *
 * Supported forms:
 *   - No LIMIT clause               -> Appends " LIMIT 50"
 *   - LIMIT <count>                 -> Clamps count between 1 and maxLimit (default 100)
 *   - LIMIT <count> OFFSET <offset> -> Clamps count and offset (offset max 10000)
 *   - LIMIT <offset>, <count>       -> Clamps offset and count (MariaDB/MySQL comma form)
 *
 * @param {string} sql - SQL query string
 * @param {object} [options]
 * @param {number} [options.defaultLimit=50]
 * @param {number} [options.maxLimit=100]
 * @param {number} [options.maxOffset=10000]
 * @returns {string} Sanitized SQL with clamped LIMIT/OFFSET
 */
export function clampLimitOffset(sql, options = {}) {
  if (!sql || typeof sql !== "string") {
    return sql;
  }

  const defaultLimit = options.defaultLimit ?? 50;
  const maxLimit = options.maxLimit ?? 100;
  const maxOffset = options.maxOffset ?? 10000;

  let text = sql.trim();

  // Strip trailing semicolons if present
  if (text.endsWith(";")) {
    text = text.replace(/;+$/, "").trim();
  }

  const limitMatch = text.match(LIMIT_REGEX);

  if (!limitMatch) {
    // No LIMIT present -> append default LIMIT
    text = `${text} LIMIT ${defaultLimit}`;
  } else {
    const isCommaForm = limitMatch[3] !== undefined;

    if (isCommaForm) {
      // Form: LIMIT <offset>, <count>
      const rawOffset = parseInt(limitMatch[1], 10);
      const offset = Math.min(Math.max(isNaN(rawOffset) ? 0 : rawOffset, 0), maxOffset);
      const count = parseInt(limitMatch[3], 10);

      const safeCount = (isNaN(count) || count <= 0 || count > maxLimit) ? defaultLimit : count;
      text = text.replace(LIMIT_REGEX, `LIMIT ${offset}, ${safeCount}`);
    } else {
      // Form: LIMIT <count> [OFFSET <offset>]
      const count = parseInt(limitMatch[1], 10);
      const rawOffset = limitMatch[2] !== undefined ? parseInt(limitMatch[2], 10) : undefined;
      const safeCount = (isNaN(count) || count <= 0 || count > maxLimit) ? defaultLimit : count;

      if (rawOffset !== undefined) {
        const offset = Math.min(Math.max(isNaN(rawOffset) ? 0 : rawOffset, 0), maxOffset);
        text = text.replace(LIMIT_REGEX, `LIMIT ${safeCount} OFFSET ${offset}`);
      } else if (safeCount !== count) {
        text = text.replace(LIMIT_REGEX, `LIMIT ${safeCount}`);
      }
    }
  }

  return text;
}
