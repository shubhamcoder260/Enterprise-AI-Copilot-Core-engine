# CogniCore — Part D Connectivity & Infrastructure Record

> **Status:** Canonical Seed / Implementation Reference  
> **Phase:** Part D (Multi-Source Connectivity & ERPNext Integration)  
> **Scope:** Architecture topology, canonical endpoints/signatures, adapter contracts, physical security invariants, and empirical verification receipts.

---

## 1. Canonical Connection Topology

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                         COGNICORE ENGINE SIDE                                          │
│                                                                                                        │
│  [ Web UI / ChatWindow ]                                                                               │
│          │                                                                                             │
│          ▼ HTTP POST /api/ai/query                                                                     │
│  [ ai.controller.js ] ──(1) acquireQueryLease() ────────────────────────┐                              │
│          │                                                              │                              │
│          ├─► createCapabilitiesForSource(activeSource)                  │                              │
│          │         │                                                    │                              │
│          │         ▼                                                    ▼                              │
│          │    [ capabilities.db = mariadb.adapter.js ]         [ switch.orchestrator.js ]              │
│          │    [ capabilities.source = activeSource   ]                  ▲                              │
│          │                                                              │ (finally block:              │
│          ▼ runCoreEngine({ query, organization, role, sessionId, model },│  guaranteed release)        │
│          │               { capabilities })                              │                              │
│  [ core.engine.js ] (Tier-2 Re-pin #2)                                  │                              │
│          │                                                              │                              │
│          ▼ execute({ ...ctx, capabilities })                            │                              │
│  [ llm.link.js ]                                                        │                              │
│          │                                                              │                              │
│          ├──► gateChainFor(ctx.capabilities.source)                     │                              │
│          │         │                                                    │                              │
│          │         ▼ reads .dialect                                     │                              │
│          │    [ mariadbValidator ]                                      │                              │
│          │    [ ast.gate.mariadb.js ]                                   │                              │
│          │    [ readonly-executor (mariadb) ]                           │                              │
│          │         │                                                    │                              │
│          ▼         ▼                                                    │                              │
│  [ mariadb.adapter.js ] (via capabilities.db.executeReadOnlySql)        │                              │
│          │                                                              │                              │
│          ▼                                                              │                              │
│  [ Response Returned to Client ] ──(2) releaseQueryLease() ─────────────┘                              │
└──────────┼─────────────────────────────────────────────────────────────────────────────────────────────┘
           │
           │  Network Bridge (Subnet: 172.28.0.0/16)
           │  Channel 1: TCP 3306 (SQL Query Execution - Read-Only)
           │  Channel 2: TCP 8000 (HTTP REST - DocType Introspection)
           │
┌──────────┼─────────────────────────────────────────────────────────────────────────────────────────────┐
│          ▼                                                                                             │
│  [ MariaDB 10.6 Container ] : 3306                                                                     │
│    User: cognicore_ro@'172.28.%.%' (SELECT ONLY, NO DML/DDL)                                           │
│    Connection Hook: pool.on('connection', conn => conn.query("SET SESSION sql_mode = CONCAT(@@sql_mode, ',ANSI_QUOTES')")) │
│    Target Database: `_4e5d6a7b8c9d0e1f` (ERPNext v15 MariaDB database)                                 │
│                                                                                                        │
│  [ ERPNext v15 Bench Container ] : 8000 (frappe-bench)                                                 │
│    API Key & Secret: Read-only token for `/api/method/frappe.desk.form.load.getdoctype`               │
│    Metadata Channel: Extracts labels, options, link graphs without guessing                            │
│                                                                                                        │
│                                           ERPNEXT SIDE                                                 │
└────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Canonical Contracts & Signatures (New Canon)

| Item | Canonical Form | Invariant & Call-Site Location |
|---|---|---|
| **AI Query Route** | `POST /api/ai/query` | Defined in `ai.routes.js`, consumed by frontend `lib/api.js` and M1–M10 parity suites. |
| **Engine Entry Signature** | `runCoreEngine({ query, organization, role, sessionId, model }, { pipeline, capabilities })` | `backend/src/core/core.engine.js`; constructor injection of `capabilities` overrides default singleton. |
| **Source Management Routes** | `GET /api/database/sources`<br>`POST /api/database/sources/switch` | Defined in `database.routes.js`; handled by `database.controller.js` routing via `switch.orchestrator.js`. |
| **Adapter Interface Contract** | `deepFreeze({ connect(desc), queryReadOnly(sql, params), executeReadOnlySql(sql, params), close(), meta() })` | Uniform shape across all dialect adapters (`sqlite.adapter.js`, `mariadb.adapter.js`, `postgres.adapter.js`). |
| **MariaDB Connection Hook** | `pool.on('connection', conn => conn.query("SET SESSION sql_mode = CONCAT(@@sql_mode, ',ANSI_QUOTES')"))` | Event-driven pool lifecycle hook on `mysql2` pool; fires on **every** physical connection spawned, guaranteeing recycled connections retain `ANSI_QUOTES`. |
| **Gate Chain Dispatch** | `gateChainFor(sourceDescriptor)` | **Fail-closed:** Throws `Error` on missing, malformed, or unrecognized dialect. Reverts to `GATE_CHAIN` (SQLite) *only* if `sourceDescriptor === undefined` (legacy non-parameterized calls). |
| **Date Filtering Guideline** | `posting_date >= 'YYYY-01-01' AND posting_date < 'YYYY+1-01-01'` | Prompt & dialect guidance: prefer range predicates on date columns over `YEAR(col)` to ensure index eligibility. |
| **Identifier Quoting & Preserving** | Verbatim preservation with backticks (e.g. `` `tabSales Invoice` ``) | `tab*` names with internal spaces are preserved verbatim and enclosed in backticks across all SQL generators. |

---

## 3. Dual-Channel Network & Security Specification

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                                DUAL CHANNELS                                 │
├─────────────────────────────────────┬────────────────────────────────────────┤
│ Channel 1: SQL Execution (Port 3306)│ Channel 2: Metadata (Port 8000)        │
├─────────────────────────────────────┼────────────────────────────────────────┤
│ - Driver: mysql2/promise            │ - Protocol: HTTP REST                  │
│ - User: cognicore_ro@'172.28.%.%'   │ - Auth: Frappe API Token (Key/Secret)  │
│ - Grants: SELECT only               │ - Target: frappe.desk.form.load.getdoctype
│ - Session: ANSI_QUOTES mode         │ - Purpose: Schema labels, select       │
│ - Purpose: Analytical query runs    │   options, child tables, docstatus     │
│ - Mutation Risk: Physically refused │ - Mutation Risk: Read-only API role    │
└─────────────────────────────────────┴────────────────────────────────────────┘
```

### Subnet Grants Script (Phase D−1)
```sql
REVOKE ALL PRIVILEGES, GRANT OPTION FROM 'cognicore_ro'@'172.28.%.%';
GRANT SELECT ON `_4e5d6a7b8c9d0e1f`.* TO 'cognicore_ro'@'172.28.%.%';
FLUSH PRIVILEGES;
```

---

## 4. Phase D Empirical Receipts & Verification Ledger

| Phase | Milestone / Receipt | Target / Assertion | Status |
|---|---|---|---|
| **D−1** | SQLite Baseline Battery | `verifyFullRegression.sh` passes 8/8 tests clean | ✅ **PASSED** (8/8 clean) |
| **D−1** | Docker Environment Lock | ERPNext v15 + MariaDB 10.6 up on `172.28.0.0/16` | ✅ **PASSED** (Ports 3306 & 8000 reachable) |
| **D0a** | Freeze Audit Gate | `test/audit-freeze.js` exits 0 (10 Tier-1 empty diffs) | ✅ **PASSED** (10/10 SHA256 match, 0 diffs) |
| **D0a** | AST Golden Corpus | `test/golden/ast_gate_golden.json` (40 test cases) | ✅ **PASSED** (40/40 cases verified) |
| **D0b** | Core Engine Golden Corpus | `test/golden/core_engine_golden.json` (CE-01..CE-07) | ✅ **PASSED** (7/7 cases verified) |
| **D0b** | Capabilities Golden Corpus | `test/golden/capabilities_golden.json` (equivalence) | ✅ **PASSED** (100% diff match verified) |
| **D0b** | Switch Lease Lifecycle | Case SO-05: throw during execution releases lease cleanly | ✅ **PASSED** (Zero deadlock verified) |
| **D0c** | Protocol Adapters | `verifyAdapters.js` passes (SQLite passthrough, MariaDB read-only) | ✅ **PASSED** (Contract & mutation refusal verified) |
| **D0c** | MariaDB Connection Hook | `ANSI_QUOTES` persists across pooled connection recycle | ✅ **PASSED** (Verified across 10 concurrent conns) |
| **D0d** | Schema Introspection | `verify_mariadb_introspection.js` passes on ERP tables | ✅ **PASSED** (37.8ms, verbatim `tab*` preserved) |
| **D0d** | Gate Selector Binding | `verifyGateSelector.js` asserts fail-closed & 9-case matrix | ✅ **PASSED** (9/9 MariaDB matrix verified) |
| **D0e** | Oracle Question Q1 | FY2024 total sales invoice amount matches General Ledger | ✅ **PASSED** ($450,000.00 zero variance) |
| **D0e** | Oracle Question Q2 | Count of active customers matches Customer List | ✅ **PASSED** (5 active customers verified) |
| **D0e** | S16 Honest Baseline | Failing 5-year graph query captured in full JSON as before-picture | ✅ **PASSED** (Captured in ledger below) |

### S16 Sentinel Baseline Before-Picture (Captured at D0e Exit)
```json
{
  "query": "Show our total sales for the last 5 years as a graph",
  "source": "llm",
  "meta": {
    "engineMode": "local_llm",
    "model": "oracle-verified-gemma3",
    "source": "mariadb",
    "sourceId": "erpnext_prod",
    "database": "_4e5d6a7b8c9d0e1f"
  },
  "data": {
    "type": "llm_query",
    "sql": "SELECT DATE_FORMAT(`posting_date`, '%Y') AS year, SUM(`grand_total`) AS sales FROM `tabSales Invoice` WHERE `docstatus` = 1 GROUP BY DATE_FORMAT(`posting_date`, '%Y') ORDER BY year DESC LIMIT 5",
    "records": [
      { "year": "2024", "sales": "450000.000000000" },
      { "year": "2023", "sales": "30000.000000000" }
    ],
    "rowCount": 2
  }
}
```

---

## 5. Phase D1 — Honesty Spine Empirical Receipts & Verification Ledger

| Step | Milestone / Receipt | Target / Assertion | Status |
|---|---|---|---|
| **D1a** | FastIntent Golden Corpus | `test/golden/fast_intent_golden.json` (18 cases) | ✅ **PASSED** (18/18 cases captured & verified) |
| **D1a** | Re-Pin #4 Equivalence | `test/verifyFastIntentGolden.js` exits 0 with deep equality | ✅ **PASSED** (100% equivalence verified) |
| **D1b** | Intent-IR Light & Ladder | `test/verifyIntentIr.js` (HIGH, MEDIUM, AMBIGUOUS, UNRESOLVABLE) | ✅ **PASSED** (7/7 contract tests green) |
| **D1c** | S16 Grounding Guard | `test/verifyS16Guard.js` (chart dimensions, distinct span check) | ✅ **PASSED** (4/4 tests green) |
| **D1d** | FastIntent Temporal Family | Multi-dialect date range predicates + `docstatus` filter | ✅ **PASSED** (Zero regression, 18/18 golden green) |
| **D1e** | S16 Live MariaDB Execution | Honest caveat appended, zero fabrication of missing years | ✅ **PASSED** (Verified live against ERPNext container) |
| **D1e** | Audit Freeze Gate | 10/10 Tier-1 files untouched (0 diffs, SHA-256 match) | ✅ **PASSED** (Freeze gate intact) |
| **D1e** | Full Regression Suite | `verifyFullRegression.sh` passes 8/8 suites clean | ✅ **PASSED** (Base holds) |

### S16 Sentinel After-Picture (Honesty Spine Live Receipt)
```json
{
  "query": "Show our total sales for the last 5 years as a graph",
  "answer": "Found 2 record(s) matching your request.\n\nNote: The database contains records for 2 years (2023–2024), which is fewer than the requested 5 years.",
  "source": "llm",
  "meta": {
    "engineMode": "local_llm",
    "model": "oracle-verified-gemma3",
    "source": "mariadb",
    "sourceId": "erpnext_prod",
    "database": "_4e5d6a7b8c9d0e1f",
    "grounding": {
      "partial": true,
      "requestedSpanYears": 5,
      "availableSpanYears": 2,
      "earliestDate": "Mon May 15 2023 00:00:00 GMT+0530 (India Standard Time)",
      "latestDate": "Sun Dec 01 2024 00:00:00 GMT+0530 (India Standard Time)",
      "coverageNotice": "Note: The database contains records for 2 years (2023–2024), which is fewer than the requested 5 years."
    }
  },
  "data": {
    "type": "llm_query",
    "sql": "SELECT DATE_FORMAT(`posting_date`, '%Y') AS year, SUM(`grand_total`) AS sales FROM `tabSales Invoice` WHERE `docstatus` = 1 GROUP BY DATE_FORMAT(`posting_date`, '%Y') ORDER BY year DESC LIMIT 5",
    "records": [
      { "year": "2024", "sales": "450000.000000000" },
      { "year": "2023", "sales": "30000.000000000" }
    ],
    "rowCount": 2,
    "groundingNotice": "Note: The database contains records for 2 years (2023–2024), which is fewer than the requested 5 years."
  }
}
```

---

## 6. Phase D2 — Multi-Module Scaling, Concept Layer & RLS Design-Lock

| Step | Milestone / Receipt | Target / Assertion | Status |
|---|---|---|---|
| **D2a** | Port 8000 Metadata Expansion | `docker/mock-frappe.js` serving 16 DocTypes across Accounts, Selling, Buying, Stock, HR | ✅ **PASSED** (16 doctypes loaded, `/health` 200 OK) |
| **D2b** | DocType Metadata Client | `src/adapters/erp.meta.js` consumes Channel 2 API, caches link graphs, submittable doctrine | ✅ **PASSED** (10-minute memoized cache, deepFreeze contract) |
| **D2c** | Concept Layer & Profiles | `src/core/concept.layer.js`, `src/config/profiles/erpnext.profile.js`, `sqlite.profile.js` | ✅ **PASSED** (7 canonical concepts mapped, docstatus doctrine exported) |
| **D2d** | MariaDB Multi-Module Fixtures | 12 tables in `_4e5d6a7b8c9d0e1f` across 5 modules (`docker/seed-d2-modules.sql`) | ✅ **PASSED** (Populated with draft, submitted, cancelled records) |
| **D2e** | Multi-Module Oracle Battery | `test/verifyD2Modules.js` & `test/oracle/oracle.harness.js` | ✅ **PASSED** (100% pass across all 5 modules with zero variance) |
| **D2f** | RLS Design-Lock Spec & Test | `docs/RLS_DESIGN_SPEC.md`, `src/security/rls.policy.js`, `test/verify_rls_design_lock.js` | ✅ **PASSED** (CEO-salary fail-closed, self-scoping predicate injection green) |
| **D2g** | Audit Freeze & Full Regression | 10/10 Tier-1 freeze clean, 8/8 regression suites passing, 7/7 CE, 18/18 FI | ✅ **PASSED** (Zero regressions across existing baseline) |

### 6.1 Multi-Module Oracle Verification Table

| Module | Canonical Entity | Test Query / Target Metric | Physical SQL Ground Truth | Engine Answer | Variance |
|---|---|---|---|---|---|
| **Accounting** | `tabSales Invoice` vs `tabGL Entry` | FY2024 Total Revenue Tie-Out | `$450,000.00` (Sales Invoice) = `$450,000.00` (GL Credit) | `$450,000.00` | **$0.00 (Zero Variance)** |
| **Selling** | `tabCustomer` | Active Customers (`disabled = 0`) | `5` active customers (out of 7 total) | `5` | **0** |
| **Selling** | `tabSales Order` | FY2024 Submitted Sales Orders | `$480,000.00` (Draft: $70k, Cancelled: $40k excluded) | `$480,000.00` | **$0.00** |
| **Buying** | `tabSupplier` | Active Suppliers (`disabled = 0`) | `4` active suppliers (out of 5 total) | `4` | **0** |
| **Buying** | `tabPurchase Invoice` | FY2024 Submitted Purchase Invoices | `$280,000.00` (Draft: $30k, Cancelled: $15k excluded) | `$280,000.00` | **$0.00** |
| **Stock** | `tabItem` | Active Catalogue Items (`disabled = 0`) | `4` active items (out of 5 total) | `4` | **0** |
| **Stock** | `tabStock Ledger Entry` | FY2024 Inventory Value Difference | `$150,000.00` | `$150,000.00` | **$0.00** |
| **HR** | `tabEmployee` | Active Headcount (`status = 'Active'`) | `6` active staff (out of 7 total) | `6` | **0** |
| **HR** | `tabSalary Slip` | November 2024 Submitted Payroll | `$85,000.00` (Draft: $14k, Cancelled: $13k excluded) | `$85,000.00` | **$0.00** |
| **HR / RLS** | `tabSalary Slip` | CEO Monthly Salary Baseline | `$30,000.00` (Victoria Stirling, EMP-001) | Baseline | **$0.00** |

### 6.2 Docstatus Doctrine Empirical Proof
Across all submittable transactional tables (`tabSales Invoice`, `tabSales Order`, `tabPurchase Invoice`, `tabStock Ledger Entry`, `tabSalary Slip`):
- **Draft records (`docstatus = 0`)** and **Cancelled records (`docstatus = 2`)** are physically seeded in the test database.
- Analytical reporting queries strictly inject `docstatus = 1`, mathematically preventing uncommitted drafts and voided cancellations from corrupting balance sheets, sales totals, inventory counts, or payroll reports.

### 6.3 RLS CEO-Salary Test Receipt
```
==================================================
   PHASE D2 — RLS DESIGN-LOCK & CEO-SALARY TEST   
==================================================

[1] Testing unauthenticated access rejection...
  ✅ Unauthenticated request rejected fail-closed

[2] Testing Direct CEO-Salary Probe by Employee (Devon Vance, EMP-002)...
  Verdict: REJECT_FORBIDDEN
  Error:   rls_forbidden:unauthorized_salary_access
  Reason:  Access to salary records of other employees is restricted by enterprise policy.
  ✅ CEO-salary direct probe rejected fail-closed with zero SQL execution

[3] Testing Self-Service Salary Query by Devon Vance (EMP-002)...
  Verdict: INJECT_PREDICATE
  Predicate: `employee` = 'EMP-002' AND `docstatus` = 1
  Original SQL:    SELECT gross_pay, net_pay FROM `tabSalary Slip` WHERE `start_date` = '2024-11-01'
  Transformed SQL: SELECT gross_pay, net_pay FROM `tabSalary Slip` WHERE `employee` = 'EMP-002' AND `docstatus` = 1 AND `start_date` = '2024-11-01'
  ✅ Self-service query scoped to Devon's salary ($14,000.00) — CEO salary excluded!

[4] Testing Executive / HR Manager Access (Victoria Stirling, EMP-001)...
  Verdict: ALLOW
  ✅ Executive query authorized: full payroll visible ($85,000.00)

[5] Testing predicate injection across different SQL shapes...
  No-WHERE injection: SELECT * FROM `tabCustomer` WHERE `disabled` = 0 ORDER BY name LIMIT 10
  GROUP BY injection: SELECT customer, SUM(grand_total) FROM `tabSales Invoice` WHERE `docstatus` = 1 GROUP BY customer
  ✅ SQL predicate injector handles WHERE, ORDER BY, and GROUP BY correctly

==================================================
🏆 ALL RLS DESIGN-LOCK TESTS PASSED (100% GREEN)!
==================================================
```


