// ==========================================
// SQL PROMPT BUILDER
// Injects cached database schema, schema notes, and conversation memory
// ==========================================

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { SEMANTIC_PROFILE } from "../config/semantic.profile.js";
import { pruneSchema } from "../core/schema.pruner.js";
import { detectPresentationIntent } from "../core/presentation.intent.js";




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
function isCategoricalColumn(col) {
  const name = String(col.name || "").toLowerCase();
  // Skip high-cardinality identifiers, timestamps, free-text
  if (/date|time|_at|dob|email|phone|url|desc|message|comment|note|reason|title|code|address/i.test(name)) {
    return false;
  }
  // Include if sample values exist and are reasonably concise
  if (Array.isArray(col.sampleValues) && col.sampleValues.length > 0) {
    return col.sampleValues.every((v) => typeof v === "string" && v.length <= 40);
  }
  return false;
}

export function formatSchemaForPrompt(schema = {}) {
  const lines = [];
  const tableNames = Object.keys(schema).sort();
  const notes = loadSchemaNotes();

  for (const tableName of tableNames) {
    const tableData = schema[tableName];
    const columns = tableData?.columns || [];
    if (columns.length === 0) continue;

    const isLargeTableUnsampled =
      tableData?.isSampled === false ||
      tableData?.samplingSkippedReason === "table_too_large" ||
      (typeof tableData?.rowCount === "number" && tableData.rowCount > 50000);

    const colDefs = columns.map((col) => {
      const type = col.type && String(col.type).trim() ? String(col.type).trim() : "TEXT";
      const pk = (col.primaryKey || col.pk) ? " PRIMARY KEY" : "";
      let colStr = `${col.name} ${type}${pk}`.trim();

      if (isCategoricalColumn(col)) {
        const formatted = col.sampleValues.slice(0, 5).map((v) => `'${v.replace(/'/g, "''")}'`).join(", ");
        colStr += ` [values: ${formatted}]`;
      } else if (
        col.sampleStatus === "not_sampled_large_table" ||
        (isLargeTableUnsampled && (/CHAR|TEXT|CLOB|VARCHAR/i.test(type) || !type))
      ) {
        colStr += ` [values: unknown/not sampled (large table)]`;
      }

      return colStr;
    });

    const rowCountInfo =
      typeof tableData?.rowCount === "number" && tableData.rowCount > 0
        ? ` (${tableData.rowCount.toLocaleString()} rows${isLargeTableUnsampled ? ", un-sampled" : ""})`
        : "";

    lines.push(`Table: ${tableName}${rowCountInfo} (${colDefs.join(", ")})`);
    const alias = SEMANTIC_PROFILE.schemaAliases?.[tableName];
    if (alias) {
      lines.push(`Note: ${tableName} — table represents "${alias}"`);
    } else if (notes[tableName]) {
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
  const seen = new Set();

  // Tier 1: Use explicit foreign keys read directly from SQLite PRAGMA foreign_key_list
  for (const [tableName, tableData] of Object.entries(schema)) {
    const fks = tableData?.foreignKeys || [];
    for (const fk of fks) {
      if (!fk.from || !fk.toTable || !fk.toColumn) continue;
      const desc = `${tableName}.${fk.from} references ${fk.toTable}.${fk.toColumn}`;
      if (!seen.has(desc)) {
        seen.add(desc);
        relationships.push(desc);
      }
    }
  }

  // If explicit foreign keys exist in the database, return them
  if (relationships.length > 0) {
    return relationships;
  }

  // Tier 2: Heuristic fallback when SQLite schema lacks explicit foreign key constraints
  const pkMap = new Map();
  for (const [tableName, tableData] of Object.entries(schema)) {
    const columns = tableData?.columns || [];
    for (const col of columns) {
      if (col.primaryKey || col.pk) {
        const lower = col.name.toLowerCase();
        // Ignore generic 'id' to prevent falsely linking every table with an 'id' PK
        if (lower === "id") continue;
        // Prefer entity table over shadow tables (e.g. film over film_text)
        if (!pkMap.has(lower) || tableName.toLowerCase() === lower.replace(/_?id$/, "")) {
          pkMap.set(lower, { tableName, colName: col.name });
        }
      }
    }
  }

  for (const [tableName, tableData] of Object.entries(schema)) {
    const columns = tableData?.columns || [];
    for (const col of columns) {
      const lower = col.name.toLowerCase();
      if (lower === "id") continue;
      if (pkMap.has(lower)) {
        const target = pkMap.get(lower);
        if (target.tableName.toLowerCase() !== tableName.toLowerCase()) {
          const desc = `${tableName}.${col.name} references ${target.tableName}.${target.colName}`;
          if (!seen.has(desc)) {
            seen.add(desc);
            relationships.push(desc);
          }
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
  const activeSchema = pruneSchema(schema, query, { topK: 6 });
  const schemaText = formatSchemaForPrompt(activeSchema);
  const relationships = detectRelationships(activeSchema);
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

  const pIntent = detectPresentationIntent(query);
  let presentationHint = "";
  if (pIntent.chart) {
    presentationHint += "\n- Visualization shape: The user wants a visualization: return aggregated results (GROUP BY on the category/time column, aggregate the numeric column) suitable for charting.";
  }
  if (pIntent.report) {
    presentationHint += "\n- Report shape: The user wants a report: return grouped aggregates and, if useful, a headline scalar.";
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
- Injected sample values: When filtering on a column where sample values are provided in the schema (e.g. status TEXT [values: 'Submitted', 'Late', 'Not Submitted']), you MUST use the EXACT casing from the sample values using string equality (e.g. status = 'Submitted' or status = 'Submitted' COLLATE NOCASE). Do not guess with arbitrary LIKE wildcards if the exact values are listed in the schema.
- Unsampled text columns: For columns marked as [values: unknown/not sampled (large table)] or text columns without sample values, use COLLATE NOCASE (e.g. col = 'value' COLLATE NOCASE) or LIKE '%value%' or LOWER(col) = 'val' to ensure case-insensitive matching.
- Entity counting: when the question asks "how many <entity>" (e.g. "how many students", "how many customers"), count distinct entities using COUNT(DISTINCT entity_id) if the entity can have multiple records in the table.
- Identifiers: double-quote identifiers with spaces (e.g. "Column Name").
- Explicit JOINs: in the ON clause, ALWAYS join columns that have the exact same name (e.g. tableA.ColId = tableB.ColId). NEVER equate different column names (e.g. NEVER equate ArtistId = AlbumId).
- Intermediate Tables: if the question asks to count or inspect items from a target table that does not directly link to the entity (e.g. counting tracks for artists), you MUST join through all intermediate linking tables (e.g. FROM artists JOIN albums ON artists.ArtistId = albums.ArtistId JOIN tracks ON albums.AlbumId = tracks.AlbumId) and aggregate the target table's items (e.g. COUNT(tracks.TrackId)).
- Aggregates: when aggregating with COUNT, SUM, or AVG (such as 'most', 'highest', 'top'), you MUST ALWAYS include both the entity identifier/name AND the aggregate metric in the SELECT clause (e.g. SELECT artists.Name, COUNT(tracks.TrackId) AS track_count), never select only the name alone. Include GROUP BY.
- Ordering & Limits: if the question asks for a specific count (e.g. "Which 5", "top 10", "first 3"), use that exact number in LIMIT (e.g. LIMIT 5). Use ORDER BY <metric> DESC for top/most. Only default to LIMIT 50 if no specific count was requested.
- Column safety: use ONLY columns that appear in the schema lines above, and attach each column to the correct table. If a table directly contains the column you need, query that table alone instead of adding joins. Use explicit table names (e.g. tracks.TrackId, artists.Name) rather than ambiguous aliases like T1, T2 to ensure every column belongs to its true table.${presentationHint}


### Few-Shot Examples (neutral reference schemas):
Question: Find all active users sorted by registration date
SQL: SELECT user_id, email, created_at FROM users WHERE status = 'Active' COLLATE NOCASE ORDER BY created_at DESC LIMIT 50

Question: How many students have submitted assignments?
SQL: SELECT COUNT(DISTINCT student_id) FROM assignment_submissions WHERE status = 'Submitted' COLLATE NOCASE

Question: Which 5 authors have the most book reviews?
SQL: SELECT authors.name, COUNT(reviews.id) AS review_count FROM authors JOIN books ON authors.id = books.author_id JOIN reviews ON books.id = reviews.book_id GROUP BY authors.id ORDER BY review_count DESC LIMIT 5

Question: What is the average rating for electronics products?
SQL: SELECT AVG(rating) AS avg_rating FROM reviews WHERE category LIKE 'electronics' LIMIT 50
${contextSection}
### Actual Task:
Question: ${query}
SQL:`;
}

