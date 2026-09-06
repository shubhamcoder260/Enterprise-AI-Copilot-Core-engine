import { connectDatabase } from "../../config/database.js";

export const cardiologyTool = {
  name: "Hospital Patient Analytics Tool",

  async execute() {
    const db = await connectDatabase();

    const records = await db.all(`
      SELECT *
      FROM hospital_visits
      WHERE department = 'Cardiology'
      AND visit_date LIKE '2026-09%'
    `);

    return {
      answer: `${records.length} patients visited Cardiology in September 2026.`,
      data: {
        metric: "cardiology_visits_2026_09",
        value: records.length,
        records
      }
    };
  }
};