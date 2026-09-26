# CogniCore — Phase D Task Tracking Checklist

## Phase D Implementation Checklist

- [x] **Step 0: Baseline & Environment Lock (Phase D−1)**
  - [x] Run full SQLite regression test suite to lock baseline.
  - [x] Verify MariaDB 10.6 (3306) and Frappe bench (8000) container connectivity.
  - [x] Execute `cognicore_ro` read-only grant script on MariaDB database.

- [x] **Step 1: Freeze Gate & Golden Safety Corpuses (Phase D0a)**
  - [x] Implement `test/audit-freeze.js` asserting zero diffs on 10 Tier-1 frozen files.
  - [x] Capture AST gate golden corpus (`test/golden/ast_gate_golden.json`, 35+ cases).

- [x] **Step 2: Capability Seam & Engine Re-Pins (Phase D0b)**
  - [x] Capture Core Engine golden corpus (`test/golden/core_engine_golden.json`, CE-01..CE-07).
  - [x] Capture capabilities golden corpus (`test/golden/capabilities_golden.json`).
  - [x] Re-Pin #1: Extract `capabilities.core.js`, create `capabilities.js` shim, implement `createCapabilitiesForSource`.
  - [x] Re-Pin #2: Update `core.engine.js` options signature and `capabilities` injection.
  - [x] Confirm `capabilities_golden.json` diff match 100% clean (both Tier-2 re-pins verified).
  - [x] Implement `switch.orchestrator.js` (`acquireQueryLease`, `releaseQueryLease`, `switchTo`).
  - [x] Wire `ai.controller.js` with lease acquire and `finally { releaseQueryLease }`.
  - [x] Verify SO-05 lease release on simulated error.

- [x] **Step 3: Dialect Engine & Protocol Adapters (Phase D0c)**
  - [x] Implement `backend/src/adapters/dialects/index.js` (`deepFreeze`, dialect definitions).
  - [x] Implement `sqlite.adapter.js` conforming to deep-frozen adapter contract.
  - [x] Implement `mariadb.adapter.js` (`mysql2/promise`, `pool.on('connection')` `ANSI_QUOTES` hook, read-only queries).
  - [x] Run and pass `test/verifyAdapters.js` and `test/verifyDialects.js`.

- [x] **Step 4: Security Gates & Call-Site Wiring (Phase D0d - Part 1)**
  - [x] Re-Pin #3: Extract `ast.gate.core.js`, create `ast.gate.mariadb.js`.
  - [x] Implement `gate.selector.js` with fail-closed `gateChainFor(sourceDescriptor)`.
  - [x] Wire `llm.link.js` to call `gateChainFor(ctx.capabilities.source)` and `executeReadOnlySql`.
  - [x] Assert `verifyGateSelector.js` validates both fail-closed on malformed/unknown dialect AND `gateChainFor(undefined) === GATE_CHAIN` identity equality.

- [x] **Step 5: Introspection & Schema Prompt Pack (Phase D0d - Part 2)**
  - [x] Extend `schema.reader.js` with MariaDB `information_schema` introspection matching contract.
  - [x] Update `sql.prompt.js` with MariaDB dialect prompt pack (≤ 300 tokens, backticks, date ranges).
  - [x] Run and pass `test/verify_mariadb_introspection.js`.

- [x] **Step 6: End-to-End Verification & Oracle Benchmarks (Phase D0e)**
  - [x] Execute Oracle Q1 (FY2024 Sales Invoice totals vs General Ledger).
  - [x] Execute Oracle Q2 (Active customer count vs Customer List).
  - [x] Confirm response `meta.source` and query trace explicitly prove execution on MariaDB adapter, not SQLite.
  - [x] Re-run full SQLite regression test suite (100% green).
  - [x] Run `test/audit-freeze.js` (zero Tier-1 diffs).
