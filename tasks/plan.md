# CogniCore — Phase D Implementation Working Plan

> **Scope:** Multi-Source Connectivity, Dynamic Dialect Gates, and ERPNext MariaDB Integration  
> **Rule:** Strict bottom-up dependency order. No step starts until the preceding exit criteria pass.

---

## The Build Order (Dependency Graph)

```
[ Step 0: Baseline & Environment ]
               │
               ▼
[ Step 1: Freeze Gate & Golden Safety Corpuses ]
               │
               ▼
[ Step 2: Capability Seam & Engine Re-Pins (core.engine.js, switch.orchestrator.js) ]
               │
               ▼
[ Step 3: Dialect Engine & Adapters (mariadb.adapter.js with pool.on, sqlite.adapter.js) ]
               │
               ▼
[ Step 4: Security Gates & Call-Site Wiring (gate.selector.js fail-closed, llm.link.js) ]
               │
               ▼
[ Step 5: Introspection & Schema Prompt Pack (information_schema, sql.prompt.js) ]
               │
               ▼
[ Step 6: End-to-End Oracle Queries & Parity Regression ]
```

---

## Detailed Step-by-Step Build Sequence

### Step 0: Baseline & Environment Lock (Phase D−1)
*Foundational verification before touching a single line of codebase code.*
1. **Run SQLite Baseline:** Execute existing test suite / `verifyFullRegression.sh` to confirm current 100% clean baseline.
2. **Environment Verification:** Confirm MariaDB 10.6 container (Port 3306) and Frappe bench container (Port 8000) are reachable on subnet `172.28.0.0/16`.
3. **Database Grants:** Execute `cognicore_ro` user setup script (`GRANT SELECT ON ...`) to lock read-only enforcement physically.
- **Exit Criteria:** Baseline tests pass 100%; MariaDB container returns TCP pong on 3306; user `cognicore_ro` cannot execute `INSERT/CREATE`.

---

### Step 1: Freeze Gate & Golden Corpuses (Phase D0a)
*Building the automated safety net that protects all Tier-1 frozen files.*
1. **Freeze Audit Script:** Build `test/audit-freeze.js` asserting zero git diffs on the 10 Tier-1 frozen files (`sql.validator.js`, `result.sanity.js`, `database.js`, etc.).
2. **AST Gate Golden Corpus:** Generate `test/golden/ast_gate_golden.json` capturing 35+ AST parsing/verdict pairs against existing SQLite rules.
- **Exit Criteria:** `node test/audit-freeze.js` exits 0; AST golden corpus exists and parses cleanly.

---

### Step 2: Capability Seam & Engine Re-Pins (Phase D0b)
*Refactoring the injection seam without altering engine behavior.*
1. **Golden Corpuses Generation:**
   - Generate `test/golden/core_engine_golden.json` (CE-01 through CE-07).
   - Generate `test/golden/capabilities_golden.json`.
2. **Re-Pin #1 — `capabilities.js`:**
   - Extract core singleton to `capabilities.core.js`.
   - Implement `capabilities.js` backward-compatibility shim.
   - Add `createCapabilitiesForSource(descriptor)`.
3. **Re-Pin #2 — `core.engine.js`:**
   - Update entry signature to `runCoreEngine(params, { pipeline, capabilities } = {})`.
   - Wire `activeCaps = customCapabilities || capabilities`.
4. **Switch Orchestrator & Lease Mechanism:**
   - Build `backend/src/kernel/switch.orchestrator.js` (`acquireQueryLease`, `releaseQueryLease`, `switchTo`).
5. **Controller Wiring:**
   - Update `ai.controller.js` to acquire query lease, inject active capabilities into `runCoreEngine`, and release lease in a guaranteed `finally` block.
- **Exit Criteria:** `verifyCoreEngineGolden.js` passes 100%; `capabilities_golden.json` diff match confirmed 100% clean (both Tier-2 re-pins verified); Case SO-05 passes (simulated engine throw releases query lease cleanly; no deadlocks).

---

### Step 3: Dialect Engine & Protocol Adapters (Phase D0c)
*Implementing isolated database communication drivers.*
1. **Dialect Engine:** Create `backend/src/adapters/dialects/index.js` with `deepFreeze` and dialect descriptors (`sqlite`, `mariadb`), identifier quoting, and date range formatting.
2. **SQLite Adapter:** Create `backend/src/adapters/sqlite.adapter.js` wrapping `config/database.js` into the uniform `{ connect, queryReadOnly, executeReadOnlySql, close, meta }` contract.
3. **MariaDB Adapter:**
   - Create `backend/src/adapters/mariadb.adapter.js` using `mysql2/promise`.
   - Attach pool-level lifecycle hook: `pool.on('connection', conn => conn.query("SET SESSION sql_mode = CONCAT(@@sql_mode, ',ANSI_QUOTES')"))`.
   - Enforce read-only querying, query timeouts, and error credential redaction.
4. **Adapter Tests:** Create and run `test/verifyAdapters.js` and `test/verifyDialects.js`.
- **Exit Criteria:** SQLite adapter passes byte-for-byte; MariaDB adapter enforces `ANSI_QUOTES` across recycled pool connections; mutations (`INSERT/DROP`) trigger permission errors; `verifyAdapters.js` exits 0.

---

### Step 4: Security Gates & Call-Site Wiring (Phase D0d - Part 1)
*Dialect-aware AST validation with fail-closed security.*
1. **Re-Pin #3 — `ast.gate.js`:**
   - Extract core parser to `ast.gate.core.js`.
   - Implement MariaDB sibling gate: `backend/src/llm/ast.gate.mariadb.js` (backtick support, `INTO OUTFILE/DUMPFILE` rejection, expanded function whitelist).
2. **Gate Selector:**
   - Build `backend/src/kernel/gate.selector.js`.
   - Implement `gateChainFor(sourceDescriptor)` strictly **failing closed** (throwing on missing, malformed, or unsupported dialect; falling back to SQLite only on unparameterized legacy calls).
3. **`llm.link.js` Wiring:**
   - Call `gateChainFor(ctx.capabilities.source)`.
   - Route SQL execution through `ctx.capabilities.db.executeReadOnlySql`.
- **Exit Criteria:** `verifyGateSelector.js` asserts both (a) fail-closed rejection on malformed or unrecognized dialects, AND (b) legacy-default path `gateChainFor()` / `gateChainFor(undefined)` resolves strictly to the frozen `GATE_CHAIN` by identity (`=== GATE_CHAIN`); AST golden test matches 100% in SQLite mode and verifies backtick/OUTFILE rules in MariaDB mode.

---

### Step 5: Introspection & Schema Prompt Pack (Phase D0d - Part 2)
*Extracting MariaDB metadata and parameterizing the LLM prompt.*
1. **Schema Reader Extension:**
   - Extend `backend/src/kernel/schema.reader.js` to query MariaDB `information_schema` for tables and columns, returning the identical contract shape as SQLite.
   - Annotate ERPNext fields (`docstatus`, `tab*`, `naming_series`).
2. **SQL Prompt Parameterization:**
   - Update `sql.prompt.js` with dialect pack (≤ 300 tokens): MariaDB header, backtick quoting, `docstatus = 1` rules, and date range-predicate instructions (`col >= ... AND col < ...`).
- **Exit Criteria:** `verify_mariadb_introspection.js` passes on ERPNext container tables with exact schema contract shape; prompt token budget overhead ≤ 300 tokens.

---

### Step 6: End-to-End Verification & Oracle Benchmarks (Phase D0e)
*Empirical verification on live ERPNext data and full regression audit.*
1. **Oracle Queries against MariaDB Container:**
   - **Q1:** FY2024 total Sales Invoice grand total verified against General Ledger balance.
   - **Q2:** Total count of active Customers matching ERPNext customer list.
2. **Provenance Verification:**
   - Verify query trace and response `meta.source` explicitly confirms execution against the ERPNext adapter (`mariadb`), not SQLite.
3. **S16 Honest Baseline Verification:**
   - Verify chart dimensions and unresolvable queries fail honestly or clarify rather than hallucinate SQL.
4. **Full Battery Regression:**
   - Run complete SQLite baseline suite (`verifyFullRegression.sh`).
   - Run `node test/audit-freeze.js` to confirm all 10 Tier-1 files remain 100% identical.
- **Exit Criteria:** Oracle Q1 & Q2 return ground-truth figures; response `meta.source` confirms execution against ERPNext adapter; SQLite regression 100% green; audit freeze check passes with zero diffs.
