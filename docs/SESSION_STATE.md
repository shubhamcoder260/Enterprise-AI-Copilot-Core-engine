# CogniCore Master Session State & Handoff Ledger

**Last Updated:** 2026-09-27 19:04 IST  
**Git Head:** `012b38e` (Branch: `main`, Remote: `myrepo/main`)  
**Status:** All Tier-1 Frozen Files 10/10 Clean | Canonical Regression: 19/19 Green

---

## 1. Executive Summary & Where We Are

We are currently executing the **Two-Part Expansion Plan**:
- **Part A — Finish Connecting & Stress-Testing on `erpnext_v16`** (In Progress)
- **Part B — Build Universal Self-Service Connector (Customer-Facing Dynamic Sources & Vault)** (Next)

### Exact Current Pause Point:
- The user has started the backend server (`npm start` on port 5000).
- We are actively in **Part A, Step 2 (Response-Shape Sweep)**, waiting to execute:
  1. Switch to `erpnext_v16`:
     ```bash
     curl -s -X POST http://localhost:5000/api/database/sources/switch \
       -H "Content-Type: application/json" \
       -d '{"sourceId": "erpnext_v16"}'
     ```
  2. Query 2.1 (List Shape):
     ```bash
     curl -s -X POST http://localhost:5000/api/ai/query \
       -H "Content-Type: application/json" \
       -d '{"query": "show customers", "sessionId": "sweep-list-1"}'
     ```

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

---

## 3. The Active Plan: Part A & Part B Roadmap

### Part A — Close Out Connector Testing (`erpnext_v16`)
1. **Response-Shape Sweep:**
   - 2.1 List shape: `"show customers"`
   - 2.2 Top-N shape: `"show top 3 customers"`
   - 2.3 Submittable count: `"how many sales orders do we have?"`
   - 2.4 Active filter: `"how many active items do we have?"`
   - 2.5 Aggregate / Average: `"average grand total of sales invoices"`
2. **Adversarial Gate Probes:**
   - Obfuscated subquery to protected table (e.g. `tabSalary Slip`)
   - Injection via SQL comments and encoding
   - Mixed-case identifier probes (`TabCustomer`, `tabsales invoice`)
   - Verify all fail closed via `gateChainFor("mariadb")`.
3. **Schema-Scale Check:**
   - Time full introspection on MariaDB 11.8 across all 740+ tables.
   - Confirm schema cache and pruning latency remains within acceptable thresholds (< 250ms).
4. **Concurrency & Lease Check:**
   - Fire parallel queries during `switchTo()` to prove zero lease starvation and 100% clean releases.

### Part B — The Universal Connector (Customer-Facing Architecture)
1. **Backend Vault & Multi-Tenant Credential Store:**
   - Replace static `.env` credential dependency with per-source encrypted storage (AES-256-GCM).
   - CRUD API endpoints: `POST /api/sources`, `POST /api/sources/:id/test`, `GET /api/sources`, `DELETE /api/sources/:id`.
2. **Active Grant Validation (Pre-Flight Probe):**
   - Live test endpoint attempts read introspection and affirmatively tests that write operations (`CREATE TABLE`, `INSERT`) fail with privilege errors (`ER_TABLEACCESS_DENIED_ERROR`).
3. **Automated SQL Setup Guidance:**
   - Endpoint generating exact, copy-pasteable `CREATE USER` and `GRANT SELECT` scripts populated with the user's database name.
4. **Frontend Wizard & Dashboard:**
   - Connection wizard (engine selection $\rightarrow$ credential input $\rightarrow$ live test $\rightarrow$ save).
   - Sources dashboard with live status indicators and connection diagnostics.

---

## 4. Key File & Container Topology

| Component | Target / Path | Key Role |
| :--- | :--- | :--- |
| **`erpnext_v16` DB** | `frappe_docker-db-1` (port 3307) | Live MariaDB 11.8 testbed with real ERPNext schema (`_210a92d8bfbfc131`) |
| **`cognicore-mariadb`** | port 3306 | Development fixture database (`_4e5d6a7b8c9d0e1f`) |
| **`verify.chain.js`** | `src/kernel/verify.chain.js` | Grounding & arithmetic verification lie-detector |
| **`dynamic.link.js`** | `src/core/links/dynamic.link.js` | Dynamic query engine pipeline bridge |
| **`fastIntent.js`** | `src/core/fastIntent.js` | Tier-2 deterministic query router (Re-Pin #6) |
| **`erpnext.profile.js`** | `src/config/profiles/erpnext.profile.js` | ERPNext semantic profile & `docstatusKind` registry |
| **Regression Suite** | `test/verifyFullRegression.sh` | 19 canonical suites (all passing green) |
| **Freeze Gate** | `test/audit-freeze.js` | 10 Tier-1 files audited for zero diffs |
