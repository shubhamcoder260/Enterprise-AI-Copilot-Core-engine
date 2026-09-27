# CogniCore Master Session State & Handoff Ledger

**Last Updated:** 2026-09-27 22:25 IST  
**Git Head:** `393d4b5` (Branch: `main`, Remote: `myrepo/main`)  
**Status:** All Tier-1 Frozen Files 10/10 Clean | Canonical Regression: 19/19 Green

---

## 1. Executive Summary & Where We Are

We have executed and completed the **Two-Part Expansion Plan**:
- **Part A — Finish Connecting & Stress-Testing on `erpnext_v16`** (✅ COMPLETED)
- **Part B — Build Universal Self-Service Connector (Customer-Facing Dynamic Sources & Vault)** (🚀 READY TO EXECUTE)

### Part A Verification Summary (All Gates Passed):
1. **Live Response-Shape Sweep:**
   - Query 2.1 (List Shape): `"show customers"` -> 9 records from `tabCustomer`, SQL `LIMIT 50`, `verified: true`, `failures: []`.
   - Query 2.2 (Top-N Shape): `"show top 3 customers by name"` -> top 3 records, SQL `LIMIT 3`, `verified: true`.
   - Query 2.3 (Scalar Count Shape): `"how many customers do we have?"` -> 9 records, SQL `COUNT(*)`, `verified: true`.
   - Query 2.4 (Submittable Shape): `"show sales invoices"` -> 35 records from `tabSales Invoice` with `docstatus = 1`, `verified: true`.
   - Query 2.5 (Item Master Shape): `"show items"` -> 13 records from `tabItem`, `verified: true`.
2. **Bug #3 Grounding Fix:**
   - Grounded SQL pagination limits (e.g. `LIMIT 50`) and boilerplate notices in `src/kernel/verify.chain.js` and `src/core/response.formatter.js`.
   - Expanded `test/verify_grounding_lie_detector.js` to 14/14 tests (added positive test and negative control).
3. **Adversarial Gate Probes on Live ERPNext v16:**
   - Protected Table Probe (`__Auth`): Blocked cold by RLS fail-closed policy.
   - Comment Injection Probe (`/* injection */ DROP TABLE...`): Malicious payload stripped, safe query executed.
   - Case-Variation Probe (`tabCUSTOMER`): Normalized and routed cleanly.
4. **Schema-Scale Introspection & Pruning:**
   - Full introspection of all 737 tables completed in 2.2 seconds.
   - Schema pruner isolated relevant sub-schemas for natural language queries in 33–51 milliseconds.
5. **Live Concurrency Check:**
   - 10 parallel queries fired simultaneously against `erpnext_v16` under real latency; 10/10 returned HTTP 200 with `verified: true`.
6. **Regression Gate:**
   - 10/10 Tier-1 frozen files verified clean.
   - 19/19 canonical test suites passing green (`verifyFullRegression.sh`).

---

## 2. Recent Accomplishments & Locked Ground Truth

### A. S17 Docstatus Doctrine Fix on Live `erpnext_v16`
- **Root Problem:** Master doctypes (`tabCustomer`, `tabItem`) lack submission lifecycles (`docstatus = 0`). Prior logic erroneously applied `docstatus = 1` to all docstatus-bearing tables.
- **Resolution:**
  - In `src/config/profiles/erpnext.profile.js`, `docstatusKind` registry explicitly declares `'master'` vs `'submittable'`.
  - In `src/core/fastIntent.js:333`, `isSubmittable(table.name)` gates `docstatus = 1` injection.
  - Applied **RE-PIN #6** to `src/core/fastIntent.js` and expanded `test/golden/fast_intent_golden.json` to 22 cases.
  - Tested live against `frappe_docker-db-1` (`_210a92d8bfbfc131`): confirmed ground truth is 9 customers with `docstatus = 0`.
  - Application query confirmed: returns 9 records with SQL `SELECT COUNT(*) AS result FROM \`tabCustomer\`` (NO `docstatus` filter).

### B. Live Wiring Regression Test (`test/verify_live_docstatus_wiring.js`)
- Added end-to-end integration test querying the live HTTP endpoint on port 5000.
- Asserts master doctypes (`tabCustomer`, `tabItem`) generate SQL without `docstatus` filter.
- Asserts submittable doctypes (`tabSales Invoice`, `tabSales Order`) generate SQL with `docstatus = ?` filter.
- Wired into `test/verifyFullRegression.sh` (expanding canonical suite count to **19/19 green**).

### C. False-Positive Grounding Lie-Detector Resolution
- **Root Problem:** `dynamic.link.js` passed `records: []` for scalar count queries. The grounding lie detector (`verify.chain.js`) searched only `records` and `query`, causing correct scalar counts (`data.value: 9`) to be flagged as `ungrounded_numeric_claims: [9]` with an erroneous warning banner.
- **Resolution:**
  - Extended `collectRecordNumbers(records, data)` in `src/kernel/verify.chain.js` to inspect `data.value`, `data.count`, `data.total`, `data.average`, and scalar payloads.
  - Extended `verifyGrounding` to accept `options.data` and `options.scalarValues`.
  - Extended `verifyArithmetic` to validate count claims against `data.value`.
  - Updated `src/core/links/dynamic.link.js` to pass `data: dynamicResult.data` into `runVerificationChain`.
  - Added positive (TEST 10) and negative-control (TEST 11) test cases to `test/verify_grounding_lie_detector.js` (12/12 passing).
  - Verified live on `erpnext_v16`: `verification.verified: true`, `honestNotice: null`, zero warning banners.

### D. Bug #3 Resolution (Pagination Limit False-Positive Grounding)
- **Root Problem:** The response formatter for list/records queries appends `"The display is limited to the first 50 records."` The Grounding Lie Detector (`verify.chain.js`) scanned numbers in the answer (`9`, `50`), saw `50` was not in the records, and erroneously issued an ungrounded claim warning badge.
- **Resolution:**
  - Extended `collectRecordNumbers(records, data, options)` in `src/kernel/verify.chain.js` to parse SQL `LIMIT` and `OFFSET` clauses, record `data.limit`, and recognize default record pagination limit (50).
  - Extended `verifyGrounding` to parse system pagination notices (`/limited to (?:the first )?(\d+) records/i`).
  - Updated `src/core/response.formatter.js` to include `limit: 50` in data payload.
  - Added TEST 12 (positive limit grounding) and TEST 13 (negative control catching fake numbers) in `test/verify_grounding_lie_detector.js` (14/14 green).
  - Verified live on `erpnext_v16`: `"show customers"` returns `verified: true`, `honestNotice: null`.

---

## 3. The Active Plan & Decision: Part B Roadmap

### Architectural Decision Made:
We evaluated the 3 options for connecting ERPs:
1. **Option 1 (Direct Self-Service Wizard + Pre-flight Test + AES-256-GCM Vault) — SELECTED ⭐**
2. **Option 2 (REST API Keys) — RULED OUT** (20x-50x slower, throws away SQL validation and schema pruner).
3. **Option 3 (Reverse Tunnel Agent) — RULED OUT** (overkill, requires IT command-line work).

### Part B Implementation Order (To execute next session):
1. **Step 1: Encrypted Credential Vault & Dynamic Source Registry (Backend)**
   - Create `src/config/vault.js`: Encrypts database credentials at rest with **AES-256-GCM**.
   - Storage format: Local encrypted JSON/SQLite file; write-once security (passwords never returned in GET responses).
   - Dynamic source CRUD: `POST /api/sources`, `GET /api/sources`, `DELETE /api/sources/:id`.
2. **Step 2: Pre-Flight Test & Script Generation Endpoint (Backend)**
   - `POST /api/sources/test`: Runs live test (connectivity, read access check, confirms write operations fail).
   - `POST /api/sources/helper-script`: Generates copy-pasteable `CREATE USER / GRANT SELECT` SQL script for client DB admin.
3. **Step 3: Frontend Connection Wizard & Sources Manager**
   - Modal UI: Engine selector (ERPNext/MariaDB, Postgres, SQLite upload) $\rightarrow$ credentials form $\rightarrow$ "Test Connection" button $\rightarrow$ Save & Activate.
   - Sources list with live health status pills.

---

## 4. Key File & Container Topology

| Component | Target / Path | Key Role |
| :--- | :--- | :--- |
| **`erpnext_v16` DB** | `frappe_docker-db-1` (port 3307) | Live MariaDB 11.8 testbed with real ERPNext schema (`_210a92d8bfbfc131`) |
| **`cognicore-mariadb`** | port 3306 | Development fixture database (`_4e5d6a7b8c9d0e1f`) |
| **`verify.chain.js`** | `src/kernel/verify.chain.js` | Grounding & arithmetic verification lie-detector (14/14 green) |
| **`dynamic.link.js`** | `src/core/links/dynamic.link.js` | Dynamic query engine pipeline bridge |
| **`fastIntent.js`** | `src/core/fastIntent.js` | Tier-2 deterministic query router (Re-Pin #6, 22/22 green) |
| **`erpnext.profile.js`** | `src/config/profiles/erpnext.profile.js` | ERPNext semantic profile & `docstatusKind` registry |
| **Regression Suite** | `test/verifyFullRegression.sh` | 19 canonical suites (19/19 passing green) |
| **Freeze Gate** | `test/audit-freeze.js` | 10 Tier-1 files audited for zero diffs |

