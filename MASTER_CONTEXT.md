# CogniCore Master Context

## 1. Project Summary

CogniCore is an on-premises, air-gapped natural language to SQL (NL→SQL) enterprise analytics engine designed for structured business databases. It connects directly to live ERP platforms (notably ERPNext v14/v15/v16 running on MariaDB) as well as PostgreSQL and SQLite instances. Rather than acting as a lightweight prototype or toy SQLite interface, CogniCore is built as an enterprise-grade analytical copilot with strict truth-and-safety gates, deterministic Row-Level Security (RLS) enforcement, a governed write pathway, and an empirical honesty verification chain that prevents LLM hallucinations.

The application couples an Express/Node.js backend with a reactive Vite/React frontend, executing queries against local open-weights LLMs (such as Gemma 3 4B via Ollama) without data egress.

---

## 2. Repository Structure

The active application implementation resides under [`Cognicore/CogniCore_Project/`](file:///home/shubh/Documents/project/cognicore/Cognicore/CogniCore_Project/):

```text
Cognicore/
├── ARCHITECTURE.md                  # System architecture & 7-layer CAP specification
├── MASTER_CONTEXT.md                # Master codebase truth and execution context
├── SECURITY.md                      # Security guardrails & vulnerability remediation log
├── GETTING_STARTED.md               # Developer environment onboarding
├── TESTING.md                       # Test suites & verification instructions
├── ROADMAP.md                       # Architectural evolution milestones
├── docs/                            # Ground truth reports & phase records (D0-D6)
│   ├── GROUND_TRUTH_REPORT.md       # Comprehensive D0-D5 verification report
│   ├── CONNECTIVITY_ARCHITECTURE_PLAN.md # CAP v2.2 specification
│   ├── PART_D_RECORD.md             # Record of D0-D5 implementation
│   └── SESSION_STATE.md             # Active session ledgers and milestones
└── CogniCore_Project/
    ├── PROJECT_CONTEXT.md           # Definitive per-module inventory
    ├── backend/
    │   ├── .env.example             # Exhaustive environment configuration spec
    │   ├── src/
    │   │   ├── server.js            # Express server, CORS, rate limits, route mounting
    │   │   ├── adapters/            # Protocol drivers (sqlite, mariadb, postgres)
    │   │   │   ├── dialects/        # Dialect pack (identifier quoting, date functions)
    │   │   │   └── write/           # Governed write adapters (sqlite, mariadb, postgres)
    │   │   ├── config/              # Source definitions, profiles, database config
    │   │   │   └── profiles/        # ERPNext and SQLite domain concept profiles
    │   │   ├── controllers/         # AI, database, source, and action controllers
    │   │   ├── core/                # Core engine, fastIntent, Intent-IR, grounding
    │   │   │   └── links/           # Pipeline link handlers (dynamic, llm, fallback, tool)
    │   │   ├── kernel/              # Gate selector, AST gates, verify.chain, orchestrator
    │   │   ├── llm/                 # Ollama client, multi-dialect prompt builders, validators
    │   │   ├── middleware/          # JWT authentication and identity propagation
    │   │   ├── routes/              # Express API routers (ai, database, source, action, auth)
    │   │   ├── security/            # RLS policy engine, action gateway, credential vault
    │   │   ├── services/            # Connection tester, auto-provisioner, grant generator
    │   │   ├── store/               # History store, source store, SHA-256 action audit log
    │   │   └── tools/               # Legacy specialized analytical tools
    │   └── test/                    # 94 test files, 26 canonical suites, golden corpora
    └── frontend/
        ├── src/
        │   ├── main.jsx             # React composition root
        │   ├── components/          # UI components (sidebar, modals, visualizer, chat)
        │   └── lib/                 # API client (api.js) and format renderers
        └── package.json
```

---

## 3. Architecture & Execution Flows

### 3.1 7-Layer CAP Architecture
```
L7: Source Experience       (DatabaseSidebar, ConnectionWizardModal, Visualizer, Chat)
L6: Truth & Safety          (gate.selector, rls.policy, verify.chain, action.gateway)
L5: Semantic Mapping        (semantic.profile, erpnext.profile, concept.layer)
L4: Schema Introspection    (schema.reader, mariadb/postgres readers, schema.pruner)
L3: Dialect Engine          (dialects/index.js, quoting, date syntax, AST grammar)
L2: Protocol Adapters       (sqlite, mariadb, postgres read and write adapters)
L1: Source Registry         (sources.js, credentials.js, credential.vault.js)
```

### 3.2 Read Pipeline Flow
```
User Query (Frontend)
  │
  ▼
POST /api/ai/query ──► [auth.js] (Verify JWT & set req.user)
  │
  ▼
[ai.controller.js] ──► Acquire query lease from [switch.orchestrator.js]
  │
  ▼
[core.engine.js] Cascade:
  ├── Link 1: fastIntent.js (Sub-millisecond direct match via Intent-IR)
  ├── Link 2: dynamic.query.engine.js (Schema-guided dynamic query composition)
  ├── Link 3: llm.link.js -> sql.prompt.js -> llm.client.js (Local Ollama inference)
  └── Link 4: fallback.link.js (Graceful recovery on failure)
  │
  ▼
Dialect Gate Chain ([kernel/gate.selector.js]):
  ├── 1. Dialect Validator (Reject multiple statements, non-SELECT keywords, comments)
  ├── 2. Dialect AST Gate (Strict AST parse via node-sql-parser, enforce SELECT)
  └── 3. RLS Policy Gate ([security/rls.policy.js] Fail-closed check, predicate injection)
  │
  ▼
Read-Only Execution ([adapters/mariadb.adapter.js] / postgres / sqlite)
  │
  ▼
Honesty Verification Chain ([kernel/verify.chain.js]):
  ├── Token Grounding (Verify every number/percentage/currency against raw DB records)
  ├── Arithmetic Re-check (Recalculate sums/averages to block LLM mental math errors)
  └── Honest Disclosures (Flag ungrounded tokens or downgrade confidence)
  │
  ▼
Formatter Registry ([kernel/formatter.registry.js]) ──► Structured JSON to Frontend
```

### 3.3 Governed Write Flow
Mutating actions never run through the open-ended AI generation loop. They follow a dedicated 3-stage lifecycle in [`security/action.gateway.js`](file:///home/shubh/Documents/project/cognicore/Cognicore/CogniCore_Project/backend/src/security/action.gateway.js):
1. **Propose:** The caller requests an action matching a strict, allowlisted template from [`security/write.templates.js`](file:///home/shubh/Documents/project/cognicore/Cognicore/CogniCore_Project/backend/src/security/write.templates.js). Returns an execution preview and generates an HMAC-signed proposal token.
2. **Approve:** A second authorized user approves the action (Separation of Duties enforced).
3. **Execute:** The approved action runs through isolated write adapters in [`adapters/write/`](file:///home/shubh/Documents/project/cognicore/Cognicore/CogniCore_Project/backend/src/adapters/write/) using `cognicore_write` credentials. Every transition is written to [`store/action.audit.log.js`](file:///home/shubh/Documents/project/cognicore/Cognicore/CogniCore_Project/backend/src/store/action.audit.log.js) with forward SHA-256 hash chaining.

---

## 4. Frontend Responsibilities

The React application delivers a complete administrative and analytical experience across 9 modules:

- [`main.jsx`](file:///home/shubh/Documents/project/cognicore/Cognicore/CogniCore_Project/frontend/src/main.jsx) (115 lines): Composition root and global layout.
- [`components/ChatWindow.jsx`](file:///home/shubh/Documents/project/cognicore/Cognicore/CogniCore_Project/frontend/src/components/ChatWindow.jsx) (224 lines): Chat interface, honesty badge rendering, streaming message timeline, and timing metrics.
- [`components/DatabaseSidebar.jsx`](file:///home/shubh/Documents/project/cognicore/Cognicore/CogniCore_Project/frontend/src/components/DatabaseSidebar.jsx) (423 lines): Source switcher (SQLite / MariaDB / PostgreSQL), table list viewer, and entry point to source management modals.
- [`components/ConnectionWizardModal.jsx`](file:///home/shubh/Documents/project/cognicore/Cognicore/CogniCore_Project/frontend/src/components/ConnectionWizardModal.jsx) (973 lines): Phase D6 multi-step connection wizard with a 6-stage "Connection Doctor" (TCP probe, auth, DB discovery, schema inspection, write canary, RLS notice).
- [`components/SourceManagerModal.jsx`](file:///home/shubh/Documents/project/cognicore/Cognicore/CogniCore_Project/frontend/src/components/SourceManagerModal.jsx) (339 lines): Dynamic source registration, credential update, connection re-testing, and source deletion.
- [`components/Visualizer.jsx`](file:///home/shubh/Documents/project/cognicore/Cognicore/CogniCore_Project/frontend/src/components/Visualizer.jsx) (61 lines): Polymorphic data visualizer rendering Vega-Lite bar, line, and area charts based on backend `chartSpec`.
- [`components/SqlModal.jsx`](file:///home/shubh/Documents/project/cognicore/Cognicore/CogniCore_Project/frontend/src/components/SqlModal.jsx) (270 lines): Transparent query inspection modal showing raw generated SQL, AST properties, and execution parameters.
- [`lib/formatRenderers.jsx`](file:///home/shubh/Documents/project/cognicore/Cognicore/CogniCore_Project/frontend/src/lib/formatRenderers.jsx) (298 lines): Formatting engine for KPI numbers, responsive data tables, markdown analysis, and charts.
- [`lib/api.js`](file:///home/shubh/Documents/project/cognicore/Cognicore/CogniCore_Project/frontend/src/lib/api.js) (231 lines): Central network client attaching JWT bearer tokens and routing calls to backend controllers.

---

## 5. Validation and Safety Architecture

CogniCore replaces probabilistic safeguards with deterministic code barriers:
- **Dialect Gate Chains:** [`kernel/gate.selector.js`](file:///home/shubh/Documents/project/cognicore/Cognicore/CogniCore_Project/backend/src/kernel/gate.selector.js) binds specific syntax validators and AST gates based on the active source's dialect (`sqlite`, `mariadb`, `postgres`). Unrecognized dialects fail closed.
- **Fail-Closed RLS:** [`security/rls.policy.js`](file:///home/shubh/Documents/project/cognicore/Cognicore/CogniCore_Project/backend/src/security/rls.policy.js) enforces `REJECT_FORBIDDEN` on any table not enumerated in `OPEN_TABLES_ALLOWLIST`. Cross-employee salary probes are refused with zero physical SQL executed. For authorized employees, it injects AST predicates (`WHERE employee = 'EMP-001' AND docstatus = 1`).
- **Governed Writes & Templates:** All database mutations require hand-crafted, parameterized templates in [`security/write.templates.js`](file:///home/shubh/Documents/project/cognicore/Cognicore/CogniCore_Project/backend/src/security/write.templates.js). Freeform LLM SQL generation for `INSERT`, `UPDATE`, `DELETE`, or `DROP` is blocked unconditionally.
- **Cryptographic Audit Log:** [`store/action.audit.log.js`](file:///home/shubh/Documents/project/cognicore/Cognicore/CogniCore_Project/backend/src/store/action.audit.log.js) records proposal, approval, and execution events using SHA-256 hash chains where each block seals the hash of the preceding record.
- **Credential Vault at Rest:** [`security/credential.vault.js`](file:///home/shubh/Documents/project/cognicore/Cognicore/CogniCore_Project/backend/src/security/credential.vault.js) encrypts DBMS credentials using AES-256-GCM backed by `VAULT_MASTER_KEY` in an internal SQLite database (`cognicore_vault.db`). Secrets are never logged or exposed over API endpoints.
- **Honesty Verification Chain:** [`kernel/verify.chain.js`](file:///home/shubh/Documents/project/cognicore/Cognicore/CogniCore_Project/backend/src/kernel/verify.chain.js) ensures that every number, percentage, and currency symbol in natural-language outputs is grounded in database records. It recomputes aggregations to prevent arithmetic hallucinations.

---

## 6. Authentication and Credential Management

- **JWT Authentication:** [`middleware/auth.js`](file:///home/shubh/Documents/project/cognicore/Cognicore/CogniCore_Project/backend/src/middleware/auth.js) validates JSON Web Tokens using HMAC-SHA256 (`COGNICORE_JWT_SECRET`). It extracts user credentials (`userId`, `roles`, `employeeId`) and attaches a verified identity object to requests.
- **Encrypted Local User Store:** [`routes/auth.routes.js`](file:///home/shubh/Documents/project/cognicore/Cognicore/CogniCore_Project/backend/src/routes/auth.routes.js) stores users in `backend/data/users.enc`, encrypted with **AES-256-GCM**.
- **Password Hashing:** Passwords are hashed using **PBKDF2-SHA512** with 10,000 iterations and a unique per-user 16-byte random salt (`crypto.pbkdf2Sync(password, salt, 10000, 64, "sha512")`). Comparisons use `crypto.timingSafeEqual` to prevent timing attacks. *(Note: Prior informal references to scrypt were inaccurate; the verified code uses PBKDF2).*

---

## 7. Source-of-Truth Hierarchy

When evaluating system behavior or resolving conflicting information, enforce this hierarchy:

1. **Active Implementation Source Files:** The actual executable code in `backend/src/` and `frontend/src/`.
2. **Architecture and Security Specifications:** `ARCHITECTURE.md`, `SECURITY.md`, and `CONNECTIVITY_ARCHITECTURE_PLAN.md`.
3. **Session Ledgers & Phase Records:** `GROUND_TRUTH_REPORT.md`, `PART_D_RECORD.md`, and `SESSION_STATE.md`.
4. **Historical or Generated Narrative Artifacts:** Older progress summaries or deprecated documentation files.

Code is the ultimate authority.

---

## 8. Bottom Line

CogniCore is a multi-dialect, ERP-connected analytics engine with enforced safety gates, governed write access, and an honesty verification chain. It is production-candidate software with known, documented limitations — not a toy prototype, and not a certified enterprise product.
