import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import assert from 'assert';
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

const corpusPath = path.join(__dirname, 'golden', 'ast_gate_golden.json');
const corpus = JSON.parse(fs.readFileSync(corpusPath, 'utf8'));

console.log("==================================================");
console.log(`   VERIFYING AST GATE GOLDEN CORPUS (${corpus.length} CASES)   `);
console.log("==================================================");

let passed = 0;
let failed = 0;

for (const testCase of corpus) {
  const result = validateAst(testCase.sql, { schema: mockSchema });
  const actualReason = result.reason || 'none';

  if (result.valid === testCase.expected.valid && actualReason === testCase.expected.reason) {
    passed++;
  } else {
    failed++;
    console.error(`❌ Case ${testCase.id} Failed:`);
    console.error(`   SQL:      ${testCase.sql}`);
    console.error(`   Expected: valid=${testCase.expected.valid}, reason=${testCase.expected.reason}`);
    console.error(`   Actual:   valid=${result.valid}, reason=${actualReason}`);
  }
}

console.log(`\nResults: ${passed}/${corpus.length} passed, ${failed} failed`);
if (failed === 0) {
  console.log("🏆 AST GATE GOLDEN CORPUS 100% GREEN!");
  console.log("==================================================");
  process.exit(0);
} else {
  console.error("🚨 AST GATE GOLDEN REGRESSION DETECTED!");
  console.log("==================================================");
  process.exit(1);
}
