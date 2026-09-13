# CogniCore AI Copilot — Comprehensive Blueprint & Exhaustive Codebase Audit

**Date:** 2026-09-08  
**Author:** Principal Software Architect & Systems Engineer  
**Target Repository:** `CogniCore_Project` (Canonical Repo Root: `/home/shubh/Documents/project/cognicore/Cognicore/CogniCore_Project`)  
**Scope:** Exhaustive architectural blueprint, context handoff specification, and 100% complete, file-by-file technical decomposition across all 60+ files in the repository.

---

# TABLE OF CONTENTS
1. [PART I: Project Context Blueprint (AI Handoff Specification)](#part-i-project-context-blueprint)
   - 1.1 Executive Summary & Core Mission
   - 1.2 Current Architecture & Tech Stack
   - 1.3 Chronological Evolution & Upgrades
   - 1.4 The "Graveyard" (Fails, Blockers, & Abandoned Approaches)
   - 1.5 Known Bugs & Current Technical Debt
   - 1.6 Next Steps & Immediate Roadmap
   - 1.7 Guidelines for the Receiving AI
2. [PART II: Exhaustive File-by-File Code Audit & Decomposition](#part-ii-exhaustive-file-by-file-code-audit)
   - [Module 1: Root Manifests, Specs & Documentation](#module-1-root-manifests-specs--documentation)
   - [Module 2: Backend Infrastructure & Server Core](#module-2-backend-infrastructure--server-core)
   - [Module 3: API Routing & Controller Layer](#module-3-api-routing--controller-layer)
   - [Module 4: Core Engine & Query Orchestration](#module-4-core-engine--query-orchestration)
   - [Module 5: Domain Tools Subsystem](#module-5-domain-tools-subsystem)
   - [Module 6: Persistence, Stores & Data Seeds](#module-6-persistence-stores--data-seeds)
   - [Module 7: LLM Layer & Security Gates](#module-7-llm-layer--security-gates)
   - [Module 8: Frontend Application (React 19 SPA)](#module-8-frontend-application-react-19-spa)
   - [Module 9: Verification, Benchmark & Test Suite (28 Individual Files)](#module-9-verification-benchmark--test-suite)
   - [Module 10: Bundled SQLite Database Artifacts](#module-10-bundled-sqlite-database-artifacts)
3. [PART III: Architectural Synthesis Matrix](#part-iii-architectural-synthesis-matrix)

---

# PART I: Project Context Blueprint

### 1. Executive Summary & Core Mission
* **Project Name:** CogniCore AI Copilot
* **The "Why":** Enterprise analytics forces organizations to choose between brittle, domain-locked BI reporting dashboards and cloud-based LLM solutions that risk catastrophic data leakage, unpredictable egress fees, and schema hallucinations. CogniCore resolves this dilemma by delivering an **air-gapped, on-premises, domain-agnostic Conversational Analytics Engine**. Users upload any arbitrary SQLite database file (`.db`, `.sqlite`, `.sqlite3`), ask questions in unconstrained natural language, and immediately receive mathematically grounded answers with the exact, validated SQL query executed. All intelligence runs locally via Ollama with **absolute zero data egress**, enforced by physical read-only database connections and dual-layer AST/regex security gates.
* **Target Audience/Users:** 
  * Enterprise data analysts, department managers, and non-technical staff needing self-service analytics over private operational databases.
  * Academic review board (UG Final Year Capstone Project; Review 2 pending, publication target: IEEE-indexed conference).

### 2. Current Architecture & Tech Stack
* **Core Stack:**
  * **Backend Runtime:** Node.js (ES Modules, `"type": "module"`) with Express 5 (`^5.1.0`) on Port 5000 (`/health` verified).
  * **Primary Database Engine:** SQLite 3 via asynchronous driver (`sqlite3` `^6.0.1` + `sqlite` `^5.1.1` wrapper). **CRITICAL: NEVER introduce `better-sqlite3`.**
  * **Active DB Pointer:** `backend/active-database.json` (atomic file-replacement store surviving restarts).
  * **Conversation Memory:** `backend/data/cognicore_history.db` (dedicated WAL-mode SQLite store via `history.store.js`).
  * **Local LLM Engine:** Ollama REST API at `http://localhost:11434` (default model `gemma3:4b`; model-agnostic UI switchable seam).
  * **Frontend Framework:** React 19 (`^19.1.0`) bundled with Vite 7 (`^7.0.0`) in `frontend/src/main.jsx`.
  * **File Ingestion:** Multer (`^2.3.0`) with 50MB limits and binary SQLite magic header validation.
* **System Architecture:**
  * Deterministic **4-link soft-cascade** in `core.engine.js`:
    1. **Link 1 (Tools):** Configured domain tools (`cgpa.tool.js`, `foreign-student.tool.js`, `cardiology.tool.js`). Soft-cascades if required tables/columns are missing.
    2. **Link 2 (Dynamic Query Engine):** Fast-path deterministic router (`fastIntent.js`, sub-50ms) evaluating 15 shapes, followed by heuristic fallback (`sql.builder.js`).
    3. **Link 3 (Local LLM):** Local Ollama generation with schema injection and sliding conversation memory, protected by Layer 1 AST/regex gate and Layer 2 physical `OPEN_READONLY` driver lock.
    4. **Link 4 (Helpful Fallback):** Schema inspection listing valid tables and suggested query shapes.
  * **Universal Response Contract:** Every link returns `{ answer, source, data, meta }` with SQL carried in `data.sql`.
* **State of the Code:**
  * **100% Functional:** Dynamic database uploading, runtime DB switching, RAM schema caching with MD5 drift detection, distinct-values cache, Part 1 Fast Intent Router (6/6 acceptance pass), 37/37 adversarial security pass, 20/20 concurrent lifecycle pass, session history hydration.
  * **Partially Built:** Schema notes enrichment (`schema.notes.json`) is static JSON; full dynamic vector RAG is pending Phase 4.
  * **Mocked / Out of Scope:** Multi-user authentication, response streaming, multi-table JOINs inside `fastIntent.js` (cascades to LLM).

### 3. Chronological Evolution & Upgrades
* **The Starting Point:** Hardcoded domain-specific prototype for education and hospital queries. Fragile connection lifecycle where connections closed in `finally` blocks, causing `SQLITE_MISUSE` crashes under concurrency. Cascade order had LLM before the dynamic engine (`[Tools → LLM → Dynamic → Fallback]`), causing a 15-second penalty on simple queries.
* **Major Upgrades:**
  * **Part 1 Cascade Reorder:** Cascade reordered to `[Tools → Dynamic Engine → Local LLM → Fallback]`. Latency dropped from ~15,000ms to 8–65ms (>200x speedup).
  * **Fast Intent Router (`fastIntent.js`):** Rule-based deterministic compiler supporting 7 parameterized shapes, Levenshtein typo tolerance ($\le 2$), distinct categorical string cache, and numeric coverage guards.
  * **Persistent WAL History Store (`history.store.js`):** Dedicated SQLite database storing multi-turn interactions, powering sliding context injection (last 3 turns $\approx 227$ tokens) and frontend hydration.
* **Refactoring Decisions:**
  * Connections refactored to persistent module-level singletons (`db`, `readOnlyDb`), recycled *only* during explicit database switches.
  * Replaced overfit few-shot prompt examples with generic schema resolution rules.

### 4. The "Graveyard" (Fails, Blockers, & Abandoned Approaches)
* **What Didn't Work & Root Causes:**
  1. *Distinct Cache Substring Matching (The 40 vs 80 Bug):* Loose substring matching (`query.includes(val)`) matched single-letter section `'A'` from `students.section` inside words `"many"` and `"are"`, injecting `WHERE section = 'A'` and counting 40 students instead of 80. Fixed by exact token matching (`norm(v.value) === tok`) and numeric coverage guards.
  2. *`better-sqlite3` Synchronous Driver:* C++ native compilation failed cross-platform and blocked the Node event loop during complex queries. Reverted to asynchronous `sqlite3` + `sqlite`.
  3. *LangChain / LangGraph:* Heavy dependency bloat and opaque prompt abstractions. Replaced with native JavaScript 4-link soft cascade.
  4. *Unrestricted LLM Write Access:* Highly vulnerable to prompt injection. Replaced with physical `OPEN_READONLY` connections and frozen Layer 1 validator.
* **Anti-Hallucination Guardrails:**
  * **DO NOT edit `sql.validator.js` without a formal audit** (37/37 tests must pass).
  * **DO NOT close SQLite connections in query execution blocks** (recycle only in `doSwitchDatabase()`).
  * **DO NOT invent columns or tables in `fastIntent.js`** (return `null` and cascade honestly).
  * **DO NOT bypass the Numeric Coverage Guard** (every integer in the query must be bound).
  * **DO NOT use string concatenation for SQL queries** (use parameterized `?` placeholders).

### 5. Known Bugs & Current Technical Debt
* **Open Issue §9.4:** Test/benchmark scripts can mutate `active-database.json`. Workaround: snapshot-at-start and restore-in-finally pattern. Permanent solution needed: `COGNICORE_ACTIVE_DB` environment variable override.
* **Limitation L7:** Complex queries (computed columns, multi-table joins) cascade to LLM on CPU, taking 9–15 seconds. Part 2 introduces an LLM latency cap and Intent-IR.
* **Case Sensitivity:** SQLite `=` is case-sensitive. Workaround: automatic retry with `COLLATE NOCASE` if 0 rows are returned.
* **Single-Table Scope:** `fastIntent.js` handles single-table shapes only; JOINs and GROUP BY cascade to LLM.

### 6. Next Steps & Immediate Roadmap
* **Immediate Priority (Part 2):** LLM Intent-IR (structured JSON output from LLM) $\rightarrow$ Deterministic SQL compiler $\rightarrow$ Single bounded corrective retry loop.
* **Phase 4:** Full document RAG integration (PDF/DOCX/TXT extraction, vector embeddings, hybrid SQL+RAG router).
* **Pending Refactor:** Decompose `main.jsx` (815 lines) into modular components (`Sidebar.jsx`, `ChatArea.jsx`, `SqlInspector.jsx`, `DataTable.jsx`).

### 7. Guidelines for the Receiving AI
* **Coding Style:** Strict ES Modules (`import/export`, `"use strict"`), fail-safe soft-cascading, evidence-driven engineering (every feature ships with a `verify*.js` test).
* **Contextual Boundaries:** Strict SQLite only (no Postgres/MySQL), zero cloud AI SDKs (local Ollama only), unconditional `{ answer, source, data, meta }` envelope.

---

# PART II: Exhaustive File-by-File Code Audit

---

## Module 1: Root Manifests, Specs & Documentation

### 📁 `START_HERE.txt`
1. **🎯 What It Is & Core Purpose:** Plaintext onboarding runbook / bootstrap documentation. Provides the zero-dependency operator manual for spinning up the backend (Express) and frontend (Vite dev server) processes.
2. **🏗️ Architectural Contribution:** Developer Experience (DevEx). Defines root workspace layout expectations (`backend/`, `frontend/`, `README.md`).
3. **⚖️ Necessity Assessment:** **OPTIONAL / NON-RUNTIME**. No runtime failure if deleted.
4. **🧠 Deep-Dive Mechanics:** Protects against archive extraction nesting bugs (e.g. `CogniCore_Project/CogniCore_Project/...`) which break relative paths in scripts.

### 📁 `README.md`
1. **🎯 What It Is & Core Purpose:** Project overview and quick-start reference. Summarizes MVP capabilities and lists immediate demo validation questions.
2. **🏗️ Architectural Contribution:** Presentation / Documentation. Static landing reference.
3. **⚖️ Necessity Assessment:** **OPTIONAL / NON-RUNTIME**. Standard repository documentation.
4. **🧠 Deep-Dive Mechanics:** Explicitly lists primary benchmark verification prompts for education and hospital domains.

### 📁 `CogniCore_Project_Status_and_Roadmap.md`
1. **🎯 What It Is & Core Purpose:** System specification, capability map, and engineering master plan (1,247 lines). Codifies the architectural blueprint for domain-agnostic enterprise analytics.
2. **🏗️ Architectural Contribution:** Foundational architectural specification. Defines component boundaries and data flows across all 9 delivery phases.
3. **⚖️ Necessity Assessment:** **CRITICAL ARCHITECTURAL SPECIFICATION (NON-RUNTIME)**. Ensures developer alignment on component contracts and IEEE publication standards.
4. **🧠 Deep-Dive Mechanics:** Codifies the core design law: RAG complements SQL for unstructured documents, but structured quantitative calculations must use deterministic/validated SQL.

### 📁 `PART1_REPORT.md`
1. **🎯 What It Is & Core Purpose:** Engineering upgrade audit report and verification log. Certifies completion of the Part 1 Fast Intent Router upgrade.
2. **🏗️ Architectural Contribution:** Quality Assurance / Verification Evidence. Records DoD compliance across Phases 0 through 5.
3. **⚖️ Necessity Assessment:** **AUDIT EVIDENCE (NON-RUNTIME)**. Crucial for academic viva defense and project auditability.
4. **🧠 Deep-Dive Mechanics:** Details the 40-vs-80 bug resolution and latency reduction from 15,042ms to 8–65ms (>200x speedup).

### 📁 `PART1_COMPLETION.md`
1. **🎯 What It Is & Core Purpose:** DoD audit verification evidence log. Documents exact compliance against Tasks A through H.
2. **🏗️ Architectural Contribution:** Release governance. Freezes canonical metrics, verified shape counts (15 shapes), and active database protection rules.
3. **⚖️ Necessity Assessment:** **AUDIT EVIDENCE (NON-RUNTIME)**. Historical certification of Part 1.
4. **🧠 Deep-Dive Mechanics:** Resolves dynamic shape count to 15 (8 baseline + 7 fastIntent) and documents the persistent connection lifecycle refactoring.

### 📁 `backend/package.json`
1. **🎯 What It Is & Core Purpose:** Node.js package manifest and dependency configuration. Declares scripts, dependencies, and native ES Module mode (`"type": "module"`).
2. **🏗️ Architectural Contribution:** Core infrastructure configuration consumed by Node.js and NPM.
3. **⚖️ Necessity Assessment:** **MISSION CRITICAL**. Application cannot install dependencies or run without it.
4. **🧠 Deep-Dive Mechanics:** Configures `"type": "module"` for native ES6 imports, and `"allowScripts": { "sqlite3@6.0.1": true }` to permit native compilation.

### 📁 `backend/nodemon.json`
1. **🎯 What It Is & Core Purpose:** Development watcher configuration file. Restricts file monitoring to `src/` while ignoring database files, logs, uploads, and tests.
2. **🏗️ Architectural Contribution:** DevEx / Runtime Stability. Filters file-system change events from triggering server reloads.
3. **⚖️ Necessity Assessment:** **HIGH IMPORTANCE IN DEV**. Prevents infinite restart loops caused by database transaction commits or file uploads.
4. **🧠 Deep-Dive Mechanics:** Explicit ignore rules: `"*.db"`, `"*.db-journal"`, `"*.json"`, `"uploads/*"`, `"verify*.js"`, `"run*.js"`.

### 📁 `backend/active-database.json`
1. **🎯 What It Is & Core Purpose:** Persistent active state store (JSON format). Tracks the absolute filesystem path of the currently active SQLite database.
2. **🏗️ Architectural Contribution:** State Persistence Layer. Read by `database.js` on boot; written during DB uploads/switches.
3. **⚖️ Necessity Assessment:** **MISSION CRITICAL**. Without it, the server reverts to default `chinook.db` on every restart.
4. **🧠 Deep-Dive Mechanics:** Written via atomic file replacement (`.tmp.*` $\rightarrow$ rename) to guarantee consistency during sudden crashes.

### 📁 `backend/PART1_DISCOVERY.md`
1. **🎯 What It Is & Core Purpose:** Phase 0 discovery findings document. Records baseline export signatures, schema analysis of `college_attendance.db`, and baseline latency metrics.
2. **🏗️ Architectural Contribution:** Historical QA reference.
3. **⚖️ Necessity Assessment:** **OPTIONAL / NON-RUNTIME**.
4. **🧠 Deep-Dive Mechanics:** Contrasts long-format time-series tables against short-format entity tables.

---

## Module 2: Backend Infrastructure & Server Core

### 📁 `backend/src/server.js`
1. **🎯 What It Is & Core Purpose:** Application entry point and HTTP server lifecycle orchestrator. Boots Express 5, binds middleware (CORS, JSON parser), registers routers, and binds port 5000.
2. **🏗️ Architectural Contribution:** Gateway / Controller Hub. Dispatches inbound requests and catches unhandled exceptions.
3. **⚖️ Necessity Assessment:** **MISSION CRITICAL**. Server cannot start without it.
4. **🧠 Deep-Dive Mechanics:** Global JSON error handler `app.use((err, req, res, next) => ...)` prevents Express from returning raw HTML error pages on unhandled exceptions.

### 📁 `backend/src/config/database.js`
1. **🎯 What It Is & Core Purpose:** Database connection manager, singleton provider, and runtime switching engine. Manages read-write and read-only connection handles and executes serialized DB switch queues.
2. **🏗️ Architectural Contribution:** Infrastructure / Data Access Layer. Depended on by all core query and controller modules.
3. **⚖️ Necessity Assessment:** **MISSION CRITICAL (CORE FOUNDATION)**.
4. **🧠 Deep-Dive Mechanics:** Persistent singletons (`db`, `readOnlyDb`) eliminate `SQLITE_MISUSE`. Promise-chained `switchQueue` serializes concurrent database switches. Registry `switchHooks` dispatches cache-invalidation events to dependent modules.

---

## Module 3: API Routing & Controller Layer

### 📁 `backend/src/routes/ai.routes.js`
1. **🎯 What It Is & Core Purpose:** Express route definition module for AI query execution, model inspection, and history hydration.
2. **🏗️ Architectural Contribution:** Transport Routing. Maps `/query`, `/llm/models`, `/history/:sessionId` to `ai.controller.js`.
3. **⚖️ Necessity Assessment:** **MISSION CRITICAL**. Frontend cannot communicate with AI endpoints without it.
4. **🧠 Deep-Dive Mechanics:** Mounts `/models` alongside `/llm/models` for backward client compatibility.

### 📁 `backend/src/routes/database.routes.js`
1. **🎯 What It Is & Core Purpose:** Express route definition with Multer multipart middleware for database file uploads and switching.
2. **🏗️ Architectural Contribution:** Ingestion / Transport Routing. Maps `/upload`, `/active`, `/switch` to `database.controller.js`.
3. **⚖️ Necessity Assessment:** **MISSION CRITICAL**.
4. **🧠 Deep-Dive Mechanics:** Filename sanitization replaces spaces with underscores; enforces 50MB file limit and `.db`/`.sqlite`/`.sqlite3` extensions.

### 📁 `backend/src/controllers/ai.controller.js`
1. **🎯 What It Is & Core Purpose:** Request orchestration controller. Validates input queries, manages session IDs, invokes the core engine, records audit logs, and queries Ollama tags.
2. **🏗️ Architectural Contribution:** Application Controller. Bridges HTTP transport with `core.engine.js` and `history.store.js`.
3. **⚖️ Necessity Assessment:** **MISSION CRITICAL**.
4. **🧠 Deep-Dive Mechanics:** Fail-safe audit logging: wraps `recordExchange()` in non-blocking try/catch so logging errors never fail user queries. Queries Ollama `/api/tags` with a 5-second abort signal.

### 📁 `backend/src/controllers/database.controller.js`
1. **🎯 What It Is & Core Purpose:** Database lifecycle controller. Handles file uploads, active path discovery, and database activation.
2. **🏗️ Architectural Contribution:** Ingestion Guard / Application Controller.
3. **⚖️ Necessity Assessment:** **MISSION CRITICAL**.
4. **🧠 Deep-Dive Mechanics:** Magic Header Inspection: reads the first 16 bytes of uploaded files, verifying `"SQLite format 3"`. Corrupted or invalid files are asynchronously unlinked and rejected with HTTP 400.

---

## Module 4: Core Engine & Query Orchestration

### 📁 `backend/src/core/core.engine.js`
1. **🎯 What It Is & Core Purpose:** Core orchestration pipeline implementing the 4-link soft-cascade chain (`[Tools → Dynamic Engine → Local LLM → Fallback]`).
2. **🏗️ Architectural Contribution:** Central Business Logic Orchestrator. Coordinates intent detection, dynamic compilation, LLM prompts, validator security gates, and formatting.
3. **⚖️ Necessity Assessment:** **MISSION CRITICAL (CENTRAL NERVOUS SYSTEM)**.
4. **🧠 Deep-Dive Mechanics:** Soft-cascade law: missing tables log quietly and cascade to the next link; real bugs log `🚨 [BUG]`. In Link 3, zero-record queries auto-retry with `COLLATE NOCASE` to recover from case-sensitivity mismatches.

### 📁 `backend/src/core/dynamic.query.engine.js`
1. **🎯 What It Is & Core Purpose:** Dynamic schema-driven SQL orchestrator. Binds `fastIntent.js` (fast-path router) and the heuristic pipeline (`schema.resolver.js`, `sql.builder.js`, `query.executor.js`, `response.formatter.js`).
2. **🏗️ Architectural Contribution:** Link 2 Query Engine.
3. **⚖️ Necessity Assessment:** **MISSION CRITICAL**.
4. **🧠 Deep-Dive Mechanics:** Validates `fastPlan` SQL through the frozen `validateAndSanitizeSql` gate before dispatching to physical read-only connections.

### 📁 `backend/src/core/fastIntent.js`
1. **🎯 What It Is & Core Purpose:** High-performance deterministic Natural Language $\rightarrow$ Parameterized SQL compiler (Part 1 upgrade).
2. **🏗️ Architectural Contribution:** Fast-Path Query Compiler in Link 2.
3. **⚖️ Necessity Assessment:** **MISSION CRITICAL (PART 1 CORE)**.
4. **🧠 Deep-Dive Mechanics:** Enforces Numeric Coverage Guard (all integers must be bound to parameters), Polarity Guard (distinguishes absent vs. present columns), and Long-Format Guards. Supports Levenshtein typo-tolerance ($\le 2$).

### 📁 `backend/core/fastIntent.js`
1. **🎯 What It Is & Core Purpose:** Bridge / Re-export stub (`export * from "../src/core/fastIntent.js";`).
2. **🏗️ Architectural Contribution:** Compatibility Shim for legacy benchmark scripts.
3. **⚖️ Necessity Assessment:** **REDUNDANT SHIM**. Can be refactored by updating legacy test import paths to `src/core/fastIntent.js`.
4. **🧠 Deep-Dive Mechanics:** 2-line ESM pass-through.

### 📁 `backend/src/core/distinct.cache.js`
1. **🎯 What It Is & Core Purpose:** In-memory distinct categorical string cache. Loads unique text values (up to 15 per column) from active databases for categorical filter matching.
2. **🏗️ Architectural Contribution:** Semantic Filter Feeder for `fastIntent.js`.
3. **⚖️ Necessity Assessment:** **MISSION CRITICAL (PART 1 CORE)**.
4. **🧠 Deep-Dive Mechanics:** Registers to `registerDatabaseSwitchHook()`, auto-clearing RAM cache on database switches to eliminate cross-database cache pollution.

### 📁 `backend/src/core/schema.reader.js`
1. **🎯 What It Is & Core Purpose:** Dynamic schema extraction, metadata enrichment, and drift detection engine. Introspects tables, columns, foreign keys, row counts, and distinct value samples.
2. **🏗️ Architectural Contribution:** Metaprogramming / Data Layer. Provides enriched schemas to engines, routers, and prompts.
3. **⚖️ Necessity Assessment:** **MISSION CRITICAL**. Foundation of domain independence.
4. **🧠 Deep-Dive Mechanics:** Computes MD5 hash over `sqlite_master` DDL. If unchanged, schema queries serve 100% from RAM cache with **zero PRAGMA or disk calls**. Tables $>50,000$ rows skip distinct sampling to avoid full-table scans.

### 📁 `backend/src/core/schema.resolver.js`
1. **🎯 What It Is & Core Purpose:** NLP entity resolver for heuristic queries. Matches tokens to table and column names using stemming and pluralization rules.
2. **🏗️ Architectural Contribution:** Semantic Resolver for `sql.builder.js`.
3. **⚖️ Necessity Assessment:** **MISSION CRITICAL FOR HEURISTIC FALLBACK**.
4. **🧠 Deep-Dive Mechanics:** Handles regular plurals, `-ies` $\rightarrow$ `-y`, `-sses` $\rightarrow$ `-ss`, while explicitly protecting non-plural singular words ending in `s` (`status`, `campus`, `census`, `address`).

### 📁 `backend/src/core/sql.builder.js`
1. **🎯 What It Is & Core Purpose:** Heuristic query planner and SQL generator supporting 8 baseline query shapes.
2. **🏗️ Architectural Contribution:** Heuristic SQL Planning in Link 2.
3. **⚖️ Necessity Assessment:** **MISSION CRITICAL**.
4. **🧠 Deep-Dive Mechanics:** Contains `quoteIdentifier()` to safely wrap identifiers in escaped double quotes (`"table"`), preventing SQL injection on schema names.

### 📁 `backend/src/core/query.executor.js`
1. **🎯 What It Is & Core Purpose:** Physical SQL execution wrapper. Dispatches query plans to read-write or read-only database singletons.
2. **🏗️ Architectural Contribution:** Execution Dispatcher.
3. **⚖️ Necessity Assessment:** **MISSION CRITICAL**.
4. **🧠 Deep-Dive Mechanics:** Dispatches plans with `readOnly: true` through `getReadOnlyDatabase()`, enforcing OS-level read-only locks.

### 📁 `backend/src/core/response.formatter.js`
1. **🎯 What It Is & Core Purpose:** Output normalization and natural language formatting engine for all 15 dynamic query shapes.
2. **🏗️ Architectural Contribution:** Presentation / Response Synthesis.
3. **⚖️ Necessity Assessment:** **MISSION CRITICAL**.
4. **🧠 Deep-Dive Mechanics:** Rounds floating-point averages to 2 decimal places, formats scalar count answers, and structures tabular records for frontend rendering.

---

## Module 5: Domain Tools Subsystem

### 📁 `backend/src/core/intent.detector.js`
1. **🎯 What It Is & Core Purpose:** Intent classifier for fixed domain capabilities (CGPA, Foreign Students, Hospital Cardiology).
2. **🏗️ Architectural Contribution:** Link 1 Intent Gate in `core.engine.js`.
3. **⚖️ Necessity Assessment:** **HIGH IMPORTANCE FOR FIXED TOOLS**.
4. **🧠 Deep-Dive Mechanics:** Evaluates keywords and workspace organizational context (e.g. matching hospital departments).

### 📁 `backend/src/core/tool.router.js`
1. **🎯 What It Is & Core Purpose:** Tool registry mapping detected intent strings to tool instances.
2. **🏗️ Architectural Contribution:** Factory Registry in Link 1.
3. **⚖️ Necessity Assessment:** **CRITICAL FOR TOOL SUBSYSTEM**.
4. **🧠 Deep-Dive Mechanics:** Exposes `getTool(intent)` returning `{ name, execute }`.

### 📁 `backend/src/tools/education/cgpa.tool.js`
1. **🎯 What It Is & Core Purpose:** Domain-specific analytics tool parsing CGPA thresholds and comparative operators (`>=`, `<=`, `>`, `<`, `=`).
2. **🏗️ Architectural Contribution:** Link 1 Domain Tool.
3. **⚖️ Necessity Assessment:** **OPTIONAL / DOMAIN SPECIFIC**.
4. **🧠 Deep-Dive Mechanics:** Whitelists comparative operators against `['>', '>=', '<', '<=', '=']` to prevent operator-based SQL injection.

### 📁 `backend/src/tools/education/foreign-student.tool.js`
1. **🎯 What It Is & Core Purpose:** Domain-specific analytics tool querying international students outside a configurable domestic home country.
2. **🏗️ Architectural Contribution:** Link 1 Domain Tool.
3. **⚖️ Necessity Assessment:** **OPTIONAL / DOMAIN SPECIFIC**.
4. **🧠 Deep-Dive Mechanics:** Soft-cascade trap: catches `/no such (table|column)/i` and returns `table_not_found` so the core engine cascades cleanly to Link 2 without crashing.

### 📁 `backend/src/tools/hospital/cardiology.tool.js`
1. **🎯 What It Is & Core Purpose:** Domain-specific healthcare analytics tool answering patient visit queries with multi-format date filtering.
2. **🏗️ Architectural Contribution:** Link 1 Domain Tool.
3. **⚖️ Necessity Assessment:** **OPTIONAL / DOMAIN SPECIFIC**.
4. **🧠 Deep-Dive Mechanics:** Translates month names to two-digit SQL LIKE patterns (`%-%m-%`).

---

## Module 6: Persistence, Stores & Data Seeds

### 📁 `backend/src/store/history.store.js`
1. **🎯 What It Is & Core Purpose:** Dedicated conversation audit store and context memory engine managing `backend/data/cognicore_history.db`.
2. **🏗️ Architectural Contribution:** Audit Logging & Memory Layer.
3. **⚖️ Necessity Assessment:** **MISSION CRITICAL**. Required for multi-turn conversational context and frontend chat restoration.
4. **🧠 Deep-Dive Mechanics:** Operates on its own physical file with `PRAGMA journal_mode = WAL;`. `getRecentExchanges(sessionId, 3)` fetches the last 3 exchanges in chronological order for token-budgeted prompt injection.

### 📁 `backend/src/data/demo.data.js`
1. **🎯 What It Is & Core Purpose:** Static JavaScript seed dataset (in-memory arrays of students and hospital visits).
2. **🏗️ Architectural Contribution:** Mock / Seed Data.
3. **⚖️ Necessity Assessment:** **REDUNDANT / SEED ONLY**. Can be safely consolidated or archived into test fixtures.
4. **🧠 Deep-Dive Mechanics:** Plain arrays mirroring tables created by `setupDatabase.js`.

### 📁 `backend/database/setupDatabase.js`
1. **🎯 What It Is & Core Purpose:** Standalone database seed script creating and populating `backend/cognicore.db`.
2. **🏗️ Architectural Contribution:** Developer Utility.
3. **⚖️ Necessity Assessment:** **UTILITY SCRIPT (NON-RUNTIME)**.
4. **🧠 Deep-Dive Mechanics:** Executes raw DDL creating `students` and `hospital_visits`.

### 📁 `backend/generateEcommerceDb.js`
1. **🎯 What It Is & Core Purpose:** Synthetic relational benchmark database generator creating `backend/ecommerce_test.db`.
2. **🏗️ Architectural Contribution:** Benchmark Fixture Generator.
3. **⚖️ Necessity Assessment:** **TEST UTILITY (NON-RUNTIME)**. Required to seed Part D benchmarks.
4. **🧠 Deep-Dive Mechanics:** Builds 5 relational tables (`users`, `categories`, `products`, `orders`, `order_items`) with foreign key constraints.

---

## Module 7: LLM Layer & Security Gates

### 📁 `backend/src/llm/llm.client.js`
1. **🎯 What It Is & Core Purpose:** HTTP client adapter for local Ollama (`http://localhost:11434/api/generate`).
2. **🏗️ Architectural Contribution:** Model Transport Layer (Link 3).
3. **⚖️ Necessity Assessment:** **MISSION CRITICAL FOR LOCAL AI**.
4. **🧠 Deep-Dive Mechanics:** Implements version fallback: sends `think: false` to suppress reasoning tokens; if Ollama returns HTTP 400, it retries without the field. Classifies timeouts, offline states, and 404 missing models.

### 📁 `backend/src/llm/sql.prompt.js`
1. **🎯 What It Is & Core Purpose:** System prompt compiler and context injection engine.
2. **🏗️ Architectural Contribution:** Prompt Engineering / Context Assembly in Link 3.
3. **⚖️ Necessity Assessment:** **MISSION CRITICAL**.
4. **🧠 Deep-Dive Mechanics:** Injects compact schema definitions, categorical value samples ($\le 5$), foreign-key relationships, and recent conversation turns under token budget ceilings.

### 📁 `backend/src/llm/sql.validator.js`
1. **🎯 What It Is & Core Purpose:** Logical AST/Regex security gate (Layer 1 Guard). Pure function, zero dependencies, hostile by default.
2. **🏗️ Architectural Contribution:** Security Boundary (Layer 1). Depended on by `core.engine.js` and `dynamic.query.engine.js`.
3. **⚖️ Necessity Assessment:** **MISSION CRITICAL (SECURITY INVARIANT - FROZEN)**.
4. **🧠 Deep-Dive Mechanics:** Must start with `SELECT` or `WITH`. Blocks 16 mutation keywords (`DELETE`, `DROP`, `UPDATE`, `INSERT`, `ALTER`, `TRUNCATE`, `PRAGMA`, etc.) while allowing `REPLACE()`. Rejects comments (`--`, `/*`) and embedded semicolons. Forcibly clamps limits to `LIMIT 50`.

### 📁 `backend/src/llm/llm.formatter.js`
1. **🎯 What It Is & Core Purpose:** LLM execution output formatter.
2. **🏗️ Architectural Contribution:** Output Normalization in Link 3.
3. **⚖️ Necessity Assessment:** **MISSION CRITICAL**.
4. **🧠 Deep-Dive Mechanics:** Packages raw SQL query rows, model names, and execution latencies into the standard `{ answer, source, data, meta }` response contract.

### 📁 `backend/src/llm/schema.notes.json`
1. **🎯 What It Is & Core Purpose:** Static RAG-lite schema documentation database.
2. **🏗️ Architectural Contribution:** RAG-Lite Knowledge Base consumed by `sql.prompt.js`.
3. **⚖️ Necessity Assessment:** **OPTIONAL ENRICHMENT**.
4. **🧠 Deep-Dive Mechanics:** Provides table-level documentation hints (e.g. linking `artists` $\rightarrow$ `albums`).

---

## Module 8: Frontend Application (React 19 SPA)

### 📁 `frontend/package.json`
1. **🎯 What It Is & Core Purpose:** Frontend package manifest (React 19, React DOM, Vite 7).
2. **🏗️ Architectural Contribution:** Build & dependency configuration.
3. **⚖️ Necessity Assessment:** **MISSION CRITICAL**.
4. **🧠 Deep-Dive Mechanics:** Defines dev server and production build scripts.

### 📁 `frontend/index.html`
1. **🎯 What It Is & Core Purpose:** SPA root HTML document mounting `#root` and `/src/main.jsx`.
2. **🏗️ Architectural Contribution:** Presentation Entry Point.
3. **⚖️ Necessity Assessment:** **MISSION CRITICAL**.
4. **🧠 Deep-Dive Mechanics:** Clean HTML5 viewport and DOM root.

### 📁 `frontend/src/main.jsx`
1. **🎯 What It Is & Core Purpose:** Primary React application component (815 lines). Renders chat stream, SQL inspection panel, data tables, database uploader, and model selector.
2. **🏗️ Architectural Contribution:** Presentation Layer / Complete UI.
3. **⚖️ Necessity Assessment:** **MISSION CRITICAL**.
4. **🧠 Deep-Dive Mechanics:** Manages session IDs in `localStorage`, hydrates history on mount from `/api/history/:sessionId`, and displays dynamic source badges (`badge-tool`, `badge-dynamic`, `badge-llm`, `badge-fallback`) with millisecond latencies.

### 📁 `frontend/src/style.css`
1. **🎯 What It Is & Core Purpose:** Global application stylesheet.
2. **🏗️ Architectural Contribution:** Presentation / Styling.
3. **⚖️ Necessity Assessment:** **HIGH IMPORTANCE FOR USER EXPERIENCE**.
4. **🧠 Deep-Dive Mechanics:** Dark-theme styling, responsive flexbox layout, monospace `.sql-card` displays, and animated thinking indicators.

---

## Module 9: Verification, Benchmark & Test Suite

### 📁 `backend/verify_college_attendance.js`
1. **🎯 What It Is & Core Purpose:** Canonical Part 1 formal acceptance test suite (6/6 hard assertions).
2. **🏗️ Architectural Contribution:** Black-box HTTP regression protection against running backend.
3. **⚖️ Necessity Assessment:** **MISSION CRITICAL ACCEPTANCE SUITE**.
4. **🧠 Deep-Dive Mechanics:** Tests count, absent days, polarity, threshold guards, and clean fallback cascades. Implements reference snapshot/restore pattern for `active-database.json`.

### 📁 `backend/verifyConnLifecycle.js`
1. **🎯 What It Is & Core Purpose:** Connection lifecycle concurrency stress harness.
2. **🏗️ Architectural Contribution:** Concurrency verification.
3. **⚖️ Necessity Assessment:** **CRITICAL CONCURRENCY TEST**.
4. **🧠 Deep-Dive Mechanics:** Fires 20 parallel HTTP queries simultaneously to prove zero `SQLITE_MISUSE` crashes occur under load.

### 📁 `backend/test_phase2_fast_intent_units.js`
1. **🎯 What It Is & Core Purpose:** Unit test suite for `fastIntent.js` (9/9 passed).
2. **🏗️ Architectural Contribution:** Unit-level parser verification.
3. **⚖️ Necessity Assessment:** **HIGH IMPORTANCE UNIT SUITE**.
4. **🧠 Deep-Dive Mechanics:** Verifies typo tolerance (`"attendence"`), numeric coverage guard, and long-format table guards in complete isolation.

### 📁 `backend/test_phase3_distinct_cache.js`
1. **🎯 What It Is & Core Purpose:** Unit test suite for `distinct.cache.js`.
2. **🏗️ Architectural Contribution:** In-memory cache testing.
3. **⚖️ Necessity Assessment:** **HIGH IMPORTANCE TEST**.
4. **🧠 Deep-Dive Mechanics:** Proves distinct values load on demand and are wiped clean on database switch hooks without memory leaks.

### 📁 `backend/verifyLlm1ValidatorSecurity.js`
1. **🎯 What It Is & Core Purpose:** Adversarial security test suite (37 test cases).
2. **🏗️ Architectural Contribution:** Security Boundary Certification.
3. **⚖️ Necessity Assessment:** **CANONICAL SECURITY SUITE (37/37 PASSED)**.
4. **🧠 Deep-Dive Mechanics:** Evaluates hostile injections (`DROP`, `DELETE`, `REPLACE INTO`, union attacks, comments, multi-statement queries), requiring sub-3ms verdicts.

### 📁 `backend/verifyLlm2ClientContract.js`
1. **🎯 What It Is & Core Purpose:** LLM client generation contract test.
2. **🏗️ Architectural Contribution:** Transport contract verification.
3. **⚖️ Necessity Assessment:** **HIGH IMPORTANCE TEST**.
4. **🧠 Deep-Dive Mechanics:** Proves `generateSql()` returns structured errors on offline ports and clean SQL on live models without hanging.

### 📁 `backend/verifyLlm3ReadOnlyPhysical.js`
1. **🎯 What It Is & Core Purpose:** Physical read-only lock penetration test.
2. **🏗️ Architectural Contribution:** Layer 2 Security Audit.
3. **⚖️ Necessity Assessment:** **MISSION CRITICAL SECURITY PROOF**.
4. **🧠 Deep-Dive Mechanics:** Deliberately fires raw `UPDATE` statements at the read-only connection, asserting the native driver throws `SQLITE_READONLY` and rows remain unchanged.

### 📁 `backend/verifyLlm4SimpleRetrieval.js`
1. **🎯 What It Is & Core Purpose:** Basic LLM single-table retrieval test.
2. **🏗️ Architectural Contribution:** Link 3 sanity check.
3. **⚖️ Necessity Assessment:** **HIGH IMPORTANCE QA SCRIPT**.
4. **🧠 Deep-Dive Mechanics:** Confirms Gemma 3 generates valid SQL matching table schemas.

### 📁 `backend/verifyLlm5ComplexJoin.js`
1. **🎯 What It Is & Core Purpose:** Multi-table relational join benchmark.
2. **🏗️ Architectural Contribution:** Cross-table reasoning evaluation.
3. **⚖️ Necessity Assessment:** **HIGH IMPORTANCE BENCHMARK**.
4. **🧠 Deep-Dive Mechanics:** Tests foreign-key traversal (artists $\rightarrow$ albums $\rightarrow$ tracks).

### 📁 `backend/verifyLlm6AdversarialQuestion.js`
1. **🎯 What It Is & Core Purpose:** Natural language prompt injection containment test.
2. **🏗️ Architectural Contribution:** Security verification.
3. **⚖️ Necessity Assessment:** **CRITICAL SECURITY TEST**.
4. **🧠 Deep-Dive Mechanics:** Submits prompts like *"Delete all students"*, asserting zero mutations occur and no destructive SQL executes.

### 📁 `backend/verifyLlm7GarbageOutput.js`
1. **🎯 What It Is & Core Purpose:** Unparseable LLM output recovery test.
2. **🏗️ Architectural Contribution:** Robustness test.
3. **⚖️ Necessity Assessment:** **HIGH IMPORTANCE STABILITY TEST**.
4. **🧠 Deep-Dive Mechanics:** Proves conversational or non-SQL model outputs fail validation safely and cascade to Link 4.

### 📁 `backend/verifyLlm8HallucinatedTable.js`
1. **🎯 What It Is & Core Purpose:** Missing table error containment test.
2. **🏗️ Architectural Contribution:** Fault-tolerance verification.
3. **⚖️ Necessity Assessment:** **HIGH IMPORTANCE STABILITY TEST**.
4. **🧠 Deep-Dive Mechanics:** Catches driver missing table errors and cleanly routes to fallback.

### 📁 `backend/verifyLlm8ModelPickerEndpoint.js`
1. **🎯 What It Is & Core Purpose:** Integration test for `GET /api/llm/models`.
2. **🏗️ Architectural Contribution:** REST API verification.
3. **⚖️ Necessity Assessment:** **HIGH IMPORTANCE TEST**.
4. **🧠 Deep-Dive Mechanics:** Validates returned payload `{ available, current, models }`.

### 📁 `backend/verifyLlm8EndToEndModelOverride.js`
1. **🎯 What It Is & Core Purpose:** Dynamic model parameter override test.
2. **🏗️ Architectural Contribution:** Model seam verification.
3. **⚖️ Necessity Assessment:** **HIGH IMPORTANCE ARCHITECTURAL TEST**.
4. **🧠 Deep-Dive Mechanics:** Proves `{ model: "custom" }` payload overrides default models dynamically.

### 📁 `backend/verifyLlm9OfflineFailover.js`
1. **🎯 What It Is & Core Purpose:** Sub-second failover benchmark test.
2. **🏗️ Architectural Contribution:** Latency SLA audit.
3. **⚖️ Necessity Assessment:** **CRITICAL LATENCY TEST**.
4. **🧠 Deep-Dive Mechanics:** Proves that an offline Ollama daemon cascades to fallback in $<1,500$ms ($<300$ms in practice).

### 📁 `backend/verifyLlm10ThinkStripping.js`
1. **🎯 What It Is & Core Purpose:** Reasoning token sanitizer unit test.
2. **🏗️ Architectural Contribution:** Token hygiene verification.
3. **⚖️ Necessity Assessment:** **HIGH IMPORTANCE SANITIZER TEST**.
4. **🧠 Deep-Dive Mechanics:** Strips multiline `<think>...</think>` XML blocks generated by reasoning models (DeepSeek-R1, Qwen).

### 📁 `backend/verifyP3_1Persistence.js`
1. **🎯 What It Is & Core Purpose:** Storage persistence integration test.
2. **🏗️ Architectural Contribution:** Memory layer verification.
3. **⚖️ Necessity Assessment:** **HIGH IMPORTANCE TEST**.
4. **🧠 Deep-Dive Mechanics:** Proves interactions written to `cognicore_history.db` physically survive process restarts.

### 📁 `backend/verifyP3_2FollowUp.js`
1. **🎯 What It Is & Core Purpose:** Contextual follow-up question test.
2. **🏗️ Architectural Contribution:** Multi-turn conversational benchmark.
3. **⚖️ Necessity Assessment:** **HIGH IMPORTANCE CAPABILITY TEST**.
4. **🧠 Deep-Dive Mechanics:** Evaluates pronoun and context resolution using injected conversation history.

### 📁 `backend/verifyP3_3SessionIsolation.js`
1. **🎯 What It Is & Core Purpose:** Multi-tenant session security test.
2. **🏗️ Architectural Contribution:** Data privacy audit.
3. **⚖️ Necessity Assessment:** **CRITICAL PRIVACY TEST**.
4. **🧠 Deep-Dive Mechanics:** Proves Session 1 cannot access Session 2 conversation records.

### 📁 `backend/verifyP3_4Hydration.js`
1. **🎯 What It Is & Core Purpose:** Full chat history rehydration test.
2. **🏗️ Architectural Contribution:** Frontend hydration API audit.
3. **⚖️ Necessity Assessment:** **HIGH IMPORTANCE TEST**.
4. **🧠 Deep-Dive Mechanics:** Validates that `GET /api/history/:sessionId` returns chronologically sorted messages (`ORDER BY id ASC`).

### 📁 `backend/verifyP3_5SurvivesSwitch.js`
1. **🎯 What It Is & Core Purpose:** Memory decoupling verification test.
2. **🏗️ Architectural Contribution:** Subsystem isolation audit.
3. **⚖️ Necessity Assessment:** **HIGH IMPORTANCE TEST**.
4. **🧠 Deep-Dive Mechanics:** Proves that switching operational databases does not wipe conversation history.

### 📁 `backend/verifyP3_6PromptOverhead.js`
1. **🎯 What It Is & Core Purpose:** Token budget ceiling test.
2. **🏗️ Architectural Contribution:** Performance audit.
3. **⚖️ Necessity Assessment:** **HIGH IMPORTANCE OPTIMIZATION TEST**.
4. **🧠 Deep-Dive Mechanics:** Proves 3 turns of history consume no more than $\sim 227$ prompt tokens.

### 📁 `backend/verifyTest2SwitchInvalidation.js`
1. **🎯 What It Is & Core Purpose:** Schema cache invalidation test.
2. **🏗️ Architectural Contribution:** Cache coherency verification.
3. **⚖️ Necessity Assessment:** **CRITICAL CACHE TEST**.
4. **🧠 Deep-Dive Mechanics:** Confirms `switchDatabase()` evicts RAM schema caches immediately.

### 📁 `backend/verifyTest3ConcurrentSwitch.js`
1. **🎯 What It Is & Core Purpose:** Race condition concurrency test.
2. **🏗️ Architectural Contribution:** Concurrency stress test.
3. **⚖️ Necessity Assessment:** **CRITICAL CONCURRENCY TEST**.
4. **🧠 Deep-Dive Mechanics:** Fires 5 concurrent database switches, proving the serialized queue resolves sequentially without deadlocks.

### 📁 `backend/verifyTest4FailedSwitch.js`
1. **🎯 What It Is & Core Purpose:** Error resilience and fallback retention test.
2. **🏗️ Architectural Contribution:** Fault tolerance test.
3. **⚖️ Necessity Assessment:** **HIGH IMPORTANCE STABILITY TEST**.
4. **🧠 Deep-Dive Mechanics:** Proves invalid target paths throw errors but keep the existing active database connection alive.

### 📁 `backend/verifyTest6NonBlocking.js`
1. **🎯 What It Is & Core Purpose:** Event-loop lag audit.
2. **🏗️ Architectural Contribution:** Asynchronous performance verification.
3. **⚖️ Necessity Assessment:** **HIGH IMPORTANCE PERFORMANCE TEST**.
4. **🧠 Deep-Dive Mechanics:** Measures timer jitter during heavy schema extractions to prove zero blocking I/O occurs.

### 📁 `backend/verifyTest6SlowDisk.js`
1. **🎯 What It Is & Core Purpose:** Simulated slow I/O stress test.
2. **🏗️ Architectural Contribution:** Storage resilience test.
3. **⚖️ Necessity Assessment:** **SPECIALIZED STRESS TEST**.
4. **🧠 Deep-Dive Mechanics:** Verifies temporary atomic files are cleanly reclaimed during delayed writes.

### 📁 `backend/verifyCacheHitMiss.js`
1. **🎯 What It Is & Core Purpose:** Schema cache metrics audit script.
2. **🏗️ Architectural Contribution:** Performance audit.
3. **⚖️ Necessity Assessment:** **HIGH IMPORTANCE AUDIT SCRIPT**.
4. **🧠 Deep-Dive Mechanics:** Proves subsequent schema reads hit RAM with 0 PRAGMA queries and 0 disk calls.

### 📁 `backend/verifyPhase2StalenessTrap.js`
1. **🎯 What It Is & Core Purpose:** DDL mutation cache eviction test.
2. **🏗️ Architectural Contribution:** Cache integrity test.
3. **⚖️ Necessity Assessment:** **CRITICAL CACHE TEST**.
4. **🧠 Deep-Dive Mechanics:** Modifies `sqlite_master` DDL in-place, verifying the MD5 hash drift check evicts stale cache.

### 📁 `backend/testActiveDatabase.js`
1. **🎯 What It Is & Core Purpose:** CLI terminal diagnostic script.
2. **🏗️ Architectural Contribution:** Developer Tooling.
3. **⚖️ Necessity Assessment:** **DEV TOOLING ONLY (NON-RUNTIME)**.
4. **🧠 Deep-Dive Mechanics:** Prints active database path and readable tables to console.

### 📁 `backend/testSchema.js`
1. **🎯 What It Is & Core Purpose:** Full schema inspection dump script.
2. **🏗️ Architectural Contribution:** Developer Tooling.
3. **⚖️ Necessity Assessment:** **DEV TOOLING ONLY (NON-RUNTIME)**.
4. **🧠 Deep-Dive Mechanics:** Dumps enriched schema objects via `console.dir(..., { depth: null })`.

### 📁 `backend/runPartBParityBenchmark.js`
1. **🎯 What It Is & Core Purpose:** Domain parity benchmark runner for `chinook.db`.
2. **🏗️ Architectural Contribution:** Domain Benchmark Suite.
3. **⚖️ Necessity Assessment:** **HIGH IMPORTANCE BENCHMARK**.
4. **🧠 Deep-Dive Mechanics:** Batch evaluates media store queries before and after engine upgrades.

### 📁 `backend/runPartDEcommerceBenchmark.js`
1. **🎯 What It Is & Core Purpose:** E-commerce benchmark runner for `ecommerce_test.db`.
2. **🏗️ Architectural Contribution:** Domain Benchmark Suite.
3. **⚖️ Necessity Assessment:** **HIGH IMPORTANCE BENCHMARK**.
4. **🧠 Deep-Dive Mechanics:** Benchmarks numeric and categorical filtering on synthetic e-commerce tables.

---

## Module 10: Bundled SQLite Database Artifacts

### 📁 `backend/chinook.db`
1. **🎯 What It Is & Core Purpose:** Standard 3NF relational benchmark media database (11 tables).
2. **🏗️ Architectural Contribution:** Default out-of-the-box fallback database fixture.
3. **⚖️ Necessity Assessment:** **MISSION CRITICAL DEFAULT FIXTURE**.
4. **🧠 Deep-Dive Mechanics:** Relational schema with composite keys, foreign keys, and manager-employee hierarchies.

### 📁 `backend/cognicore.db`
1. **🎯 What It Is & Core Purpose:** Legacy seed database containing primitive student and hospital visit tables.
2. **🏗️ Architectural Contribution:** Legacy Test Fixture.
3. **⚖️ Necessity Assessment:** **OPTIONAL / LEGACY FIXTURE**.
4. **🧠 Deep-Dive Mechanics:** Small flat tables ($\le 10$ rows) used for fixed-tool unit regression testing.

### 📁 `backend/ecommerce_test.db`
1. **🎯 What It Is & Core Purpose:** Relational e-commerce database (5 tables: users, categories, products, orders, order items).
2. **🏗️ Architectural Contribution:** Benchmark Test Fixture for Part D.
3. **⚖️ Necessity Assessment:** **TEST FIXTURE ONLY**.
4. **🧠 Deep-Dive Mechanics:** Relational joins and timestamps representing customer orders.

### 📁 `backend/erp_demo.db`
1. **🎯 What It Is & Core Purpose:** Canonical ERP demo database modeling corporate departments, employees, clients, projects, and invoices.
2. **🏗️ Architectural Contribution:** Core Demonstration Data Layer.
3. **⚖️ Necessity Assessment:** **CRITICAL DEMO ARTIFACT**.
4. **🧠 Deep-Dive Mechanics:** Encodes canonical demo invariants (Tariq Patel = 7 direct reports, 3 VIP clients, 9 invoice-less clients).

### 📁 `backend/sakila.db`
1. **🎯 What It Is & Core Purpose:** SQLite port of the Sakila DVD rental database.
2. **🏗️ Architectural Contribution:** Complex Stress-Testing Fixture.
3. **⚖️ Necessity Assessment:** **OPTIONAL STRESS FIXTURE**.
4. **🧠 Deep-Dive Mechanics:** Many-to-many join tables (`film_actor`, `film_category`) for deep relationship prompt stress testing.

### 📁 `backend/data/cognicore_history.db` (and `-wal`, `-shm`)
1. **🎯 What It Is & Core Purpose:** Dedicated internal audit and memory SQLite database.
2. **🏗️ Architectural Contribution:** Operational Audit & Context Memory Store.
3. **⚖️ Necessity Assessment:** **MISSION CRITICAL (SYSTEM DATA)**.
4. **🧠 Deep-Dive Mechanics:** Operates with Write-Ahead Logging (`-wal`, `-shm`), allowing non-blocking concurrent reads during background writes.

---

# PART III: Architectural Synthesis Matrix

| Subsystem | Primary Files | Architectural Layer | Runtime Necessity | Key Mechanics & Invariants |
| :--- | :--- | :--- | :--- | :--- |
| **HTTP Gateway & Routing** | `server.js`, `ai.routes.js`, `database.routes.js` | Transport / Gateway | **Mission Critical** | Express 5, Multer 50MB file validation, JSON error middleware. |
| **Request Controllers** | `ai.controller.js`, `database.controller.js` | Application Orchestration | **Mission Critical** | Session UUID resolution, magic header inspection, non-blocking history logging. |
| **Database Engine & Switcher** | `config/database.js`, `active-database.json` | Infrastructure / Data Layer | **Mission Critical** | Async `sqlite3`, persistent singletons, promise-chained switch queue, switch hooks. |
| **Core Cascade Engine** | `core.engine.js` | Core Business Logic | **Mission Critical** | 4-link soft cascade (`Tools → Dynamic → LLM → Fallback`), `COLLATE NOCASE` auto-recovery. |
| **Deterministic NLP Query Engine** | `dynamic.query.engine.js`, `fastIntent.js`, `distinct.cache.js` | Semantic Processing | **Mission Critical** | 15 query shapes, Numeric Coverage Guard, Polarity Guard, sub-50ms execution. |
| **Schema Metaprogramming** | `schema.reader.js`, `schema.resolver.js`, `sql.builder.js`, `query.executor.js`, `response.formatter.js` | Metaprogramming / Data Access | **Mission Critical** | MD5 DDL drift check, RAM schema cache, stemming normalizer, identifier quoting. |
| **Domain-Specific Tools** | `intent.detector.js`, `tool.router.js`, `cgpa.tool.js`, `foreign-student.tool.js`, `cardiology.tool.js` | Fixed Capability Extensions | **High / Optional** | Education and Healthcare handlers; soft-cascades quietly if tables are missing. |
| **Context Memory & Audit** | `history.store.js`, `cognicore_history.db` | Persistence / State | **Mission Critical** | WAL-mode SQLite database tracking sessions, multi-turn history, and latency. |
| **Local LLM Layer** | `llm.client.js`, `sql.prompt.js`, `sql.validator.js`, `llm.formatter.js`, `schema.notes.json` | AI Reasoning & Security | **Mission Critical** | Ollama client, token budgeting, frozen Layer 1 AST/regex security gate. |
| **React Presentation Layer** | `package.json`, `index.html`, `main.jsx`, `style.css` | Frontend / Client UI | **Mission Critical** | React 19 SPA with live SQL inspection, source badges, and database uploader. |
| **Verification & Benchmarks** | `verify_college_attendance.js`, `verifyLlm*.js`, `verifyP3_*.js`, `verifyTest*.js`, etc. | Quality Assurance / CI | **Critical QA (Non-Runtime)** | 28 automated test scripts guaranteeing 6/6 acceptance and 37/37 security validation. |

---
*End of Complete Blueprint and Exhaustive Codebase Audit Document.*
