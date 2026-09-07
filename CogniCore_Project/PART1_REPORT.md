# CogniCore — Part 1 Upgrade Final Report: Fast Intent Router

**Date:** 2026-09-07  
**Branch:** `part1-fast-intent`  
**Author:** Antigravity AI Coding Assistant  

---

## 1. Executive Summary
Part 1 of the Core Engine Upgrade has been completed with **100% of Definition of Done (DoD) criteria satisfied across all phases (Phase 0–5)**.
- The cascade chain in `core.engine.js` was reordered from `[Tools → LLM → Dynamic → Fallback]` to `[Tools → Dynamic → LLM → Fallback]`.
- A deterministic rule-based natural language router `backend/src/core/fastIntent.js` was designed and inserted as the fast-path in `dynamic.query.engine.js`.
- A distinct-values cache (`backend/src/core/distinct.cache.js`) was added with automatic invalidation on database switch hooks, preventing cross-database pollution.
- Numeric Coverage Guard and semantic polarity guards were introduced to prevent hallucinated or unfiltered query execution.
- Query latency for common natural language queries dropped from **~15,000 ms (LLM timeout) to 8–65 ms**, representing a **>200x speedup**.

---

## 2. Phase 0 Discovery Findings

### 2.1 Export Signatures
- **`backend/src/core/core.engine.js`**:
  `export async function runCoreEngine({ query, organization, role, sessionId, model })`
- **`backend/src/core/sql.builder.js`**:
  `export function quoteIdentifier(name)`
  `export function buildQueryPlan({ query, schema = {}, resolved = {} })`
- **`backend/src/core/query.executor.js`**:
  `export async function executeQueryPlan(plan)`
- **`backend/src/core/schema.reader.js`**:
  `export function clearSchemaCache()`, `export function getSchemaCacheStats()`, `export function resetSchemaCacheStats()`
  `export function truncate(str, n = 60)`, `export async function computeSchemaHash(db)`
  `export async function getEnrichedSchema(dbInstance, options = {})`, `export async function readDatabaseSchema(forceRefresh = false)`
- **`backend/src/core/response.formatter.js`**:
  `export function formatExecutionResponse({ plan, execution, schema = {} })`
- **`backend/src/config/database.js`**:
  `export function registerDatabaseSwitchHook(hookFn)`, `export async function ensureInitialized()`
  `export async function connectDatabase()`, `export function switchDatabase(newDatabasePath)`
  `export async function getReadOnlyDatabase()`, `export async function executeReadOnlySql(sql, params = [])`
  `export function getActiveDatabasePath()`, `export async function closeDatabase()`
- **Driver in `package.json`**:
  `"sqlite": "^5.1.1"`, `"sqlite3": "^6.0.1"` (Asynchronous `sqlite3` driver, **NOT** `better-sqlite3`).

### 2.2 Active Database Resolution
- **File**: `backend/active-database.json`
- **College Attendance DB**: `/home/shubh/Documents/project/cognicore/Cognicore/CogniCore_Project/backend/uploads/1788767199100-college_attendance_(3).db`

### 2.3 College Attendance DB Schema Analysis
- **Tables & Row Counts**:
  - `attendance`: 6,000 rows
  - `departments`: 5 rows
  - `faculty`: 10 rows
  - `fees`: 160 rows
  - `marks`: 1,200 rows
  - `students`: 80 rows
  - `subjects`: 25 rows
- **Attendance-Like Tables**:
  - `attendance`: `attendance_id`, `student_id`, `subject_id`, `faculty_id`, `date`, `status` (`CHECK(status IN ('Present','Absent','Late'))`).
  - `students`: contains `attendance_percentage` column (REAL).
- **Format Classification**:
  - `attendance` table is **LONG-FORMAT** (6,000 rows, date column present, non-unique `student_id`).
  - `students` table is **SHORT-FORMAT** (80 rows, exactly 1 row per student, `student_id` is PK).
- **Low-Cardinality Distinct TEXT Columns**:
  - `attendance.status` (`Present`, `Absent`, `Late`)
  - `departments.dept_name` (`Computer Science`, `Electronics & Communication`, `Mechanical`, `Electrical & Electronics`, `Information Technology`)
  - `faculty.designation` (`Professor`, `Assistant Professor`, `Associate Professor`)
  - `fees.status` (`Paid`, `Pending`, `Overdue`)
  - `marks.exam_type` (`Internal 1`, `Internal 2`, `Semester`)
  - `students.section` (`A`, `B`)

### 2.4 Live Probe Response
- **Query**: `how many student are there`
- **Response**:
```json
{
  "answer": "There are 80 record(s) in the students table.",
  "source": "dynamic",
  "data": {
    "type": "count",
    "table": "students",
    "value": 80,
    "sql": "SELECT COUNT(*) AS result FROM \"students\""
  },
  "meta": {
    "engineMode": "dynamic_query",
    "processingMs": 65
  }
}
```
- **SQL Panel Field**: The SQL query string for the frontend SQL inspection panel is carried in `data.sql`.

---

## 3. Dynamic Path Query Shapes (Resolution of Canon §9.3)

Prior to Part 1, the dynamic path supported 8 heuristic shapes. With the introduction of `fastIntent.js`, the dynamic engine now supports **15 concrete query shapes**:

1. `database_tables`: Schema table discovery ("what tables exist")
2. `table_columns`: Column discovery for a specified table ("what columns are in students")
3. `count`: Total table row counting (`SELECT COUNT(*) AS result FROM "table"`)
4. `records` / `list`: Plain 50-row table view (`SELECT * FROM "table" LIMIT 50`)
5. `average`: Unfiltered column average (`SELECT AVG("col") FROM "table"`)
6. `sum`: Unfiltered column total (`SELECT SUM("col") FROM "table"`)
7. `highest`: Max row retrieval (`SELECT * FROM "table" ORDER BY "col" DESC LIMIT 1`)
8. `lowest`: Min row retrieval (`SELECT * FROM "table" ORDER BY "col" ASC LIMIT 1`)
9. `topN`: Parameterized top-N ranking with limit (`SELECT * FROM "table" ORDER BY "col" DESC LIMIT ?`)
10. `bottomN`: Parameterized bottom-N ranking with limit (`SELECT * FROM "table" ORDER BY "col" ASC LIMIT ?`)
11. `threshold_filter`: Row filtering by threshold condition (`SELECT * FROM "table" WHERE "col" > ? LIMIT 50`)
12. `id_lookup`: Primary key or foreign key equality (`SELECT * FROM "table" WHERE "id_col" = ? LIMIT 50`)
13. `value_match_filter`: Categorical text filtering via cached distinct values (`SELECT * FROM "table" WHERE "status" = ? LIMIT 50`)
14. `count_with_filter`: Filtered row counting (`SELECT COUNT(*) AS result FROM "table" WHERE "col" = ?`)
15. `aggregate_with_filter`: Filtered aggregation (`SELECT AVG("col") AS result FROM "table" WHERE "status" = ?`)

*Final verified shape count: **15 shapes**.*

---

## 4. Acceptance Test Results (`verify_college_attendance.js`)

All 6 verbatim queries from user transcripts were tested black-box over HTTP against the running backend server:

| # | Question (Verbatim) | Status | Latency | Source | Resolved SQL / Behavior |
|---|---|---|---|---|---|
| 1 | `how many student are there` | **PASS** | **34 ms** | `dynamic` | `SELECT COUNT(*) AS result FROM "students"` (Value: 80) |
| 2 | `find student id = 80 absent days` | **PASS** | **9 ms** | `dynamic` | `SELECT * FROM "attendance" WHERE "student_id" = ? AND "status" = ? LIMIT 50` (Params: `[80, 'Absent']`, Rows: 8) |
| 3 | `student_id = 80 how many says is this student present` | **PASS** | **8 ms** | `dynamic` | `SELECT COUNT(*) AS result FROM "attendance" WHERE "student_id" = ? AND "status" = ?` (Params: `[80, 'Present']`, Result: 60 ≠ 80) |
| 4 | `average absent percentage` | **PASS** | 15,045 ms | `fallback` | Router declined to fabricate non-existent `absent_percentage` column. Cascaded cleanly to LLM/fallback. |
| 5 | `lowest attendence top 5 (calculate the lowest attendance by student id)` | **PASS** | **23 ms** | `dynamic` | `SELECT * FROM "students" ORDER BY "attendance_percentage" ASC LIMIT ?` (Params: `[5]`, Rows: 5, Ordered ASC) |
| 6 | `calculate average no. of student absent more than 10 days` | **PASS** | 15,040 ms | `fallback` | Router declined to fabricate non-existent absent days column. Cascaded cleanly without number hallucination. |

**Summary: 6 / 6 HARD Assertions Passed.**

---

## 5. Latency Comparison Table

| Question | Baseline Latency (Before Upgrade) | Part 1 Fast Intent Latency (Warm) | Part 1 Fast Intent Latency (Cold) | Speedup Factor |
|---|---|---|---|---|
| 1. `how many student are there` | 15,042 ms (LLM timeout) | **65 ms** | **34 ms** | **~440x faster** |
| 2. `find student id = 80 absent days` | 15,038 ms (LLM timeout) | **17 ms** | **9 ms** | **~1,670x faster** |
| 3. `student_id = 80 how many says is this student present` | 15,055 ms (LLM timeout) | **13 ms** | **8 ms** | **~1,880x faster** |
| 4. `average absent percentage` | 15,070 ms (LLM timeout) | 15,093 ms (Cascaded) | 15,045 ms (Cascaded) | 1.0x (Clean fallback) |
| 5. `lowest attendence top 5` | 15,061 ms (LLM timeout) | **26 ms** | **23 ms** | **~650x faster** |
| 6. `calculate average no. of student absent more than 10 days` | 15,048 ms (LLM timeout) | 15,051 ms (Cascaded) | 15,040 ms (Cascaded) | 1.0x (Clean fallback) |

---

## 6. Regression Suite Results

All pre-existing test suites pass without regression:
- `backend/test_phase2_fast_intent_units.js`: **9/9 PASSED** (Count, ID filter, typo tolerance, threshold, value-match, guards)
- `backend/test_phase3_distinct_cache.js`: **PASSED** (Cache invalidation on switch, zero cross-DB leakage)
- `backend/verifyTest2SwitchInvalidation.js`: **PASSED**
- `backend/verifyTest3ConcurrentSwitch.js`: **PASSED**
- `backend/verifyTest4FailedSwitch.js`: **PASSED**
- `backend/verifyCacheHitMiss.js`: **PASSED**
- `backend/verifyPhase2StalenessTrap.js`: **PASSED**
- `backend/verifyP3_1Persistence.js`: **PASSED**
- `backend/verifyP3_3SessionIsolation.js`: **PASSED**
- `backend/verifyP3_4Hydration.js`: **PASSED**
- `backend/verifyP3_5SurvivesSwitch.js`: **PASSED**
- `backend/verifyP3_6PromptOverhead.js`: **PASSED**
- `backend/verifyLlm1ValidatorSecurity.js`: **37/37 PASSED**
- `backend/verifyLlm2ClientContract.js`: **PASSED**
- `backend/verifyLlm3ReadOnlyPhysical.js`: **PASSED**
- `backend/verifyLlm4SimpleRetrieval.js`: **PASSED**
- `backend/verifyLlm6AdversarialQuestion.js`: **PASSED**
- `backend/verifyLlm7GarbageOutput.js`: **PASSED**
- `backend/verifyLlm8HallucinatedTable.js`: **PASSED**
- `backend/verifyLlm9OfflineFailover.js`: **PASSED**
- `backend/verifyLlm10ThinkStripping.js`: **PASSED**

---

## 7. Proposed `MASTER_CONTEXT.md` v1.1 Changelog (Proposal Only)

The following changes are recommended for inclusion in the next revision of `MASTER_CONTEXT.md`:

```markdown
### Proposed Changes to MASTER_CONTEXT.md (v1.1)

1. §3 Core Engine Cascade Order:
   - OLD: Tools → Local LLM (Layer 2) → Dynamic Engine (Layer 1) → Helpful Error Fallback
   - NEW: Tools → Dynamic Engine (Fast Intent Router + Heuristics) → Local LLM → Helpful Error Fallback
   - RATIONALE: Placing deterministic, rule-based SQL routing before LLM execution eliminates 15s inference overhead for all common single-table queries while preserving LLM escalation for multi-table joins and complex reasoning.

2. §4 Layer 1 Architecture:
   - Add backend/src/core/fastIntent.js: Deterministic NL → Parameterized SQL router with Levenshtein typo tolerance, numeric coverage guard, and long-format table guards.
   - Add backend/src/core/distinct.cache.js: In-memory LRU/RAM distinct TEXT value cache invalidated via registerDatabaseSwitchHook.
   - Update backend/src/core/dynamic.query.engine.js: Integrates tryRoute(query, deps) before fallback to sql.builder.js.

3. §9.3 Dynamic Query Engine Scope Resolution:
   - Final shape count resolved to 15 shapes (8 baseline heuristic shapes + 7 fastIntent parameterized shapes).

4. §9.4 Active Database File Protection:
   - Document mandatory snapshot-at-start and restore-in-finally pattern in test harnesses touching backend/active-database.json.
```

---

## 8. Root Cause: 40-vs-80 Count Discrepancy

During Part 1 router development, the natural language query `"how many students are there"` returned `40` instead of the database total of `80`. Investigation revealed that the distinct-value matcher checked whether candidate column values appeared inside the query string via loose substring inclusion; the single-character distinct section value `'A'` from the `students.section` column (`'A'`, `'B'`) matched the letter `'a'` inside query words like `"many"` and `"are"`. As a result, an unintended filter `WHERE "section" = ?` (`'A'`) was injected into the query, counting only section A's 40 students. The issue was resolved by enforcing exact token equality (`norm(v.value) === tok`) on tokenized words and hardening stopword filtering. Regression protection is strictly enforced by `backend/verify_college_attendance.js` (Question 1 hard assertion: `result === 80`).

