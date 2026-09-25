import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import assert from 'assert';
import { capabilities, createDefaultCapabilities, createCapabilitiesForSource } from '../src/kernel/capabilities.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const goldenPath = path.join(__dirname, 'golden', 'capabilities_golden.json');
const expected = JSON.parse(fs.readFileSync(goldenPath, 'utf8'));

console.log("==================================================");
console.log("   VERIFYING CAPABILITIES RE-PIN EQUIVALENCE      ");
console.log("==================================================");

// Check capabilities singleton shape
const actualKeys = Object.keys(capabilities).filter(k => k !== 'source').sort();
assert.deepStrictEqual(actualKeys, expected.keys, "Top-level keys must match golden snapshot");

const actualDbMethods = Object.keys(capabilities.db).sort();
assert.deepStrictEqual(actualDbMethods, expected.dbMethods, "db methods must match golden snapshot");

const actualLlmMethods = Object.keys(capabilities.llm).sort();
assert.deepStrictEqual(actualLlmMethods, expected.llmMethods, "llm methods must match golden snapshot");

assert.strictEqual(typeof capabilities.db.getDb === 'function', expected.hasGetDb);
assert.strictEqual(typeof capabilities.db.executeReadOnlySql === 'function', expected.hasExecuteReadOnlySql);
assert.strictEqual(typeof capabilities.llm.queryLLM === 'function', expected.hasQueryLLM);

// Check factory functions exist
assert.strictEqual(typeof createDefaultCapabilities, 'function');
assert.strictEqual(typeof createCapabilitiesForSource, 'function');

const customCaps = createCapabilitiesForSource({ id: 'test_db', dialect: 'sqlite' });
assert.strictEqual(typeof customCaps.db.executeReadOnlySql, 'function');
assert.strictEqual(customCaps.source.id, 'test_db');

console.log("✅ Top-level keys match golden snapshot");
console.log("✅ dbMethods match golden snapshot");
console.log("✅ llmMethods match golden snapshot");
console.log("✅ Factory functions verified");
console.log("🏆 CAPABILITIES RE-PIN EQUIVALENCE 100% VERIFIED!");
console.log("==================================================");
