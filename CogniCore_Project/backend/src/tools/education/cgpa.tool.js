import { connectDatabase } from "../../config/database.js";

export const cgpaTool = {
  name: "CGPA Analytics Tool",

  async execute() {
    const db = await connectDatabase();

    const result = await db.get(`
      SELECT COUNT(*) AS count
      FROM students
      WHERE cgpa > 8
    `);

    const records = await db.all(`
      SELECT *
      FROM students
      WHERE cgpa > 8
    `);

    return {
      answer: `${result.count} students have a CGPA above 8.`,
      data: {
        metric: "students_with_cgpa_above_8",
        value: result.count,
        records
      }
    };
  }
};