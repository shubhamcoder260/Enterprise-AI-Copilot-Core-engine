import { readDatabaseSchema } from "../schema.reader.js"; 
import { ANSWERED } from "../../kernel/handler-result.js";


 export async function executeFallbackLink({ query, organization, role, sessionId, startTime, lastReason }) {
  console.log("🛡️ Falling back to Helpful Fallback handler with schema inspection");

  let tables = [];
  try {
    const schema = await readDatabaseSchema();
    tables = Object.keys(schema);
  } catch (e) {}

  const tablesText =
    tables.length > 0
      ? `Available tables in the active database: ${tables.join(", ")}.`
      : "No readable tables found in the currently active database.";

  const answer = `I could not find an exact answer for: "${query}".\n\n${tablesText}\n\nYou can ask to count records, show records, list columns, or calculate averages/totals for numeric fields.`;

  return ANSWERED({
    answer,
    source: "fallback",
    data: { error: "unresolved_query", query, availableTables: tables },
    meta: {
      sessionId, organization, role,
      engineMode: "fallback",
      processingMs: Date.now() - startTime
    }
  });
}
