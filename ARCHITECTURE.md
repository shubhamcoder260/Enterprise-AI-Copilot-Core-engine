# CogniCore System Architecture

## 1. Overview
CogniCore is an on-premises, air-gapped natural language to SQL (NL→SQL) enterprise analytics engine with a Node.js backend, a modern React frontend, and multi-dialect SQL execution support across SQLite, MariaDB (ERPNext v14/v15/v16), and PostgreSQL. Designed for secure internal deployments, CogniCore prevents hallucination, unauthorized privilege escalation, and credential leakage through deterministic truth-and-safety gates, Row-Level Security (RLS) policies, and an honesty verification chain.

---

## 2. The 7-Layer CAP Architecture (CAP v2.2)

CogniCore is structured around the 7-Layer Connectivity Architecture Plan (CAP v2.2):

```
┌─────────────────────────────────────────────────────────────────────────┐
│ L7: Source Experience (Frontend React UI & Multi-Source Tooling)        │
│     DatabaseSidebar, ConnectionWizardModal, SourceManagerModal,         │
│     Visualizer (Vega-Lite), ChatWindow, SqlModal, formatRenderers       │
├─────────────────────────────────────────────────────────────────────────┤
│ L6: Truth & Safety Gates (Deterministic Defense-in-Depth)                │
│     gate.selector.js -> [Dialect Validators -> AST Gates -> RO-Exec]     │
│     rls.policy.js (Fail-Closed, Probes, Predicate Injection)            │
│     verify.chain.js (Token Grounding, Arithmetic Re-computation)        │
│     action.gateway.js (Governed Writes, SoD, SHA-256 Audit Log)         │
├─────────────────────────────────────────────────────────────────────────┤
│ L5: Semantic Mapping & Entity Resolution                                │
│     semantic.profile.js, profiles/erpnext.profile.js, concept.layer.js  │
│     Natural language business terminology mapped to ERP DocTypes        │
├─────────────────────────────────────────────────────────────────────────┤
│ L4: Schema Introspection & Dynamic Pruning                              │
│     schema.reader.js, mariadb.schema.reader.js, postgres.schema.reader.js│
│     schema.pruner.js (Distractor exclusion, token-equality scoring)     │
├─────────────────────────────────────────────────────────────────────────┤
│ L3: Dialect Engine & Grammar Normalization                              │
│     src/adapters/dialects/index.js (One-knob quoting, date functions,   │
│     parser grammar, ANSI_QUOTES bindings)                               │
├─────────────────────────────────────────────────────────────────────────┤
│ L2: Protocol Adapters (Read & Governed Write)                           │
│     Read: sqlite.adapter.js, mariadb.adapter.js, postgres.adapter.js    │
│     Write: src/adapters/write/ (sqlite, mariadb, postgres write adapters│
├─────────────────────────────────────────────────────────────────────────┤
│ L1: Source Registry & Credential Vault                                  │
│     config/sources.js, config/credentials.js, store/source.store.js     │
│     security/credential.vault.js (AES-256-GCM encrypted at rest)        │
└─────────────────────────────────────────────────────────────────────────┘
```

- **L1 Source Registry:** [`config/sources.js`](file:///home/shubh/Documents/project/cognicore/Cognicore/CogniCore_Project/backend/src/config/sources.js), [`config/credentials.js`](file:///home/shubh/Documents/project/cognicore/Cognicore/CogniCore_Project/backend/src/config/credentials.js), and [`security/credential.vault.js`](file:///home/shubh/Documents/project/cognicore/Cognicore/CogniCore_Project/backend/src/security/credential.vault.js) manage physical connectivity definitions and encrypted credential storage at rest in `cognicore_vault.db`.
- **L2 Protocol Adapters:** [`src/adapters/`](file:///home/shubh/Documents/project/cognicore/Cognicore/CogniCore_Project/backend/src/adapters/) (`sqlite.adapter.js`, `mariadb.adapter.js`, `postgres.adapter.js`) isolate connection pooling and read-only query execution. Mutating writes are isolated in [`src/adapters/write/`](file:///home/shubh/Documents/project/cognicore/Cognicore/CogniCore_Project/backend/src/adapters/write/) (`sqlite.write-adapter.js`, `mariadb.write-adapter.js`, `postgres.write-adapter.js`), accessible only via approved Action Gateway executions.
- **L3 Dialect Engine:** [`src/adapters/dialects/index.js`](file:///home/shubh/Documents/project/cognicore/Cognicore/CogniCore_Project/backend/src/adapters/dialects/index.js) provides dialect-specific identifier quoting, date formatting functions, and AST grammar selection (`sqlite`, `mariadb`/`mysql`, `postgresql`).
- **L4 Schema Introspection:** [`core/schema.reader.js`](file:///home/shubh/Documents/project/cognicore/Cognicore/CogniCore_Project/backend/src/core/schema.reader.js), [`core/mariadb.schema.reader.js`](file:///home/shubh/Documents/project/cognicore/Cognicore/CogniCore_Project/backend/src/core/mariadb.schema.reader.js), and [`core/postgres.schema.reader.js`](file:///home/shubh/Documents/project/cognicore/Cognicore/CogniCore_Project/backend/src/core/postgres.schema.reader.js) generate uniform schema metadata across dialects. [`core/schema.pruner.js`](file:///home/shubh/Documents/project/cognicore/Cognicore/CogniCore_Project/backend/src/core/schema.pruner.js) prunes irrelevant tables to minimize prompt token bloat and eliminate distractor tables.
- **L5 Semantic Mapping:** [`config/semantic.profile.js`](file:///home/shubh/Documents/project/cognicore/Cognicore/CogniCore_Project/backend/src/config/semantic.profile.js), [`config/profiles/erpnext.profile.js`](file:///home/shubh/Documents/project/cognicore/Cognicore/CogniCore_Project/backend/src/config/profiles/erpnext.profile.js), and [`core/concept.layer.js`](file:///home/shubh/Documents/project/cognicore/Cognicore/CogniCore_Project/backend/src/core/concept.layer.js) map enterprise concepts (Sales, Accounts, Stock, HR) to underlying DocTypes (e.g. `tabSales Invoice`, `tabEmployee`, `tabItem`).
- **L6 Truth & Safety:** [`kernel/gate.selector.js`](file:///home/shubh/Documents/project/cognicore/Cognicore/CogniCore_Project/backend/src/kernel/gate.selector.js) dispatches dialect-aware gate chains; [`security/rls.policy.js`](file:///home/shubh/Documents/project/cognicore/Cognicore/CogniCore_Project/backend/src/security/rls.policy.js) enforces fail-closed Row-Level Security; [`kernel/verify.chain.js`](file:///home/shubh/Documents/project/cognicore/Cognicore/CogniCore_Project/backend/src/kernel/verify.chain.js) enforces numeric token grounding and arithmetic consistency; [`security/action.gateway.js`](file:///home/shubh/Documents/project/cognicore/Cognicore/CogniCore_Project/backend/src/security/action.gateway.js) gates write mutations with cryptographic audit trails.
- **L7 Source Experience:** Frontend components provide source switching, connection testing, data exploration, chat interface, query inspection, and Vega-Lite visualization rendering.

---

## 3. Query Lifecycle (End-to-End Trace)

An incoming natural-language analytical question (e.g., *"What were our total submitted sales invoices last month?"*) traverses the following lifecycle:

1. **HTTP Ingestion & Authentication:** The request hits `POST /api/ai/query`. [`middleware/auth.js`](file:///home/shubh/Documents/project/cognicore/Cognicore/CogniCore_Project/backend/src/middleware/auth.js) validates the caller's JWT token, extracts user identity (`userId`, `roles`, `employeeId`), and injects verified cryptographic identity onto `req.user`.
2. **Controller & Source Lease Acquisition:** [`controllers/ai.controller.js`](file:///home/shubh/Documents/project/cognicore/Cognicore/CogniCore_Project/backend/src/controllers/ai.controller.js) coordinates execution. It requests an active query lease from [`kernel/switch.orchestrator.js`](file:///home/shubh/Documents/project/cognicore/Cognicore/CogniCore_Project/backend/src/kernel/switch.orchestrator.js) to guarantee concurrency safety against mid-query database switches, and loads source capabilities from the active descriptor.
3. **Core Engine Cascade:** [`core/core.engine.js`](file:///home/shubh/Documents/project/cognicore/Cognicore/CogniCore_Project/backend/src/core/core.engine.js) executes the staged pipeline defined in [`kernel/pipeline.config.js`](file:///home/shubh/Documents/project/cognicore/Cognicore/CogniCore_Project/backend/src/kernel/pipeline.config.js):
   - **Link 1 (Deterministic fastIntent):** Checks for sub-millisecond compiled SQL matches via [`core/fastIntent.js`](file:///home/shubh/Documents/project/cognicore/Cognicore/CogniCore_Project/backend/src/core/fastIntent.js).
   - **Link 2 (Dynamic Query Engine):** Attempts schema-guided entity composition via [`core/dynamic.query.engine.js`](file:///home/shubh/Documents/project/cognicore/Cognicore/CogniCore_Project/backend/src/core/dynamic.query.engine.js).
   - **Link 3 (LLM Inference):** If unresolved, [`llm/sql.prompt.js`](file:///home/shubh/Documents/project/cognicore/Cognicore/CogniCore_Project/backend/src/llm/sql.prompt.js) constructs a pruned, dialect-tailored schema prompt with `docstatus = 1` rules and dispatches to [`llm/llm.client.js`](file:///home/shubh/Documents/project/cognicore/Cognicore/CogniCore_Project/backend/src/llm/llm.client.js) (local Ollama instance running `gemma3:4b`).
   - **Link 4 (Fallback Link):** Graceful recovery if inference fails or timeouts occur.
4. **Dialect-Aware Gate Chain Validation:** The candidate SQL passes through [`kernel/gate.selector.js`](file:///home/shubh/Documents/project/cognicore/Cognicore/CogniCore_Project/backend/src/kernel/gate.selector.js) into a dialect-specific gate chain:
   - **Syntax & Regex Validator:** [`llm/mariadb.validator.js`](file:///home/shubh/Documents/project/cognicore/Cognicore/CogniCore_Project/backend/src/llm/mariadb.validator.js) (or Postgres/SQLite validator) rejects multiple statements, forbidden comments, and DDL/DML keywords.
   - **AST Security Gate:** [`kernel/ast.gate.mariadb.js`](file:///home/shubh/Documents/project/cognicore/Cognicore/CogniCore_Project/backend/src/kernel/ast.gate.mariadb.js) parses the AST via `node-sql-parser`, verifies statement type is strictly `SELECT`, and verifies column/table references.
   - **Row-Level Security (RLS) Gate:** [`security/rls.policy.js`](file:///home/shubh/Documents/project/cognicore/Cognicore/CogniCore_Project/backend/src/security/rls.policy.js) checks tenant/employee boundaries. Probing unauthorized employee salaries yields an immediate zero-SQL rejection (`REJECT_FORBIDDEN`). For self-service employee queries, it injects ownership predicates (e.g. `WHERE employee = 'EMP-002'`).
5. **Physical Read-Only Execution:** The validated SQL reaches [`adapters/mariadb.adapter.js`](file:///home/shubh/Documents/project/cognicore/Cognicore/CogniCore_Project/backend/src/adapters/mariadb.adapter.js). The connection pool enforces `SET sql_mode = CONCAT(@@sql_mode, ',ANSI_QUOTES')` and uses low-privilege credentials (`cognicore_ro`).
6. **Honesty Verification Chain:** Execution rows are passed to [`kernel/verify.chain.js`](file:///home/shubh/Documents/project/cognicore/Cognicore/CogniCore_Project/backend/src/kernel/verify.chain.js):
   - **Token Grounding:** Extracts all numeric, monetary, and percentage tokens from the natural language response and proves each exists in the empirical database payload or query inputs.
   - **Arithmetic Re-calculation:** Recomputes sums, averages, and counts from raw records to prevent LLM mental math hallucinations.
   - **Fail-Honest Flagging:** Hallucinated or ungrounded values trigger warning disclosures or downgrades.
7. **Presentation Assembly & Response:** [`core/presentation.intent.js`](file:///home/shubh/Documents/project/cognicore/Cognicore/CogniCore_Project/backend/src/core/presentation.intent.js) selects visual representations, and [`kernel/formatter.registry.js`](file:///home/shubh/Documents/project/cognicore/Cognicore/CogniCore_Project/backend/src/kernel/formatter.registry.js) packages structured payloads (`kpi`, `table`, `chartSpec`, `report`, `csv`) returned to the frontend.

---

## 4. Safety Architecture

### 4.1 Frozen Files and the Re-Pin Protocol
To prevent silent regressions in core invariants, **10 Tier-1 files** are cryptographically frozen with baseline SHA-256 hashes monitored by [`backend/test/audit-freeze.js`](file:///home/shubh/Documents/project/cognicore/Cognicore/CogniCore_Project/backend/test/audit-freeze.js):

1. `src/llm/sql.validator.js`
2. `src/kernel/gate.chain.js`
3. `src/kernel/pipeline.config.js`
4. `src/kernel/handler-result.js`
5. `src/kernel/formatter.registry.js`
6. `src/core/result.sanity.js`
7. `src/core/guard-markers.js`
8. `src/llm/llm.client.js`
9. `src/config/semantic.profile.js`
10. `src/config/database.js`

**The Re-Pin Protocol:** Tier-1 files may only be modified under formal architectural re-pin events (such as Phase D3 Postgres porting, Phase D5 write-boundary sealing, or VULN fixes). A re-pin requires:
- Explicit architectural rationale documented in commit notes and records.
- 100% green pass on the full regression battery.
- Updating the baseline hash in `audit-freeze.js` and updating associated golden test corpora (`verifyFastIntentGolden.js`, `verifyGateIntegrity.js`).

### 4.2 Row-Level Security (RLS) Policy Engine
Implemented in [`security/rls.policy.js`](file:///home/shubh/Documents/project/cognicore/Cognicore/CogniCore_Project/backend/src/security/rls.policy.js) (512 lines):
- **Fail-Closed by Default:** Any table not explicitly listed in `OPEN_TABLES_ALLOWLIST` or governed by a specific policy yields an immediate `rls_forbidden:unpolicied_table` refusal.
- **Salary & Payroll Isolation:** Probing sensitive tables (`tabSalary Slip`, `tabPayroll Entry`) by non-executive users triggers a zero-SQL rejection (`callCount === 0` on adapters).
- **Automatic Predicate Injection:** Legitimate queries by employees for their own records receive injected AST predicates (`employee = :callerEmpId AND docstatus = 1`).

### 4.3 Action Gateway (Governed Write Pathway)
Mutating queries are forbidden through the general NL→SQL pipeline. Database mutations must execute through [`security/action.gateway.js`](file:///home/shubh/Documents/project/cognicore/Cognicore/CogniCore_Project/backend/src/security/action.gateway.js) (357 lines):
- **Lifecycle:** `propose` $\rightarrow$ `approve` $\rightarrow$ `execute`.
- **Allowlisted Templates:** Mutations must bind strictly to hand-authored, immutable SQL templates in [`security/write.templates.js`](file:///home/shubh/Documents/project/cognicore/Cognicore/CogniCore_Project/backend/src/security/write.templates.js) with rigid parameter schema validation.
- **Separation of Duties (SoD):** The identity proposing an action cannot approve it unless explicitly flagged as `selfApproveEligible`.
- **Cryptographic Audit Log:** Every action lifecycle transition is written to [`store/action.audit.log.js`](file:///home/shubh/Documents/project/cognicore/Cognicore/CogniCore_Project/backend/src/store/action.audit.log.js) with SHA-256 forward hash chaining.

### 4.4 SQLSTATE & Privilege Enforcement
Database security is enforced at the DBMS driver and server privilege level:
- Read-only queries execute under user `cognicore_ro`. In MariaDB, missing privileges trigger `ERROR 1142 (42000)`. In PostgreSQL, physical role privileges have `REVOKE INSERT, UPDATE, DELETE, TRUNCATE` (SQLSTATE `42501`) backed by connection parameter `default_transaction_read_only=on` (SQLSTATE `25006`).
- Write queries execute solely via dedicated `cognicore_write` credentials with table-level grants limited strictly to allowlisted operational tables.

---

## 5. Frontend Architecture

The frontend is a single-page application built with Vite and React:
- [`main.jsx`](file:///home/shubh/Documents/project/cognicore/Cognicore/CogniCore_Project/frontend/src/main.jsx) (115 lines): Composition root and application layout shell.
- [`components/DatabaseSidebar.jsx`](file:///home/shubh/Documents/project/cognicore/Cognicore/CogniCore_Project/frontend/src/components/DatabaseSidebar.jsx) (423 lines): Active source selection, table list exploration, and connection status.
- [`components/ConnectionWizardModal.jsx`](file:///home/shubh/Documents/project/cognicore/Cognicore/CogniCore_Project/frontend/src/components/ConnectionWizardModal.jsx) (973 lines): Multi-step self-service connection wizard supporting TCP probe, credential validation, DB discovery, schema pre-flight, and RLS notice.
- [`components/SourceManagerModal.jsx`](file:///home/shubh/Documents/project/cognicore/Cognicore/CogniCore_Project/frontend/src/components/SourceManagerModal.jsx) (339 lines): Dynamic source configuration, credential modification, and source deletion.
- [`components/Visualizer.jsx`](file:///home/shubh/Documents/project/cognicore/Cognicore/CogniCore_Project/frontend/src/components/Visualizer.jsx) (61 lines): Polymorphic Vega-Lite chart renderer for aggregated query results.
- [`components/ChatWindow.jsx`](file:///home/shubh/Documents/project/cognicore/Cognicore/CogniCore_Project/frontend/src/components/ChatWindow.jsx) (224 lines): Conversational query interface with honesty notice badges and execution timing.
- [`components/SqlModal.jsx`](file:///home/shubh/Documents/project/cognicore/Cognicore/CogniCore_Project/frontend/src/components/SqlModal.jsx) (270 lines): Transparent query inspection displaying raw SQL, AST structure, and execution parameters.
- [`lib/formatRenderers.jsx`](file:///home/shubh/Documents/project/cognicore/Cognicore/CogniCore_Project/frontend/src/lib/formatRenderers.jsx) (298 lines): Renders tables, KPI stat cards, markdown summaries, and charts.
- [`lib/api.js`](file:///home/shubh/Documents/project/cognicore/Cognicore/CogniCore_Project/frontend/src/lib/api.js) (231 lines): API client managing JWT bearer authorization and source switching endpoints.

---

## 6. Known Limitations

To maintain architectural transparency, the following limitations are explicitly documented:
1. **Narrow RLS Policy Set:** Dynamic RLS predicate injection and probe blocking is presently implemented for employee/HR salary scenarios (`tabSalary Slip`, `tabEmployee`). All other unpolicied tables fail-closed; broader multi-entity policies (e.g. cross-branch or territory isolation) are not yet authored.
2. **Write Pathway Fixture Validation:** The Action Gateway write pathway has been verified on local development test fixtures and Docker containers; it has not been validated on a live production ERPNext instance.
3. **Single-Tenant & Non-Clustered:** The system operates as a single-tenant deployment without horizontal clustering or distributed node-to-node lease synchronization.
4. **No External Security Audit:** While hardened against VULN-01 through VULN-13 and backed by 26 automated regression suites, CogniCore has not undergone formal third-party penetration testing or external code audit.
5. **fastIntent Complex Query Boundary:** `fastIntent.js` handles direct lookups, counts, sums, and single-dimension filters with sub-millisecond latency. Queries requiring multi-table `JOIN` operations or complex `GROUP BY` logic automatically fall through to the local LLM link.
