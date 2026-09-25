// ============================================================
// DIALECTS — The Single Knob for Database SQL Rules
// Defines quoting, parser grammar, date functions, and query syntax.
// ============================================================

export function deepFreeze(obj) {
  if (obj === null || typeof obj !== "object") {
    return obj;
  }
  Object.freeze(obj);
  for (const key of Object.getOwnPropertyNames(obj)) {
    const prop = obj[key];
    if (prop !== null && typeof prop === "object" && !Object.isFrozen(prop)) {
      deepFreeze(prop);
    }
  }
  return obj;
}

export const DIALECTS = deepFreeze({
  sqlite: {
    dialect: "sqlite",
    parser: "sqlite",
    quote: (d) => `"${d}"`,
    dateFn: "strftime",
    limitStyle: "LIMIT n",
    concat: "||",
    dateMath: "julianday",
    collateNOCASE: true,
    docs: "SQLite standard quoting with double-quotes, strftime date functions, and COLLATE NOCASE string comparison."
  },
  mariadb: {
    dialect: "mariadb",
    parser: "MariaDB",
    quote: (d) => `\`${d}\``,
    dateFn: "DATE_FORMAT",
    limitStyle: "LIMIT n",
    concat: "CONCAT()",
    dateMath: "DATEDIFF",
    collateNOCASE: false, // Case-insensitive collation by default; line-211 recovery bypassed
    docs: "MariaDB standard quoting with backticks; docstatus=1 for submitted documents; tab* prefix backtick-quoted verbatim; prefer range predicates on date columns (e.g. col >= 'YYYY-01-01' AND col < 'YYYY+1-01-01') over YEAR() for index eligibility; DATE_FORMAT for date extraction."
  },
  postgres: {
    dialect: "postgres",
    parser: "postgresql",
    quote: (d) => `"${d}"`,
    dateFn: "to_char",
    limitStyle: "LIMIT n",
    concat: "||",
    dateMath: "AGE",
    collateNOCASE: false,
    docs: "PostgreSQL standard quoting with double quotes, to_char for formatting, ILIKE for case-insensitive matching."
  }
});

export const getDialect = (key) => {
  if (!key || typeof key !== "string") return null;
  return DIALECTS[key.toLowerCase()] || null;
};
