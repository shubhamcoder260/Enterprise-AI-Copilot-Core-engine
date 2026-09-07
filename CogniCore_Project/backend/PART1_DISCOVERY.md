# CogniCore Part 1 — Phase 0 Discovery Report

**Timestamp**: 2026-09-07T13:58:00+05:30  
**Branch**: `part1-fast-intent`  

---

### 1. Environment Confirmation
- **Health Check**: `curl -s http://localhost:5000/health` → `{"status":"ok","service":"CogniCore AI Engine"}`
- **Ollama Models**: `curl -s http://localhost:11434/api/tags` → `['qwen3:14b', 'gemma3:4b', 'nomic-embed-text:latest']`

---

### 2. Export Signatures
- **`backend/src/core/core.engine.js`**:
  - `export async function runCoreEngine({ query, organization, role, sessionId, model })`
- **`backend/src/core/sql.builder.js`**:
  - `export function quoteIdentifier(name)`
  - `export function buildQueryPlan({ query, schema = {}, resolved = {} })`
- **`backend/src/core/query.executor.js`**:
  - `export async function executeQueryPlan(plan)`
- **`backend/src/core/schema.reader.js`**:
  - `export function clearSchemaCache()`
  - `export function getSchemaCacheStats()`
  - `export function resetSchemaCacheStats()`
  - `export function truncate(str, n = 60)`
  - `export async function computeSchemaHash(db)`
  - `export async function getEnrichedSchema(dbInstance, options = {})`
  - `export async function readDatabaseSchema(forceRefresh = false)`
- **`backend/src/core/response.formatter.js`**:
  - `export function formatExecutionResponse({ plan, execution, schema = {} })`
- **`backend/src/config/database.js`**:
  - `export function registerDatabaseSwitchHook(hookFn)`
  - `export async function ensureInitialized()`
  - `export async function connectDatabase()`
  - `export function switchDatabase(newDatabasePath)`
  - `export async function getReadOnlyDatabase()`
  - `export async function executeReadOnlySql(sql)`
  - `export function getActiveDatabasePath()`
  - `export async function closeDatabase()`
- **Driver in `package.json`**:
  - `"sqlite": "^5.1.1"`, `"sqlite3": "^6.0.1"` (Asynchronous `sqlite3` driver, **NOT** `better-sqlite3`).

---

### 3. Active Database Resolution
- **File**: `backend/active-database.json`
- **Path**: `/home/shubh/Documents/project/cognicore/Cognicore/CogniCore_Project/backend/uploads/1788767199100-college_attendance_(3).db`

---

### 4. College Attendance DB Schema Analysis
- **Tables & Row Counts**:
  - `attendance`: 6,000 rows
  - `departments`: 5 rows
  - `faculty`: 10 rows
  - `fees`: 160 rows
  - `marks`: 1,200 rows
  - `students`: 80 rows
  - `subjects`: 25 rows

- **Attendance-Like Tables**:
  - `attendance` table: contains `attendance_id`, `student_id`, `subject_id`, `faculty_id`, `date`, `status` (`CHECK(status IN ('Present','Absent','Late'))`).
  - `students` table: contains `attendance_percentage` column (REAL).

- **Format Classification**:
  - `attendance` table: **LONG-FORMAT** (non-unique `student_id`, has `date` TEXT column, 6,000 records).
  - `students` table: **SHORT-FORMAT** (80 rows, exactly 1 row per student, `student_id` is PK).

- **Low-Cardinality TEXT Columns (Distinct Cache Candidates)**:
  - `attendance.status` (`Present`, `Absent`, `Late`)
  - `departments.dept_name` (`Computer Science`, `Electronics & Communication`, `Mechanical`, `Electrical & Electronics`, `Information Technology`)
  - `faculty.designation` (`Professor`, `Assistant Professor`, `Associate Professor`)
  - `fees.status` (`Paid`, `Pending`, `Overdue`)
  - `marks.exam_type` (`Internal 1`, `Internal 2`, `Semester`)
  - `students.section` (`A`, `B`)

---

### 5. Live Probe Response
- **Endpoint**: `POST /api/ai/query`
- **Payload**: `{"query":"how many student are there","sessionId":"plan0-probe"}`
- **Response**:
```json
{
  "answer": "There are 40 record(s) in the students table.",
  "source": "dynamic",
  "data": {
    "type": "count",
    "table": "students",
    "value": 40
  },
  "meta": {
    "sessionId": "plan0-probe",
    "organization": "college",
    "role": "admin",
    "engineMode": "dynamic_query",
    "intent": "dynamic_query",
    "processingMs": 2
  }
}
```
- **SQL Field Identification**: The frontend SQL panel reads `data.sql`. In standard LLM responses, `data.sql` carries the query. For fastIntent queries, `data.sql` will be explicitly populated.
