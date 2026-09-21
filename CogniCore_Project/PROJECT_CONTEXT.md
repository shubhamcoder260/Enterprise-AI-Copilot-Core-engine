# COGNICORE — DEFINITIVE PROJECT CONTEXT & STATE ARCHITECTURE

> **Document Status:** CANONICAL & DEFINITIVE  
> **Compilation Date:** September 21, 2026  
> **Repository Commit (HEAD):** `9367b6d` (synced with `myrepo/main`)  
> **Method Law:** Every file claim is grounded in direct codebase inspection. Where legacy documentation or memory contradicts the code on disk, the CODE wins and the discrepancy is codified in [§5 Doc-Drift Findings](#5-doc-drift-findings).

---

## Table of Contents
- [§0 Inventory & Delta-Detection](#0-inventory--delta-detection)
  - [0.1 Raw Git History & Status](#01-raw-git-history--status)
  - [0.2 Recursive File Inventory & Line Counts](#02-recursive-file-inventory--line-counts)
  - [0.3 Delta Analysis: Disk vs Seed Inventory](#03-delta-analysis-disk-vs-seed-inventory)
- [§1 Per-File Architectural Dossiers](#1-per-file-architectural-dossiers)
  - [1.1 Server & Infrastructure (`server.js`)](#11-server--infrastructure-serverjs)
  - [1.2 Configuration Layer (`config/*`)](#12-configuration-layer-config)
  - [1.3 Controllers (`controllers/*`)](#13-controllers-controllers)
  - [1.4 Kernel Bedrock (`kernel/*`)](#14-kernel-bedrock-kernel)
  - [1.5 Core Engine & Links (`core/*`)](#15-core-engine--links-core)
  - [1.6 LLM Adapter & Validators (`llm/*`)](#16-llm-adapter--validators-llm)
  - [1.7 Routes & Stores (`routes/*`, `store/*`)](#17-routes--stores-routes-store)
  - [1.8 Configured Analytics Tools (`tools/*`)](#18-configured-analytics-tools-tools)
  - [1.9 Frontend Architecture (`frontend/src/*`)](#19-frontend-architecture-frontendsrc)
- [§2 Architecture & Execution Flows](#2-architecture--execution-flows)
  - [2.1 Request Lifecycle Trace (File:Line Anchors & Reason Codes)](#21-request-lifecycle-trace-fileline-anchors--reason-codes)
  - [2.2 The 3-Tier Security Chain & Open Edges](#22-the-3-tier-security-chain--open-edges)
  - [2.3 Data Lifecycle (Singletons, ReadOnly, SwitchQueue, WAL History)](#23-data-lifecycle-singletons-readonly-switchqueue-wal-history)
  - [2.4 Presentation & Formatting Flow (Sanity → Registry → Visualizer)](#24-presentation--formatting-flow-sanity--registry--visualizer)
  - [2.5 Extension Points Map ("To Add X, Touch Y")](#25-extension-points-map-to-add-x-touch-y)
- [§3 Test Arsenal Inventory & Quality Assurance](#3-test-arsenal-inventory--quality-assurance)
  - [3.1 The Canonical Battery (`verifyFullRegression.sh`)](#31-the-canonical-battery-verifyfullregressionsh)
  - [3.2 Full Test Suite Catalog (56 Test Scripts Analyzed)](#32-full-test-suite-catalog-56-test-scripts-analyzed)
  - [3.3 Unit & Invariant Test Matrices](#33-unit--invariant-test-matrices)
  - [3.4 The Stability Protocol (Mode of 3 Runs)](#34-the-stability-protocol-mode-of-3-runs)
- [§4 Canon, Doctrine & System State](#4-canon-doctrine--system-state)
  - [4.1 Canon Document Summaries](#41-canon-document-summaries)
  - [4.2 Frozen / Locked Files Governance](#42-frozen--locked-files-governance)
  - [4.3 The Two Primary Bug Classes](#43-the-two-primary-bug-classes)
  - [4.4 Operational Hazards (H1–H10)](#44-operational-hazards-h1h10)
  - [4.5 Open Edges Ledger & Dispositions](#45-open-edges-ledger--dispositions)
  - [4.6 Current Empirical Scoreboard](#46-current-empirical-scoreboard)
  - [4.7 Queued Work Post-B7](#47-queued-work-post-b7)
- [§5 Doc-Drift Findings](#5-doc-drift-findings)
- [§6 "How to Continue" Playbook](#6-how-to-continue-playbook)

---

## §0 Inventory & Delta-Detection

### 0.1 Raw Git History & Status

```
$ git status --short
(clean — nothing to commit, working tree clean)

$ git log --oneline -25
9367b6d (HEAD -> main, myrepo/main) test(parity): add M1-M10 live parity and Visualizer verification battery
d4fd128 refactor(frontend): slim main.jsx composition root to <120 lines
5101941 feat(frontend): extract ChatWindow component
3dab426 feat(frontend): polymorphic Visualizer component with Vega-Lite support
1c92cfd feat(frontend): extract SqlModal component
878c53c feat(frontend): extract DatabaseSidebar component
a73e363 feat(frontend): extract lib/api.js network layer
437a80f docs(record): B6 closure — A-L1 friendly-direction proofs, scoreboard attributions, stability protocol, distractor edge, few-shot resolution
992812d fix(core): pruner relative-candidate threshold — distractor exclusion
7b3d935 docs(record): PART_B_RECORD.md — B6 section + B2 rider closures
d5a1952 feat(core): series adapter, grouping guard, report/chartSpec assembly
9a3d279 feat(core): presentation intent detector + prompt shape hints
9873ba3 fix(core): scoreTables token-equality (R1) — exact normalized match on sample values
a05e8c0 docs(record): PART_B_RECORD.md — Step 6 (B2) measurements, S12 & O2 resolution, realm scores
3d79544 feat(core): top-K sub-schema pruner — token scoring, topK cap, FK closure preserving intermediate tables
61e2316 feat(core): schema extension hook — frozen schemaAliases dictionary, exact-match resolver fallback, prompt notes
9b3ca1b docs(roadmap): B1 complete in Part B queue
c903777 feat(core): wire format field via ai.controller selectFormat + scalar prose fix in llm.formatter
ccc1931 feat(kernel): formatter registry — kpi/table/chartSpec/report/csv, closed-shape frozen map, purity+determinism+injection tests
a83ba21 docs(canon): A4 record corrections (5391, S4/S6 descriptions, lineage, old mysteries)
5e9aad4 fix(core): restore verbatim derivation semantics in semantic profile
afa3443 docs(canon): MASTER_CONTEXT v2.0 — Part A complete, Part B begins
63b9638 docs(record): Part A measurement record (docs/PART_A_RECORD.md)
04915fd refactor(core): M4 hardcode family -> semantic.profile.js (code + TODO removals; after W1a-W1d green)
5e10cc3 docs(roadmap): record Decision O6 LLM timeout policy (75000ms)
```

---

### 0.2 Recursive File Inventory & Line Counts

Exact physical line count across all source code, tests, schemas, configs, and documentation:

```
Total Lines | Path
------------|------------------------------------------------------------------
        766 | CogniCore_Project/docs/AUDIT_REPORT.md
        657 | CogniCore_Project/COGNICORE_CODEBASE_AUDIT_AND_DECOMPOSITION.md
        501 | CogniCore_Project/backend/src/core/fastIntent.js
        393 | CogniCore_Project/backend/src/controllers/ai.controller.js
        389 | CogniCore_Project/backend/src/kernel/ast.gate.js
        364 | CogniCore_Project/backend/src/core/response.formatter.js
        338 | CogniCore_Project/backend/test/verifyFormatterRegistry.js
        325 | CogniCore_Project/backend/src/core/sql.builder.js
        298 | CogniCore_Project/frontend/src/lib/formatRenderers.jsx
        290 | CogniCore_Project/backend/test/verifyLlm1ValidatorSecurity.js
        290 | CogniCore_Project/backend/src/config/database.js
        279 | CogniCore_Project/backend/src/kernel/formatter.registry.js
        271 | CogniCore_Project/backend/test/verify_ast_gate.js
        270 | CogniCore_Project/frontend/src/components/SqlModal.jsx
        270 | CogniCore_Project/backend/src/core/links/llm.link.js
        258 | CogniCore_Project/frontend/src/components/DatabaseSidebar.jsx
        251 | CogniCore_Project/backend/src/llm/sql.prompt.js
        251 | CogniCore_Project/backend/src/core/schema.pruner.js
        249 | CogniCore_Project/backend/test/runPartDEcommerceBenchmark.js
        240 | CogniCore_Project/backend/test/verify_college_attendance.js
        239 | CogniCore_Project/backend/test/verify_m1_m10_parity.js
        224 | CogniCore_Project/frontend/src/components/ChatWindow.jsx
        223 | CogniCore_Project/backend/database/gen_hospital.js
        222 | CogniCore_Project/backend/src/core/schema.reader.js
        221 | CogniCore_Project/backend/test/lib/validator.js
        218 | CogniCore_Project/backend/test/generateEcommerceDb.js
        211 | CogniCore_Project/backend/test/verify_m2_result_sanity.js
        204 | CogniCore_Project/backend/database/gen_fooddelivery.js
        203 | CogniCore_Project/PART1_REPORT.md
        194 | CogniCore_Project/backend/database/gen_university.js
        192 | CogniCore_Project/backend/database/gen_bank.js
        189 | CogniCore_Project/backend/src/llm/llm.client.js
        184 | CogniCore_Project/backend/test/runRealmFull.js
        183 | test/verifyVisualizer.js
        177 | CogniCore_Project/backend/test/runPartBParityBenchmark.js
        176 | CogniCore_Project/backend/src/core/schema.resolver.js
        164 | CogniCore_Project/backend/src/tools/hospital/cardiology.tool.js
        161 | CogniCore_Project/backend/test/test_phase2_fast_intent_units.js
        154 | CogniCore_Project/backend/test/verifyP3_2FollowUp.js
        151 | CogniCore_Project/backend/src/core/result.sanity.js
        146 | CogniCore_Project/backend/test/verify_m1_corrective_retry.js
        144 | CogniCore_Project/backend/src/core/dynamic.query.engine.js
        144 | CogniCore_Project/backend/database/gen_industry.js
        140 | test/verifySchemaPruner.js
        140 | CogniCore_Project/backend/test/verify_m1_live_specimens.js
        136 | CogniCore_Project/backend/src/store/history.store.js
        135 | CogniCore_Project/backend/src/llm/sql.validator.js
        134 | CogniCore_Project/backend/src/tools/education/cgpa.tool.js
        130 | CogniCore_Project/backend/test/verify_categorical_value_precision.js
        127 | CogniCore_Project/backend/test/verifyErpGroundTruth.js
        125 | CogniCore_Project/PART1_COMPLETION.md
        123 | CogniCore_Project/backend/test/suites/hospital.json
        122 | CogniCore_Project/frontend/src/lib/api.js
        115 | CogniCore_Project/frontend/src/main.jsx
        114 | CogniCore_Project/backend/test/verifyP3_3SessionIsolation.js
        112 | CogniCore_Project/backend/test/verifyP3_5SurvivesSwitch.js
        111 | CogniCore_Project/backend/test/verifyTest6SlowDisk.js
        110 | CogniCore_Project/backend/test/runRealms.js
        109 | CogniCore_Project/backend/test/verifyP3_1Persistence.js
        109 | CogniCore_Project/backend/src/controllers/database.controller.js
        108 | CogniCore_Project/backend/test/verifyConnLifecycle.js
        106 | CogniCore_Project/backend/test/verifyP3_4Hydration.js
        103 | CogniCore_Project/backend/PART1_DISCOVERY.md
         97 | CogniCore_Project/backend/test/verifyTest6NonBlocking.js
         97 | CogniCore_Project/backend/test/specimens/university-specimens.json
         96 | CogniCore_Project/backend/test/verifyLlm5ComplexJoin.js
         96 | CogniCore_Project/backend/src/core/distinct.cache.js
         95 | CogniCore_Project/backend/test/verifyLlm7GarbageOutput.js
         94 | CogniCore_Project/backend/test/verifyP3_6PromptOverhead.js
         92 | CogniCore_Project/backend/test/verifyLlm8HallucinatedTable.js
         92 | CogniCore_Project/backend/src/core/core.engine.js
         91 | CogniCore_Project/backend/test/verifyTest4FailedSwitch.js
         91 | CogniCore_Project/backend/test/verify_m3_ratio_recognizer.js
         90 | CogniCore_Project/backend/test/verifyPhase2StalenessTrap.js
         87 | CogniCore_Project/backend/test/verifyLlm10ThinkStripping.js
         86 | CogniCore_Project/backend/test/verifyTest2SwitchInvalidation.js
         85 | CogniCore_Project/backend/test/verifyLlm4SimpleRetrieval.js
         85 | CogniCore_Project/backend/test/test_phase3_distinct_cache.js
         85 | CogniCore_Project/backend/test/specimens/industry-specimens.json
         85 | CogniCore_Project/backend/database/setupDatabase.js
         83 | CogniCore_Project/backend/test/suites/university.json
         83 | CogniCore_Project/backend/src/core/guard-markers.js
         80 | CogniCore_Project/backend/test/verifyLlm6AdversarialQuestion.js
         80 | CogniCore_Project/backend/src/tools/education/foreign-student.tool.js
         76 | CogniCore_Project/backend/test/verifyLlm8ModelPickerEndpoint.js
         74 | CogniCore_Project/backend/test/verifyLlm9OfflineFailover.js
         74 | CogniCore_Project/backend/src/routes/database.routes.js
         72 | CogniCore_Project/backend/src/llm/llm.formatter.js
         71 | CogniCore_Project/backend/src/config/semantic.profile.js
         70 | CogniCore_Project/backend/test/suites/bank.json
         69 | test/verifySchemaAliases.js
         66 | test/verifyPresentationIntent.js
         65 | CogniCore_Project/backend/test/verifyLlm8EndToEndModelOverride.js
         65 | CogniCore_Project/backend/test/verifyLlm2ClientContract.js
         64 | CogniCore_Project/backend/test/suites/industry.json
         64 | CogniCore_Project/backend/src/core/presentation.intent.js
         62 | CogniCore_Project/backend/test/verifyTest3ConcurrentSwitch.js
         62 | CogniCore_Project/backend/test/suites/fooddelivery.json
         61 | CogniCore_Project/frontend/src/components/Visualizer.jsx
         61 | CogniCore_Project/backend/test/verifyLlm3ReadOnlyPhysical.js
         61 | CogniCore_Project/backend/test/specimens/fooddelivery-specimens.json
         61 | CogniCore_Project/backend/test/specimens/bank-specimens.json
         60 | CogniCore_Project/backend/src/core/links/tool.link.js
         53 | CogniCore_Project/backend/test/verifyValidatorUnit.js
         53 | CogniCore_Project/backend/test/verifyCacheHitMiss.js
         51 | CogniCore_Project/backend/src/server.js
         50 | CogniCore_Project/backend/src/core/query.executor.js
         49 | CogniCore_Project/backend/test/specimens/hospital-specimens.json
         46 | CogniCore_Project/backend/test/specimens/ecommerce-specimens.json
         46 | CogniCore_Project/backend/src/core/intent.detector.js
         40 | CogniCore_Project/backend/test/specimens/chinook-specimens.json
         32 | CogniCore_Project/backend/src/core/links/dynamic.link.js
         31 | CogniCore_Project/backend/test/testActiveDatabase.js
         31 | CogniCore_Project/backend/src/core/links/fallback.link.js
         27 | CogniCore_Project/backend/package.json
         23 | CogniCore_Project/backend/test/verifyPipelineOverride.js
         21 | CogniCore_Project/frontend/package.json
         20 | CogniCore_Project/backend/src/kernel/handler-result.js
         19 | CogniCore_Project/backend/test/verifyLitmusNewTool.js
         16 | CogniCore_Project/backend/test/verifyFullRegression.sh
         16 | CogniCore_Project/backend/src/kernel/pipeline.config.js
         15 | CogniCore_Project/backend/src/kernel/gate.chain.js
         14 | CogniCore_Project/backend/src/kernel/capabilities.js
         13 | CogniCore_Project/backend/src/core/tool.router.js
         12 | CogniCore_Project/backend/src/routes/ai.routes.js
          9 | CogniCore_Project/frontend/README.md
          8 | CogniCore_Project/README.md
          8 | CogniCore_Project/backend/test/verifyGateIntegrity.js
          6 | CogniCore_Project/backend/test/verifyTraceEvidence.js
          6 | CogniCore_Project/backend/test/testSchema.js
          5 | CogniCore_Project/backend/nodemon.json
          4 | CogniCore_Project/backend/test/verifyBypass.js
          4 | CogniCore_Project/backend/src/llm/schema.notes.json
          2 | CogniCore_Project/backend/active-database.json
```

---

### 0.3 Delta Analysis: Disk vs Seed Inventory

| Seed Item | Disk Path / Status | Classification | Finding & Analysis |
|---|---|---|---|
| `backend/src/*` (41 files) | `CogniCore_Project/backend/src/*` | **MATCH** | All 41 backend files present and accounted for verbatim. |
| `frontend/src/*` (8 files) | `CogniCore_Project/frontend/src/*` | **MATCH** | All 8 frontend files (`main.jsx`, 4 components, 2 lib files, CSS) present. |
| `docs & root: MASTER_CONTEXT.md` | `Cognicore/MASTER_CONTEXT.md` | **MATCH** | Located at root of git repository (`Cognicore/`). |
| `docs & root: PART_A_RECORD.md` | `Cognicore/docs/PART_A_RECORD.md` | **PATH DELTA** | Seed listed it at "docs & root"; it resides specifically in `docs/`. |
| `docs & root: PART_B_RECORD.md` | `Cognicore/docs/PART_B_RECORD.md` | **PATH DELTA** | Seed listed it at "docs & root"; it resides specifically in `docs/`. |
| `docs & root: ROADMAP.md` | `Cognicore/ROADMAP.md` | **MATCH** | Located at repository root. |
| `docs & root: STEP0_AUDIT_REPORT.md` | `CogniCore_Project/docs/AUDIT_REPORT.md` | **NAME/PATH DELTA** | Preserved on disk as `AUDIT_REPORT.md` inside `CogniCore_Project/docs/` and root `COGNICORE_CODEBASE_AUDIT_AND_DECOMPOSITION.md`. |
| `docs & root: package.json (both)` | `backend/package.json`, `frontend/package.json` | **PATH DELTA** | No root `package.json` exists; package manifests are scoped to `backend` and `frontend`. |
| `test/` directory at root | `Cognicore/test/` (4 suites) | **UNLISTED LOCATION** | Part B test suites (`verifyPresentationIntent.js`, `verifySchemaAliases.js`, `verifySchemaPruner.js`, `verifyVisualizer.js`) reside in root `test/` rather than `backend/test/`. |
| `database_test/` directory | `Cognicore/database_test/` | **UNEXPLAINED NEW DIR** | Contains benchmark SQLite files (`chinook.db`, `student_erp.db`, `sqlite-sakila.db`, `erp_demo.db`) and generator scripts (`db.py`, `erp_demo_db.py`). |
| `backend/test/suites/*.json` | `backend/test/suites/` (5 files) | **UNLISTED NEW FILES** | Realm test definitions (`bank.json`, `fooddelivery.json`, `hospital.json`, `industry.json`, `university.json`). |
| `backend/test/specimens/*.json` | `backend/test/specimens/` (7 files) | **UNLISTED NEW FILES** | Golden specimen fixtures for bank, chinook, ecommerce, fooddelivery, hospital, industry, university. |
| Supplemental Docs | Root & Project Root | **UNLISTED NEW FILES** | `ARCHITECTURE.md`, `GETTING_STARTED.md`, `SECURITY.md`, `TESTING.md`, `LICENSE`, `PART1_COMPLETION.md`, `PART1_REPORT.md`, `START_HERE.txt`, `backend/PART1_DISCOVERY.md`. |

---

## §1 Per-File Architectural Dossiers

### 1.1 Server & Infrastructure (`server.js`)

#### `backend/src/server.js` (51 lines)
- **PURPOSE:** Application entry point. Bootstraps the Express HTTP server, applies standard middlewares (CORS, JSON parser, static upload serving), mounts REST routers, runs initial database connection verification, and exposes the `/health` diagnostic endpoint.
- **WHY IT EXISTS:** Root runtime harness established in pre-A era to serve API traffic to the browser and verify operational status on port 5000.
- **KEY EXPORTS:** Default export of the initialized Express `app` instance.
- **CONSUMES:** `express`, `cors`, `path`, `url`, `dotenv/config`, `config/database.js` (`connectDatabase`), `routes/ai.routes.js`, `routes/database.routes.js`.
- **CONSUMED BY:** `backend/test/verifyErpGroundTruth.js`, `backend/test/runRealms.js`, `backend/test/runRealmFull.js`.
- **INVARIANTS:** Must initialize `dotenv` at boot before loading database credentials (Hazard H1); must catch initial DB connection failure gracefully without unhandled process crashes.
- **STATUS:** STABLE.
- **TESTS:** `verifyErpGroundTruth.js`, `verifyFullRegression.sh` (proves port 5000 `/health` responds with JSON status).

---

### 1.2 Configuration Layer (`config/*`)

#### `backend/src/config/database.js` (290 lines)
- **PURPOSE:** SQLite database connection manager and transaction serializer. Houses the persistent connection singletons (`db`, `readOnlyDb`), serialized switch queue, asynchronous switch hook dispatcher, and runtime database pointer resolution.
- **WHY IT EXISTS:** Pre-A legacy architecture suffered from race conditions during DB switches and `SQLITE_MISUSE` crashes. Overhauled in A1 to enforce single-flight serialized database switches, physical `OPEN_READONLY` separation, and active database pointer persistence.
- **KEY EXPORTS:**
  - `getActiveDatabasePath()`: Resolves active DB path honoring `COGNICORE_ACTIVE_DB` env override, `backend/active-database.json`, or default fallback.
  - `saveActiveDatabasePath(filePath)`: Atomically updates `active-database.json`.
  - `connectDatabase()`: Returns read-write connection singleton (`db`).
  - `connectReadOnlyDatabase()`: Returns `OPEN_READONLY` connection singleton (`readOnlyDb`).
  - `executeReadOnlySql(sql, params)`: Executes SQL query strictly on `readOnlyDb` using `conn.all()`.
  - `switchDatabase(newDatabasePath)`: Serializes database switches through a FIFO promise queue (`switchQueue`), closes existing singletons, updates active pointer, and fires registered `switchHooks`.
  - `registerSwitchHook(fn)`: Registers callback to be invoked on every successful database switch.
  - `clearSwitchHooks()`: Clears all switch hooks (test teardown).
  - `closeDatabase()`: Closes connection singletons and clears references.
- **CONSUMES:** `sqlite3`, `sqlite` (`open`), `path`, `fs/promises`, `url`, `dotenv/config`.
- **CONSUMED BY:** 46 files across repo (primary data backbone: `server.js`, `database.controller.js`, `distinct.cache.js`, `query.executor.js`, `ast.gate.js`, `capabilities.js`, `llm.link.js`, etc.).
- **INVARIANTS:** Driver is strictly `sqlite3` + `sqlite` wrapper (NEVER `better-sqlite3`); physical read-only connection must open with `sqlite3.OPEN_READONLY`; database switches must be strictly serialized via `switchQueue`; file existence checks must be non-blocking via `fs.access`.
- **STATUS:** STABLE / FROZEN KERNEL INFRASTRUCTURE.
- **TESTS:** `verifyConnLifecycle.js`, `verifyTest2SwitchInvalidation.js`, `verifyTest3ConcurrentSwitch.js`, `verifyTest4FailedSwitch.js`, `verifyTest6SlowDisk.js`, `verifyTest6NonBlocking.js`, `verifyLlm3ReadOnlyPhysical.js`.

#### `backend/src/config/semantic.profile.js` (71 lines)
- **PURPOSE:** Declarative domain knowledge dictionary. Centralizes calculation rules (`derivations`), active status indicators (`statusMarkers`), primary identifier tokens (`scalarIdNames`), and legacy schema synonym mappings (`schemaAliases`).
- **WHY IT EXISTS:** Created in Step A4 (Commit `04915fd`) to honor Promise #4: completely remove hardcoded domain logic from core engine parsers (`fastIntent.js`, `sql.builder.js`) and place them in a declarative profile. Expanded in B2 (Commit `61e2316`) with `schemaAliases` to break the Synonym Wall (S12).
- **KEY EXPORTS:**
  - `SEMANTIC_PROFILE`: Frozen dictionary containing:
    - `derivations`: Maps terms like `"absent"` / `"absence"` to `{ column: "attendance", formula: "100.0 - AVG({col})" }`.
    - `statusMarkers`: Maps statuses (`"completed"`, `"active"`, `"pending"`) to target columns and allowed states.
    - `scalarIdNames`: Set of recognized ID column basenames (`"student_id"`, `"id"`, `"roll_no"`, etc.).
    - `schemaAliases`: Maps domain terms to abbreviated legacy tables (`"students"` → `"stus"`, `"machines"` → `"mcs"`, `"accounts"` → `"accts"`, `"restaurants"` → `"rst"`, `"patients"` → `"pts"`).
- **CONSUMES:** None (pure JS dictionary).
- **CONSUMED BY:** `fastIntent.js`, `guard-markers.js`, `sql.builder.js`, `schema.resolver.js`, `schema.pruner.js`, `sql.prompt.js`, `test/verifySchemaAliases.js`.
- **INVARIANTS:** Must remain a pure, frozen configuration dictionary with zero side-effects; all derivations must be non-destructive formulas; table aliases must be lowercase normalized.
- **STATUS:** FROZEN.
- **TESTS:** `test/verifySchemaAliases.js`, `verify_college_attendance.js` (Q4 derivation), `test_phase2_fast_intent_units.js`.

---

### 1.3 Controllers (`controllers/*`)

#### `backend/src/controllers/ai.controller.js` (393 lines)
- **PURPOSE:** Primary AI query orchestration controller. Manages HTTP query requests (`handleQuery`), session history logging, available model polling (`getAvailableModels`), presentation formatting (`selectFormat`), series transformation for charts (`seriesFromRecords`), and grouping integrity enforcement (`checkGroupingGuard`).
- **WHY IT EXISTS:** Core request gateway serving `/api/ai/query`. Updated in B1 to add polymorphic format assignment, in B6 to add series transformation and Vega-Lite spec binding, and in B7 to support frontend chat client requests.
- **KEY EXPORTS:**
  - `handleQuery(req, res)`: Express POST handler. Validates payload, invokes `executeCorePipeline`, writes exchange to `history.store.js`, executes `selectFormat()`, and returns standard `{ answer, source, data, meta, format }` envelope.
  - `getAvailableModels(req, res)`: Express GET handler. Polls Ollama `/api/tags` and returns local model list.
  - `getSessionHistory(req, res)`: Express GET handler. Retrieves full multi-turn conversation from `history.store.js`.
  - `seriesFromRecords(records)`: Transforms array of SQL row objects into Vega-Lite compatible named series `{ name, values }`.
  - `checkGroupingGuard(records, series)`: Enforces that multi-series charts have at least two distinct grouping values; falls back to single-series if cardinality ≤ 1.
  - `selectFormat(payload, query)`: Assigns polymorphic format (`kpi`, `table`, `chartSpec`, `report`, `csv`) based on data shape and query presentation intent.
- **CONSUMES:** `core/core.engine.js`, `core/presentation.intent.js`, `kernel/formatter.registry.js`, `store/history.store.js`, `dotenv/config`.
- **CONSUMED BY:** `routes/ai.routes.js`, `backend/test/verifyFormatterRegistry.js`, `test/verifyVisualizer.js`.
- **INVARIANTS:** The response contract `{ answer, source, data, meta }` is strictly additive-only; formatting failures must never crash or invalidate the underlying answer; presentation is presentation-only (never alters data values).
- **STATUS:** ACTIVE / STABLE.
- **TESTS:** `verifyFormatterRegistry.js`, `test/verifyVisualizer.js`, `verifyFullRegression.sh`.

#### `backend/src/controllers/database.controller.js` (109 lines)
- **PURPOSE:** Database lifecycle controller. Handles SQLite file uploads (`uploadDatabase`), active database inspection (`getActiveDatabase`), and runtime database switching (`switchActiveDatabase`).
- **WHY IT EXISTS:** Allows users and automated benchmarks to dynamically mount different SQLite databases via `/api/database/*` endpoints.
- **KEY EXPORTS:**
  - `uploadDatabase(req, res)`: Validates uploaded file's SQLite magic header (`SQLite format 3`), triggers `switchDatabase`, and responds with status.
  - `getActiveDatabase(req, res)`: Reads and returns the current active DB path and filename.
  - `switchActiveDatabase(req, res)`: Validates path, triggers serialized `switchDatabase`, and returns the switched active DB name.
- **CONSUMES:** `config/database.js` (`switchDatabase`, `getActiveDatabasePath`), `fs/promises`, `path`.
- **CONSUMED BY:** `routes/database.routes.js`.
- **INVARIANTS:** Physical file header must begin with exact 16-byte magic header `SQLite format 3\0`; paths must exist before switching; all switches must be awaited through `switchDatabase`.
- **STATUS:** STABLE.
- **TESTS:** `verifyConnLifecycle.js`, `verifyTest2SwitchInvalidation.js`, `verifyTest4FailedSwitch.js`.

---

### 1.4 Kernel Bedrock (`kernel/*`)

#### `backend/src/kernel/handler-result.js` (20 lines)
- **PURPOSE:** Pipeline result vocabulary factory. Defines the closed set of outcome constructors (`ANSWERED`, `PASS`, `ABSTAIN`, `BUG`) and provides type validation (`isHandlerResult`).
- **WHY IT EXISTS:** Created in Step A0 to eliminate ambiguous `null`/`undefined` returns across pipeline links. Enforces structured cascade semantics where every link explicitly declares its outcome and reason.
- **KEY EXPORTS:**
  - `ANSWERED(payload)`: Outcome indicating the link satisfied the query.
  - `PASS(reason, payload)`: Outcome indicating the link declined; passes execution to the next link with an auditable reason.
  - `ABSTAIN(reason)`: Outcome indicating the query should not proceed further.
  - `BUG(reason, err)`: Outcome indicating an internal failure requiring alert.
  - `isHandlerResult(outcome)`: Type guard validating that an object contains a valid `status` from `HANDLER_STATUSES`.
- **CONSUMES:** None (pure JS).
- **CONSUMED BY:** `core.engine.js`, `links/dynamic.link.js`, `links/fallback.link.js`, `links/llm.link.js`, `links/tool.link.js`.
- **INVARIANTS:** Pure vocabulary; every status must match `HANDLER_STATUSES` enum; immutability of status contracts.
- **STATUS:** FROZEN KERNEL BEDROCK.
- **TESTS:** `verifyPipelineOverride.js`, `verifyGateIntegrity.js`, `verifyTraceEvidence.js`.

#### `backend/src/kernel/pipeline.config.js` (16 lines)
- **PURPOSE:** Declarative pipeline definition. Specifies the exact sequence and link handlers that execute incoming queries.
- **WHY IT EXISTS:** Established in Step A0 to decouple the pipeline order from `core.engine.js`. Allows deterministic ordering and easy injection of test links.
- **KEY EXPORTS:**
  - `DEFAULT_PIPELINE`: Array of link descriptors in fixed order:
    1. `Configured Tools` (`executeToolLink`)
    2. `Dynamic Query Engine` (`executeDynamicLink`)
    3. `Local LLM` (`executeLlmLink`)
    4. `Helpful Fallback` (`executeFallbackLink`)
- **CONSUMES:** `links/tool.link.js`, `links/dynamic.link.js`, `links/llm.link.js`, `links/fallback.link.js`.
- **CONSUMED BY:** `core/core.engine.js`.
- **INVARIANTS:** The 4 links must execute in strict order: Tools → Dynamic → LLM → Fallback; no link may be reordered without explicit governance review.
- **STATUS:** FROZEN KERNEL BEDROCK.
- **TESTS:** `verifyPipelineOverride.js`, `verifyTraceEvidence.js`.

#### `backend/src/kernel/gate.chain.js` (15 lines)
- **PURPOSE:** Declarative security gate chain definition. Assembles the sequential validation and execution gates that guard LLM-generated SQL.
- **WHY IT EXISTS:** Built in Step A1 to ensure that all SQL execution paths pass through both syntax/command validation, AST structural checks, and physical read-only execution.
- **KEY EXPORTS:**
  - `GATE_CHAIN`: Array of gate descriptors:
    1. `{ name: "sql-validator", type: "validate", run: validateAndSanitizeSql }`
    2. `{ name: "ast-gate", type: "validate", run: validateAst }`
    3. `{ name: "readonly-executor", type: "execute", run: executeReadOnlySql }`
- **CONSUMES:** `llm/sql.validator.js`, `kernel/ast.gate.js`, `config/database.js`.
- **CONSUMED BY:** `links/llm.link.js`, `backend/test/verifyGateIntegrity.js`, `backend/test/verify_ast_gate.js`.
- **INVARIANTS:** Order is inviolable: Layer 1 Validator → Layer 1.5 AST Gate → Layer 3 Read-Only Executor; no SQL can execute without passing all validate gates.
- **STATUS:** FROZEN KERNEL BEDROCK.
- **TESTS:** `verifyGateIntegrity.js`, `verify_ast_gate.js`.

#### `backend/src/kernel/ast.gate.js` (389 lines)
- **PURPOSE:** Layer 1.5 AST structural validator. Uses `node-sql-parser` to parse SQL queries into an Abstract Syntax Tree and validates database schema conformance, allowed function whitelisting, and strict `ONLY_FULL_GROUP_BY` / Primary Key Functional Dependency (PK-FD) rules.
- **WHY IT EXISTS:** Created in Step A2 (locked at commit `c29e0dc`) to defeat the silent-wrong aggregation failure class (Specimens S1, S1-LLM, S10) where SQLite returns arbitrary scalar rows when non-aggregated columns are projected without grouping.
- **KEY EXPORTS:**
  - `validateAst(sql, options)`: Analyzes SQL AST against `options.schema`.
    - Enforces function whitelist: `COUNT`, `SUM`, `AVG`, `MIN`, `MAX`, `ROUND`, `LOWER`, `UPPER`, `strftime`.
    - Enforces schema table and column existence.
    - Enforces `ONLY_FULL_GROUP_BY`: if aggregate functions are present, all bare projected columns must appear in `GROUP BY`, unless the table's primary key (including composite PK) is grouped.
- **CONSUMES:** `node-sql-parser`, `llm/sql.validator.js` (`cleanLlmSql`).
- **CONSUMED BY:** `kernel/gate.chain.js`, `backend/test/verify_ast_gate.js`.
- **INVARIANTS:** FROZEN (c29e0dc). Receives full unpruned schema (Invariant R2); pure function; never mutates SQL; rejects schema-unknown entities; strictly blocks bare non-aggregated projections.
- **STATUS:** FROZEN (c29e0dc).
- **TESTS:** `verify_ast_gate.js` (12 assertions / 9 test cases), `verify_m1_corrective_retry.js`.

#### `backend/src/kernel/capabilities.js` (14 lines)
- **PURPOSE:** Infrastructure capability dependency injection container. Bundles persistent database connections and LLM generation clients into an injectable context.
- **WHY IT EXISTS:** Created in Step A0 to eliminate direct environmental coupling inside pipeline links, making pipeline links testable with mock capabilities.
- **KEY EXPORTS:**
  - `createDefaultCapabilities()`: Returns `{ db: { connectDatabase, executeReadOnlySql }, llm: { generateSql } }`.
- **CONSUMES:** `config/database.js`, `llm/llm.client.js`.
- **CONSUMED BY:** `core/core.engine.js`.
- **INVARIANTS:** Capability seams are read-only abstractions; must not leak internal connection mutation handles to links.
- **STATUS:** FROZEN KERNEL BEDROCK.
- **TESTS:** `verifyPipelineOverride.js`, `verifyGateIntegrity.js`.

#### `backend/src/kernel/formatter.registry.js` (279 lines)
- **PURPOSE:** Polymorphic presentation format registry. Formats raw query execution outcomes into standardized presentation payloads (`kpi`, `table`, `chartSpec`, `report`, `csv`).
- **WHY IT EXISTS:** Created in Step B1 (Commit `ccc1931`) to establish a presentation layer that later steps (B6 visualizer, B7 frontend) consume without altering core SQL values.
- **KEY EXPORTS:**
  - `FORMAT_REGISTRY`: Frozen dictionary of formatters:
    - `kpi`: Emits single-metric card with numeric formatting.
    - `table`: Emits tabular headers, rows, and row counts.
    - `chartSpec`: Emits minimal valid Vega-Lite v5 specification with data values embedded.
    - `report`: Emits structured business report with summary, metrics, and data breakdown.
    - `csv`: Emits RFC 4180 compliant CSV string, with formula injection prevention (neutralizes `=, +, -, @, \t, \r` with leading single-quote `'`).
  - `formatResponse(formatName, data, options)`: Dispatches format request to registered formatter.
- **CONSUMES:** None (pure functions).
- **CONSUMED BY:** `controllers/ai.controller.js`, `backend/test/verifyFormatterRegistry.js`.
- **INVARIANTS:** PRESENTATION ONLY (The Prime Invariant): A formatter NEVER alters data values (`data.sql`, `data.value`, `data.records` remain identical). Formula injection neutralization is mandatory on CSV.
- **STATUS:** FROZEN.
- **TESTS:** `backend/test/verifyFormatterRegistry.js` (14/14 unit tests proving purity, determinism, and CSV injection defense).

---

### 1.5 Core Engine & Links (`core/*`)

#### `backend/src/core/core.engine.js` (92 lines)
- **PURPOSE:** Central pipeline execution harness. Accepts user queries, initializes attempt traces, and executes pipeline links sequentially until a link returns `ANSWERED`, an explicit `ABSTAIN`, or links exhaust.
- **WHY IT EXISTS:** Refactored in Step A0 from an unstructured monolithic controller into a data-driven soft-cascade engine.
- **KEY EXPORTS:**
  - `executeCorePipeline(context)`: Main pipeline driver loop. Returns `{ answer, source, data, meta }`.
- **CONSUMES:** `kernel/pipeline.config.js`, `kernel/handler-result.js`, `kernel/capabilities.js`, `core/intent.detector.js`.
- **CONSUMED BY:** `controllers/ai.controller.js`, 14 backend test suites.
- **INVARIANTS:** Every link return MUST satisfy `isHandlerResult`; trace array `meta.pipelineTrace` records every attempt; falls back safely to `Helpful Fallback` if all links pass.
- **STATUS:** FROZEN KERNEL BEDROCK.
- **TESTS:** `verifyPipelineOverride.js`, `verifyGateIntegrity.js`, `verifyTraceEvidence.js`.

#### `backend/src/core/intent.detector.js` (46 lines)
- **PURPOSE:** Deterministic natural language query intent classifier. Inspects user query tokens and classifies queries into tool intents or generic data queries.
- **WHY IT EXISTS:** Routes specialized queries (e.g. CGPA, foreign students, cardiology visits) to deterministic tools before invoking dynamic SQL builders.
- **KEY EXPORTS:**
  - `detectIntent(query)`: Matches regex tokens for CGPA (`cgpa`, `gpa`), foreign students (`foreign`, `outside`), cardiology (`cardiology`, `patient`, `hospital`), returning intent code or `"data_query"`.
- **CONSUMES:** None (regex matching).
- **CONSUMED BY:** `core/core.engine.js`.
- **INVARIANTS:** Deterministic regex only; must return `"data_query"` if no specialized tool matches.
- **STATUS:** STABLE.
- **TESTS:** `verifyLitmusNewTool.js`, `verifyFullRegression.sh`.

#### `backend/src/core/tool.router.js` (13 lines)
- **PURPOSE:** Tool registry and dispatcher. Maps intent identifiers to corresponding tool execution objects.
- **WHY IT EXISTS:** Simple router decoupling tool implementations from the pipeline link.
- **KEY EXPORTS:**
  - `getTool(intent)`: Returns tool instance matching intent (`education_cgpa_analytics`, `education_foreign_students`, `hospital_patient_analytics`).
- **CONSUMES:** `tools/education/cgpa.tool.js`, `tools/education/foreign-student.tool.js`, `tools/hospital/cardiology.tool.js`.
- **CONSUMED BY:** `core/links/tool.link.js`.
- **INVARIANTS:** Returns `undefined` for unrecognized intents; does not execute tools directly.
- **STATUS:** STABLE.
- **TESTS:** `verifyLitmusNewTool.js`.

#### `backend/src/core/fastIntent.js` (501 lines)
- **PURPOSE:** High-speed deterministic Natural-Language-to-SQL compiler. Converts common analytical questions directly into verified SQL without invoking the LLM. Handles aggregations, filters, categorical values, ratio computations, and semantic derivations.
- **WHY IT EXISTS:** Primary engine for Link 2 (Dynamic Query Engine). Overhauled across Steps A1–A4 to resolve the Cardinality Trap (40 vs 80), Specimen S11 (ratios), and Specimen S13 (exact categorical matching).
- **KEY EXPORTS:**
  - `compileFastIntent(query, schema)`: Compiles plain English into `{ sql, plan, explanation }` or returns `null` on any structural ambiguity.
  - `checkGroupByRequired(query)`: Detects if query demands grouping across categories.
- **CONSUMES:** `schema.resolver.js`, `guard-markers.js`, `config/semantic.profile.js`, `distinct.cache.js`, `sql.validator.js`.
- **CONSUMED BY:** `dynamic.query.engine.js`, `guard-markers.js`, `backend/test/test_phase2_fast_intent_units.js`.
- **INVARIANTS:** Null-on-doubt principle: if any token, relation, or condition cannot be mapped with 100% certainty, returns `null` to cascade to LLM; all numbers in query must be bound (Numeric Coverage Guard); exact word normalization only.
- **STATUS:** FROZEN (7f24d3b).
- **TESTS:** `test_phase2_fast_intent_units.js`, `verify_college_attendance.js`, `verify_m3_ratio_recognizer.js`, `verify_categorical_value_precision.js`.

#### `backend/src/core/guard-markers.js` (83 lines)
- **PURPOSE:** Regular expression grouping guard definitions. Detects multi-attribute groupings and "by [attribute]" query structures that require `GROUP BY`.
- **WHY IT EXISTS:** Extracted in Step A2 to centralize grouping marker regexes and prevent false scalar aggregation plans on queries like "top 5 suppliers by order count".
- **KEY EXPORTS:**
  - `COUNT_BY_MARKER_REGEX`: Matches patterns like `count by`, `grouped by`, `per [category]`.
  - `AGGREGATE_GROUPING_REGEX`: Detects grouping intent with exception for scalar IDs (College Q5 sentinel).
- **CONSUMES:** `config/semantic.profile.js`.
- **CONSUMED BY:** `sql.builder.js`, `fastIntent.js`.
- **INVARIANTS:** Must not over-decline single-table ranking queries ordered by primary key (College Q5 sentinel exception).
- **STATUS:** FROZEN.
- **TESTS:** `verify_college_attendance.js` (Q5 sentinel), `test_phase2_fast_intent_units.js`.

#### `backend/src/core/dynamic.query.engine.js` (144 lines)
- **PURPOSE:** Execution coordinator for Link 2. Invokes `fastIntent.js`, validates generated SQL through Layer 1 `sql.validator.js`, executes queries against SQLite, and formats results.
- **WHY IT EXISTS:** Dispatches deterministic queries before LLM cascade, resolving 80%+ of common queries in <15ms.
- **KEY EXPORTS:**
  - `executeDynamicQuery(params)`: Executes compiled fast intent or builds single-table query plan.
- **CONSUMES:** `fastIntent.js`, `schema.resolver.js`, `sql.builder.js`, `query.executor.js`, `response.formatter.js`, `distinct.cache.js`, `sql.validator.js`.
- **CONSUMED BY:** `links/dynamic.link.js`, `backend/test/verifyCacheHitMiss.js`.
- **INVARIANTS:** Must pass all generated SQL through `validateAndSanitizeSql`; if fast intent fails or table is unresolvable, returns structured refusal codes (`table_missing`, `numeric_column_missing`) to trigger O15 Fast Refusal upstream.
- **STATUS:** STABLE.
- **TESTS:** `verify_college_attendance.js`, `verifyErpGroundTruth.js`.

#### `backend/src/core/schema.reader.js` (222 lines)
- **PURPOSE:** Schema metadata introspector and cache. Introspects SQLite `sqlite_master` and PRAGMA statements to build enriched schema maps (tables, columns, types, PKs, FKs, sample values) with DDL MD5 drift detection.
- **WHY IT EXISTS:** Eliminates PRAGMA latency overhead during query processing; ensures schema is read once and invalidated only when DDL hash changes or database switches.
- **KEY EXPORTS:**
  - `readDatabaseSchema()`: Returns cached enriched database schema map.
  - `invalidateSchemaCache()`: Clears schema cache on database switch.
  - `getSchemaCacheStats()`: Returns cache hit/miss statistics.
- **CONSUMES:** `config/database.js` (`connectDatabase`), `crypto`.
- **CONSUMED BY:** 11 files (`dynamic.query.engine.js`, `fallback.link.js`, `llm.link.js`, `sql.prompt.js`, etc.).
- **INVARIANTS:** Zero PRAGMA queries on cache hit; cache must be invalidated on every `switchDatabase` hook; computes MD5 hash of schema DDL to detect live schema drift.
- **STATUS:** STABLE.
- **TESTS:** `verifyCacheHitMiss.js`, `verifyTest2SwitchInvalidation.js`, `verifyPhase2StalenessTrap.js`.

#### `backend/src/core/schema.resolver.js` (176 lines)
- **PURPOSE:** Fuzzy-resistant token resolver. Maps user natural language tokens to exact physical tables and columns using morphological stemming, plural/singular normalization, and frozen schema aliases.
- **WHY IT EXISTS:** Overhauled in Step B2 (Commit `61e2316`) to kill the Synonym Wall (S12). Replaces naive substring matches with exact normalized token equality and dictionary fallbacks.
- **KEY EXPORTS:**
  - `normalizeWord(word)`: Trims, lowercases, and strips common English plural suffixes (`s`, `es`).
  - `getWords(text)`: Tokenizes text into alphanumeric words.
  - `resolveTable(name, schema)`: Resolves token to schema table name, checking `SEMANTIC_PROFILE.schemaAliases`.
  - `resolveColumn(tableName, colName, schema)`: Resolves token to table column name.
- **CONSUMES:** `config/semantic.profile.js`.
- **CONSUMED BY:** `dynamic.query.engine.js`, `sql.builder.js`, `schema.pruner.js`, `presentation.intent.js`, `test/verifySchemaAliases.js`.
- **INVARIANTS:** Exact normalized token match only (NEVER substring match); dictionary aliases must match bidirectionally; returns `null` on unresolvable tokens.
- **STATUS:** STABLE.
- **TESTS:** `test/verifySchemaAliases.js` (A-U1..6), `verify_categorical_value_precision.js`.

#### `backend/src/core/schema.pruner.js` (251 lines)
- **PURPOSE:** Top-K sub-schema prompt pruner with Foreign Key (FK) closure. Prunes massive database schemas down to the top-K most relevant tables for prompt injection while preserving all intermediate join tables.
- **WHY IT EXISTS:** Created in Step B2 (Commit `3d79544`) and hardened in B6 (Commit `992812d`) to defeat the Latency Wall (O2) for 300+ table enterprise databases.
- **KEY EXPORTS:**
  - `scoreTables(schema, question)`: Scores tables by exact table token (10), alias token (10), column match (3), and sample value token (2).
  - `pruneSchema(schema, question, options)`: Filters candidate tables scoring ≥ 40% of top score, caps to `topK` (default 6), and runs BFS on relationship graph to preserve FK-closure.
  - `buildRelationshipGraph(schema)`: Constructs undirected adjacency graph across tables from explicit and heuristic FKs.
  - `getInformativeTokens(question)`: Filters stopwords and short tokens.
- **CONSUMES:** `schema.resolver.js`, `config/semantic.profile.js`.
- **CONSUMED BY:** `llm/sql.prompt.js`, `test/verifySchemaPruner.js`.
- **INVARIANTS:** PURE FUNCTION; PROMPT-SIDE ONLY (Invariant R2: Full unpruned schema is ALWAYS passed to AST validation gates); CONNECTIVITY PRESERVATION: Intermediate join tables (e.g. `albums` between `artists` and `tracks`) are always retained in FK closure; Relative-candidate threshold: excludes distractors scoring < 40% of top candidate.
- **STATUS:** STABLE.
- **TESTS:** `test/verifySchemaPruner.js` (P-U1..P-U7, including P-U7 albums tripwire).

#### `backend/src/core/presentation.intent.js` (64 lines)
- **PURPOSE:** Presentation intent detector. Detects whether the user's natural language question requests a visual representation (`chart`, `graph`, `plot`, `visualize`) or structured report (`report`, `dashboard`).
- **WHY IT EXISTS:** Created in Step B6 (Commit `9a3d279`) to allow the LLM prompt and response formatter to conditionally target chart specs and report structures.
- **KEY EXPORTS:**
  - `detectPresentationIntent(question)`: Returns `{ intent: "chart"|"report"|"standard", chartType: "bar"|"line"|"pie"|"scatter"|null }`.
- **CONSUMES:** `schema.resolver.js` (`getWords`, `normalizeWord`).
- **CONSUMED BY:** `controllers/ai.controller.js`, `llm/sql.prompt.js`, `test/verifyPresentationIntent.js`.
- **INVARIANTS:** Deterministic token detection; exact word boundaries (no substring false-positives); returns `"standard"` if no presentation tokens present.
- **STATUS:** STABLE.
- **TESTS:** `test/verifyPresentationIntent.js` (PI-1..PI-7).

#### `backend/src/core/distinct.cache.js` (96 lines)
- **PURPOSE:** Low-cardinality categorical value cache. Caches distinct text values from database columns to enable exact-match filtering in `fastIntent.js`.
- **WHY IT EXISTS:** Created in Step A1/A3 to resolve Specimen S13 (Disambiguating grade `B` from `B-`).
- **KEY EXPORTS:**
  - `getDistinctValuesForColumn(table, column)`: Returns cached Set of distinct lowercase values.
  - `invalidateDistinctCache()`: Clears cache on database switch.
- **CONSUMES:** `config/database.js` (`connectDatabase`), `sql.builder.js` (`quoteIdentifier`).
- **CONSUMED BY:** `dynamic.query.engine.js`, `backend/test/test_phase3_distinct_cache.js`.
- **INVARIANTS:** Maximum distinct threshold (caps at 100 values per column to avoid caching high-cardinality data); invalidates on DB switch.
- **STATUS:** STABLE.
- **TESTS:** `test_phase3_distinct_cache.js`, `verify_categorical_value_precision.js`.

#### `backend/src/core/sql.builder.js` (325 lines)
- **PURPOSE:** Single-table query plan builder and SQL generator. Generates deterministic SELECT queries for counts, sums, averages, min/max, and sorted records.
- **WHY IT EXISTS:** Baseline SQL generator for `dynamic.query.engine.js`.
- **KEY EXPORTS:**
  - `buildQueryPlan(params)`: Constructs structured query plan object.
  - `generateSqlFromPlan(plan)`: Compiles query plan into parameterized SQL string.
  - `quoteIdentifier(name)`: Safely quotes table/column identifiers with standard double-quotes `""`.
- **CONSUMES:** `guard-markers.js`, `config/semantic.profile.js`, `schema.resolver.js`.
- **CONSUMED BY:** `distinct.cache.js`, `dynamic.query.engine.js`, `result.sanity.js`.
- **INVARIANTS:** Always double-quote identifiers; enforce LIMIT clauses; reject multi-table plans (defers to LLM); fail safe on any unknown operator.
- **STATUS:** STABLE.
- **TESTS:** `test_phase2_fast_intent_units.js`, `verify_m3_ratio_recognizer.js`.

#### `backend/src/core/query.executor.js` (50 lines)
- **PURPOSE:** Database driver abstraction for query execution. Exposes uniform `all`, `get`, `run` methods.
- **WHY IT EXISTS:** Decouples execution mechanisms from the underlying SQLite driver.
- **KEY EXPORTS:**
  - `executeQuery(sql, params)`: Runs query against read-write or read-only connection.
- **CONSUMES:** `config/database.js`.
- **CONSUMED BY:** `dynamic.query.engine.js`, `fastIntent.js`.
- **INVARIANTS:** Prevents connection leaks; uses persistent singleton connection.
- **STATUS:** STABLE.
- **TESTS:** `verifyConnLifecycle.js`.

#### `backend/src/core/response.formatter.js` (364 lines)
- **PURPOSE:** Execution response formatter for Link 2 (Dynamic Query Engine). Transforms database row arrays into human-readable answers and structured payload data.
- **WHY IT EXISTS:** Produces consistent conversational summaries for deterministic engine responses.
- **KEY EXPORTS:**
  - `formatExecutionResponse(plan, rows, durationMs)`: Assembles `{ answer, data }`.
- **CONSUMES:** None (pure presentation helper).
- **CONSUMED BY:** `dynamic.query.engine.js`.
- **INVARIANTS:** Preserves exact numeric values; formats dates and currency cleanly; includes raw rows in `data.records`.
- **STATUS:** STABLE.
- **TESTS:** `verify_college_attendance.js`, `verifyErpGroundTruth.js`.

#### `backend/src/core/result.sanity.js` (151 lines)
- **PURPOSE:** Result sanity validator. Intercepts nonsensical scalar SQL aggregates executing on boolean-shaped columns (Specimen S9).
- **WHY IT EXISTS:** Created in Step A3 to prevent the LLM from returning misleading answers when summing boolean flags (`SUM(is_vip)` or `AVG(has_insurance)`).
- **KEY EXPORTS:**
  - `checkResultSanity({ sql, rows, query, schema, db })`: Checks if scalar SUM/AVG was executed on a boolean-shaped column (`{0, 1}` values). Returns `{ valid: false, reason: "boolean_aggregate_suspicion:<col>" }` unless the query explicitly asked for the column.
- **CONSUMES:** `sql.builder.js` (`quoteIdentifier`).
- **CONSUMED BY:** `links/llm.link.js`, `backend/test/verify_m2_result_sanity.js`.
- **INVARIANTS:** COUNT is strictly exempt; scalar results only; does not decline if the question explicitly named the column.
- **STATUS:** FROZEN.
- **TESTS:** `backend/test/verify_m2_result_sanity.js`.

#### `backend/src/core/links/tool.link.js` (60 lines)
- **PURPOSE:** Link 1 handler: Configured Tools. Evaluates query intent and executes hardcoded analytical tools.
- **WHY IT EXISTS:** First link in the pipeline sequence. Handles deterministic enterprise workflows (CGPA, foreign student queries, hospital cardiology).
- **KEY EXPORTS:**
  - `executeToolLink(ctx)`: Returns `ANSWERED` if tool succeeds, or `PASS("intent_not_configured_for_tool")`.
- **CONSUMES:** `core/tool.router.js`, `kernel/handler-result.js`.
- **CONSUMED BY:** `kernel/pipeline.config.js`.
- **INVARIANTS:** Returns `PASS` on missing tools or schema incompatibilities; never halts pipeline on missing tables.
- **STATUS:** STABLE.
- **TESTS:** `verifyLitmusNewTool.js`, `verifyFullRegression.sh`.

#### `backend/src/core/links/dynamic.link.js` (32 lines)
- **PURPOSE:** Link 2 handler: Dynamic Query Engine. Bridges pipeline execution to `dynamic.query.engine.js`.
- **WHY IT EXISTS:** Second link in pipeline sequence. Resolves deterministic single-table and fast-intent queries.
- **KEY EXPORTS:**
  - `executeDynamicLink(ctx)`: Invokes dynamic query engine; returns `ANSWERED` on success or `PASS(reason)` on doubt.
- **CONSUMES:** `core/dynamic.query.engine.js`, `kernel/handler-result.js`.
- **CONSUMED BY:** `kernel/pipeline.config.js`.
- **INVARIANTS:** Emits structured decline reasons (`table_missing`, `unresolvable_missing_column`) for O15 Fast Refusal consumption.
- **STATUS:** STABLE.
- **TESTS:** `verify_college_attendance.js`, `verifyFullRegression.sh`.

#### `backend/src/core/links/llm.link.js` (270 lines)
- **PURPOSE:** Link 3 handler: Local LLM Link. Manages prompt generation, local Ollama client calls, gate chain evaluation, one-shot corrective retry, case-sensitivity recovery, and result sanity checks.
- **WHY IT EXISTS:** Third link in pipeline sequence. Synthesizes SQL for complex multi-table joins and unstructured queries.
- **KEY EXPORTS:**
  - `executeLlmLink(ctx)`: Coordinates end-to-end LLM query synthesis.
  - `getRuleHint(reason)`: Maps AST/validator rejection reason codes to corrective hints.
  - `buildCorrectivePrompt(reason, priorSql, basePrompt)`: Constructs corrective retry prompt notice.
- **CONSUMES:** `schema.reader.js`, `llm/sql.prompt.js`, `llm/llm.formatter.js`, `store/history.store.js`, `kernel/gate.chain.js`, `kernel/handler-result.js`, `core/result.sanity.js`.
- **CONSUMED BY:** `kernel/pipeline.config.js`, `backend/test/verify_m1_corrective_retry.js`, `backend/test/verify_m2_result_sanity.js`.
- **INVARIANTS:** O15 Fast Refusal: checks upstream declines and passes immediately if unresolvable; Invariant R2: passes unpruned schema to `gate.run`; enforces `sawValidator` invariant; structurally caps corrective retry to 1 retry (max 2 LLM calls total); read-only physical execution only.
- **STATUS:** STABLE.
- **TESTS:** `verify_m1_corrective_retry.js`, `verifyLlm1ValidatorSecurity.js`, `verify_ast_gate.js`.

#### `backend/src/core/links/fallback.link.js` (31 lines)
- **PURPOSE:** Link 4 handler: Helpful Fallback. Final link in the pipeline. Emits an honest refusal with schema summary and suggested queries when upstream links decline.
- **WHY IT EXISTS:** Fourth and final link. Ensures the system never fails silently or hallucinates when queries cannot be answered.
- **KEY EXPORTS:**
  - `executeFallbackLink(ctx)`: Returns `ANSWERED` with explanatory answer and suggested valid questions.
- **CONSUMES:** `schema.reader.js`, `kernel/handler-result.js`.
- **CONSUMED BY:** `kernel/pipeline.config.js`.
- **INVARIANTS:** Always succeeds (terminal link); source is strictly `"fallback"`; never invents fake data or executes SQL.
- **STATUS:** STABLE.
- **TESTS:** `runPartDEcommerceBenchmark.js` (Q4 clean fallback).

---

### 1.6 LLM Adapter & Validators (`llm/*`)

#### `backend/src/llm/llm.client.js` (189 lines)
- **PURPOSE:** Ollama HTTP API client wrapper. Sends generation requests to `POST /api/generate` with timeout controls, think-block stripping, and connection error handling.
- **WHY IT EXISTS:** Standardized LLM network adapter. Hardened in A2 (Decision O6) to support 75s timeouts (`LOCAL_LLM_TIMEOUT_MS=75000`) on CPU inference.
- **KEY EXPORTS:**
  - `generateSql({ prompt, model })`: Issues generation request, enforces timeout via `AbortController`, handles `think: false` fallback on HTTP 400, and returns `{ success, sql, errorType, durationMs, model }`.
  - `cleanLlmSql(rawResponse)`: Defensively strips `<think>` blocks, reasoning tags, and markdown code fences.
- **CONSUMES:** `dotenv/config`, `perf_hooks` (`performance`).
- **CONSUMED BY:** `kernel/capabilities.js`, `backend/test/verifyLlm10ThinkStripping.js`, `backend/test/verifyLlm2ClientContract.js`.
- **INVARIANTS:** Must enforce `LOCAL_LLM_TIMEOUT_MS` (75s); defensively strip `<think>` tags; return structured error types (`llm_timeout`, `llm_offline`, `llm_model_not_found`, `llm_bad_output`) without throwing unhandled exceptions.
- **STATUS:** FROZEN KERNEL BEDROCK.
- **TESTS:** `verifyLlm10ThinkStripping.js`, `verifyLlm2ClientContract.js`, `verifyLlm9OfflineFailover.js`.

#### `backend/src/llm/sql.validator.js` (135 lines)
- **PURPOSE:** Layer 1 SQL regex validator and sanitizer. Strips thinking blocks and fences, verifies SELECT/WITH query structure, blocks 16 destructive keywords, blocks SQL comments (`--`, `/* */`), and enforces LIMIT ≤ 100.
- **WHY IT EXISTS:** The original frozen security gate created in baseline. Maintained byte-identical throughout all development eras.
- **KEY EXPORTS:**
  - `validateAndSanitizeSql(rawSql)`: Evaluates SQL string; returns `{ valid: boolean, sql?: string, reason?: string }`.
  - `cleanLlmSql(rawSql)`: Helper removing markdown fences and `<think>` blocks.
- **CONSUMES:** None (pure regex).
- **CONSUMED BY:** `kernel/gate.chain.js`, `kernel/ast.gate.js`, `dynamic.query.engine.js`, `fastIntent.js`, `backend/test/verifyLlm1ValidatorSecurity.js`, `backend/test/verifyValidatorUnit.js`.
- **INVARIANTS:** FROZEN (Byte-identical to baseline). Litmus #8 protected. Must reject: non-SELECT queries, multiple statements (`;`), comments (`--`, `/*`), destructive keywords (`DROP`, `DELETE`, `INSERT`, `UPDATE`, `ALTER`, etc.). ReDoS safe (<0.05ms execution).
- **STATUS:** FROZEN.
- **TESTS:** `verifyLlm1ValidatorSecurity.js` (37/37 matrix), `verifyValidatorUnit.js` (13/13 unit tests).

#### `backend/src/llm/sql.prompt.js` (251 lines)
- **PURPOSE:** LLM SQL prompt builder. Assembles the system prompt, pruned database schema, static schema hints (`schema.notes.json`), few-shot domain examples, and conversation history.
- **WHY IT EXISTS:** Constructs the LLM prompt. Enhanced in B2 to integrate `pruneSchema`, and in B6 to include presentation shape hints for charts and reports.
- **KEY EXPORTS:**
  - `buildSqlPrompt({ query, schema, history })`: Returns complete prompt string.
- **CONSUMES:** `core/schema.pruner.js`, `core/presentation.intent.js`, `llm/schema.notes.json`, `config/semantic.profile.js`.
- **CONSUMED BY:** `core/links/llm.link.js`, `backend/test/verifyP3_6PromptOverhead.js`, `test/verifySchemaAliases.js`.
- **INVARIANTS:** Prompt-side pruning only; must include table notes if available; enforces SQLite dialect rules (e.g. `strftime`); appends presentation shaping instructions when chart or report intent is detected.
- **STATUS:** STABLE.
- **TESTS:** `verifyP3_6PromptOverhead.js`, `test/verifySchemaAliases.js`, `verifyPresentationIntent.js`.

#### `backend/src/llm/llm.formatter.js` (72 lines)
- **PURPOSE:** LLM query response formatter. Converts executed SQL rows into conversational answer strings and structured data envelopes.
- **WHY IT EXISTS:** Standardizes LLM answer phrasing. Corrected in Step B1 (Commit `c903777`) to enforce canonical scalar phrasing (`The result is <value>.`).
- **KEY EXPORTS:**
  - `formatLlmResponse({ sql, rows, model, llmDurationMs, extraMeta })`: Produces standard `{ answer, source: "llm", data: { sql, rows, records, rowCount, value }, meta }`.
- **CONSUMES:** None (pure JS).
- **CONSUMED BY:** `core/links/llm.link.js`.
- **INVARIANTS:** Scalar results must format as `"The result is <value>."`; multi-row results describe row counts; raw rows preserved in `data.records`.
- **STATUS:** STABLE.
- **TESTS:** `verifyFormatterRegistry.js`, `verifyErpGroundTruth.js`.

#### `backend/src/llm/schema.notes.json` (4 lines)
- **PURPOSE:** Static schema annotation dictionary for complex database schemas (Chinook).
- **WHY IT EXISTS:** Injected into LLM prompts to prevent cross-table ID confusion on legacy schemas.
- **KEY EXPORTS:** JSON mapping table names (`artists`, `albums`, `tracks`) to descriptive foreign key join notes.
- **CONSUMES:** None.
- **CONSUMED BY:** `llm/sql.prompt.js`.
- **INVARIANTS:** Static, human-curated domain guidance.
- **STATUS:** STABLE.
- **TESTS:** `verifyP3_2FollowUp.js`.

---

### 1.7 Routes & Stores (`routes/*`, `store/*`)

#### `backend/src/routes/ai.routes.js` (12 lines)
- **PURPOSE:** Express router mounting AI query and model endpoints.
- **WHY IT EXISTS:** REST API routing for `/api/ai`.
- **KEY EXPORTS:** Default export Express Router: `POST /query`, `GET /llm/models`, `GET /models`, `GET /history/:sessionId`.
- **CONSUMES:** `express`, `controllers/ai.controller.js`.
- **CONSUMED BY:** `backend/src/server.js`, `backend/test/verifyLlm8ModelPickerEndpoint.js`.
- **INVARIANTS:** Pure routing layer; no inline business logic.
- **STATUS:** STABLE.
- **TESTS:** `verifyLlm8ModelPickerEndpoint.js`.

#### `backend/src/routes/database.routes.js` (74 lines)
- **PURPOSE:** Express router mounting database upload, switch, and active inspection endpoints. Includes Multer disk storage and file extension filters.
- **WHY IT EXISTS:** REST API routing for `/api/database`.
- **KEY EXPORTS:** Default export Express Router: `GET /active`, `POST /switch`, `POST /upload`.
- **CONSUMES:** `express`, `multer`, `path`, `url`, `controllers/database.controller.js`.
- **CONSUMED BY:** `backend/src/server.js`.
- **INVARIANTS:** Limits file uploads to 50MB; filters file extensions to `.db`, `.sqlite`, `.sqlite3`; returns structured JSON errors on upload failures.
- **STATUS:** STABLE.
- **TESTS:** `verifyConnLifecycle.js`, `verifyTest2SwitchInvalidation.js`.

#### `backend/src/store/history.store.js` (136 lines)
- **PURPOSE:** Persistent multi-turn conversation memory store. Operates an independent SQLite database in Write-Ahead Logging (`WAL`) mode located at `backend/data/cognicore_history.db`.
- **WHY IT EXISTS:** Created in Step A2 to give CogniCore conversational memory across query turns without contaminating or coupling to active analytical databases.
- **KEY EXPORTS:**
  - `initHistoryStore()`: Connects to `cognicore_history.db` and enables `PRAGMA journal_mode = WAL`.
  - `recordExchange({ sessionId, question, answer, source, sql, model })`: Appends conversation exchange.
  - `getRecentExchanges(sessionId, limit = 3)`: Returns last N exchanges in chronological order for prompt injection.
  - `getFullHistory(sessionId, limit = 100)`: Retrieves full session history.
  - `closeHistoryStore()`: Closes connection handle.
- **CONSUMES:** `sqlite3`, `sqlite` (`open`), `path`, `fs/promises`.
- **CONSUMED BY:** `controllers/ai.controller.js`, `core/links/llm.link.js`, 4 persistence test suites.
- **INVARIANTS:** Completely decoupled from active database lifecycle (never affected by `switchDatabase`); WAL mode enabled for high concurrency; queries parameterized against SQL injection.
- **STATUS:** STABLE.
- **TESTS:** `verifyP3_1Persistence.js`, `verifyP3_2FollowUp.js`, `verifyP3_3SessionIsolation.js`, `verifyP3_4Hydration.js`, `verifyP3_5SurvivesSwitch.js`.

---

### 1.8 Configured Analytics Tools (`tools/*`)

#### `backend/src/tools/education/cgpa.tool.js` (134 lines)
- **PURPOSE:** Academic CGPA analytics tool. Deterministically answers queries regarding student GPA thresholds, grade cutoffs, and academic rankings.
- **WHY IT EXISTS:** Legacy Link 1 tool demonstrating deterministic execution for educational ERPs.
- **KEY EXPORTS:**
  - `cgpaTool`: Tool descriptor with `name` and `async execute({ query, capabilities })`.
- **CONSUMES:** `capabilities.db`.
- **CONSUMED BY:** `core/tool.router.js`.
- **INVARIANTS:** Whitelists comparison operators (`>`, `>=`, `<`, `<=`, `=`); caps record output at 50; falls back gracefully if `students` table or `cgpa` column is missing.
- **STATUS:** STABLE.
- **TESTS:** `verifyLitmusNewTool.js`.

#### `backend/src/tools/education/foreign-student.tool.js` (80 lines)
- **PURPOSE:** International student analytics tool. Answers queries regarding foreign student enrollment by country and year.
- **WHY IT EXISTS:** Legacy Link 1 tool demonstrating parameterized entity filtering.
- **KEY EXPORTS:**
  - `foreignStudentTool`: Tool descriptor with `name` and `async execute({ query, capabilities })`.
- **CONSUMES:** `capabilities.db`, `process.env.DEFAULT_HOME_COUNTRY`.
- **CONSUMED BY:** `core/tool.router.js`.
- **INVARIANTS:** Parameterized SQL queries; defaults home country to `"India"`; caps records at 50.
- **STATUS:** STABLE.
- **TESTS:** `verifyFullRegression.sh`.

#### `backend/src/tools/hospital/cardiology.tool.js` (164 lines)
- **PURPOSE:** Hospital patient visit analytics tool. Parses department names and date intervals to compute patient counts and visit histories.
- **WHY IT EXISTS:** Legacy Link 1 tool demonstrating medical domain analytics.
- **KEY EXPORTS:**
  - `cardiologyTool`: Tool descriptor with `name` and `async execute({ query, capabilities })`.
- **CONSUMES:** `capabilities.db`.
- **CONSUMED BY:** `core/tool.router.js`.
- **INVARIANTS:** Dynamically resolves department names against `hospital_visits`; maps month names to zero-padded numeric strings; parameterized SQL queries.
- **STATUS:** STABLE.
- **TESTS:** `verifyLitmusNewTool.js`.

---

### 1.9 Frontend Architecture (`frontend/src/*`)

#### `frontend/src/main.jsx` (115 lines)
- **PURPOSE:** React frontend composition root. Manages global application state (messages, active DB, model, active session), mounts layout scaffolding, and wires child components.
- **WHY IT EXISTS:** Decomposed in Step B7 (Commit `d4fd128`) from an 815-line monolith down to <120 lines, establishing clean separation of concerns.
- **KEY EXPORTS:** Default export React component `App`.
- **CONSUMES:** `react`, `components/DatabaseSidebar.jsx`, `components/ChatWindow.jsx`, `components/SqlModal.jsx`, `lib/api.js`, `style.css`.
- **CONSUMED BY:** Vite entry point (`index.html`).
- **INVARIANTS:** Composition root only; holds zero direct fetch calls (all network requests delegated to `lib/api.js`); line count strictly bounded under 120 lines.
- **STATUS:** STABLE.
- **TESTS:** Parity benchmark `backend/test/verify_m1_m10_parity.js`.

#### `frontend/src/components/ChatWindow.jsx` (224 lines)
- **PURPOSE:** Main chat interface component. Renders message history list, conversational message bubbles, pipeline latency chips, source badges (`tool`, `dynamic`, `llm`, `fallback`), prompt textarea, SQL modal triggers, and embedded visualizers.
- **WHY IT EXISTS:** Extracted in Step B7 (Commit `5101941`) to encapsulate conversational chat rendering.
- **KEY EXPORTS:** Default export React component `ChatWindow`.
- **CONSUMES:** `react`, `components/Visualizer.jsx`.
- **CONSUMED BY:** `frontend/src/main.jsx`.
- **INVARIANTS:** Renders `Visualizer` inside message bubble when `msg.format` exists; displays execution duration in milliseconds; provides copy-to-clipboard functionality.
- **STATUS:** STABLE.
- **TESTS:** `backend/test/verify_m1_m10_parity.js`.

#### `frontend/src/components/DatabaseSidebar.jsx` (258 lines)
- **PURPOSE:** Control sidebar component. Manages session ID controls, LLM model selector dropdown, organizational role switch, drag-and-drop SQLite file upload, and active database status badge.
- **WHY IT EXISTS:** Extracted in Step B7 (Commit `878c53c`) to encapsulate environment controls and database upload flows.
- **KEY EXPORTS:** Default export React component `DatabaseSidebar`.
- **CONSUMES:** `react`, `lib/api.js`.
- **CONSUMED BY:** `frontend/src/main.jsx`.
- **INVARIANTS:** Automatically triggers database refresh upon upload completion; polls `/api/ai/llm/models` on mount.
- **STATUS:** STABLE.
- **TESTS:** `backend/test/verify_m1_m10_parity.js`.

#### `frontend/src/components/SqlModal.jsx` (270 lines)
- **PURPOSE:** Diagnostic SQL and pipeline trace modal. Displays formatted SQL queries, execution latency, and step-by-step pipeline link trace details (`pipelineTrace`).
- **WHY IT EXISTS:** Extracted in Step B7 (Commit `1c92cfd`) to allow users and developers to audit query provenance and reasoning.
- **KEY EXPORTS:** Default export React component `SqlModal`.
- **CONSUMES:** `react`.
- **CONSUMED BY:** `frontend/src/main.jsx`.
- **INVARIANTS:** Renders only when active SQL or trace payload is present; provides one-click copy of raw SQL.
- **STATUS:** STABLE.
- **TESTS:** `backend/test/verify_m1_m10_parity.js`.

#### `frontend/src/components/Visualizer.jsx` (61 lines)
- **PURPOSE:** Polymorphic presentation format dispatcher. Dispatches presentation payloads to appropriate UI renderers based on `format.kind`.
- **WHY IT EXISTS:** Created in Step B7 (Commit `3dab426`) to connect backend polymorphic format payloads (`kpi`, `table`, `chartSpec`, `report`, `csv`) to UI renderers.
- **KEY EXPORTS:** Default export React component `Visualizer`.
- **CONSUMES:** `react`, `lib/formatRenderers.jsx`.
- **CONSUMED BY:** `frontend/src/components/ChatWindow.jsx`.
- **INVARIANTS:** Fail-safe rendering: unhandled formats fall back gracefully to raw table view; never throws unhandled rendering exceptions.
- **STATUS:** STABLE.
- **TESTS:** `test/verifyVisualizer.js` (V1–V7).

#### `frontend/src/lib/api.js` (122 lines)
- **PURPOSE:** Centralized frontend network client. Wraps `fetch` requests to `/api/*` endpoints with error handling, JSON parsing, and multipart upload handling.
- **WHY IT EXISTS:** Extracted in Step B7 (Commit `a73e363`) to eliminate duplicated `fetch` boilerplate across React components.
- **KEY EXPORTS:**
  - `queryAi(params)`: Issues `POST /api/ai/query`.
  - `fetchModels()`: Issues `GET /api/ai/llm/models`.
  - `fetchActiveDatabase()`: Issues `GET /api/database/active`.
  - `switchDatabase(databasePath)`: Issues `POST /api/database/switch`.
  - `uploadDatabase(file)`: Issues `POST /api/database/upload` multipart request.
  - `fetchHistory(sessionId)`: Issues `GET /api/ai/history/:sessionId`.
- **CONSUMES:** Browser `fetch` API.
- **CONSUMED BY:** `frontend/src/main.jsx`, `frontend/src/components/DatabaseSidebar.jsx`.
- **INVARIANTS:** Returns consistent `{ ok, data, error }` results; handles non-200 responses with descriptive error messages.
- **STATUS:** STABLE.
- **TESTS:** `backend/test/verify_m1_m10_parity.js`.

#### `frontend/src/lib/formatRenderers.jsx` (298 lines)
- **PURPOSE:** React presentation component library for format registry outputs. Implements Vega-Lite chart rendering (`vega` + `vega-lite`), KPI cards, data tables, CSV download buttons, and executive report layouts.
- **WHY IT EXISTS:** Created in Step B7 (Commit `3dab426`) to house presentation widgets.
- **KEY EXPORTS:**
  - `VegaLiteChart`: Compiles and renders Vega-Lite v5 specification into a reactive DOM container.
  - `KpiCard`: Renders large single-metric card with formatted value and title.
  - `DataTable`: Renders paginated, searchable tabular data with header formatting.
  - `CsvDownload`: Renders download button generating RFC 4180 CSV client-side blobs.
  - `ReportLayout`: Renders multi-section executive report with KPIs, narrative, and tabular drill-downs.
- **CONSUMES:** `react`, `vega`, `vega-lite`.
- **CONSUMED BY:** `frontend/src/components/Visualizer.jsx`.
- **INVARIANTS:** Client-side Vega-Lite compilation must catch syntax errors cleanly without breaking the surrounding UI; CSV export must preserve formula-injection escape characters.
- **STATUS:** STABLE.
- **TESTS:** `test/verifyVisualizer.js`.

#### `frontend/src/style.css` (851 lines)
- **PURPOSE:** Application styling. Houses dark-mode UI styles, CSS variables, glassmorphism layouts, responsive grid scaffolding, chart containers, and animations.
- **WHY IT EXISTS:** UI styling stylesheet.
- **KEY EXPORTS:** CSS styles.
- **CONSUMES:** None.
- **CONSUMED BY:** `frontend/src/main.jsx`.
- **INVARIANTS:** Pure CSS; responsive layout.
- **STATUS:** STABLE.
- **TESTS:** Visual verification in browser.

---

## §2 Architecture & Execution Flows

### 2.1 Request Lifecycle Trace (File:Line Anchors & Reason Codes)

Tracing a single query end-to-end through the CogniCore pipeline:

```
[Browser Client]
       │
       ▼  POST /api/ai/query { query, sessionId, organization, role, model }
[backend/src/server.js:33]
       │  Express Router dispatches to ai.routes.js
       ▼
[backend/src/routes/ai.routes.js:5]
       │  Routes POST to ai.controller.js handleQuery
       ▼
[backend/src/controllers/ai.controller.js:296] handleQuery(req, res)
       │  Extracts params, starts clock: startTime = Date.now()
       │  Invokes executeCorePipeline(ctx)
       ▼
[backend/src/core/core.engine.js:46] executeCorePipeline(context)
       │  Initializes ctx.attempts = [], ctx.trace = []
       │  Loads DEFAULT_PIPELINE from kernel/pipeline.config.js:10
       │
       ├─► LINK 1: Configured Tools
       │   [backend/src/core/links/tool.link.js:21] executeToolLink(ctx)
       │   Detects intent via core/intent.detector.js:31
       │   - If matched: invokes tool.router.js -> tool.execute() -> returns ANSWERED(payload)
       │   - If unmatched: returns PASS("intent_not_configured_for_tool") [line 28]
       │
       ├─► LINK 2: Dynamic Query Engine
       │   [backend/src/core/links/dynamic.link.js:14] executeDynamicLink(ctx)
       │   Invokes executeDynamicQuery() [backend/src/core/dynamic.query.engine.js:48]
       │   - Calls compileFastIntent() [backend/src/core/fastIntent.js:285]
       │   - Checks SEMANTIC_PROFILE.derivations (e.g. absent% = 100.0 - AVG)
       │   - Resolves tables/columns via core/schema.resolver.js
       │   - Validates SQL via llm/sql.validator.js:38 (Layer 1)
       │   - If valid SQL built: executes query via query.executor.js, formats via response.formatter.js -> returns ANSWERED(payload)
       │   - If table missing or structural decline: returns PASS("table_missing:..." | "numeric_column_missing:...")
       │
       ├─► LINK 3: Local LLM Link
       │   [backend/src/core/links/llm.link.js:45] executeLlmLink(ctx)
       │   - Line 52: O15 Fast Refusal Check. Inspects upstream Dynamic Query decline.
       │     If reason matches FAST_REFUSAL_CODES ("table_missing", "unresolvable_missing_column"):
       │     Returns PASS("fast_refusal:table_missing") in <20ms without invoking Ollama!
       │   - Line 71: Reads cached schema via core/schema.reader.js:45
       │   - Line 74: Fetches last 3 turns from store/history.store.js:83
       │   - Line 77: Builds prompt via llm/sql.prompt.js:123 (uses core/schema.pruner.js for Top-K tables)
       │   - Line 80: Invokes llm.generateSql() via kernel/capabilities.js -> llm/llm.client.js:19
       │     * If timeout (75s): returns PASS("llm_timeout")
       │     * If offline: returns PASS("llm_offline")
       │   - Line 99: GATE CHAIN EVALUATION (Ordered loop over GATE_CHAIN):
       │     * Gate 1 (Validate): llm/sql.validator.js:38 validateAndSanitizeSql
       │     * Gate 2 (Validate): kernel/ast.gate.js:125 validateAst(sql, { schema })
       │       - Passes full unpruned schema (Invariant R2)
       │       - Enforces function whitelist, schema presence, ONLY_FULL_GROUP_BY
       │     * Gate 3 (Execute): config/database.js:189 executeReadOnlySql
       │       - Executes strictly on physical OPEN_READONLY SQLite connection
       │   - Line 122: ONE-SHOT CORRECTIVE RETRY (M1):
       │     * If Gate 2 rejects with ast_* or group_by_required:
       │       Builds corrective prompt via buildCorrectivePrompt() [line 35]
       │       Re-invokes llm.generateSql() (Attempt 2/2)
       │       Re-evaluates GATE_CHAIN
       │       If retry fails: returns PASS("corrective_retry_exhausted:<reason>")
       │   - Line 203: Case-Sensitivity Recovery:
       │     * If zero results on string comparison, retries with COLLATE NOCASE
       │   - Line 231: Result Sanity Check:
       │     * Invokes core/result.sanity.js:99 checkResultSanity()
       │     * Blocks scalar SUM/AVG on boolean {0, 1} flags -> PASS("boolean_aggregate_suspicion:<col>")
       │   - Line 254: Formats answer via llm/llm.formatter.js:28 -> returns ANSWERED(payload)
       │
       └─► LINK 4: Helpful Fallback
           [backend/src/core/links/fallback.link.js:15] executeFallbackLink(ctx)
           - Line 22: Introspects schema tables/columns
           - Returns ANSWERED({ answer: "I could not find an answer...", source: "fallback", ... })
```

---

### 2.2 The 3-Tier Security Chain & Open Edges

All dynamic and LLM SQL execution is guarded by the 3-tier security chain defined in `backend/src/kernel/gate.chain.js`:

```
Generated SQL 
     │
     ▼
┌────────────────────────────────────────────────────────────────────────┐
│ LAYER 1: Regex Validator (sql.validator.js — FROZEN baseline)          │
│ • Rejects non-SELECT / non-WITH statements                             │
│ • Blocks 16 destructive keywords (DROP, DELETE, UPDATE, INSERT, ALTER) │
│ • Blocks SQL comments (-- and /* */) and multi-statement semicolons    │
│ • Clamps LIMIT clauses (max 100)                                       │
│ • ReDoS protected (<0.05ms execution)                                  │
│ Proved by: backend/test/verifyLlm1ValidatorSecurity.js (37/37 matrix) │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │ PASS
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│ LAYER 1.5: AST Structural Gate (ast.gate.js — FROZEN c29e0dc)          │
│ • Parses SQL into AST using node-sql-parser                            │
│ • Function Whitelist: COUNT, SUM, AVG, MIN, MAX, ROUND, LOWER,         │
│   UPPER, strftime                                                      │
│ • Schema Entity Verification: all tables & columns must exist          │
│ • ONLY_FULL_GROUP_BY & Functional Dependency: Bare non-aggregated      │
│   columns must be grouped, unless table primary key is in GROUP BY     │
│ Proved by: backend/test/verify_ast_gate.js (12 assertions / 9 cases)   │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │ PASS
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│ LAYER 3: Physical Read-Only Executor (config/database.js)             │
│ • Opened with sqlite3.OPEN_READONLY flag at the OS driver level        │
│ • OS/Driver physically raises SQLITE_READONLY on any write attempt     │
│ • Permanent backstop even if Layers 1 and 1.5 were bypassed            │
│ Proved by: backend/test/verifyLlm3ReadOnlyPhysical.js                  │
└────────────────────────────────────────────────────────────────────────┘
```

#### Registered Open Edges on Security Chain:
1. **CTE Column-Check Softening:** Dynamic unqualified CTE aliases in complex subqueries bypass strict table schema check.
2. **Expression Bare-Column Escape:** Arithmetic expressions like `AVG(price) + category` can bypass simple AST node checks.
3. **ORDER BY Bare-Column Unchecked:** Non-aggregated columns in `ORDER BY` without `GROUP BY` are permitted by SQLite's engine.
4. **Cross-Table PK-Name Collision:** Unqualified `GROUP BY id` across multi-table joins where both tables define `id` relies on SQLite driver resolution.

---

### 2.3 Data Lifecycle (Singletons, ReadOnly, SwitchQueue, WAL History)

```
                       ┌──────────────────────────────┐
                       │  backend/active-database.json│
                       └──────────────┬───────────────┘
                                      │ path
                                      ▼
                      ┌────────────────────────────────┐
                      │    config/database.js          │
                      │  - switchQueue (FIFO Promise)  │
                      │  - switchHooks (Callbacks)     │
                      └───────┬────────────────┬───────┘
                              │                │
            ┌─────────────────┴─┐            ┌─┴─────────────────┐
            │ RW Singleton (db) │            │ RO Singleton      │
            │ (sqlite3.Database)│            │ (OPEN_READONLY)   │
            └─────────┬─────────┘            └─────────┬─────────┘
                      │                                │
                      ▼                                ▼
              Schema Introspection               Query Execution
             (core/schema.reader.js)          (executeReadOnlySql)
              - DDL MD5 Hash Drift             - Thread-safe reads
              - Invalidate on switch           - No write corruption
                      │
                      ▼
             Distinct Value Cache
             (core/distinct.cache.js)
              - Low cardinality Set
              - Invalidate on switch

                      ┌────────────────────────────────┐
                      │    backend/data/               │
                      │    cognicore_history.db        │
                      │    (PRAGMA journal_mode = WAL) │
                      └────────────────┬───────────────┘
                                       │
                                       ▼
                              Multi-Turn History
                            (store/history.store.js)
                            - Independent DB connection
                            - Survives DB switches
                            - Zero user data leakage
```

---

### 2.4 Presentation & Formatting Flow (Sanity → Registry → Visualizer)

```
Executed SQL & Rows (from Dynamic Engine or LLM Link)
      │
      ▼
[core/result.sanity.js:99] checkResultSanity()
      │ Intercepts scalar aggregates on boolean {0, 1} flags
      │ Pass: proceeds to response formatting
      ▼
[controllers/ai.controller.js:246] selectFormat(payload, query)
      │
      ├─► Explicit Presentation Intent? (core/presentation.intent.js)
      │   ├─ "chart" / "graph" / "plot":
      │   │   Invokes seriesFromRecords() -> checks checkGroupingGuard()
      │   │   Emits { kind: "chartSpec", spec: <Vega-Lite v5 JSON> }
      │   └─ "report" / "dashboard":
      │       Emits { kind: "report", title, metrics, records }
      │
      └─► Automatic Shape Dispatch:
          ├─ Single scalar value -> { kind: "kpi", value, display }
          ├─ Multi-row tabular -> { kind: "table", columns, rows }
          └─ Explicit CSV export request -> { kind: "csv", data: <RFC 4180> }
      │
      ▼
[controllers/ai.controller.js:338]
Envelope: { answer, source, data, meta, format }
      │
      ▼ HTTP Response
[frontend/src/components/ChatWindow.jsx:180]
      │
      ▼ Mounts Visualizer Component
[frontend/src/components/Visualizer.jsx:25]
      │
      ├─► format.kind === "chartSpec" -> <VegaLiteChart spec={format.spec} />
      ├─► format.kind === "kpi"       -> <KpiCard value={format.value} />
      ├─► format.kind === "table"     -> <DataTable rows={format.rows} />
      ├─► format.kind === "report"    -> <ReportLayout report={format} />
      └─► format.kind === "csv"       -> <CsvDownload content={format.data} />
```

---

### 2.5 Extension Points Map ("To Add X, Touch Y")

| To Add / Modify | Touch Files | Invariants / Constraints | Verifying Test Suite |
|---|---|---|---|
| **New Analytical Tool** | 1. `backend/src/tools/<domain>/<name>.tool.js`<br>2. `backend/src/core/tool.router.js`<br>3. `backend/src/core/intent.detector.js` | Must implement `execute({ query, capabilities })`; handle missing tables gracefully; cap records ≤ 50. | `backend/test/verifyLitmusNewTool.js` |
| **New Security Gate** | 1. `backend/src/kernel/gate.chain.js`<br>2. Gate implementation file | Must insert before `readonly-executor`; signature `run(sql, { schema })`; return `{ valid, reason }`. | `backend/test/verifyGateIntegrity.js` |
| **New Presentation Format** | 1. `backend/src/kernel/formatter.registry.js`<br>2. `backend/src/controllers/ai.controller.js`<br>3. `frontend/src/lib/formatRenderers.jsx` | Pure function; NEVER alter `data.sql` or `data.records`; RFC 4180 injection defense on text exports. | `backend/test/verifyFormatterRegistry.js`<br>`test/verifyVisualizer.js` |
| **New Domain Synonym / Derivation** | 1. `backend/src/config/semantic.profile.js` | Add to `schemaAliases` or `derivations`; exact normalized words only; no substring regex. | `test/verifySchemaAliases.js`<br>`backend/test/verify_college_attendance.js` |
| **New Pipeline Link** | 1. `backend/src/core/links/<name>.link.js`<br>2. `backend/src/kernel/pipeline.config.js` | Must return standard `HANDLER_STATUSES` (`ANSWERED`, `PASS`, `ABSTAIN`, `BUG`) via `isHandlerResult`. | `backend/test/verifyPipelineOverride.js`<br>`backend/test/verifyTraceEvidence.js` |
| **New Whitelisted SQL Function** | 1. `backend/src/kernel/ast.gate.js` (`ALLOWED_FUNCTIONS`) | Whitelist function name in uppercase; ensure function exists in SQLite dialect. | `backend/test/verify_ast_gate.js` |

---

## §3 Test Arsenal Inventory & Quality Assurance

### 3.1 The Canonical Battery (`verifyFullRegression.sh`)

The exact 8 tests executed by `backend/test/verifyFullRegression.sh` in strict sequential order:

```bash
#!/bin/bash
# verifyFullRegression.sh — The Litmus #6 Canonical Regression Battery
1. verify_college_attendance.js   # College Attendance & Derivations (6/6 Q5 sentinel green)
2. verifyLlm1ValidatorSecurity.js # Layer 1 Validator Security Matrix (37/37)
3. verifyConnLifecycle.js         # SQLite Singleton Lifecycle & Non-Blocking Access
4. verifyPipelineOverride.js      # Dynamic Pipeline Override & Capability Seams
5. verifyGateIntegrity.js         # Security Gate Chain Slot Order & Invariants
6. verifyBypass.js                # Direct Bypass Prevention & Fallback Verification
7. verifyLitmusNewTool.js         # Tool Router & Link 1 Tool Dispatch Litmus
8. verifyTraceEvidence.js         # Pipeline Execution Trace & Audit Provenance
```

---

### 3.2 Full Test Suite Catalog (56 Test Scripts Analyzed)

| Test Script Name | Primary Modules Exercised | Runtime Class | Snapshot Hygiene | What It Proves & Canon Result |
|---|---|---|---|---|
| `verifyFullRegression.sh` | Full Core Pipeline | Fast (Harness) | Yes (via children) | Litmus #6 canonical regression battery; exits 0 if 8/8 pass. |
| `verify_college_attendance.js` | `fastIntent.js`, `semantic.profile.js` | Fast (HTTP) | Yes (Snapshot/Restore) | Proves 6/6 attendance queries pass, including Q5 sentinel by name. |
| `verifyLlm1ValidatorSecurity.js` | `sql.validator.js` | Instant (Unit) | N/A | Proves 37/37 security attack vectors blocked (<0.05ms execution). |
| `verifyConnLifecycle.js` | `config/database.js` | Fast (HTTP) | Yes (Snapshot/Restore) | Proves connection singleton reuse, no leaks, and clean switch transitions. |
| `verifyPipelineOverride.js` | `core.engine.js`, `pipeline.config.js` | Instant (Unit) | N/A | Proves pipeline link reordering, mock injection, and override semantics. |
| `verifyGateIntegrity.js` | `gate.chain.js`, `ast.gate.js` | Instant (Unit) | N/A | Proves slot positions `[validator, ast, readonly-executor]`. |
| `verifyBypass.js` | `gate.chain.js`, `core.engine.js` | Instant (Unit) | N/A | Proves queries cannot bypass validation layers to reach executor. |
| `verifyLitmusNewTool.js` | `tool.router.js`, `tool.link.js` | Instant (Unit) | N/A | Proves new tool registration and deterministic dispatch. |
| `verifyTraceEvidence.js` | `core.engine.js`, `handler-result.js` | Instant (Unit) | N/A | Proves `pipelineTrace` captures step-by-step link statuses and timings. |
| `verifyValidatorUnit.js` | `sql.validator.js` | Instant (Unit) | N/A | Proves 13/13 unit isolation tests on Layer 1 regex sanitizer. |
| `verify_ast_gate.js` | `ast.gate.js` | Instant (Unit) | N/A | Proves 12 assertions / 9 cases (PK functional dependency, bare columns). |
| `verifyFormatterRegistry.js` | `formatter.registry.js` | Instant (Unit) | N/A | Proves 14/14 unit tests: closed-shape formats, purity, CSV formula defense. |
| `test/verifySchemaAliases.js` | `schema.resolver.js`, `semantic.profile.js` | Instant (Unit) | N/A | Proves A-U1..A-U6 synonym resolution (`students`→`stus`, `machines`→`mcs`). |
| `test/verifySchemaPruner.js` | `schema.pruner.js` | Instant (Unit) | N/A | Proves P-U1..P-U7: token scoring, Top-K cap, 40% threshold, FK closure. |
| `test/verifyPresentationIntent.js`| `presentation.intent.js` | Instant (Unit) | N/A | Proves PI-1..PI-7: token detection for charts, graphs, and reports. |
| `test/verifyVisualizer.js` | `formatRenderers.jsx`, `Visualizer.jsx` | Instant (Unit) | N/A | Proves V1–V7: component rendering for KPI, table, chartSpec, report, CSV. |
| `verify_m1_m10_parity.js` | `frontend/src/*`, `controllers/ai.controller.js` | Fast (HTTP) | Yes (Snapshot/Restore) | Live parity suite proving UI decomposition preserved all M1–M10 features. |
| `runPartDEcommerceBenchmark.js` | Full Pipeline, Ollama LLM | LLM-Dependent | Yes (Snapshot/Restore) | E-commerce 9Q benchmark: 8/9 (89%) canonically, Q4 clean fallback. |
| `runRealmFull.js` | Full Pipeline, All Links | LLM-Dependent | No | Full realm battery: hospital (15–16/19), university (10/16), bank (7/13), etc. |
| `runRealms.js` | Full Pipeline | LLM-Dependent | No | Multi-realm smoke test harness. |
| `verifyErpGroundTruth.js` | Dynamic Engine, `fastIntent.js` | Fast (HTTP) | No | ERP ground truth suite: 4/6 passing (ERP-2, ERP-6 documented gaps). |
| `runPartBParityBenchmark.js` | Full Pipeline | Fast (HTTP) | No | Regression parity benchmark across Part B changes. |
| `verify_categorical_value_precision.js` | `fastIntent.js`, `distinct.cache.js` | Fast (HTTP) | Yes (Snapshot/Restore) | Specimen S13 proof: exact match disambiguates `B` (5,541) from `B-` (265). |
| `verify_m1_corrective_retry.js` | `llm.link.js`, `ast.gate.js` | LLM-Dependent | Yes (Snapshot/Restore) | Proves one-shot corrective retry triggers on AST Gate rejection. |
| `verify_m1_live_specimens.js` | `llm.link.js`, `ast.gate.js` | Instant (Unit) | Yes (Snapshot/Restore) | Unit verification of live specimen AST rejection strings. |
| `verify_m2_result_sanity.js` | `result.sanity.js` | LLM-Dependent | Yes (Snapshot/Restore) | Specimen S9 proof: blocks scalar SUM/AVG on boolean `{0, 1}` flags. |
| `verify_m3_ratio_recognizer.js` | `fastIntent.js`, `sql.builder.js` | Instant (Unit) | Yes (Snapshot/Restore) | Specimen S11 proof: ratio compiler `ROUND(COUNT(...)*100.0/COUNT(*), 2)`. |
| `verifyP3_1Persistence.js` | `store/history.store.js` | Fast (HTTP) | No | Proves conversation turns persist to `cognicore_history.db`. |
| `verifyP3_2FollowUp.js` | `llm.link.js`, `store/history.store.js` | Fast (HTTP) | Yes (Snapshot/Restore) | Proves 2-turn context: Turn 1 (Iron Maiden: 213), Turn 2 (Albums: 57). |
| `verifyP3_3SessionIsolation.js` | `store/history.store.js` | Fast (HTTP) | No | Proves concurrent sessions maintain isolated conversation histories. |
| `verifyP3_4Hydration.js` | `store/history.store.js` | Fast (HTTP) | No | Proves session hydration from disk across server restarts. |
| `verifyP3_5SurvivesSwitch.js` | `store/history.store.js`, `config/database.js` | Fast (HTTP) | No | Proves conversation memory survives active database switches. |
| `verifyP3_6PromptOverhead.js` | `llm/sql.prompt.js` | Instant (Unit) | No | Measures prompt token overhead across history turn depths. |
| `verifyLlm2ClientContract.js` | `llm/llm.client.js` | LLM-Dependent | No | Verifies Ollama response shape contract and timeout handling. |
| `verifyLlm3ReadOnlyPhysical.js` | `config/database.js` | Instant (Unit) | No | Proves physical write query throws `SQLITE_READONLY` on read-only conn. |
| `verifyLlm4SimpleRetrieval.js` | Full Pipeline | Instant (Unit) | No | Single-table retrieval verification via LLM link. |
| `verifyLlm5ComplexJoin.js` | Full Pipeline | Instant (Unit) | No | Multi-table join verification via LLM link. |
| `verifyLlm6AdversarialQuestion.js`| `llm.link.js`, `sql.validator.js` | Instant (Unit) | No | Adversarial prompt injection defense verification. |
| `verifyLlm7GarbageOutput.js` | `llm/llm.client.js` | Fast (HTTP) | No | Malformed LLM response handling and fallback cascade. |
| `verifyLlm8EndToEndModelOverride.js`| `llm/llm.client.js` | Instant (Unit) | No | Verifies per-query model parameter override. |
| `verifyLlm8HallucinatedTable.js` | `llm.link.js`, `ast.gate.js` | Fast (HTTP) | No | Proves AST Gate blocks queries referencing non-existent tables. |
| `verifyLlm8ModelPickerEndpoint.js`| `controllers/ai.controller.js` | Fast (HTTP) | No | Verifies `/api/ai/llm/models` endpoint returns available Ollama tags. |
| `verifyLlm9OfflineFailover.js` | `llm/llm.client.js` | Fast (HTTP) | No | Proves graceful fallback when local Ollama daemon is offline. |
| `verifyLlm10ThinkStripping.js` | `llm/llm.client.js` | Instant (Unit) | No | Proves `<think>...</think>` tags and reasoning blocks are stripped. |
| `verifyCacheHitMiss.js` | `schema.reader.js` | Instant (Unit) | No | Proves zero PRAGMA overhead on schema cache hits. |
| `test_phase2_fast_intent_units.js`| `fastIntent.js` | Instant (Unit) | No | Comprehensive unit test suite for fast-intent parsing rules. |
| `test_phase3_distinct_cache.js` | `distinct.cache.js` | Instant (Unit) | Yes (Snapshot/Restore) | Unit tests for categorical distinct value caching. |
| `verifyPhase2StalenessTrap.js` | `schema.reader.js` | Fast (HTTP) | No | Proves schema cache updates when underlying DB DDL changes. |
| `verifyTest2SwitchInvalidation.js`| `config/database.js` | Instant (Unit) | Yes (Snapshot/Restore) | Proves switchDatabase invalidates schema and distinct caches. |
| `verifyTest3ConcurrentSwitch.js` | `config/database.js` | Instant (Unit) | Yes (Snapshot/Restore) | Proves concurrent switches serialize cleanly without race conditions. |
| `verifyTest4FailedSwitch.js` | `config/database.js` | Instant (Unit) | No | Proves invalid database switch fails safe without corrupting active pointer. |
| `verifyTest6NonBlocking.js` | `config/database.js` | Instant (Unit) | Yes (Snapshot/Restore) | Proves asynchronous switch operations do not block Node.js event loop. |
| `verifyTest6SlowDisk.js` | `config/database.js` | Instant (Unit) | Yes (Snapshot/Restore) | Proves slow I/O conditions are handled safely without socket timeouts. |
| `testActiveDatabase.js` | `config/database.js` | Instant (Unit) | No | Active database path resolution unit test. |
| `testSchema.js` | `schema.reader.js` | Instant (Unit) | No | Raw schema reader sanity verification script. |
| `generateEcommerceDb.js` | Database Fixture Generator | Instant (Unit) | No | Generates `ecommerce.db` benchmark fixture database. |

---

### 3.3 Unit & Invariant Test Matrices

All unit matrices run in <2 seconds and represent zero-tolerance regression gates:

1. **Layer 1 SQL Validator Security Matrix (`verifyLlm1ValidatorSecurity.js`):**
   - **Score:** **37 / 37 (100%)**
   - **Guarantees:** Blocks DROP, DELETE, INSERT, UPDATE, ALTER, ATTACH, DETACH, PRAGMA, EXEC, multi-statement `;`, line comments `--`, block comments `/* */`, and enforces LIMIT clamping. Execution duration <0.05ms on 10k-character hostile strings.
2. **Layer 1 Validator Unit Isolation (`verifyValidatorUnit.js`):**
   - **Score:** **13 / 13 (100%)**
3. **Layer 1.5 AST Structural Gate (`verify_ast_gate.js`):**
   - **Score:** **12 assertions / 9 test cases (100%)**
   - **Guarantees:** Enforces `ONLY_FULL_GROUP_BY` and Primary Key Functional Dependency across simple and composite PKs; rejects non-whitelisted functions; rejects schema-unknown entities.
4. **Formatter Registry Matrix (`verifyFormatterRegistry.js`):**
   - **Score:** **14 / 14 (100%)**
   - **Guarantees:** Verifies pure deterministic formatting across `kpi`, `table`, `chartSpec`, `report`, and `csv`. Proves CSV formula injection neutralization (`=`, `+`, `-`, `@`, `\t`, `\r` escaped with leading single quote).
5. **Schema Synonym Resolution Matrix (`test/verifySchemaAliases.js`):**
   - **Score:** **6 / 6 (A-U1..A-U6) (100%)**
   - **Guarantees:** Resolves domain entity terms (`students`, `machines`, `accounts`, `restaurants`, `patients`) to physical legacy tables (`stus`, `mcs`, `accts`, `rst`, `pts`).
6. **Schema Pruner & FK Closure Matrix (`test/verifySchemaPruner.js`):**
   - **Score:** **7 / 7 (P-U1..P-U7) (100%)**
   - **Guarantees:** Verifies exact token scoring, Top-K pruning cap, 40% relative candidate threshold (distractor exclusion), and all-pairs BFS FK-closure (P-U7 preserves intermediate `albums` table between `artists` and `tracks`).
7. **Presentation Intent Matrix (`test/verifyPresentationIntent.js`):**
   - **Score:** **7 / 7 (PI-1..PI-7) (100%)**
8. **Visualizer Component Rendering Matrix (`test/verifyVisualizer.js`):**
   - **Score:** **7 / 7 (V1–V7) (100%)**

---

### 3.4 The Stability Protocol (Mode of 3 Runs)

Because natural language to SQL benchmarks running on local quantized LLMs (`gemma3:4b` on CPU) exhibit non-deterministic inference variance due to temperature (0.1), prefill scheduling, and thread contention:

- **Canon Law:** Any official score reported for publication or milestone gates MUST represent the **statistical mode of 3 consecutive identical benchmark runs**.
- **Single Run Observation:** A single benchmark execution is classified as an empirical observation, NOT a definitive score.
- **Reporting Rule:** Both single observation runs and 3-run mode distributions must be transparently documented with their individual run results (e.g. `Run 1: 15/19, Run 2: 16/19, Run 3: 16/19 → Mode: 16/19`).

---

## §4 Canon, Doctrine & System State

### 4.1 Canon Document Summaries

#### 1. `MASTER_CONTEXT.md` (v2.0)
- Declares Part A (reliability bedrock) locked; outlines Part B expressiveness additions.
- Specifies canonical stack: Node.js/Express (port 5000), SQLite-only (`sqlite3` driver, strictly NOT `better-sqlite3`), local Ollama (`gemma3:4b`, 75s timeout).
- Defines immutable response contract: `{ answer, source, data, meta }`.
- Codifies the 4-link soft cascade and 3-tier security gate chain.
- Establishes binding development doctrine: Structure beats vigilance; honesty before polish; frozen kernel governance.
- *Doc Drift Note:* Section 10 describes Part B Steps 6, 7, and 8 as future work, whereas they are fully completed in git history (`9367b6d`).

#### 2. `docs/PART_A_RECORD.md`
- Canonical measurement record for Part A completion.
- Records O15 fast refusal gains: hostile mutations cut from 12.5s to 5ms; missing column declines cut from 13s to 21ms.
- Details M1 corrective retry machinery: 2/2 live activation (100%), 0/2 recovery rate (model-bound honesty, not recovery).
- Locks empirical benchmarks: Part D 8/9 (89%), Hospital 15/19 (79%), Validator 37/37 (100%), S13 categorical precision 5,541.
- Formally records Architectural Decision O6: `LOCAL_LLM_TIMEOUT_MS=75000` (75s).
- Documents Specimen Disposition Ledger S1 through S15.

#### 3. `docs/PART_B_RECORD.md`
- Canonical measurement record for Part B (Steps 5, 6, and 7).
- Documents B2 carried rider closures R1–R7: R1 token-equality, R2 gate-unaffected proof, R3 friendly-direction synonym proofs (A-L1).
- Proves destruction of the Synonym Wall (S12) and Latency Wall (O2).
- Details 40% relative-candidate threshold in `schema.pruner.js` and distractor exclusion case study (L-C1: 86.23 → 85.92).
- Attributions for benchmark flips: ERP 3/6 → 4/6 (Q1 scalar prose fix) and Hospital 15/19 → 16/19.
- Formulates the statistical mode of 3 runs Stability Protocol.

#### 4. `ROADMAP.md`
- High-level roadmap tracking Part A completion and Part B progression.
- Formally assigns ownership of Specimen S12 (Synonym Wall) to Part B Step 6.
- Documents Decision O6 justifying the 75s CPU inference timeout policy.
- *Doc Drift Note:* Step 6 (B2) is marked completed, but Step 7 (B6) and Step 8 (B7) remain unmarked.

---

### 4.2 Frozen / Locked Files Governance

The following core modules are classified as **FROZEN** or **LOCKED BEDROCK**:

| File Path | Status | Lock Hash / Rule | Modification Governance |
|---|---|---|---|
| `backend/src/llm/sql.validator.js` | **FROZEN** | Byte-identical to baseline (Litmus #8) | ZERO edits permitted. ReDoS and attack vector gate. |
| `backend/src/kernel/ast.gate.js` | **FROZEN** | Locked at commit `c29e0dc` | Edits prohibited without full security council audit. |
| `backend/src/core/core.engine.js` | **FROZEN** | Kernel Bedrock | Requires `feat(kernel)` prefix and pre-push review. |
| `backend/src/kernel/pipeline.config.js` | **FROZEN** | Kernel Bedrock | Link sequence order is immutable. |
| `backend/src/llm/llm.client.js` | **FROZEN** | Kernel Bedrock | Network adapter contract must remain stable. |
| `backend/src/core/result.sanity.js` | **FROZEN** | Locked at commit `26bc44d` | Boolean aggregate detection rules locked. |
| `backend/src/core/fastIntent.js` | **FROZEN** | Locked at commit `7f24d3b` | Deterministic compiler rules locked. |
| `backend/src/config/semantic.profile.js` | **FROZEN** | Locked at commit `61e2316` | Profile schema dictionary locked. |
| `backend/src/kernel/formatter.registry.js`| **FROZEN** | Locked at commit `ccc1931` | Presentation registry and injection defense locked. |

**The Kernel Governance Rule:** Any commit modifying files in `backend/src/kernel/`, `sql.validator.js`, `core.engine.js`, or `pipeline.config.js` MUST use the commit prefix `feat(kernel):` or `fix(kernel):` and undergo full-file diff inspection prior to pushing to `main`.

---

### 4.3 The Two Primary Bug Classes

All code reviews and architecture contributions are evaluated against the two primary bug classes:

1. **Loose / Substring Matching:**
   - *Failure Mechanism:* Using naive regexes, `.includes()`, or substring matches against schemas, user questions, or sample values. Normalization that destroys distinguishing tokens (e.g. stripping hyphens conflates grade `B` with `B-`; loose token matching conflates section `'A'` with filler word `'a'`).
   - *Review Mandate:* Enforce exact normalized token equality (`wordSet.has(normToken)`). Every token comparison must prove it does not match partial strings or unrelated tokens.
2. **Over-Declining:**
   - *Failure Mechanism:* Introducing defensive validation rules or grouping guards that inadvertently reject valid, previously-passing queries (e.g. a grouping guard rejecting single-table ranking queries ordered by primary key).
   - *Review Mandate:* Every new validation rule or guard must explicitly name the **sentinel test case** it is guaranteed NOT to catch (e.g. College Q5 sentinel: *"lowest attendance top 5 by student id"*) and prove it passes live.

---

### 4.4 Operational Hazards (H1–H10)

- **H1 (dotenv-at-boot):** Database configuration and timeout policies depend on environment variables. `dotenv/config` must be imported at the absolute entry point of every standalone script or server.
- **H2 (One Server Policy):** Multiple Node.js processes binding to port 5000 cause erratic request routing. Always run `pgrep -fl node` before launching tests or servers.
- **H3 (Zombie Queue):** Unhandled asynchronous database switch rejections can leave `switchQueue` permanently pending. Always catch and resolve promise tails.
- **H4 (Context Mismatch Reload):** When changing branches or modifying configs, restart the dev server to clear in-memory singletons and schema caches.
- **H5 (Abort-Log Audit Method):** Do not guess whether a timeout occurred; verify the exact duration logged in the Ollama client abort log (`⏱️ [LLM Client] Call aborted after X ms`).
- **H6 (Case Sensitivity Trap):** SQLite string comparisons (`=`) are case-sensitive by default. Link 3 must utilize `COLLATE NOCASE` recovery when initial string matches return zero rows.
- **H7 (Driver Contamination):** Under no circumstances import `better-sqlite3`. The entire codebase is architected for asynchronous `sqlite3`.
- **H8 (Memory Contamination):** Conversation memory in `cognicore_history.db` must never point to analytical user databases. Keep WAL stores physically separated.
- **H9 (Authoritative Generator Paths):** When running database fixture generators (`gen_*.js`), treat the printed output file path as authoritative.
- **H10 (Re-Derive Post-Regeneration):** When SQLite fixture generators are modified or re-run, re-verify ground truth expectations against the newly generated database before asserting failures.

---

### 4.5 Open Edges Ledger & Dispositions

| # | Edge Description | Risk & Severity | Current Mitigation | Permanent Disposition |
|---|---|---|---|---|
| **1** | **Retry Recovery Rate (0/2 in-sample)** | Medium: Small LLMs (`gemma3:4b`) repeat hallucinated columns on retry. | Honesty guarantee: exhausts cleanly to fallback; zero silent-wrong numbers. | Accept as model capacity limit; upgrade local model or fine-tune. |
| **2** | **Numeric-Flag Binding Gap (ERP-2)** | Low: Query filtering by `is_vip = 1` or boolean flags fails in fast intent. | Handled via LLM cascade or fallback refusal. | Queued: Add explicit numeric-flag binder in `fastIntent.js`. |
| **3** | **CTE Column-Check Softening** | Low: Unqualified CTE aliases inside subqueries bypass strict table check. | Read-Only physical execution prevents mutation; validator blocks destructive SQL. | Hardened in AST Gate; remaining subquery edge documented. |
| **4** | **Expression Bare-Column Escape** | Low: Arithmetic expressions like `AVG(price) + category` evade simple bare-column check. | AST gate inspects top-level select exprs; physical execution read-only. | Queued: AST Gate recursive expression walker. |
| **5** | **ORDER BY Bare-Column Unchecked** | Low: Unaggregated column in `ORDER BY` permitted by SQLite engine without `GROUP BY`. | SQLite relaxes ordering; result shape remains structurally valid. | Queued: Validate `ORDER BY` identifiers against grouping set. |
| **6** | **Cross-Table PK-Name Collision** | Low: Ambiguous `GROUP BY id` across multi-table joins where both define `id`. | Relies on SQLite driver resolution; schema reader warns on unqualified joins. | Queued: Require qualified table prefixes on multi-table joins. |
| **7** | **`a/an` STOP-Word Gap** | Low: Stripping article `'a'` affects letter-grade queries (*"received an A"*). | Pinned suites avoid letter grade 'A'; exact token matching protects S13. | Queued: Context-sensitive article preservation. |
| **8** | **Pruner Distractor Edge** | **RESOLVED**: Low-scoring tables entered prompt (e.g. `order_items` distractor). | **Closed in B6 (Commit `992812d`)**: 40% relative-candidate threshold excludes distractors. | Verified by `verifySchemaPruner.js` and L-C1 case study (86.23 → 85.92). |
| **9** | **Report Assembly Shallow** | Low: Complex reports emit basic structured breakdown. | Formatter registry emits valid `report` shape; frontend renders clean layout. | Queued: Multi-metric cross-tab report synthesis. |
| **10** | **S6 Disclosure Backstop Unowned** | Medium: Multi-join relations lacking foreign keys may substitute entities. | Physical read-only safety ensures zero database corruption. | Queued: Deterministic entity disclosure disclaimer in fallback. |

---

### 4.6 Current Empirical Scoreboard

| Benchmark / Test Suite | Score / Metric | Status | Evidence Source |
|---|---|---|---|
| **Part D Cross-Domain Benchmark** | **8 / 9 (89%)** | Mode of 3 Runs | `backend/test/runPartDEcommerceBenchmark.js` (Zero silent failures) |
| **Part D Single-Run Observation** | **9 / 9 (100%)** | Observation | Peak single run observed in B6 closure |
| **Hospital Realm Full Battery** | **15 – 16 / 19 (79–84%)** | Mode: 16/19 | `backend/test/runRealmFull.js hospital` |
| **University Realm Battery** | **10 / 16 (63%)** | Canonical | `backend/test/runRealmFull.js university` |
| **Industry Realm Battery** | **7 / 12 (58%)** | Canonical | `backend/test/runRealmFull.js industry` |
| **Bank Realm Battery** | **7 / 13 (54%)** | Canonical | `backend/test/runRealmFull.js bank` (Predicate/aggregation failures) |
| **Food Delivery Realm Battery** | **9 – 10 / 12 (75–83%)** | Mode: 10/12 | `backend/test/runRealmFull.js fooddelivery` |
| **Student ERP Ground Truth** | **4 / 6 (67%)** | Canonical | `backend/test/verifyErpGroundTruth.js` (ERP-2, ERP-6 documented gaps) |
| **Layer 1 SQL Validator Security** | **37 / 37 (100%)** | Inviolable Gate | `backend/test/verifyLlm1ValidatorSecurity.js` (<0.05ms execution) |
| **Layer 1 Validator Unit Matrix** | **13 / 13 (100%)** | Unit Gate | `backend/test/verifyValidatorUnit.js` |
| **Layer 1.5 AST Structural Gate** | **12 / 12 (100%)** | Structural Gate | `backend/test/verify_ast_gate.js` |
| **Formatter Registry Matrix** | **14 / 14 (100%)** | Presentation Gate| `backend/test/verifyFormatterRegistry.js` (Purity & RFC 4180 defense) |
| **Categorical Value Precision (S13)**| **5,541 Exact** | Precision Gate | `backend/test/verify_categorical_value_precision.js` (`B` vs `B-`) |
| **College Attendance Suite** | **6 / 6 (100%)** | Sentinel Gate | `backend/test/verify_college_attendance.js` (Q5 sentinel green) |
| **Follow-Up Multi-Turn Context (P3.2)**| **213 & 57** | Context Gate | `backend/test/verifyP3_2FollowUp.js` (Chinook: Iron Maiden / Greatest Hits) |
| **Chinook Canon Album Leader** | **Greatest Hits (57)** | Canon Value | `backend/test/verifyP3_2FollowUp.js` |
| **Chinook Canon Artist Leaderboard** | **Iron Maiden (213)**<br>**U2 (135)**<br>**Led Zeppelin (114)**<br>**Metallica (112)**<br>**Deep Purple (92)** | Canon Values | Verified across Chinook benchmark suites |

---

### 4.7 Queued Work Post-B7

With the completion of Step 8 (B7: Frontend Decomposition), the functional architecture of Part B is closed. The queued roadmap includes:

1. **Final Stability Sweep:** Comprehensive 3-run mode sweeps across all five enterprise benchmark realms.
2. **IEEE Conference Paper Preparation:**
   - Methodology: Multi-tier Gate Chain and structural soft-cascade.
   - Results: Part A & Part B empirical measurement records.
   - Limitations: Honest disclosure of model-bound retry limits and open edges.
3. **Engineering Polish Queue:**
   - Explicit numeric-flag filter binder in `fastIntent.js` (resolving ERP-2).
   - Recursive AST-gate expression walker (closing arithmetic bare-column escape).
   - Context-sensitive article preservation for letter grades (resolving `a/an` STOP-word edge).
   - Semantic YAML profile loader for runtime enterprise dictionary updates.
   - GPU clone benchmark testing (evaluating latency improvements over CPU inference).
   - Learning suite on `nomic-embed-text` for vector similarity fallback.
   - Action Gateway & Model Context Protocol (MCP) server integration.

---

## §5 Doc-Drift Findings

The following discrepancies were identified where earlier documentation or roadmap notes diverged from the actual implementation on disk:

| # | Document | Stated Claim in Document | Reality in Source Code (CODE WINS) | Impact & Remediation |
|---|---|---|---|---|
| **1** | `MASTER_CONTEXT.md` §10 | Steps 6 (B2), 7 (B6), and 8 (B7) are listed as pending future work in Part B queue. | Steps 6, 7, and 8 are fully completed and committed (`a05e8c0`, `437a80f`, `9367b6d`). | Codified in this document; `MASTER_CONTEXT.md` reflects historical Part A close. |
| **2** | `ROADMAP.md` §1 | Roadmap ends with Step 6 (B2) completed; Steps 7 (B6) and 8 (B7) not marked. | B6 (`437a80f`) and B7 (`9367b6d`) are fully completed and proven live. | Documented here; roadmap was not bumped after B6/B7 closures. |
| **3** | Seed Inventory | Listed `PART_A_RECORD.md` and `PART_B_RECORD.md` at root or docs root. | Both files reside strictly in `Cognicore/docs/` (`docs/PART_A_RECORD.md`, `docs/PART_B_RECORD.md`). | Correct path codified in §0.3 inventory. |
| **4** | Seed Inventory | Listed `STEP0_AUDIT_REPORT.md` at root. | Preserved at `CogniCore_Project/docs/AUDIT_REPORT.md` and `COGNICORE_CODEBASE_AUDIT_AND_DECOMPOSITION.md`. | Correct path codified in §0.3 inventory. |
| **5** | Seed Inventory | Listed `package.json (both)` implying root + package. | No root `package.json` exists; packages are isolated in `backend/` and `frontend/`. | Documented in §0.3 delta analysis. |
| **6** | Seed Inventory | Test suites expected exclusively under `backend/test/`. | 4 Part B unit test suites reside in root `test/` (`test/verifySchemaAliases.js`, etc.). | Both directories cataloged in §3.2. |
| **7** | `MASTER_CONTEXT.md` §2 | Frontend described as "Single main.jsx (Part B Step 8 splits into modular components)". | `main.jsx` is decomposed to 115 lines, orchestrating 4 modular components in `frontend/src/components/`. | Decomposed architecture documented in §1.9. |

---

## §6 "How to Continue" Playbook

This operational playbook dictates the exact discipline required for any future engineer or AI agent picking up a task in CogniCore:

### 1. Task Selection & Pre-Flight
- Pick one well-defined task from the queued backlog (§4.7).
- Run pre-flight environment checks:
  ```bash
  git status --short                        # Must be clean
  pgrep -fl node                            # Ensure no conflicting server is running
  bash backend/test/verifyFullRegression.sh # Canonical 8/8 must be GREEN before touching any file
  ```

### 2. Pre-Flight Grep & Interface Check
- Before modifying or consuming an existing module, run a repository-wide grep for its importers:
  ```bash
  grep -rn "targetFunctionOrModule" CogniCore_Project/
  ```
- Review the module's dossier in [§1](#1-per-file-architectural-dossiers) to understand its **Invariants** and **Consumers**.
- If the file is marked **FROZEN** (e.g. `sql.validator.js`, `ast.gate.js`), **DO NOT EDIT IT**. Seek an architectural exception first.

### 3. Incremental Implementation & Sentinel Protection
- Implement code changes under strict single-responsibility discipline.
- If adding a new guard or validation rule:
  - Name the previously-passing sentinel query it must NOT break (e.g. College Q5 sentinel: *"lowest attendance top 5 by student id"*).
  - Verify that the sentinel test passes live after your change.
- Never use loose `.includes()` or substring matching on tokens or schemas. Enforce exact normalized token matching via `schema.resolver.js`.

### 4. Verification Battery & Receipts
- Run the unit suite governing your modified module.
- Run the full canonical battery:
  ```bash
  bash backend/test/verifyFullRegression.sh
  ```
- Run the full step battery including realm suites if engine behavior was touched:
  ```bash
  node backend/test/verifyErpGroundTruth.js
  node backend/test/runPartDEcommerceBenchmark.js
  node backend/test/runRealmFull.js hospital
  ```
- For any publication-grade score claims, execute 3 consecutive runs and report the statistical mode.

### 5. Atomic Commit & Push
- Verify `git diff` contains ZERO unintended changes or debug statements.
- Ensure no modifications were made to frozen files without governance authorization.
- Commit with conventional commit prefix (`feat:`, `fix:`, `docs:`, or `feat(kernel):` / `fix(kernel):` for kernel changes):
  ```bash
  git commit -m "feat(module): descriptive summary of verified change"
  git push myrepo main
  ```
- Verify `git status` reports `ahead 0` and working tree clean.

---
*End of Project Context Compilation — CogniCore Engine Architecture.*
