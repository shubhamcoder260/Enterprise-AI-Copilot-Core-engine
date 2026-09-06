// ==========================================
// SQL PROMPT BUILDER
// Injects cached database schema, schema notes, and conversation memory
// ==========================================

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const NOTES_PATH = path.join(__dirname, "schema.notes.json");

function loadSchemaNotes() {
  try {
    if (fs.existsSync(NOTES_PATH)) {
      const raw = fs.readFileSync(NOTES_PATH, "utf8");
      return JSON.parse(raw);
    }
  } catch {}
  return {};
}

/**
 * Formats in-memory schema into compact line-by-line table definitions.
 * Table: <name> (col1 TYPE [PRIMARY KEY], col2 TYPE, ...)
 * Note: <name> — <description>
 *
 * @param {object} schema - In-memory schema map from schema.reader.js
 * @returns {string}
 */
export function formatSchemaForPrompt(schema = {}) {
  const lines = [];
  const tableNames = Object.keys(schema).sort();
  const notes = loadSchemaNotes();

  for (const tableName of tableNames) {
    const columns = schema[tableName];
    if (!Array.isArray(columns) || columns.length === 0) continue;

    const colDefs = columns.map((col) => {
      const type = col.type && String(col.type).trim() ? String(col.type).trim() : "TEXT";
      const pk = col.primaryKey ? " PRIMARY KEY" : "";
      return `${col.name} ${type}${pk}`.trim();
    });

    lines.push(`Table: ${tableName} (${colDefs.join(", ")})`);
    if (notes[tableName]) {
      lines.push(`Note: ${tableName} — ${notes[tableName]}`);
    }
  }

  return lines.join("\n");
}


/**
 * Detects relationships across tables by finding foreign key columns matching primary keys.
 *
 * @param {object} schema - In-memory schema map from schema.reader.js
 * @returns {string[]} List of relationship descriptions
 */
export function detectRelationships(schema = {}) {
  const relationships = [];
  const pkMap = new Map();

  for (const [tableName, columns] of Object.entries(schema)) {
    if (!Array.isArray(columns)) continue;
    for (const col of columns) {
      if (col.primaryKey) {
        pkMap.set(col.name.toLowerCase(), { tableName, colName: col.name });
      }
    }
  }

  for (const [tableName, columns] of Object.entries(schema)) {
    if (!Array.isArray(columns)) continue;
    for (const col of columns) {
      if (col.primaryKey) continue;
      const lower = col.name.toLowerCase();
      if (pkMap.has(lower)) {
        const target = pkMap.get(lower);
        if (target.tableName.toLowerCase() !== tableName.toLowerCase()) {
          relationships.push(`${tableName}.${col.name} references ${target.tableName}.${target.colName}`);
        }
      }
    }
  }

  return relationships;
}

/**
 * Builds the complete system prompt for SQLite generation.
 *
 * @param {object} params
 * @param {string} params.query - Natural language user question
 * @param {object} params.schema - Cached database schema
 * @returns {string}
 */
export function buildSqlPrompt({ query, schema = {}, history = [] }) {
  const schemaText = formatSchemaForPrompt(schema);
  const relationships = detectRelationships(schema);
  const relText =
    relationships.length > 0
      ? `\n### Key Relationships (Foreign Keys):\n${relationships.map((r) => `- ${r}`).join("\n")}\n`
      : "";

  let contextSection = "";
  if (Array.isArray(history) && history.length > 0) {
    const formattedHistory = history
      .map((item) => {
        const q = String(item.question || "").slice(0, 120);
        const s = String(item.sql || "").slice(0, 120);
        return `Q: ${q}\nSQL: ${s}`;
      })
      .join("\n\n");

    contextSection = `\n### Previous Conversation Context:\n${formattedHistory}\n\n### Context Resolution Instruction:
For follow-up questions that refer to the previous exchanges:
1. Identify what the current question adds or changes relative to the most recent prior question (e.g. a different column, table, or filter).
2. Resolve it into one self-contained question, retaining any ranking, ordering, or limits from the prior exchange.
3. Output ONLY the raw SQLite SELECT statement for the resolved query.\n`;
  }

  return `You are a strict SQLite SQL generator.

### Database Schema:
${schemaText || "No tables available in active database."}
${relText}
### Output Rules:
1. Return ONLY one raw SQLite SELECT statement.
2. No markdown, no explanation, no trailing semicolon.
3. If no table in the schema plausibly matches the main noun of the question (e.g. patients, students, employees), respond with a single line starting with -- rather than guessing a mapping.


### Dialect & Schema Rules:
- Case-insensitive text matches: use LIKE '%value%' or LOWER(col) = LOWER('val').
- Identifiers: double-quote identifiers with spaces (e.g. "Column Name").
- Explicit JOINs: in the ON clause, ALWAYS join columns that have the exact same name (e.g. tableA.ColId = tableB.ColId). NEVER equate different column names (e.g. NEVER equate ArtistId = AlbumId).
- Intermediate Tables: if the question asks to count or inspect items from a target table that does not directly link to the entity (e.g. counting tracks for artists), you MUST join through all intermediate linking tables (e.g. FROM artists JOIN albums ON artists.ArtistId = albums.ArtistId JOIN tracks ON albums.AlbumId = tracks.AlbumId) and aggregate the target table's items (e.g. COUNT(tracks.TrackId)).
- Aggregates: when aggregating with COUNT, SUM, or AVG (such as 'most', 'highest', 'top'), you MUST ALWAYS include both the entity identifier/name AND the aggregate metric in the SELECT clause (e.g. SELECT artists.Name, COUNT(tracks.TrackId) AS track_count), never select only the name alone. Include GROUP BY.
- Ordering & Limits: if the question asks for a specific count (e.g. "Which 5", "top 10", "first 3"), use that exact number in LIMIT (e.g. LIMIT 5). Use ORDER BY <metric> DESC for top/most. Only default to LIMIT 50 if no specific count was requested.
- Column safety: use ONLY columns that appear in the schema lines above, and attach each column to the correct table. If a table directly contains the column you need, query that table alone instead of adding joins. Use explicit table names (e.g. tracks.TrackId, artists.Name) rather than ambiguous aliases like T1, T2 to ensure every column belongs to its true table.


### Few-Shot Examples (neutral reference schemas):
Question: Find all active users sorted by registration date
SQL: SELECT user_id, email, created_at FROM users WHERE status = 'active' ORDER BY created_at DESC LIMIT 50

Question: Which 5 authors have the most book reviews?
SQL: SELECT authors.name, COUNT(reviews.id) AS review_count FROM authors JOIN books ON authors.id = books.author_id JOIN reviews ON books.id = reviews.book_id GROUP BY authors.id ORDER BY review_count DESC LIMIT 5

Question: What is the average rating for electronics products?
SQL: SELECT AVG(rating) AS avg_rating FROM reviews WHERE category = 'electronics' LIMIT 50
${contextSection}
### Actual Task:
Question: ${query}
SQL:`;
}

