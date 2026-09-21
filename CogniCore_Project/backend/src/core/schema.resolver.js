// ==========================================
// SCHEMA RESOLVER (UNDERSTAND)
// Resolves table and column matches from natural language queries
// ==========================================

import { SEMANTIC_PROFILE } from "../config/semantic.profile.js";

export function normalizeWord(word) {
  const w = String(word)
    .toLowerCase()
    .trim();

  // "ies" -> "y" (e.g. categories -> category, cities -> city)
  if (w.endsWith("ies") && w.length > 4) {
    return w.slice(0, -3) + "y";
  }

  // "sses" -> "ss" (e.g. addresses -> address, processes -> process, businesses -> business)
  if (w.endsWith("sses") && w.length > 5) {
    return w.slice(0, -2);
  }

  // "ses" -> "s" or "se" (e.g. cases -> case, databases -> database)
  if (w.endsWith("ses") && w.length > 4) {
    return w.slice(0, -2);
  }

  // Do NOT strip 's' if word ends in double-s (e.g. address, class, access, process, business, status)
  if (w.endsWith("ss")) {
    return w;
  }

  // Common singular words ending in 's', 'us', 'is' that are NOT plurals
  const nonPlurals = [
    "status", "census", "campus", "radius", "focus", "bonus",
    "virus", "apparatus", "basis", "crisis", "axis", "gas", "canvas", "address"
  ];
  if (nonPlurals.includes(w) || w.endsWith("us") || w.endsWith("is")) {
    return w;
  }

  // Regular English plural ending in 's' (e.g. students -> student, customers -> customer)
  if (w.endsWith("s") && w.length > 3) {
    return w.slice(0, -1);
  }

  return w;
}

export function getWords(query) {
  return (
    String(query)
      .toLowerCase()
      .match(/[a-z0-9_]+/g) || []
  );
}

export function isNumericColumn(column) {
  const type = String(column?.type || "").toLowerCase();

  return (
    type.includes("int") ||
    type.includes("real") ||
    type.includes("numeric") ||
    type.includes("decimal") ||
    type.includes("double") ||
    type.includes("float")
  );
}

export function findMatchingTable(query, schema = {}) {
  const words = getWords(query).map(normalizeWord);

  // Direct table name match
  for (const tableName of Object.keys(schema)) {
    const normalizedTable = normalizeWord(tableName);
    if (words.includes(normalizedTable)) {
      console.log("✅ MATCHED TABLE:", tableName);
      return tableName;
    }
  }

  // Exact normalized alias match fallback (Decision S12)
  const aliases = SEMANTIC_PROFILE.schemaAliases || {};
  for (const [actualTable, friendlyAlias] of Object.entries(aliases)) {
    if (schema[actualTable]) {
      const normalizedAlias = normalizeWord(friendlyAlias);
      if (words.includes(normalizedAlias)) {
        console.log(`✅ MATCHED TABLE VIA ALIAS: ${actualTable} (alias: "${friendlyAlias}")`);
        return actualTable;
      }
    }
  }

  return null;
}

export function findMatchingColumn(query, columns = []) {
  const words = getWords(query).map(normalizeWord);

  for (const column of columns) {
    const normalizedColumn = normalizeWord(column.name);
    if (words.includes(normalizedColumn)) {
      console.log("✅ MATCHED COLUMN:", column.name);
      return column.name;
    }
  }

  return null;
}

export function getTableColumns(tableData) {
  return tableData?.columns || [];
}

export function findTableFromColumn(query, schema = {}) {
  const words = getWords(query).map(normalizeWord);
  const matches = [];

  for (const [tableName, tableData] of Object.entries(schema)) {
    const columns = getTableColumns(tableData);
    for (const column of columns) {
      const normalizedColumn = normalizeWord(column.name);
      if (words.includes(normalizedColumn)) {
        matches.push({
          tableName,
          columnName: column.name
        });
      }
    }
  }

  if (matches.length > 0) {
    console.log("✅ TABLE FOUND FROM COLUMN:", matches[0]);
    return matches[0];
  }

  return null;
}

export function findBestNumericColumn(columns = []) {
  // Do not automatically choose ID columns
  const numericColumns = columns.filter(
    (column) => isNumericColumn(column) && !column.name.toLowerCase().endsWith("id")
  );

  if (numericColumns.length === 1) {
    return numericColumns[0].name;
  }

  return null;
}

export function resolveTableAndColumn(query, schema = {}) {
  const tableName = findMatchingTable(query, schema);

  if (tableName) {
    return {
      tableName,
      columnName: findMatchingColumn(query, getTableColumns(schema[tableName]))
    };
  }

  const columnMatch = findTableFromColumn(query, schema);
  if (columnMatch) {
    return {
      tableName: columnMatch.tableName,
      columnName: columnMatch.columnName
    };
  }

  return {
    tableName: null,
    columnName: null
  };
}
