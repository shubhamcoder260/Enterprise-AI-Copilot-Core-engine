import { cgpaTool } from "../tools/education/cgpa.tool.js";
import { foreignStudentTool } from "../tools/education/foreign-student.tool.js";
import { cardiologyTool } from "../tools/hospital/cardiology.tool.js";

const tools = {
  education_cgpa_analytics: cgpaTool,
  education_foreign_students: foreignStudentTool,
  hospital_patient_analytics: cardiologyTool
};

export function getTool(intent) {
  return tools[intent];
}
