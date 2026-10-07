// ==========================================
// SQL PROMPT BUILDER
// Unified prompt constructor for multi-dialect text-to-SQL generation.
// Enforces canonical ordering:
// system role → dialect rules → schema → profile notes →
// docstatus doctrine → conversation history → question
// ==========================================

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { SEMANTIC_PROFILE } from "../config/semantic.profile.js";
import { pruneSchema } from "../core/schema.pruner.js";
import { detectPresentationIntent } from "../core/presentation.intent.js";
import { DIALECTS, getDialect } from "../adapters/dialects/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const NOTES_PATH = path.join(__dirname, "schema.notes.json");

let cachedNotes = null;
export function loadSchemaNotes() {
  if (cachedNotes) return cachedNotes;
  try {
    if (fs.existsSync(NOTES_PATH)) {
      const raw = fs.readFileSync(NOTES_PATH, "utf8");
      cachedNotes = JSON.parse(raw);
      return cachedNotes;
    }
  } catch (err) {
    console.warn("⚠️ [SqlPrompt] Failed to load schema notes:", err.message);
  }
  cachedNotes = {};
  return cachedNotes;
}

/**
 * Checks if a column is low-cardinality categorical with sample values.
 */
export function isCategoricalColumn(col) {
  const name = String(col.name || "").toLowerCase();
  if (/date|time|_at|dob|email|phone|url|desc|message|comment|note|reason|title|code|address/i.test(name)) {
    return false;
  }
  if (Array.isArray(col.sampleValues) && col.sampleValues.length > 0) {
    return col.sampleValues.every((v) => typeof v === "string" && v.length <= 40);
  }
  return false;
}

/**
 * Formats in-memory schema into compact line-by-line table definitions.
 */
export function formatSchemaForPrompt(schema = {}) {
  const lines = [];
  const tableNames = Object.keys(schema).sort();
  const notes = loadSchemaNotes();
  const aliases = SEMANTIC_PROFILE.schemaAliases || {};

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

    const alias = aliases[tableName];
    if (alias) {
      lines.push(`Note: ${tableName} — table represents "${alias}"`);
    } else if (notes[tableName]) {
      lines.push(`Note: ${tableName} — ${notes[tableName]}`);
    }
  }

  return lines.join("\n");
}

/**
 * Detects relationships across tables via foreign keys.
 */
export function detectRelationships(schema = {}) {
  const relationships = [];
  const seen = new Set();

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

  if (relationships.length > 0) {
    return relationships;
  }

  const pkMap = new Map();
  for (const [tableName, tableData] of Object.entries(schema)) {
    const columns = tableData?.columns || [];
    for (const col of columns) {
      if (col.primaryKey || col.pk) {
        const lower = col.name.toLowerCase();
        if (lower === "id") continue;
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
 * Formats dialect rules from the DIALECTS registry.
 */
function formatDialectRules(dialect = "sqlite", query = "") {
  const dKey = String(dialect).toLowerCase();
  const dialectObj = getDialect(dKey) || DIALECTS[dKey] || DIALECTS.sqlite;
  const isMariaDb = dialectObj.dialect === "mariadb";
  const isPostgres = dialectObj.dialect === "postgres";
  const dialectLabel = isMariaDb ? "MariaDB" : isPostgres ? "PostgreSQL" : "SQLite";

  const lines = [
    `### Dialect & Output Rules (${dialectLabel}):`,
    `- Registry rules: ${dialectObj.docs}`,
    `- Output: Return ONLY one raw ${dialectLabel} SELECT statement. No markdown, no explanation, no trailing semicolon.`,
    "- Safety: Read-only SELECT queries only. Never generate INSERT, UPDATE, DELETE, DROP, or ALTER."
  ];

  if (isMariaDb) {
    lines.push(
      "- Identifiers: Enclose table and column names in backticks (e.g. `tabSales Invoice`, `customer`). Preserve spaces in ERPNext tab* names verbatim.",
      "- Date Filtering: Prefer range predicates on date columns (e.g. `posting_date` >= 'YYYY-01-01' AND `posting_date` < 'YYYY+1-01-01') over YEAR() for index eligibility.",
      "- Casing: MariaDB comparisons are case-insensitive by default under utf8mb4_general_ci / utf8mb4_unicode_ci. Do not use COLLATE NOCASE."
    );
  } else if (isPostgres) {
    lines.push(
      '- Identifiers: Enclose table and column names in double quotes (e.g. "customers", "order_date").',
      "- Date Functions: Safe date operations are DATE_TRUNC('month', col), EXTRACT(YEAR FROM col), and TO_CHAR(col, 'YYYY-MM').",
      '- Date Filtering: Prefer range predicates on date columns (e.g. "order_date" >= \'YYYY-01-01\' AND "order_date" < \'YYYY+1-01-01\') to preserve index eligibility.',
      "- Casing: PostgreSQL comparisons are case-sensitive by default. Use ILIKE or LOWER(col) = LOWER('val'). Do not use COLLATE NOCASE."
    );
  } else {
    lines.push(
      '- Identifiers: Double-quote identifiers with spaces or keywords (e.g. "student_id", "attendance_percentage").',
      "- Injected sample values: When filtering on columns with sample values, use EXACT casing from sample values using string equality.",
      "- Unsampled text columns: For columns without sample values or un-sampled large tables, use COLLATE NOCASE or LOWER(col) = 'val' for case-insensitive matching."
    );
  }

  lines.push(
    "- Aggregates: When aggregating with COUNT, SUM, or AVG, include both the grouping identifier and aggregate metric in SELECT and GROUP BY."
  );

  const pIntent = detectPresentationIntent(query);
  if (pIntent.chart) {
    lines.push("- Presentation: Return grouped aggregates suitable for charting (GROUP BY category/time, aggregate numeric column).");
  } else if (pIntent.report) {
    lines.push("- Presentation: Return grouped aggregates suitable for report display.");
  }

  return lines.join("\n") + "\n";
}

/**
 * Formats semantic profile notes (aliases and descriptions).
 */
function formatProfileNotes(activeSchema = {}) {
  const notes = loadSchemaNotes();
  const aliases = SEMANTIC_PROFILE.schemaAliases || {};
  const lines = [];

  for (const tableName of Object.keys(activeSchema).sort()) {
    const alias = aliases[tableName];
    if (alias) {
      lines.push(`- Table "${tableName}" represents "${alias}"`);
    } else if (notes[tableName]) {
      lines.push(`- Table "${tableName}": ${notes[tableName]}`);
    }
  }

  return lines.length > 0 ? `### Profile Notes:\n${lines.join("\n")}\n` : "";
}

/**
 * Formats docstatus doctrine for transactional tables.
 */
function formatDocstatusDoctrine(activeSchema = {}, dialect = "sqlite") {
  const d = String(dialect).toLowerCase();
  const hasDocstatus =
    d === "mariadb" ||
    Object.values(activeSchema).some((t) =>
      (t.columns || []).some((c) => c.name?.toLowerCase() === "docstatus")
    );

  if (!hasDocstatus) return "";

  return `### Docstatus Doctrine:
- For transactional tables with a docstatus column (e.g. \`tabSales Invoice\`, \`tabPurchase Invoice\`, \`tabSales Order\`), ALWAYS filter by \`docstatus\` = 1 for submitted documents.
- Master DocTypes (e.g. \`tabCustomer\`, \`tabItem\`) do not have docstatus = 1 constraints unless specifically required.\n`;
}

/**
 * Formats conversation history (last 3 turns).
 */
function formatConversationHistory(history = []) {
  if (!Array.isArray(history) || history.length === 0) return "";
  const turns = history
    .slice(-3)
    .map((item) => {
      const q = String(item.question || "").slice(0, 120);
      const s = String(item.sql || "").slice(0, 120);
      return `Q: ${q}\nSQL: ${s}`;
    })
    .join("\n\n");

  return `### Previous Conversation Context:
${turns}

### Context Resolution Instruction:
For follow-up questions that refer to the previous exchanges:
1. Identify what the current question adds or changes relative to prior questions.
2. Resolve into a single self-contained query.
3. Output ONLY the raw SELECT statement.\n`;
}

/**
 * Builds the unified SQL prompt following the canonical section order:
 * system role → dialect rules → schema → profile notes →
 * docstatus doctrine → conversation history → question
 *
 * @param {object} params
 * @param {string} params.query - Natural language user question
 * @param {object} params.schema - Cached database schema
 * @param {Array} [params.history=[]] - Conversation history
 * @param {string} [params.dialect="sqlite"] - Active database dialect
 * @returns {string}
 */
export function buildSqlPrompt({ query, schema = {}, history = [], dialect = "sqlite" }) {
  const dKey = String(dialect).toLowerCase();
  const dialectObj = getDialect(dKey) || DIALECTS[dKey] || DIALECTS.sqlite;
  const isMariaDb = dialectObj.dialect === "mariadb";
  const isPostgres = dialectObj.dialect === "postgres";
  const dialectLabel = isMariaDb ? "MariaDB" : isPostgres ? "PostgreSQL" : "SQLite";

  const activeSchema = pruneSchema(schema, query, { topK: 6 });
  const schemaText = formatSchemaForPrompt(activeSchema);
  const relationships = detectRelationships(activeSchema);
  const relText =
    relationships.length > 0
      ? `\n### Key Relationships (Foreign Keys):\n${relationships.map((r) => `- ${r}`).join("\n")}\n`
      : "";

  const sections = [
    `You are a strict ${dialectLabel} SQL generator.\n`,
    formatDialectRules(dKey, query),
    `### Database Schema:\n${schemaText || "No tables available in active database."}\n${relText}`,
    formatProfileNotes(activeSchema),
    formatDocstatusDoctrine(activeSchema, dKey),
    formatConversationHistory(history),
    `### Actual Task:\nQuestion: ${query}\nSQL:`
  ];

  return sections.filter(Boolean).join("\n").trim();
}
