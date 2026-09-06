import { connectDatabase } from "../../config/database.js";

function parseCgpaQuery(query = "") {
  const q = String(query).toLowerCase();

  let operator = null;
  let opLabel = null;
  let threshold = null;

  // 1. Detect number with explicit suffix (e.g., "8.5 or higher", "8.5+", "8.5 and above", "8.5 or more")
  const suffixGreaterMatch = q.match(/(\d+(?:\.\d+)?)\s*(?:\+|or\s*higher|and\s*higher|or\s*above|and\s*above|or\s*more|and\s*more|or\s*greater|and\s*greater)/i);
  if (suffixGreaterMatch) {
    threshold = parseFloat(suffixGreaterMatch[1]);
    operator = ">=";
    opLabel = "greater than or equal to";
  }

  // Detect number with lower suffix (e.g., "6.5 or lower", "6.5 or below", "6.5 and below", "6.5 or less")
  const suffixLowerMatch = q.match(/(\d+(?:\.\d+)?)\s*(?:or\s*lower|and\s*lower|or\s*below|and\s*below|or\s*less|and\s*less)/i);
  if (suffixLowerMatch && !operator) {
    threshold = parseFloat(suffixLowerMatch[1]);
    operator = "<=";
    opLabel = "less than or equal to";
  }

  // 2. Detect "cgpa of 8.5", "cgpa is 8.5", "cgpa = 8.5", "cgpa: 8.5"
  if (threshold === null) {
    const cgpaOfMatch = q.match(/(?:cgpa|grade point|gpa)\s*(?:of|is|equals?|equal to|:)?\s*(\d+(?:\.\d+)?)/i);
    if (cgpaOfMatch) {
      threshold = parseFloat(cgpaOfMatch[1]);
      if (q.includes("of") || q.includes("is") || q.includes("equal") || q.includes("=")) {
        operator = "=";
        opLabel = "equal to";
      }
    }
  }

  // 3. Detect standard comparison prefixes if operator not set yet
  if (!operator) {
    if (q.includes(">=") || q.includes("greater than or equal") || q.includes("at least") || q.includes("minimum") || q.includes("or higher") || q.includes("or above") || q.includes("or more")) {
      operator = ">=";
      opLabel = "greater than or equal to";
    } else if (q.includes("<=") || q.includes("less than or equal") || q.includes("at most") || q.includes("maximum") || q.includes("or lower") || q.includes("or below") || q.includes("or less")) {
      operator = "<=";
      opLabel = "less than or equal to";
    } else if (q.includes("<") || q.includes("below") || q.includes("less than") || q.includes("under") || q.includes("lower than")) {
      operator = "<";
      opLabel = "below";
    } else if (q.includes("equal to") || q.includes("equals") || q.includes("exactly") || q.includes("equal")) {
      operator = "=";
      opLabel = "equal to";
    } else if (q.includes(">") || q.includes("above") || q.includes("greater than") || q.includes("more than") || q.includes("higher than") || q.includes("over") || q.includes("exceeding")) {
      operator = ">";
      opLabel = "above";
    } else {
      operator = ">";
      opLabel = "above";
    }
  }

  // 4. If threshold not found yet, search context after operator keywords
  if (threshold === null) {
    const contextMatch = q.match(/(?:cgpa|grade point|gpa|above|below|over|under|than|least|most|>=|<=|>|<|=|minimum|maximum|exceeding)\s*(?:of|is|to)?\s*(\d+(?:\.\d+)?)/i);
    if (contextMatch && contextMatch[1]) {
      threshold = parseFloat(contextMatch[1]);
    }
  }

  // 5. Fallback: find candidate numbers <= 10, preferring floats or numbers closest to "cgpa"
  if (threshold === null) {
    const numbers = (q.match(/\b\d+(?:\.\d+)?\b/g) || []).map(Number);
    const floatCandidate = numbers.find((n) => n <= 10 && !Number.isInteger(n));
    const candidate = floatCandidate !== undefined ? floatCandidate : numbers.find((n) => n <= 10);
    threshold = candidate !== undefined ? candidate : 8;
  }

  return { operator, opLabel, threshold };
}

export const cgpaTool = {
  name: "CGPA Analytics Tool",

  async execute({ query = "" } = {}) {
    const { operator, opLabel, threshold } = parseCgpaQuery(query);
    const db = await connectDatabase();

    // Validate operator to prevent SQL injection
    const allowedOperators = [">", ">=", "<", "<=", "="];
    const safeOperator = allowedOperators.includes(operator) ? operator : ">";

    try {
      const MAX_RECORDS = 50;
      const result = await db.get(
        `SELECT COUNT(*) AS count FROM students WHERE cgpa ${safeOperator} ?`,
        [threshold]
      );

      const records = await db.all(
        `SELECT * FROM students WHERE cgpa ${safeOperator} ? ORDER BY cgpa DESC LIMIT ?`,
        [threshold, MAX_RECORDS]
      );

      const count = result?.count ?? 0;
      const limitNote = count > MAX_RECORDS ? ` (showing top ${MAX_RECORDS} records)` : "";

      return {
        answer: `${count} student(s) have a CGPA ${opLabel} ${threshold}${limitNote}.`,
        data: {
          metric: `students_with_cgpa_${safeOperator}_${threshold}`,
          operator: safeOperator,
          threshold,
          value: count,
          recordsCapped: count > MAX_RECORDS,
          limit: MAX_RECORDS,
          records
        }
      };
    } catch (err) {
      if (err.message && err.message.includes("no such table: students")) {
        return {
          answer: "The currently active database does not contain a 'students' table. Please upload or select an education database.",
          data: {
            error: "table_not_found",
            table: "students"
          }
        };
      }
      throw err;
    }
  }
};