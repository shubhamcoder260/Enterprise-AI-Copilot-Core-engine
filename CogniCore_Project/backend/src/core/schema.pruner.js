// ==========================================
// SCHEMA PRUNER (CORE)
// Selects top-K most relevant tables for prompt injection while preserving
// foreign key connectivity (FK closure).
//
// INVARIANT 1: PURE FUNCTION. Accepts (schema, question, options) -> returns pruned schema subset.
// INVARIANT 2: PROMPT-SIDE ONLY. The full unpruned schema is ALWAYS passed to AST validation gates.
// INVARIANT 3: CONNECTIVITY PRESERVATION. If table A and table B are selected, any intermediate
//              join table C connecting them via foreign keys MUST be included in the closure.
// ==========================================

import { normalizeWord, getWords } from "./schema.resolver.js";
import { SEMANTIC_PROFILE } from "../config/semantic.profile.js";

/**
 * Builds an undirected adjacency graph representing FK connections between tables.
 * Checks both explicit schema[t].foreignKeys and heuristic column PK/FK matching.
 *
 * @param {object} schema - Full database schema map
 * @returns {Map<string, Set<string>>} Table name -> Set of neighboring table names
 */
export function buildRelationshipGraph(schema = {}) {
  const adj = new Map();
  const tableNames = Object.keys(schema);

  for (const t of tableNames) {
    adj.set(t, new Set());
  }

  // Tier 1: Explicit schema foreign keys
  let foundExplicit = false;
  for (const [tableName, tableData] of Object.entries(schema)) {
    const fks = tableData?.foreignKeys || [];
    for (const fk of fks) {
      if (!fk.toTable) continue;
      // Case-insensitive match to known schema table names
      const targetTable = tableNames.find(
        (t) => t.toLowerCase() === String(fk.toTable).toLowerCase()
      );
      if (targetTable && targetTable !== tableName) {
        adj.get(tableName).add(targetTable);
        adj.get(targetTable).add(tableName);
        foundExplicit = true;
      }
    }
  }

  // Tier 2: Heuristic naming fallback if no explicit foreign keys were defined
  if (!foundExplicit) {
    const pkMap = new Map();
    for (const [tableName, tableData] of Object.entries(schema)) {
      const columns = tableData?.columns || [];
      for (const col of columns) {
        if (col.primaryKey || col.pk) {
          const lower = col.name.toLowerCase();
          if (lower === "id") continue;
          if (!pkMap.has(lower) || tableName.toLowerCase() === lower.replace(/_?id$/, "")) {
            pkMap.set(lower, tableName);
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
          const targetTable = pkMap.get(lower);
          if (targetTable !== tableName && adj.has(targetTable)) {
            adj.get(tableName).add(targetTable);
            adj.get(targetTable).add(tableName);
          }
        }
      }
    }
  }

  return adj;
}

/**
 * Computes shortest path between start and goal using BFS on an undirected adjacency graph.
 *
 * @param {string} start
 * @param {string} goal
 * @param {Map<string, Set<string>>} adj
 * @returns {string[]|null} Array of table names along path including start and goal, or null
 */
function findShortestPath(start, goal, adj) {
  if (start === goal) return [start];
  const queue = [[start]];
  const visited = new Set([start]);

  while (queue.length > 0) {
    const path = queue.shift();
    const node = path[path.length - 1];

    const neighbors = adj.get(node) || new Set();
    for (const next of neighbors) {
      if (next === goal) {
        return [...path, next];
      }
      if (!visited.has(next)) {
        visited.add(next);
        queue.push([...path, next]);
      }
    }
  }

  return null;
}

/**
 * Computes relevance score for each table against the user query.
 *
 * @param {object} schema
 * @param {string} question
 * @returns {Map<string, number>} Table name -> relevance score
 */
export function scoreTables(schema = {}, question = "") {
  const words = getWords(question).map(normalizeWord);
  const wordSet = new Set(words);
  const scores = new Map();
  const aliases = SEMANTIC_PROFILE.schemaAliases || {};

  for (const [tableName, tableData] of Object.entries(schema)) {
    let score = 0;
    const normTable = normalizeWord(tableName);

    // 1. Exact match on table name
    if (wordSet.has(normTable)) {
      score += 10;
    }

    // 2. Exact match on table alias (from semantic profile)
    const alias = aliases[tableName];
    if (alias && wordSet.has(normalizeWord(alias))) {
      score += 10;
    }

    // 3. Column name matches
    const columns = tableData?.columns || [];
    for (const col of columns) {
      const colNorm = normalizeWord(col.name);
      if (wordSet.has(colNorm)) {
        score += 3;
      }
    }

    // 4. Sample value matches (if cached)
    for (const col of columns) {
      if (Array.isArray(col.sampleValues)) {
        for (const sv of col.sampleValues) {
          const svStr = String(sv).toLowerCase();
          if (svStr.length > 2 && wordSet.has(normalizeWord(svStr))) {
            score += 2;
            break; // Max 2 per column
          }
        }
      }
    }

    scores.set(tableName, score);
  }

  return scores;
}

/**
 * Prunes the schema to top-K tables by relevance score, plus all intermediate
 * tables required for FK-closure between the selected tables.
 *
 * @param {object} schema - Full database schema map
 * @param {string} question - Natural language question
 * @param {object} [options]
 * @param {number} [options.topK=6] - Maximum initial tables to select by score
 * @returns {object} Pruned schema map containing only relevant & connecting tables
 */
export function pruneSchema(schema = {}, question = "", options = {}) {
  const { topK = 6 } = options;
  const tableNames = Object.keys(schema);

  // If total tables <= topK, no pruning needed; return full schema
  if (tableNames.length <= topK) {
    return { ...schema };
  }

  const scores = scoreTables(schema, question);

  // Filter tables with score > 0, sorted descending
  const candidates = tableNames
    .filter((t) => scores.get(t) > 0)
    .sort((a, b) => scores.get(b) - scores.get(a));

  // Fallback: If no tables scored > 0, take the first topK tables from schema
  const primarySelected = candidates.length > 0 ? candidates.slice(0, topK) : tableNames.slice(0, topK);

  // Build FK relationship graph
  const adj = buildRelationshipGraph(schema);

  // Compute FK-closure: for every pair of selected tables, find shortest path and add intermediates
  const selectedSet = new Set(primarySelected);

  for (let i = 0; i < primarySelected.length; i++) {
    for (let j = i + 1; j < primarySelected.length; j++) {
      const t1 = primarySelected[i];
      const t2 = primarySelected[j];
      const path = findShortestPath(t1, t2, adj);
      if (path && path.length > 2) {
        // Intermediate tables are between start and end
        for (let k = 1; k < path.length - 1; k++) {
          selectedSet.add(path[k]);
        }
      }
    }
  }

  // Assemble pruned schema subset
  const pruned = {};
  for (const tableName of selectedSet) {
    if (schema[tableName]) {
      pruned[tableName] = schema[tableName];
    }
  }

  return pruned;
}
