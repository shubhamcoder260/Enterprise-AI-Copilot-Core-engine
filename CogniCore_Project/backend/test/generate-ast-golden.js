import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { validateAst } from '../src/kernel/ast.gate.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const mockSchema = {
  products: {
    columns: [
      { name: "product_id", type: "INTEGER", pk: true },
      { name: "name", type: "TEXT" },
      { name: "category", type: "TEXT" },
      { name: "price", type: "REAL" }
    ]
  },
  artists: {
    columns: [
      { name: "artist_id", type: "INTEGER", pk: true },
      { name: "name", type: "TEXT" },
      { name: "country", type: "TEXT" }
    ]
  },
  orders: {
    columns: [
      { name: "order_id", type: "INTEGER", pk: true },
      { name: "order_date", type: "TEXT" },
      { name: "total_amount", type: "REAL" }
    ]
  },
  assignments: {
    columns: [
      { name: "emp_id", type: "INTEGER", pk: true },
      { name: "project_id", type: "INTEGER", pk: true },
      { name: "role_on_project", type: "TEXT" },
      { name: "hours_allocated", type: "INTEGER" }
    ]
  },
  playlist_track: {
    columns: [
      { name: "PlaylistId", type: "INTEGER", pk: true },
      { name: "TrackId", type: "INTEGER", pk: true }
    ]
  }
};

const testQueries = [
  // Whitelist functions (allowed)
  "SELECT COUNT(*) FROM products",
  "SELECT SUM(price) FROM products",
  "SELECT AVG(price) FROM products",
  "SELECT MIN(price) FROM products",
  "SELECT MAX(price) FROM products",
  "SELECT ROUND(price, 2) FROM products",
  "SELECT LOWER(name) FROM products",
  "SELECT UPPER(name) FROM products",
  "SELECT COUNT(DISTINCT category) FROM products",
  "SELECT ROUND(AVG(price), 1) FROM products",

  // Disallowed functions
  "SELECT load_extension('evil')",
  "SELECT hex(name) FROM products",
  "SELECT randomblob(16) FROM products",
  "SELECT char(65) FROM products",
  "SELECT typeof(price) FROM products",
  "SELECT zeroblob(10) FROM products",

  // Schema existence (valid tables & columns)
  "SELECT name, price FROM products WHERE price > 10",
  "SELECT artist_id, name, country FROM artists",
  "SELECT order_id, total_amount FROM orders WHERE order_date >= '2024-01-01'",
  "SELECT emp_id, project_id, role_on_project FROM assignments",

  // Schema existence violations
  "SELECT * FROM ghost_table",
  "SELECT fake_column FROM products",
  "SELECT missing_col FROM artists WHERE artist_id = 1",
  "SELECT product_id, non_existent FROM products",
  "SELECT * FROM phantom_schema_table",

  // Bare-column / Group-by combinations (valid PK-FD or grouped)
  "SELECT name, COUNT(*) FROM artists GROUP BY artist_id",
  "SELECT category, AVG(price) FROM products GROUP BY category",
  "SELECT artists.name, COUNT(*) FROM artists GROUP BY artists.artist_id",
  "SELECT emp_id, project_id, SUM(hours_allocated) FROM assignments GROUP BY emp_id, project_id",
  "SELECT PlaylistId, TrackId, COUNT(*) FROM playlist_track GROUP BY PlaylistId, TrackId",

  // Bare-column / Group-by violations
  'SELECT "category", AVG("price") AS average_price FROM "products" ORDER BY "price" DESC LIMIT 50',
  "SELECT name, COUNT(*) FROM artists GROUP BY country",
  "SELECT role_on_project, SUM(hours_allocated) FROM assignments GROUP BY emp_id",
  "SELECT TrackId, COUNT(*) FROM playlist_track GROUP BY PlaylistId",
  "SELECT name, AVG(price) FROM products",
  "SELECT category, name, COUNT(*) FROM products GROUP BY category",

  // Joins & subqueries
  "SELECT p.name, p.price FROM products p WHERE p.price > 100",
  "SELECT a.name, count(al.album_id) FROM artists a LEFT JOIN albums al ON a.artist_id = al.artist_id GROUP BY a.artist_id",
  "SELECT * FROM (SELECT product_id, price FROM products) sub WHERE sub.price > 50",
  "SELECT category, sum(price) FROM products WHERE category IN ('Electronics', 'Books') GROUP BY 1"
];

console.log(`Generating AST golden corpus for ${testQueries.length} test cases...`);

const goldenCorpus = testQueries.map((sql, index) => {
  const result = validateAst(sql, { schema: mockSchema });
  return {
    id: `AST-G-${String(index + 1).padStart(2, '0')}`,
    sql,
    expected: {
      valid: result.valid,
      reason: result.reason || 'none'
    }
  };
});

const outputPath = path.join(__dirname, 'golden', 'ast_gate_golden.json');
fs.writeFileSync(outputPath, JSON.stringify(goldenCorpus, null, 2) + '\n', 'utf8');
console.log(`✅ Saved ${goldenCorpus.length} cases to ${outputPath}`);
