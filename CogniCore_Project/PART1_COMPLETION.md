# COGNICORE — PART 1 COMPLETION REPORT (Evidence Log)

**Date:** 2026-09-07  
**Branch:** part1-fast-intent  
**Target:** Finalize Part 1 (Fast Intent Router), audit invariants, freeze canon v1.1.

---

## 1. Task A: .env Audit
- **Git Check-Ignore:** Verified `CogniCore_Project/backend/.env` is tracked by `.gitignore`.
- **Content:** Restored to the canonical 4 lines:
  ```env
  PORT=5000
  ENABLE_LOCAL_LLM=true
  LOCAL_LLM_URL=http://localhost:11434
  LOCAL_LLM_MODEL=gemma3:4b
  ```
- **Verification:** Express server running on port 5000; `GET /health` returned HTTP 200 `{"status":"ok"}`.

---

## 2. Task B: Read-Only Path Audit
- **Execution Path:**
  `dynamic.query.engine.js:L83 → executeQueryPlan(plan) [with plan.readOnly = true at L78] → getReadOnlyDatabase() (OPEN_READONLY)`
- **Parameter Binding:** Parameterized queries use standard SQLite placeholders (`?`) with bound parameters passed as arrays directly to `readOnlyDb.all(sql, params, callback)`. Zero string concatenation of user-provided values.
- **Evidence:** Tested live via `verify_college_attendance.js` Question 2:
  `SELECT * FROM "attendance" WHERE "student_id" = ? AND "status" = ? LIMIT 50` with parameters `[80, "Absent"]`. Physical write attempts throw `SQLITE_READONLY`.

---

## 3. Task C: Connection Lifecycle Audit
- **Singleton Persistence:**
  - Read-write connection: module-level cached singleton `db` at `config/database.js:L148`.
  - Read-only connection: module-level cached singleton `readOnlyDb` at `config/database.js:L231`.
  - Closing connections occurs only inside `doSwitchDatabase` (`config/database.js:L195-207`) upon an explicit database switch. Connections are never closed in query execution `finally` blocks.
- **Verification Script:** Created `CogniCore_Project/backend/verifyConnLifecycle.js` executing 20 concurrent queries in parallel.
- **Outcome:** 20/20 passed in 192ms with 0 errors and zero `SQLITE_MISUSE`.

---

## 4. Task D: Root Cause of 40-vs-80 Bug
- **Documented In:** `CogniCore_Project/PART1_REPORT.md` under `## 8. Root Cause: 40-vs-80 Count Discrepancy`.
- **Root Cause Mechanism:** The distinct values cache loaded low-cardinality string values, including single-letter section names like `'A'` from `students.section`. The substring matching logic `q.includes(sv.toLowerCase())` loosely matched `'a'` inside general query words like `"many"` or `"are"`, mistakenly detecting a value match and injecting `WHERE "section" = ?` with param `['A']`. Because Section A had 40 students while total students was 80, the count returned was 40 instead of 80.
- **Fix:** Replaced substring matching with exact token matching (`norm(v.value) === tok`), hardened the stopword list, and enforced the numeric coverage guard.
- **Regression Lock:** Verified locked by `verify_college_attendance.js` Question 1 (`how many student are there` returning 80 in 42ms).

---

## 5. Task E: Benchmark Freeze (Resolves v1.0 §9.1)
- **Search Conducted:** Examined `CogniCore_Project/backend` for any ground truth benchmark scripts matching `verify.*(bench|ground|truth|accuracy|erp)`.
- **Candidates Examined:**
  - `runPartBParityBenchmark.js` (targets Chinook DB)
  - `runPartDEcommerceBenchmark.js` (targets ecommerce_test.db)
  - `verify_college_attendance.js` (targets college attendance DB)
  - `verifyLlm*.js` (unit / integration suites)
- **Result:** No benchmark script exists for `erp_demo.db`.
- **Resolution:** Frozen strictly per §7.4 instructions as:
  `UNRESOLVED(no benchmark script found — candidates examined: runPartBParityBenchmark.js, runPartDEcommerceBenchmark.js, verify_college_attendance.js, verifyLlm*.js)`.

---

## 6. Task F: Shape Recount (Resolves v1.0 §9.3)
- **Baseline `sql.builder.js` Shapes (8):**
  1. `database_tables`
  2. `table_columns`
  3. `count`
  4. `records`
  5. `average`
  6. `sum`
  7. `highest`
  8. `lowest`
- **New Parameterized `fastIntent.js` Shapes (7):**
  1. `topN`
  2. `bottomN`
  3. `threshold_filter`
  4. `id_lookup`
  5. `value_match_filter`
  6. `count_with_filter`
  7. `aggregate_with_filter`
- **Total:** **15 (8 sql.builder baseline + 7 fastIntent)**.

---

## 7. Task G: Full Suite Re-Run Summary
- **`verify_college_attendance.js`:** 6/6 HARD assertions PASSED.
  - Q1: `how many student are there` → 42ms, source: `dynamic`, count: 80
  - Q2: `find student id = 80 absent days` → 11ms, source: `dynamic`, count: 8
  - Q3: `student_id = 80 how many says is this student present` → 8ms, source: `dynamic`, count: 60
  - Q4: `average absent percentage` → 6263ms, source: `llm` (router correctly declined to fabricate column)
  - Q5: `lowest attendence top 5 (calculate the lowest attendance by student id)` → 8ms, source: `dynamic`, count: 5
  - Q6: `calculate average no. of student absent more than 10 days` → 13201ms, source: `llm` (correctly cascaded)
- **Active Database Hygiene:** Verified `active-database.json` restored to `erp_demo.db` after execution.
- **`test_phase2_fast_intent_units.js`:** 9/9 passed.
- **`test_phase3_distinct_cache.js`:** Passed; verified cache invalidation across DB switch without leakage.
- **Regression Tests:**
  - `verifyConnLifecycle.js`: 20/20 passed
  - `verifyCacheHitMiss.js`: passed
  - `verifyTest2SwitchInvalidation.js`: passed
  - `verifyTest3ConcurrentSwitch.js`: passed
  - `verifyTest4FailedSwitch.js`: passed
  - `verifyPhase2StalenessTrap.js`: passed
  - `verifyP3_1Persistence.js`: passed
  - `verifyP3_3SessionIsolation.js`: passed
  - `verifyP3_4Hydration.js`: passed
  - `verifyP3_5SurvivesSwitch.js`: passed
  - `verifyP3_6PromptOverhead.js`: passed
  - `verifyLlm1ValidatorSecurity.js`: 37/37 passed (<3ms verdicts)
  - `verifyLlm2ClientContract.js`: passed
  - `verifyLlm3ReadOnlyPhysical.js`: passed (driver threw SQLITE_READONLY)
  - `verifyLlm4SimpleRetrieval.js`: passed
  - `verifyLlm6AdversarialQuestion.js`: passed
  - `verifyLlm7GarbageOutput.js`: passed
  - `verifyLlm8HallucinatedTable.js`: passed
  - `verifyLlm9OfflineFailover.js`: passed (29ms failover)
  - `verifyLlm10ThinkStripping.js`: passed

---

## 8. Task H: Canonical `MASTER_CONTEXT.md` v1.1
- **File Created:** `/home/shubh/Documents/project/cognicore/Cognicore/MASTER_CONTEXT.md` (repo root).
- **Placeholder Audit:** `grep -c "<<" MASTER_CONTEXT.md` confirmed: **0**.
- **Invariants Checked:**
  - `backend/src/core/sql.validator.js` untouched (`git diff main...HEAD` is empty).
  - Contract `{ answer, source, data, meta }` preserved.
  - Part 2 explicitly out of scope.
