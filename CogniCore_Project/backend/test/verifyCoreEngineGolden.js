import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import assert from 'assert';
import { runCoreEngine } from '../src/core/core.engine.js';
import { ANSWERED } from '../src/kernel/handler-result.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const goldenPath = path.join(__dirname, 'golden', 'core_engine_golden.json');
const goldenCases = JSON.parse(fs.readFileSync(goldenPath, 'utf8'));

console.log("==================================================");
console.log("   VERIFYING CORE ENGINE GOLDEN CORPUS (CE-01..CE-07) ");
console.log("==================================================");

async function runVerification() {
  let passed = 0;

  // Hermetic environment hygiene: ensure active database is baseline H3_metropol.db
  const baselineDbPath = path.join(__dirname, '../uploads/1790095610940-H3_metropol.db');
  if (fs.existsSync(baselineDbPath)) {
    const { switchDatabase } = await import('../src/config/database.js');
    await switchDatabase(baselineDbPath);
  }

  // CE-01
  const c1 = goldenCases.find(c => c.id === 'CE-01');
  const res1 = await runCoreEngine({ query: c1.query, organization: "college", role: "admin", sessionId: "ce-01-v" });
  assert.strictEqual(res1.source, c1.expectedSource, "CE-01 source mismatch");
  assert.strictEqual(res1.answer.slice(0, 30), c1.expectedAnswerPrefix, "CE-01 answer prefix mismatch");
  console.log("✅ CE-01: Tool path equivalence verified");
  passed++;

  // CE-02
  const c2 = goldenCases.find(c => c.id === 'CE-02');
  const res2 = await runCoreEngine({ query: c2.query, organization: "hospital", role: "admin", sessionId: "ce-02-v" });
  assert.strictEqual(res2.source, c2.expectedSource, "CE-02 source mismatch");
  assert.strictEqual(res2.answer.slice(0, 30), c2.expectedAnswerPrefix, "CE-02 answer prefix mismatch");
  console.log("✅ CE-02: Dynamic query engine equivalence verified");
  passed++;

  // CE-03
  const c3 = goldenCases.find(c => c.id === 'CE-03');
  const mockLink = {
    name: "MockDeterministicLink",
    execute: async () => ANSWERED({ answer: "Mock deterministic answer", source: "mock_deterministic", data: { count: 42 } })
  };
  const res3 = await runCoreEngine({ query: c3.query, sessionId: "ce-03-v" }, { pipeline: [mockLink] });
  assert.strictEqual(res3.source, c3.expectedSource, "CE-03 source mismatch");
  assert.strictEqual(res3.answer, c3.expectedAnswer, "CE-03 answer mismatch");
  console.log("✅ CE-03: Custom pipeline override verified");
  passed++;

  // CE-04
  const c4 = goldenCases.find(c => c.id === 'CE-04');
  const res4 = await runCoreEngine({ query: c4.query, sessionId: "ce-04-v" });
  assert.strictEqual(res4.source, c4.expectedSource, "CE-04 source mismatch");
  assert.strictEqual(res4.answer.slice(0, 30), c4.expectedAnswerPrefix, "CE-04 answer prefix mismatch");
  console.log("✅ CE-04: Helpful fallback path verified");
  passed++;

  // CE-05
  const c5 = goldenCases.find(c => c.id === 'CE-05');
  const res5 = await runCoreEngine({ query: c5.query, organization: "hospital", role: "admin", sessionId: "ce-05-v" });
  assert.strictEqual(res5.source, c5.expectedSource, "CE-05 source mismatch");
  console.log("✅ CE-05: Legacy call without options parameter verified");
  passed++;

  // CE-06
  const c6 = goldenCases.find(c => c.id === 'CE-06');
  const res6 = await runCoreEngine({ query: "total patients", organization: "hospital", role: "admin", sessionId: "ce-06-v" }, {});
  assert.strictEqual(res6.source, c6.expectedSource, "CE-06 source mismatch");
  console.log("✅ CE-06: Empty options object verified");
  passed++;

  // CE-07: Injected capabilities verification
  const injectedCalls = [];
  const testMockLink = {
    name: "CapabilitySpyLink",
    execute: async (ctx) => {
      injectedCalls.push(ctx.capabilities.customMarker);
      return ANSWERED({ answer: "injected ok", source: "injected" });
    }
  };
  await runCoreEngine(
    { query: "test injected caps", sessionId: "ce-07-v" },
    { pipeline: [testMockLink], capabilities: { customMarker: "FOUND_CUSTOM_CAPS" } }
  );
  assert.strictEqual(injectedCalls[0], "FOUND_CUSTOM_CAPS", "CE-07: Custom injected capabilities must reach link");
  console.log("✅ CE-07: Custom capabilities injection seam verified");
  passed++;

  console.log("==================================================");
  console.log(`🏆 ALL ${passed}/7 CORE ENGINE GOLDEN CASES GREEN!`);
  console.log("==================================================");
}

runVerification();
