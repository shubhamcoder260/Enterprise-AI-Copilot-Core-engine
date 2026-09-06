import { connectDatabase } from "../../config/database.js";

const MONTH_MAP = {
  january: "01", jan: "01",
  february: "02", feb: "02",
  march: "03", mar: "03",
  april: "04", apr: "04",
  may: "05",
  june: "06", jun: "06",
  july: "07", jul: "07",
  august: "08", aug: "08",
  september: "09", sep: "09", sept: "09",
  october: "10", oct: "10",
  november: "11", nov: "11",
  december: "12", dec: "12"
};

function parseDateFilters(query = "") {
  const q = String(query).toLowerCase();

  // 1. Check for YYYY-MM pattern
  const ymMatch = q.match(/\b(20\d\d|19\d\d)[-/](0[1-9]|1[0-2])\b/);
  if (ymMatch) {
    return {
      datePattern: `${ymMatch[1]}-${ymMatch[2]}%`,
      dateLabel: ` in ${ymMatch[1]}-${ymMatch[2]}`
    };
  }

  // 2. Check for Month + Year (e.g. "September 2026")
  for (const [monthName, mm] of Object.entries(MONTH_MAP)) {
    const regex = new RegExp(`\\b${monthName}\\s*(?:of|,)?\\s*(20\\d\\d|19\\d\\d)\\b`, "i");
    const m = q.match(regex);
    if (m) {
      const year = m[1];
      const monthTitle = monthName.charAt(0).toUpperCase() + monthName.slice(1);
      return {
        datePattern: `${year}-${mm}%`,
        dateLabel: ` in ${monthTitle} ${year}`
      };
    }
  }

  // 3. Check for Year only (e.g. "2026")
  const yearMatch = q.match(/\b(20\d\d|19\d\d)\b/);
  if (yearMatch) {
    return {
      datePattern: `${yearMatch[1]}%`,
      dateLabel: ` in ${yearMatch[1]}`
    };
  }

  // 4. Check for Month only (e.g. "September")
  for (const [monthName, mm] of Object.entries(MONTH_MAP)) {
    const regex = new RegExp(`\\b${monthName}\\b`, "i");
    if (regex.test(q)) {
      const monthTitle = monthName.charAt(0).toUpperCase() + monthName.slice(1);
      return {
        datePattern: `%-${mm}-%`,
        dateLabel: ` in ${monthTitle}`
      };
    }
  }

  return {
    datePattern: null,
    dateLabel: ""
  };
}

async function resolveDepartment(db, query = "") {
  const q = String(query).toLowerCase();

  try {
    const deptRows = await db.all(`SELECT DISTINCT department FROM hospital_visits`);
    for (const row of deptRows) {
      if (row.department && q.includes(row.department.toLowerCase())) {
        return row.department;
      }
    }
  } catch (err) {
    // Handled in caller
  }

  const commonDepts = [
    "Cardiology", "Neurology", "Oncology", "Pediatrics",
    "Orthopedics", "Radiology", "Dermatology", "Emergency", "Pathology"
  ];
  for (const dept of commonDepts) {
    if (q.includes(dept.toLowerCase())) {
      return dept;
    }
  }

  return null;
}

export const cardiologyTool = {
  name: "Hospital Patient Analytics Tool",

  async execute({ query = "" } = {}) {
    const db = await connectDatabase();

    try {
      const department = await resolveDepartment(db, query);
      const { datePattern, dateLabel } = parseDateFilters(query);

      let countSql = `SELECT COUNT(*) AS count FROM hospital_visits WHERE 1=1`;
      let recordSql = `SELECT * FROM hospital_visits WHERE 1=1`;
      const params = [];

      if (department) {
        countSql += ` AND LOWER(department) = LOWER(?)`;
        recordSql += ` AND LOWER(department) = LOWER(?)`;
        params.push(department);
      }

      if (datePattern) {
        countSql += ` AND visit_date LIKE ?`;
        recordSql += ` AND visit_date LIKE ?`;
        params.push(datePattern);
      }

      const MAX_RECORDS = 50;
      recordSql += ` ORDER BY visit_date DESC LIMIT ?`;
      const recordParams = [...params, MAX_RECORDS];

      const result = await db.get(countSql, params);
      const records = await db.all(recordSql, recordParams);
      const count = result?.count ?? 0;

      const deptLabel = department ? `${department} department` : "the hospital";
      const limitNote = count > MAX_RECORDS ? ` (showing most recent ${MAX_RECORDS} records)` : "";
      const answer = `${count} patient(s) visited ${deptLabel}${dateLabel}${limitNote}.`;

      return {
        answer,
        data: {
          metric: `hospital_visits_${department ? department.toLowerCase() : "all"}`,
          department: department || "All",
          dateFilter: datePattern,
          value: count,
          recordsCapped: count > MAX_RECORDS,
          limit: MAX_RECORDS,
          records
        }
      };
    } catch (err) {
      if (err.message && err.message.includes("no such table: hospital_visits")) {
        return {
          answer: "The currently active database does not contain a 'hospital_visits' table. Please upload or select a hospital database.",
          data: {
            error: "table_not_found",
            table: "hospital_visits"
          }
        };
      }
      throw err;
    }
  }
};