
function parseForeignStudentQuery(query = "", defaultHomeCountry = process.env.DEFAULT_HOME_COUNTRY || "India") {
  const q = String(query).toLowerCase();

  // Extract 4-digit year (e.g. 2024, 2025, 2026)
  const yearMatch = q.match(/\b(19\d\d|20\d\d)\b/);
  const year = yearMatch ? parseInt(yearMatch[1], 10) : null;

  // Check if query specifies a custom domestic/home country
  let homeCountry = defaultHomeCountry;
  const homeMatch = q.match(
    /(?:home\s*country|domestic\s*country|local\s*to|outside\s*(?:of)?)\s*(?:is\s+|as\s+)?([a-zA-Z\s]+?)(?=\s*(?:\b(?:students?|enrolled|enrollment|admissions?|who|with|in|during|for|having|count|total|records?|list)\b|[?,.;!]|$))/i
  );
  if (homeMatch && homeMatch[1] && homeMatch[1].trim()) {
    homeCountry = homeMatch[1].trim();
  }

  return { year, homeCountry };
}

export const foreignStudentTool = {
  name: "Foreign Student Analytics Tool",

  async execute({ query = "", capabilities } = {}) {
    const { db } = capabilities;
    const { year, homeCountry } = parseForeignStudentQuery(query);
    const conn = await db.connectDatabase();

    try {
      const MAX_RECORDS = 50;
      let countSql = `SELECT COUNT(*) AS count FROM students WHERE LOWER(country) != LOWER(?)`;
      let recordSql = `SELECT * FROM students WHERE LOWER(country) != LOWER(?)`;
      const params = [homeCountry];

      if (year !== null) {
        countSql += ` AND enrollment_year = ?`;
        recordSql += ` AND enrollment_year = ?`;
        params.push(year);
      }

      recordSql += ` ORDER BY name ASC LIMIT ?`;
      const recordParams = [...params, MAX_RECORDS];

      const result = await conn.get(countSql, params);
      const records = await conn.all(recordSql, recordParams);
      const count = result?.count ?? 0;

      const yearLabel = year !== null ? ` enrolled in ${year}` : " enrolled";
      const limitNote = count > MAX_RECORDS ? ` (showing first ${MAX_RECORDS} records)` : "";
      const answer = `${count} foreign student(s) (outside ${homeCountry})${yearLabel}${limitNote}.`;

      return {
        answer,
        data: {
          metric: `foreign_students${year ? `_${year}` : ""}`,
          homeCountry,
          year,
          value: count,
          recordsCapped: count > MAX_RECORDS,
          limit: MAX_RECORDS,
          records
        }
      };
    } catch (err) {
      const isMissingTable = typeof err?.message === "string" && /no such table/i.test(err.message);
      const isMissingColumn = typeof err?.message === "string" && /no such column/i.test(err.message);

      if (isMissingTable || isMissingColumn) {
        return {
          answer: "The currently active database does not contain a compatible 'students' schema for this fixed tool.",
          data: {
            error: "table_not_found",
            table: "students",
            detail: err.message
          }
        };
      }
      throw err;
    }
  }
};