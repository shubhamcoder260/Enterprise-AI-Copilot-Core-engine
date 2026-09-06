import { connectDatabase } from "../../config/database.js";

export const foreignStudentTool = {
  name: "Foreign Student Analytics Tool",

  async execute() {
    const db = await connectDatabase();

    const records = await db.all(`
      SELECT *
      FROM students
      WHERE country != 'India'
      AND enrollment_year = 2026
    `);

    return {
      answer: `${records.length} foreign students enrolled in 2026.`,
      data: {
        metric: "foreign_students_enrolled_2026",
        value: records.length,
        records
      }
    };
  }
};