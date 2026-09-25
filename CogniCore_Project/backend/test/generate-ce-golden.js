import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { runCoreEngine } from '../src/core/core.engine.js';
import { capabilities } from '../src/kernel/capabilities.js';
import { ANSWERED } from '../src/kernel/handler-result.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const goldenDir = path.join(__dirname, 'golden');

if (!fs.existsSync(goldenDir)) {
  fs.mkdirSync(goldenDir, { recursive: true });
}

async function generateGoldenCorpora() {
  console.log("Generating Core Engine & Capabilities Golden Corpora...");

  // --- 1. Capabilities Golden Snapshot ---
  const capsKeys = Object.keys(capabilities);
  const dbKeys = Object.keys(capabilities.db);
  const llmKeys = Object.keys(capabilities.llm);

  const capabilitiesSnapshot = {
    keys: capsKeys.sort(),
    dbMethods: dbKeys.sort(),
    llmMethods: llmKeys.sort(),
    hasGetDb: typeof capabilities.db.getDb === 'function',
    hasExecuteReadOnlySql: typeof capabilities.db.executeReadOnlySql === 'function',
    hasQueryLLM: typeof capabilities.llm.queryLLM === 'function'
  };

  fs.writeFileSync(
    path.join(goldenDir, 'capabilities_golden.json'),
    JSON.stringify(capabilitiesSnapshot, null, 2) + '\n',
    'utf8'
  );
  console.log("✅ capabilities_golden.json captured.");

  // --- 2. Core Engine Golden Corpus (CE-01..CE-07) ---
  const goldenCases = [];

  // CE-01: Tool path (CGPA analytics tool)
  const res1 = await runCoreEngine(
    { query: "Students with CGPA above 8.5", organization: "college", role: "admin", sessionId: "ce-01" }
  );
  goldenCases.push({
    id: "CE-01",
    desc: "tool link traversal",
    query: "Students with CGPA above 8.5",
    expectedSource: res1.source,
    expectedAnswerPrefix: res1.answer.slice(0, 30),
    traceLinks: res1.meta.pipelineTrace.map(t => t.link)
  });

  // CE-02: Dynamic query engine path
  const res2 = await runCoreEngine(
    { query: "list all doctors", organization: "hospital", role: "admin", sessionId: "ce-02" }
  );
  goldenCases.push({
    id: "CE-02",
    desc: "dynamic query engine path",
    query: "list all doctors",
    expectedSource: res2.source,
    expectedAnswerPrefix: res2.answer.slice(0, 30),
    traceLinks: res2.meta.pipelineTrace.map(t => t.link)
  });

  // CE-03: Deterministic mock pipeline link
  const mockLink = {
    name: "MockDeterministicLink",
    execute: async (ctx) => {
      return ANSWERED({
        answer: "Mock deterministic answer",
        source: "mock_deterministic",
        data: { count: 42 }
      });
    }
  };
  const res3 = await runCoreEngine(
    { query: "test query", sessionId: "ce-03" },
    { pipeline: [mockLink] }
  );
  goldenCases.push({
    id: "CE-03",
    desc: "custom pipeline override",
    query: "test query",
    expectedSource: res3.source,
    expectedAnswer: res3.answer,
    traceLinks: res3.meta.pipelineTrace.map(t => t.link)
  });

  // CE-04: Helpful Fallback path
  const res4 = await runCoreEngine(
    { query: "xyz123 unresolvable nonsensical query ???", sessionId: "ce-04" }
  );
  goldenCases.push({
    id: "CE-04",
    desc: "helpful fallback path",
    query: "xyz123 unresolvable nonsensical query ???",
    expectedSource: res4.source,
    expectedAnswerPrefix: res4.answer.slice(0, 30),
    traceLinks: res4.meta.pipelineTrace.map(t => t.link)
  });

  // CE-05: Legacy call without second argument options
  const res5 = await runCoreEngine(
    { query: "total patients", organization: "hospital", role: "admin", sessionId: "ce-05" }
  );
  goldenCases.push({
    id: "CE-05",
    desc: "legacy signature call without options parameter",
    query: "total patients",
    expectedSource: res5.source,
    traceLength: res5.meta.pipelineTrace.length
  });

  // CE-06: Empty options object {}
  const res6 = await runCoreEngine(
    { query: "total patients", organization: "hospital", role: "admin", sessionId: "ce-06" },
    {}
  );
  goldenCases.push({
    id: "CE-06",
    desc: "empty options object call",
    expectedSource: res6.source,
    traceLength: res6.meta.pipelineTrace.length
  });

  // CE-07: Legacy default identity check descriptor
  goldenCases.push({
    id: "CE-07",
    desc: "legacy gateChainFor(undefined) equivalence invariant",
    target: "GATE_CHAIN identity"
  });

  fs.writeFileSync(
    path.join(goldenDir, 'core_engine_golden.json'),
    JSON.stringify(goldenCases, null, 2) + '\n',
    'utf8'
  );
  console.log("✅ core_engine_golden.json captured with CE-01..CE-07.");
}

generateGoldenCorpora();
