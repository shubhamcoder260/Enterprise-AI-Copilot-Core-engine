# CogniCore Project Context & Module Catalog

## 1. Scope

CogniCore is an on-premises, air-gapped natural language to SQL (NL→SQL) enterprise analytics engine designed for business intelligence over production databases. It natively supports SQLite, MariaDB (ERPNext v14/v15/v16), and PostgreSQL. CogniCore operates without external data egress, utilizing local LLM inference engines (such as Gemma 3 4B via Ollama) guarded by deterministic security gates, fail-closed Row-Level Security (RLS), an honesty verification chain, and a governed write pathway.

---

## 2. Repository Layout

```text
CogniCore_Project/
├── backend/
│   ├── .env.example
│   ├── package.json
│   ├── src/
│   │   ├── server.js
│   │   ├── adapters/
│   │   │   ├── dialects/
│   │   │   │   └── index.js
│   │   │   ├── erp.meta.js
│   │   │   ├── mariadb.adapter.js
│   │   │   ├── postgres.adapter.js
│   │   │   ├── sqlite.adapter.js
│   │   │   └── write/
│   │   │       ├── index.js
│   │   │       ├── mariadb.write-adapter.js
│   │   │       ├── postgres.write-adapter.js
│   │   │       └── sqlite.write-adapter.js
│   │   ├── config/
│   │   │   ├── credentials.js
│   │   │   ├── database.js
│   │   │   ├── profiles/
│   │   │   │   └── erpnext.profile.js
│   │   │   ├── semantic.profile.js
│   │   │   └── sources.js
│   │   ├── controllers/
│   │   │   ├── action.controller.js
│   │   │   ├── ai.controller.js
│   │   │   ├── database.controller.js
│   │   │   └── source.controller.js
│   │   ├── core/
│   │   │   ├── concept.layer.js
│   │   │   ├── core.engine.js
│   │   │   ├── distinct.cache.js
│   │   │   ├── dynamic.query.engine.js
│   │   │   ├── fastIntent.js
│   │   │   ├── grounding.guard.js
│   │   │   ├── guard-markers.js
│   │   │   ├── intent.detector.js
│   │   │   ├── intent.ir.js
│   │   │   ├── links/
│   │   │   │   ├── dynamic.link.js
│   │   │   │   ├── fallback.link.js
│   │   │   │   ├── llm.link.js
│   │   │   │   └── tool.link.js
│   │   │   ├── mariadb.schema.reader.js
│   │   │   ├── postgres.schema.reader.js
│   │   │   ├── presentation.intent.js
│   │   │   ├── query.executor.js
│   │   │   ├── response.formatter.js
│   │   │   ├── result.sanity.js
│   │   │   ├── schema.pruner.js
│   │   │   ├── schema.reader.js
│   │   │   ├── schema.resolver.js
│   │   │   ├── sql.builder.js
│   │   │   └── tool.router.js
│   │   ├── kernel/
│   │   │   ├── ast.gate.core.js
│   │   │   ├── ast.gate.js
│   │   │   ├── ast.gate.mariadb.js
│   │   │   ├── ast.gate.postgres.js
│   │   │   ├── capabilities.core.js
│   │   │   ├── capabilities.js
│   │   │   ├── formatter.registry.js
│   │   │   ├── gate.chain.js
│   │   │   ├── gate.selector.js
│   │   │   ├── handler-result.js
│   │   │   ├── pipeline.config.js
│   │   │   ├── switch.orchestrator.js
│   │   │   └── verify.chain.js
│   │   ├── llm/
│   │   │   ├── llm.client.js
│   │   │   ├── llm.formatter.js
│   │   │   ├── mariadb.validator.js
│   │   │   ├── postgres.validator.js
│   │   │   ├── sql.prompt.js
│   │   │   └── sql.validator.js
│   │   ├── middleware/
│   │   │   └── auth.js
│   │   ├── routes/
│   │   │   ├── action.routes.js
│   │   │   ├── ai.routes.js
│   │   │   ├── auth.routes.js
│   │   │   ├── database.routes.js
│   │   │   └── source.routes.js
│   │   ├── security/
│   │   │   ├── action.gateway.js
│   │   │   ├── credential.vault.js
│   │   │   ├── rls.policy.js
│   │   │   └── write.templates.js
│   │   ├── services/
│   │   │   ├── auto.provisioner.js
│   │   │   ├── connection.tester.js
│   │   │   └── grant.script.generator.js
│   │   ├── store/
│   │   │   ├── action.audit.log.js
│   │   │   ├── history.store.js
│   │   │   └── source.store.js
│   │   └── tools/
│   │       ├── education/
│   │       │   ├── cgpa.tool.js
│   │       │   └── foreign-student.tool.js
│   │       └── hospital/
│   │           └── cardiology.tool.js
│   └── test/
└── frontend/
    ├── package.json
    └── src/
        ├── main.jsx
        ├── components/
        │   ├── ChatWindow.jsx
        │   ├── ConnectionWizardModal.jsx
        │   ├── DatabaseSidebar.jsx
        │   ├── SourceManagerModal.jsx
        │   ├── SqlModal.jsx
        │   └── Visualizer.jsx
        └── lib/
            ├── api.js
            └── formatRenderers.jsx
```

---

## 3. Backend Modules Catalog (82 Modules by Layer)

### 3.1 Kernel Layer (13 Modules)
- [`src/kernel/capabilities.core.js`](file:///home/shubh/Documents/project/cognicore/Cognicore/CogniCore_Project/backend/src/kernel/capabilities.core.js): Dialect feature detection and capability masks.
- [`src/kernel/capabilities.js`](file:///home/shubh/Documents/project/cognicore/Cognicore/CogniCore_Project/backend/src/kernel/capabilities.js): Source capabilities resolver.
- [`src/kernel/gate.selector.js`](file:///home/shubh/Documents/project/cognicore/Cognicore/CogniCore_Project/backend/src/kernel/gate.selector.js): Selects gate chains based on active source dialect; fails closed on unknown dialects.
- [`src/kernel/handler-result.js`](file:///home/shubh/Documents/project/cognicore/Cognicore/CogniCore_Project/backend/src/kernel/handler-result.js): Standardized result carrier object across pipeline links.
- [`src/kernel/pipeline.config.js`](file:///home/shubh/Documents/project/cognicore/Cognicore/CogniCore_Project/backend/src/kernel/pipeline.config.js): Declarative registration of pipeline execution stages.
- [`src/kernel/gate.chain.js`](file:///home/shubh/Documents/project/cognicore/Cognicore/CogniCore_Project/backend/src/kernel/gate.chain.js): Executes sequential gate chains (syntax validator $\rightarrow$ AST gate $\rightarrow$ executor).
- [`src/kernel/ast.gate.core.js`](file:///home/shubh/Documents/project/cognicore/Cognicore/CogniCore_Project/backend/src/kernel/ast.gate.core.js): Dialect-agnostic AST parsing logic and statement classification.
- [`src/kernel/ast.gate.js`](file:///home/shubh/Documents/project/cognicore/Cognicore/CogniCore_Project/backend/src/kernel/ast.gate.js): SQLite-specific AST gate.
- [`src/kernel/ast.gate.mariadb.js`](file:///home/shubh/Documents/project/cognicore/Cognicore/CogniCore_Project/backend/src/kernel/ast.gate.mariadb.js): MariaDB-specific AST gate enforcing SELECT and calling RLS policy.
- [`src/kernel/ast.gate.postgres.js`](file:///home/shubh/Documents/project/cognicore/Cognicore/CogniCore_Project/backend/src/kernel/ast.gate.postgres.js): PostgreSQL-specific AST gate.
- [`src/kernel/formatter.registry.js`](file:///home/shubh/Documents/project/cognicore/Cognicore/CogniCore_Project/backend/src/kernel/formatter.registry.js): Formatters packaging results into KPI, table, report, or chartSpec.
- [`src/kernel/switch.orchestrator.js`](file:///home/shubh/Documents/project/cognicore/Cognicore/CogniCore_Project/backend/src/kernel/switch.orchestrator.js): Manages database switches with concurrent query lease counters.
- [`src/kernel/verify.chain.js`](file:///home/shubh/Documents/project/cognicore/Cognicore/CogniCore_Project/backend/src/kernel/verify.chain.js): Honesty Spine enforcing token grounding, arithmetic re-check, and fail-honest disclosures.

### 3.2 Core Pipeline Layer (21 Modules)
- [`src/core/core.engine.js`](file:///home/shubh/Documents/project/cognicore/Cognicore/CogniCore_Project/backend/src/core/core.engine.js): Coordinates cascade across fastIntent, dynamicLink, llmLink, and fallbackLink.
- [`src/core/fastIntent.js`](file:///home/shubh/Documents/project/cognicore/Cognicore/CogniCore_Project/backend/src/core/fastIntent.js): Deterministic sub-millisecond intent router with parameter whitelisting.
- [`src/core/guard-markers.js`](file:///home/shubh/Documents/project/cognicore/Cognicore/CogniCore_Project/backend/src/core/guard-markers.js): Marker tokens injected into answers indicating safety checks passed.
- [`src/core/intent.ir.js`](file:///home/shubh/Documents/project/cognicore/Cognicore/CogniCore_Project/backend/src/core/intent.ir.js): Intermediate Representation structuring queries before SQL compilation.
- [`src/core/intent.detector.js`](file:///home/shubh/Documents/project/cognicore/Cognicore/CogniCore_Project/backend/src/core/intent.detector.js): Identifies question categories (lookup, aggregate, list).
- [`src/core/grounding.guard.js`](file:///home/shubh/Documents/project/cognicore/Cognicore/CogniCore_Project/backend/src/core/grounding.guard.js): Verifies numeric/monetary tokens match query payloads.
- [`src/core/dynamic.query.engine.js`](file:///home/shubh/Documents/project/cognicore/Cognicore/CogniCore_Project/backend/src/core/dynamic.query.engine.js): Dynamic SQL composition from introspected schemas.
- [`src/core/links/dynamic.link.js`](file:///home/shubh/Documents/project/cognicore/Cognicore/CogniCore_Project/backend/src/core/links/dynamic.link.js): Executes dynamic query engine within pipeline cascade.
- [`src/core/links/fallback.link.js`](file:///home/shubh/Documents/project/cognicore/Cognicore/CogniCore_Project/backend/src/core/links/fallback.link.js): Provides safe fallbacks upon query failures.
- [`src/core/links/llm.link.js`](file:///home/shubh/Documents/project/cognicore/Cognicore/CogniCore_Project/backend/src/core/links/llm.link.js): Prepares prompt and invokes local LLM.
- [`src/core/links/tool.link.js`](file:///home/shubh/Documents/project/cognicore/Cognicore/CogniCore_Project/backend/src/core/links/tool.link.js): Routes to domain tools if matched.
- [`src/core/schema.reader.js`](file:///home/shubh/Documents/project/cognicore/Cognicore/CogniCore_Project/backend/src/core/schema.reader.js): Common schema reader interface.
- [`src/core/mariadb.schema.reader.js`](file:///home/shubh/Documents/project/cognicore/Cognicore/CogniCore_Project/backend/src/core/mariadb.schema.reader.js): Introspects ERPNext MariaDB tables and columns.
- [`src/core/postgres.schema.reader.js`](file:///home/shubh/Documents/project/cognicore/Cognicore/CogniCore_Project/backend/src/core/postgres.schema.reader.js): Introspects PostgreSQL `information_schema`.
- [`src/core/schema.pruner.js`](file:///home/shubh/Documents/project/cognicore/Cognicore/CogniCore_Project/backend/src/core/schema.pruner.js): Excludes distractor tables based on token-equality scoring.
- [`src/core/schema.resolver.js`](file:///home/shubh/Documents/project/cognicore/Cognicore/CogniCore_Project/backend/src/core/schema.resolver.js): Resolves natural language business entities to physical table names.
- [`src/core/sql.builder.js`](file:///home/shubh/Documents/project/cognicore/Cognicore/CogniCore_Project/backend/src/core/sql.builder.js): Safe parameter quoting and query building.
- [`src/core/query.executor.js`](file:///home/shubh/Documents/project/cognicore/Cognicore/CogniCore_Project/backend/src/core/query.executor.js): Dispatches SQL to active adapter with timeout handling.
- [`src/core/response.formatter.js`](file:///home/shubh/Documents/project/cognicore/Cognicore/CogniCore_Project/backend/src/core/response.formatter.js): Formats execution records into Markdown and presentation models.
- [`src/core/result.sanity.js`](file:///home/shubh/Documents/project/cognicore/Cognicore/CogniCore_Project/backend/src/core/result.sanity.js): Validates row counts and payload integrity.
- [`src/core/presentation.intent.js`](file:///home/shubh/Documents/project/cognicore/Cognicore/CogniCore_Project/backend/src/core/presentation.intent.js): Selects appropriate chart or KPI visualization types.
- [`src/core/distinct.cache.js`](file:///home/shubh/Documents/project/cognicore/Cognicore/CogniCore_Project/backend/src/core/distinct.cache.js): Caches distinct column values for intent detection.
- [`src/core/concept.layer.js`](file:///home/shubh/Documents/project/cognicore/Cognicore/CogniCore_Project/backend/src/core/concept.layer.js): Maps enterprise concepts across modules.
- [`src/core/tool.router.js`](file:///home/shubh/Documents/project/cognicore/Cognicore/CogniCore_Project/backend/src/core/tool.router.js): Dispatches legacy tool executions.

### 3.3 LLM & Validation Layer (6 Modules)
- [`src/llm/llm.client.js`](file:///home/shubh/Documents/project/cognicore/Cognicore/CogniCore_Project/backend/src/llm/llm.client.js): Local Ollama client (HTTP `/api/generate`, timeout, keep-alive, `think: false`).
- [`src/llm/sql.prompt.js`](file:///home/shubh/Documents/project/cognicore/Cognicore/CogniCore_Project/backend/src/llm/sql.prompt.js): Multi-dialect prompt generator with ERPNext `docstatus = 1` rules.
- [`src/llm/sql.validator.js`](file:///home/shubh/Documents/project/cognicore/Cognicore/CogniCore_Project/backend/src/llm/sql.validator.js): SQLite syntax and keyword validator (Tier-1 Frozen).
- [`src/llm/mariadb.validator.js`](file:///home/shubh/Documents/project/cognicore/Cognicore/CogniCore_Project/backend/src/llm/mariadb.validator.js): MariaDB syntax, keyword, and statement count validator.
- [`src/llm/postgres.validator.js`](file:///home/shubh/Documents/project/cognicore/Cognicore/CogniCore_Project/backend/src/llm/postgres.validator.js): PostgreSQL syntax and keyword validator.
- [`src/llm/llm.formatter.js`](file:///home/shubh/Documents/project/cognicore/Cognicore/CogniCore_Project/backend/src/llm/llm.formatter.js): Cleans raw LLM markdown fences and extracts naked SQL.

### 3.4 Adapters Layer (9 Modules)
- [`src/adapters/sqlite.adapter.js`](file:///home/shubh/Documents/project/cognicore/Cognicore/CogniCore_Project/backend/src/adapters/sqlite.adapter.js): Read-only SQLite driver.
- [`src/adapters/mariadb.adapter.js`](file:///home/shubh/Documents/project/cognicore/Cognicore/CogniCore_Project/backend/src/adapters/mariadb.adapter.js): MariaDB connection pool with `ANSI_QUOTES` initialization.
- [`src/adapters/postgres.adapter.js`](file:///home/shubh/Documents/project/cognicore/Cognicore/CogniCore_Project/backend/src/adapters/postgres.adapter.js): PostgreSQL driver with `default_transaction_read_only=on`.
- [`src/adapters/erp.meta.js`](file:///home/shubh/Documents/project/cognicore/Cognicore/CogniCore_Project/backend/src/adapters/erp.meta.js): ERPNext metadata constants and submittable DocType tables.
- [`src/adapters/dialects/index.js`](file:///home/shubh/Documents/project/cognicore/Cognicore/CogniCore_Project/backend/src/adapters/dialects/index.js): Dialect abstraction (quotes, date functions, grammars).
- [`src/adapters/write/index.js`](file:///home/shubh/Documents/project/cognicore/Cognicore/CogniCore_Project/backend/src/adapters/write/index.js): Write adapter factory.
- [`src/adapters/write/sqlite.write-adapter.js`](file:///home/shubh/Documents/project/cognicore/Cognicore/CogniCore_Project/backend/src/adapters/write/sqlite.write-adapter.js): SQLite mutating write executor.
- [`src/adapters/write/mariadb.write-adapter.js`](file:///home/shubh/Documents/project/cognicore/Cognicore/CogniCore_Project/backend/src/adapters/write/mariadb.write-adapter.js): MariaDB mutating write executor (`cognicore_write`).
- [`src/adapters/write/postgres.write-adapter.js`](file:///home/shubh/Documents/project/cognicore/Cognicore/CogniCore_Project/backend/src/adapters/write/postgres.write-adapter.js): PostgreSQL mutating write executor.

### 3.5 Security Layer (4 Modules)
- [`src/security/rls.policy.js`](file:///home/shubh/Documents/project/cognicore/Cognicore/CogniCore_Project/backend/src/security/rls.policy.js): Row-Level Security policy engine (fail-closed default, employee salary scoping, zero-SQL probe rejection).
- [`src/security/action.gateway.js`](file:///home/shubh/Documents/project/cognicore/Cognicore/CogniCore_Project/backend/src/security/action.gateway.js): Governed write state machine (propose $\rightarrow$ approve $\rightarrow$ execute) with Separation of Duties.
- [`src/security/write.templates.js`](file:///home/shubh/Documents/project/cognicore/Cognicore/CogniCore_Project/backend/src/security/write.templates.js): Immutable allowlisted write templates with strict JSON schema parameter validation.
- [`src/security/credential.vault.js`](file:///home/shubh/Documents/project/cognicore/Cognicore/CogniCore_Project/backend/src/security/credential.vault.js): AES-256-GCM encrypted database credential vault at rest.

### 3.6 Configuration Layer (5 Modules)
- [`src/config/sources.js`](file:///home/shubh/Documents/project/cognicore/Cognicore/CogniCore_Project/backend/src/config/sources.js): Pre-configured source descriptors.
- [`src/config/credentials.js`](file:///home/shubh/Documents/project/cognicore/Cognicore/CogniCore_Project/backend/src/config/credentials.js): Credential resolution helper.
- [`src/config/database.js`](file:///home/shubh/Documents/project/cognicore/Cognicore/CogniCore_Project/backend/src/config/database.js): Active database manager and switch queue (Tier-1 Frozen).
- [`src/config/semantic.profile.js`](file:///home/shubh/Documents/project/cognicore/Cognicore/CogniCore_Project/backend/src/config/semantic.profile.js): Base semantic mappings (Tier-1 Frozen).
- [`src/config/profiles/erpnext.profile.js`](file:///home/shubh/Documents/project/cognicore/Cognicore/CogniCore_Project/backend/src/config/profiles/erpnext.profile.js): Comprehensive ERPNext DocType mappings.

### 3.7 Routes (5 Modules)
- [`src/routes/ai.routes.js`](file:///home/shubh/Documents/project/cognicore/Cognicore/CogniCore_Project/backend/src/routes/ai.routes.js): Mounts query endpoint (`POST /api/ai/query`).
- [`src/routes/database.routes.js`](file:///home/shubh/Documents/project/cognicore/Cognicore/CogniCore_Project/backend/src/routes/database.routes.js): Database listing, schema, and switching.
- [`src/routes/source.routes.js`](file:///home/shubh/Documents/project/cognicore/Cognicore/CogniCore_Project/backend/src/routes/source.routes.js): Dynamic source registration, pre-flight test, grant scripts.
- [`src/routes/action.routes.js`](file:///home/shubh/Documents/project/cognicore/Cognicore/CogniCore_Project/backend/src/routes/action.routes.js): Action Gateway propose, approve, execute endpoints.
- [`src/routes/auth.routes.js`](file:///home/shubh/Documents/project/cognicore/Cognicore/CogniCore_Project/backend/src/routes/auth.routes.js): User login, user store initialization, and JWT issuance.

### 3.8 Store Layer (3 Modules)
- [`src/store/history.store.js`](file:///home/shubh/Documents/project/cognicore/Cognicore/CogniCore_Project/backend/src/store/history.store.js): Conversational query and response history.
- [`src/store/action.audit.log.js`](file:///home/shubh/Documents/project/cognicore/Cognicore/CogniCore_Project/backend/src/store/action.audit.log.js): Append-only SHA-256 forward hash-chained audit log for writes.
- [`src/store/source.store.js`](file:///home/shubh/Documents/project/cognicore/Cognicore/CogniCore_Project/backend/src/store/source.store.js): Persistent dynamic source definition store.

### 3.9 Controllers (4 Modules)
- [`src/controllers/ai.controller.js`](file:///home/shubh/Documents/project/cognicore/Cognicore/CogniCore_Project/backend/src/controllers/ai.controller.js): Query orchestrator with JWT identity precedence.
- [`src/controllers/database.controller.js`](file:///home/shubh/Documents/project/cognicore/Cognicore/CogniCore_Project/backend/src/controllers/database.controller.js): Database switching and schema retrieval with path traversal defense.
- [`src/controllers/source.controller.js`](file:///home/shubh/Documents/project/cognicore/Cognicore/CogniCore_Project/backend/src/controllers/source.controller.js): Dynamic source CRUD and pre-flight connection controller.
- [`src/controllers/action.controller.js`](file:///home/shubh/Documents/project/cognicore/Cognicore/CogniCore_Project/backend/src/controllers/action.controller.js): Action proposal, approval, and execution controller.

### 3.10 Services (3 Modules)
- [`src/services/connection.tester.js`](file:///home/shubh/Documents/project/cognicore/Cognicore/CogniCore_Project/backend/src/services/connection.tester.js): 6-stage connection doctor (TCP, Auth, DB, Schema, Canary, RLS).
- [`src/services/auto.provisioner.js`](file:///home/shubh/Documents/project/cognicore/Cognicore/CogniCore_Project/backend/src/services/auto.provisioner.js): Automated database role provisioner (deprecated, gated by `ENABLE_AUTO_PROVISION`).
- [`src/services/grant.script.generator.js`](file:///home/shubh/Documents/project/cognicore/Cognicore/CogniCore_Project/backend/src/services/grant.script.generator.js): Generates least-privilege SQL scripts for DBAs.

### 3.11 Tools (Legacy, 3 Modules)
- Specialized demo calculators ([`cgpa.tool.js`](file:///home/shubh/Documents/project/cognicore/Cognicore/CogniCore_Project/backend/src/tools/education/cgpa.tool.js), [`foreign-student.tool.js`](file:///home/shubh/Documents/project/cognicore/Cognicore/CogniCore_Project/backend/src/tools/education/foreign-student.tool.js), [`cardiology.tool.js`](file:///home/shubh/Documents/project/cognicore/Cognicore/CogniCore_Project/backend/src/tools/hospital/cardiology.tool.js)) preserved for backwards compatibility.

---

## 4. Frontend Modules

| File Path | Lines | Responsibilities |
| :--- | :---: | :--- |
| [`frontend/src/main.jsx`](file:///home/shubh/Documents/project/cognicore/Cognicore/CogniCore_Project/frontend/src/main.jsx) | 115 | Composition root, application state context, shell layout. |
| [`frontend/src/components/ChatWindow.jsx`](file:///home/shubh/Documents/project/cognicore/Cognicore/CogniCore_Project/frontend/src/components/ChatWindow.jsx) | 224 | Query submission, conversation history, honesty badge rendering, execution timing. |
| [`frontend/src/components/DatabaseSidebar.jsx`](file:///home/shubh/Documents/project/cognicore/Cognicore/CogniCore_Project/frontend/src/components/DatabaseSidebar.jsx) | 423 | Source switching, active table viewer, modal triggers. |
| [`frontend/src/components/ConnectionWizardModal.jsx`](file:///home/shubh/Documents/project/cognicore/Cognicore/CogniCore_Project/frontend/src/components/ConnectionWizardModal.jsx) | 973 | Phase D6 dynamic source connection wizard with live doctor test stages and RLS notice. |
| [`frontend/src/components/SourceManagerModal.jsx`](file:///home/shubh/Documents/project/cognicore/Cognicore/CogniCore_Project/frontend/src/components/SourceManagerModal.jsx) | 339 | Source configuration manager, credential updates, source deletion. |
| [`frontend/src/components/Visualizer.jsx`](file:///home/shubh/Documents/project/cognicore/Cognicore/CogniCore_Project/frontend/src/components/Visualizer.jsx) | 61 | Polymorphic Vega-Lite chart visualization component. |
| [`frontend/src/components/SqlModal.jsx`](file:///home/shubh/Documents/project/cognicore/Cognicore/CogniCore_Project/frontend/src/components/SqlModal.jsx) | 270 | Query transparency modal displaying raw generated SQL, AST properties, and execution parameters. |
| [`frontend/src/lib/formatRenderers.jsx`](file:///home/shubh/Documents/project/cognicore/Cognicore/CogniCore_Project/frontend/src/lib/formatRenderers.jsx) | 298 | Formatters for KPI statistics, data tables, and Markdown responses. |
| [`frontend/src/lib/api.js`](file:///home/shubh/Documents/project/cognicore/Cognicore/CogniCore_Project/frontend/src/lib/api.js) | 231 | Central HTTP network client attaching JWT bearer tokens. |

---

## 5. Testing & Verification Infrastructure

CogniCore maintains a comprehensive automated testing battery:
- **94 Test Files:** Dedicated scripts covering unit invariants, integration pathways, and regression tests in [`backend/test/`](file:///home/shubh/Documents/project/cognicore/Cognicore/CogniCore_Project/backend/test/).
- **26-Suite Canonical Regression Battery:** Executed via [`backend/test/verifyFullRegression.sh`](file:///home/shubh/Documents/project/cognicore/Cognicore/CogniCore_Project/backend/test/verifyFullRegression.sh), asserting 100% green integrity across:
  - Multi-dialect connection lifecycles (`verifyConnLifecycle.js`)
  - Gate integrity & bypass prevention (`verifyGateIntegrity.js`, `verifyBypass.js`)
  - Dialect selector verification (`verifyGateSelector.js`)
  - Fail-closed RLS policies (`verify_unpolicied_table_rls.js`, `verify_rls_live_pipeline.js`)
  - Governed write gateway & audit logging (`verify_action_gateway_lifecycle.js`, `verify_action_audit_log.js`)
  - Credential Vault encryption & round-trip (`verify_credential_vault.js`)
  - Dynamic source CRUD & auto-provisioning (`verify_source_crud_api.js`, `verify_auto_provisioning.js`)
- **Golden Corpora:**
  - **fastIntent Golden Corpus (Re-Pin #6):** 22 golden query assertions (`verifyFastIntentGolden.js`).
  - **RLS Read Policy Golden Corpus:** 28 golden cases asserting deterministic verdicts (`verifyRlsPolicyGolden.js`).
  - **RLS Write Policy Golden Corpus:** 20 golden cases verifying mutation boundaries (`verifyRlsWritePolicyGolden.js`).
  - **Gate Integrity Corpus:** 40 AST cases covering syntax validation, keyword blocking, and structure checks.
- **Audit Freeze Gate:** [`backend/test/audit-freeze.js`](file:///home/shubh/Documents/project/cognicore/Cognicore/CogniCore_Project/backend/test/audit-freeze.js) validates SHA-256 hashes of 10 Tier-1 frozen files.

---

## 6. Documentation Hierarchy

To prevent divergence between code and documentation:

1. **Physical Source Code:** `backend/src/` and `frontend/src/` are the absolute ground truth.
2. **System Specifications:** `ARCHITECTURE.md`, `SECURITY.md`, and `CONNECTIVITY_ARCHITECTURE_PLAN.md`.
3. **Session Records:** `GROUND_TRUTH_REPORT.md` and `SESSION_STATE.md`.
4. **Historical Narratives:** Deprecated or archived summaries.

---

## 7. Bottom Line

CogniCore is a multi-dialect, ERP-connected analytics engine with enforced safety gates, governed write access, and an honesty verification chain. It is production-candidate software with known, documented limitations — not a toy prototype, and not a certified enterprise product.
