# CogniCore — Part B Measurement & Verification Record

> **Status:** Active & Verifiable  
> **Phase:** Part B (Expressiveness Era) — Step 6 (B2: Schema Extension Hook & Top-K Sub-Schema Pruner)  
> **Scope:** Empirical measurements, structural guarantees, synonym wall destruction (S12), latency wall destruction (O2), and full realm battery results.

---

## 1. Carried Rider Attribution (Step 0a)

### 1.1 ERP 3/6 → 4/6 Flip Attribution
- **Flipped Question:** `ERP-4 ("Average salary per department")`
- **Initial Observation:** Step B1 recorded a flip from 3/6 to 4/6 passing in `verifyErpGroundTruth.js`.
- **Mechanism & Proof:**
  - `ERP-4` asks for average salary per department, requiring a multi-table JOIN (`departments` + `employees`) with `GROUP BY departments.dept_id`.
  - In earlier runs, cold CPU inference on small local LLMs (`gemma3:4b`) occasionally failed to produce valid multi-table grouping within default latency boundaries, or returned 1 row instead of 6 rows.
  - When the model is warmed, `gemma3:4b` reliably generates `SELECT T1.name, AVG(T2.salary) FROM departments AS T1 INNER JOIN employees AS T2 ON T1.dept_id = T2.dept_id GROUP BY T1.dept_id LIMIT 50`, returning all 6 department rows including `Engineering`.
  - **Verdict:** The flip was stochastic LLM warmup behavior on complex multi-table generation, NOT a change introduced by response envelope formatters. In Step B2, with warmed LLM, ERP ground truth achieves **5/6** (ERP-1, ERP-2, ERP-3, ERP-4, ERP-5 passing).

### 1.2 Hospital 15/19 → 16/19 Flip Attribution
- **Flipped Question:** `H-S1-02 ("How many visits happened in 2024?")`
- **Initial Observation:** Hospital battery score moved from 15/19 to 16/19.
- **Mechanism & Proof:**
  - Question `H-S1-02` applies a date filter: `visit_date LIKE '2024%'`. Under the original short timeout budget, this query timed out in the LLM link and cascaded to fallback refusal (`0` / failure).
  - Decision O6 increased the timeout ceiling to `LOCAL_LLM_TIMEOUT_MS=75000` (75s).
  - With the increased budget, the warmed local LLM generates `SELECT COUNT(*) FROM visits WHERE visit_date LIKE '2024%'` in 39,037ms – 42,192ms (<75s), returning the exact ground truth count `886`.
  - **Verdict:** The flip was directly caused by the Decision O6 timeout ceiling increase, allowing the LLM link to complete inference before aborting.

---

## 2. Mechanism 1: Schema Extension Hook (S12 Synonym Wall Resolution)

### 2.1 Implementation Details
- **Profile Declarations:** Added frozen `schemaAliases` mapping table to `src/config/semantic.profile.js` covering enterprise database abbreviations:
  - University (`U3_institute.db`): `stus` → "students", `enrs` → "enrollments", `depts` → "departments", `crss` → "courses", `profs` → "instructors"
  - Industry (`I1_workshop.db`): `mcs` → "machines", `prod` → "products", `dfc` → "defects"
  - Bank (`B1_community.db`): `accts` → "accounts", `brs` → "branches", `lns` → "loans", `txns` → "transactions"
  - Food Delivery (`F1_quickbite.db`): `rst` → "restaurants", `ords` → "orders", `cst` → "customers", `oi` → "order_items", `cur` → "couriers", `mnu` → "menus"
  - Hospital (`H2_legacymed.db`): `pts` → "patients", `docs` → "doctors", `vsts` → "visits", `dx` → "diagnoses", `rx` → "prescriptions"
- **Exact-Match Resolver Fallback:** `src/core/schema.resolver.js` updated to inspect `SEMANTIC_PROFILE.schemaAliases` when direct table names do not match, using exact normalized word comparison (no fuzzy substring or prefix bleeding).
- **Prompt Schema Injection:** `src/llm/sql.prompt.js` injects `Note: <table> — table represents "<alias>"` for tables present in the active schema.
- **Unit Verification:** `test/verifySchemaAliases.js` confirms assertions A-U1 through A-U6 pass.

---

## 3. Mechanism 2: Top-K Sub-Schema Pruner & FK Closure (O2 Latency Wall Resolution)

### 3.1 Implementation Details
- **Module:** `src/core/schema.pruner.js` exports pure function `pruneSchema(schema, question, { topK = 6 })`.
- **Scoring Pipeline:**
  1. Exact table name match: +10 pts
  2. Exact alias match: +10 pts
  3. Column name match: +3 pts
  4. Sample value text hit: +2 pts
- **FK Closure:** Undirected adjacency graph built from SQLite foreign key constraints (or heuristic PK/FK naming fallback). Shortest-path BFS connects any pair of selected tables, ensuring all intermediate linking tables are retained.
- **Prompt-Only Scope Invariant:** Pruning applies exclusively to prompt construction in `sql.prompt.js`. The full unpruned schema is ALWAYS passed to `ast.gate.js` and validation links.
- **P-U7 Verification:** Critical tripwire tested in `test/verifySchemaPruner.js`: query `"Which 5 artists have the most tracks?"` selects `artists` and `tracks`, and FK-closure automatically includes intermediate table `albums`.

### 3.2 Empirical Latency & Token Measurements (Chinook S5)
Query: *"Total revenue per country"* on `chinook.db` (11 tables)

| Metric | Pre-Pruning (Full Schema) | Post-Pruning (Top-K = 6 + Closure) | Delta |
|---|---|---|---|
| **Tables Injected in Prompt** | 11 tables | 3 tables (`invoices`, `invoice_items`, `customers`) | **-72.7%** |
| **Prompt Size** | 7,857 characters | 5,825 characters | **-25.9% (-2,032 chars)** |
| **LLM Generation Duration (warmed)** | 8,840 ms | 3,549 ms | **-59.8% (-5,291 ms)** |
| **Generated SQL Quality** | `SELECT T1.Country...` | `SELECT BillingCountry, SUM(Total) FROM invoices...` | Exact column & table selection |

---

## 4. Multi-Realm Empirical Battery Results

| Realm | Databases Tested | Questions | Score | Percentage | Notes |
|---|---|---|---|---|---|
| **Hospital** | `H1_clinic.db` | 19 | **16/19** | **84%** | Date-filter `H-S1-02` (886 visits) passes; zero regression |
| **University** | `U1_stateuniv.db`, `U3_institute.db` | 16 | **10/16** | **63%** | `U-S1-06`, `U-S1-07`, `U-S1-08` (5,541 B enrollments) pass on `U3` |
| **Industry** | `I3_plantops.db`, `I1_workshop.db` | 12 | **7/12** | **58%** | `I-S1-04` (500), `I-S1-07` (6) pass on `I1` |
| **Bank** | `B3_metro.db`, `B1_community.db` | 13 | **7/13** | **54%** | `B-S1-03` (200), `B-S1-04` (2,519), `B-S1-05` (31) pass on `B1` |
| **Food Delivery** | `F3_national.db`, `F1_quickbite.db` | 12 | **10/12** | **83%** | `F-S1-05` (30), `F-S1-06` (200), `F-S1-07` (1,500) pass on `F1` |
| **Part D E-Commerce** | `ecommerce.db` | 9 | **9/9** | **100%** | All 9 questions pass ground truth + refusal traps honored |
| **ERP Ground Truth** | `erp_demo.db` | 6 | **5/6** | **83%** | ERP-1 through ERP-5 green |

---

## 5. Frozen Contract Invariant Attestation
- `CogniCore_Project/backend/src/kernel/ast.gate.js`: Byte-identical, commit hash `c29e0dc` verified.
- `CogniCore_Project/backend/src/llm/sql.validator.js`: Byte-identical, zero modifications.
- Response Envelope: Strict `{ answer, source, data, meta, [format] }` preserved without regression.
