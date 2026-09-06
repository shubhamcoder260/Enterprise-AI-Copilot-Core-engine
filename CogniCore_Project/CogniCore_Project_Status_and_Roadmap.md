# CogniCore — Project Status, Architecture & Roadmap

## 1. Project identity

**Project name:** CogniCore

**Target title:** Enterprise AI Copilot: A Domain-Agnostic Conversational Analytics & Automation Platform

CogniCore is intended to be a domain-agnostic AI Copilot that connects to enterprise databases and organizational documents, understands natural-language questions, selects the correct capability, retrieves or calculates information, performs controlled actions, and returns grounded answers.

It should not be hardcoded only for a college, hospital, or one business.

---

## 2. Target architecture

```text
                         USER
                           |
                           v
                    +--------------+
                    |  COGNICORE   |
                    |  AI COPILOT  |
                    +------+-------+
                           |
                           v
                     QUERY ROUTER
                           |
             +-------------+-------------+
             |             |             |
             v             v             v
        SQL ENGINE        RAG          TOOLS
             |             |             |
             v             v             v
        DATABASES       DOCUMENTS      ACTIONS
             |             |             |
             +-------------+-------------+
                           |
                           v
                    LLM / REASONING
                           |
                           v
                    FINAL RESPONSE
                           |
             +-------------+-------------+
             |             |             |
             v             v             v
        DASHBOARD       REPORTS       HISTORY
```

### Core principle

- **SQL / Dynamic Query Engine** → exact structured database information
- **RAG** → unstructured information in documents
- **Tools** → controlled actions
- **LLM** → language understanding, reasoning and response generation
- **Query Router** → decides SQL vs RAG vs Tool vs Hybrid
- **Schema Reader/Intelligence** → understands database structure dynamically
- **RBAC** → controls access
- **Frontend** → chat, uploads, dashboard, reports and history
- **Backend** → APIs, orchestration and secure data access

RAG should complement SQL, not replace it.

---

# 3. What has already been created

## Backend structure

```text
backend/
└── src/
    ├── server.js
    ├── config/
    │   └── database.js
    ├── controllers/
    │   ├── ai.controller.js
    │   └── database.controller.js
    ├── core/
    │   ├── core.engine.js
    │   ├── dynamic.query.engine.js
    │   ├── intent.detector.js
    │   ├── schema.reader.js
    │   └── tool.router.js
    ├── data/
    │   └── demo.data.js
    ├── routes/
    │   ├── ai.routes.js
    │   └── database.routes.js
    └── tools/
        ├── education/
        │   ├── cgpa.tool.js
        │   └── foreign-student.tool.js
        └── hospital/
            └── cardiology.tool.js
```

The frontend also exists and contains multiple components/features, but its complete current file tree has not been captured here.

---

# 4. Existing components

## 4.1 server.js

Backend entry point.

Responsibilities:
- Starts the server
- Registers backend routes
- Makes APIs available to the frontend

---

## 4.2 config/database.js

Handles SQLite database connectivity and the active database concept.

Important work already done:
- Active SQLite database can be selected
- The system can work with different `.db` files
- Active database can change at runtime
- A server restart should not be fundamentally required every time a different database is selected

Intended flow:

```text
Select/upload database
        ↓
Set active database
        ↓
Read schema
        ↓
Dynamic Query Engine uses active database
```

---

## 4.3 schema.reader.js

Purpose:

> Dynamically inspect the connected database.

Instead of hardcoding table names, it discovers the actual schema.

Example:

```text
Database
 ├── customers
 │    ├── CustomerId
 │    ├── FirstName
 │    └── LastName
 ├── invoices
 │    ├── InvoiceId
 │    ├── CustomerId
 │    └── Total
 └── employees
      ├── EmployeeId
      └── FirstName
```

This is a foundation for domain independence.

---

## 4.4 dynamic.query.engine.js

A major part of the project already exists here.

It:
- Connects to the active SQLite database
- Reads the schema
- Finds tables from natural-language queries
- Finds columns
- Detects basic operations
- Builds SQL dynamically
- Executes SQL
- Returns results
- Closes the database connection

Current helper concepts include:
- Identifier quoting
- Word normalization
- Numeric-column detection
- Table matching
- Column matching
- Finding a table from a column
- Resolving table and column

Query patterns worked on include concepts such as:

```text
Show available tables
What tables are available?
What columns are in customers?
What columns are in events?
How many customers are there?
Show customers
Average invoice total
Sum ...
Highest ...
Lowest ...
```

The exact success of natural-language questions depends on wording and whether the query reaches this engine.

---

## 4.5 Active database testing

A `testActiveDatabase.js` script was used.

It successfully identified the active database as:

```text
C:\Users\ASUS\Downloads\CogniCore_Project\cognicore_project\backend\chinook.db
```

The Chinook schema was read successfully.

Tables detected included:

```text
albums
artists
customers
employees
genres
invoice_items
invoices
media_types
playlist_track
playlists
tracks
```

Another database, referred to as the **newcheck database**, was also tested. At one point its schema contained:

```text
events
```

This demonstrated that the schema reader can inspect a different database without hardcoding Chinook's tables.

---

## 4.6 core.engine.js

Current conceptual flow:

```text
User query
    ↓
Intent Detector
    ↓
Tool Router
    ├── specific configured tool → execute tool
    └── otherwise → Dynamic Query Engine
```

The current engine returns information such as:
- answer
- intent
- tool
- data
- metadata
- organization
- role
- engine mode

This is a useful first version, but it should eventually be improved with a proper Query Router.

---

## 4.7 intent.detector.js

Detects configured/specific intents.

It has been used for domain-specific cases such as education and hospital requests.

Current limitation:

A generic database question can potentially match a configured intent and bypass the Dynamic Query Engine.

This is one reason a proper Query Router is needed.

---

## 4.8 tool.router.js

Maps detected intents to configured tools.

Concept:

```text
Intent
  ↓
Tool Router
  ├── CGPA Tool
  ├── Foreign Student Tool
  ├── Cardiology Tool
  └── future tools
```

---

## 4.9 Existing tools

Education:

```text
cgpa.tool.js
foreign-student.tool.js
```

Hospital:

```text
cardiology.tool.js
```

These demonstrate domain-specific tool support while the core engine is intended to remain domain-agnostic.

---

## 4.10 Controllers

### ai.controller.js

Connects AI-related HTTP requests to the core engine.

```text
Frontend
   ↓
AI API
   ↓
AI Controller
   ↓
Core Engine
```

### database.controller.js

Handles database-related operations such as database selection/upload and active database handling.

---

## 4.11 Routes

Current routes:

```text
ai.routes.js
database.routes.js
```

They expose backend functionality to the frontend.

---

## 4.12 demo.data.js

Contains demonstration data used by parts of the current project/scaffold.

As real dynamic database/document features grow, this should become less important.

---

# 5. Current limitations

The current Dynamic Query Engine is primarily deterministic.

Example:

```text
Database table:
customers

User:
"How many clients do we have?"
```

The system needs to understand:

```text
clients ≈ customers
```

The current engine does not yet provide complete semantic schema understanding.

Another architectural limitation is that the current `core.engine.js` can send a query to a configured tool before trying the generic dynamic database engine.

The solution is a stronger Query Router.

---

# 6. What we still need to build

Major remaining features:

```text
[ ] Schema Intelligence
[ ] Semantic table/column matching
[ ] Proper Query Router
[ ] SQL/RAG/Tool/Hybrid classification
[ ] RAG document ingestion
[ ] PDF/DOCX/TXT extraction
[ ] Chunking
[ ] Embeddings
[ ] Vector store
[ ] Retriever
[ ] LLM integration
[ ] Grounded response generation
[ ] SQL + RAG hybrid reasoning
[ ] Conversation memory
[ ] Source citations
[ ] Authentication
[ ] RBAC
[ ] Authorization
[ ] Audit logs
[ ] Multi-user/organization handling
[ ] Dashboard
[ ] Report generation
[ ] Automation/actions
[ ] Comprehensive testing
[ ] Frontend polish
[ ] Deployment
[ ] Final documentation
```

---

# 7. Next major component — Schema Intelligence

The first major improvement should make database understanding more semantic.

Example:

```text
customers
```

Possible user words:

```text
customers
clients
buyers
accounts
```

Another example:

```text
employees
```

Possible words:

```text
employees
staff
workers
personnel
```

The system should combine:

```text
Actual schema
+
Metadata
+
Descriptions
+
Aliases/synonyms
+
Semantic matching
+
Validation
```

Important: aliases must never blindly create SQL against nonexistent tables or columns. Everything should be validated against the actual schema.

Target:

```text
Natural-language question
        ↓
Semantic schema matching
        ↓
Actual table/column
        ↓
Validated SQL
        ↓
Database
```

---

# 8. Next major component — Query Router

The current Intent Detector/Tool Router architecture should evolve into:

```text
                       USER QUESTION
                             |
                             v
                       QUERY ROUTER
                             |
        +--------------------+--------------------+
        |                    |                    |
        v                    v                    v
       SQL                  RAG                 TOOL
        |                    |                    |
    Database             Documents              Action
```

And it must support:

```text
                       HYBRID
                          |
                 +--------+--------+
                 |                 |
                SQL               RAG
                 |                 |
                 +--------+--------+
                          |
                          v
                         LLM
```

Examples:

```text
"How many customers?"
→ SQL

"What is the refund policy?"
→ RAG

"Generate a monthly report."
→ Tool / workflow

"What was revenue last month and what does the policy say about the target?"
→ SQL + RAG
```

---

# 9. RAG implementation

RAG flow:

```text
PDF/DOCX/TXT
      ↓
Document Loader
      ↓
Text Extraction
      ↓
Chunking
      ↓
Embeddings
      ↓
Vector Store
      ↓
Retriever
      ↓
Relevant chunks
      ↓
LLM
      ↓
Grounded answer
```

Recommended initial stack:

```text
Document loader
Text extraction
Embeddings
FAISS
Retriever
LLM
```

Pinecone can be considered later if cloud vector storage is needed.

Do not add LangChain/LangGraph just for the sake of using them. A smaller implementation may be easier to debug and explain in a viva.

---

# 10. LLM layer

The LLM should help with:

- Natural-language understanding
- Semantic matching
- Query planning
- RAG response generation
- SQL result explanation
- Hybrid reasoning
- Natural-language final responses

The LLM should NOT have unrestricted ability to execute arbitrary SQL.

Safer flow:

```text
User
 ↓
Router / LLM
 ↓
Structured query plan
 ↓
SQL validation
 ↓
Controlled SQL execution
 ↓
Result
 ↓
LLM
 ↓
Final answer
```

---

# 11. SQL + RAG hybrid capability

This should become one of CogniCore's strongest demonstration features.

Example:

> "What was our revenue last month and what does the company policy say about the target?"

Flow:

```text
                    Question
                       |
                       v
                     Router
                    /      \
                   /        \
                 SQL        RAG
                  |           |
             Revenue DB    Policy PDF
                  |           |
                  +-----+-----+
                        |
                        v
                       LLM
                        |
                        v
                  Combined answer
```

This demonstrates that CogniCore can reason across structured and unstructured enterprise information.

---

# 12. Authentication and RBAC

Future:

```text
User
 ↓
Authentication
 ↓
Role
 ↓
Permission check
 ↓
CogniCore
```

Example roles:

```text
Admin
Manager
Employee
Viewer
```

Possible permissions:

```text
Admin
- Upload databases
- Upload documents
- Query data
- Generate reports
- Manage users

Employee
- Ask permitted questions
- Read permitted documents

Viewer
- Read-only access
```

---

# 13. Conversation memory

Eventually:

```text
User:
"How many customers do we have?"

CogniCore:
"There are 59."

User:
"How many are from Germany?"

CogniCore:
"12."
```

The second question can use the previous conversational context.

Memory must respect authorization.

---

# 14. Reports and automation

Example:

```text
"Generate monthly sales report"
        ↓
Router
        ↓
SQL
        ↓
Analytics
        ↓
Report Generator
        ↓
PDF / PPT
```

Automation can later support controlled actions such as:

```text
"Remind me to review the GST report tomorrow."
```

This can route to a reminder/action tool.

---

# 15. Dashboard

The frontend can eventually show dynamically calculated information such as:

```text
Revenue
Customers
Orders
Growth
Top products
Other KPIs
```

The metrics should come from the connected data rather than being hardcoded.

---

# 16. Team division

Both team members are expected to learn and understand the project.

Do NOT assume one person knows more coding.

Split by modules instead.

## Person A — AI/Data Intelligence

Own:

### Database intelligence
- Schema intelligence
- Semantic table matching
- Semantic column matching
- Dynamic query improvements

### AI routing
- Query Router
- SQL/RAG/Tool classification
- Hybrid routing

### RAG
- Document ingestion
- Text extraction
- Chunking
- Embeddings
- FAISS/vector store
- Retrieval

### LLM
- LLM integration
- Prompting
- SQL result explanation
- RAG response generation
- Hybrid response generation

### Memory
- Conversation context
- Source/citation handling

---

## Person B — Application/Platform

Own:

### Frontend
- Chat UI
- Database upload UI
- Document upload UI
- Dashboard
- History
- Reports UI
- User interface

### Backend application layer
- API endpoints
- File upload APIs
- User APIs
- Authentication
- RBAC
- Organization management

### Platform
- Report generation integration
- Audit logs
- Database management UI
- Error handling
- Deployment

---

# 17. Shared responsibilities

Both people should work together on:

```text
Architecture
API contracts
Integration
Testing
Security review
Database testing
RAG testing
Final documentation
Presentation
Viva preparation
Demo
```

Both should understand the entire architecture even if each owns different modules.

---

# 18. How both sides connect

Use clear API contracts.

Example frontend request:

```json
{
  "query": "How many customers are there?"
}
```

Backend response:

```json
{
  "answer": "There are 59 customers.",
  "source": "sql",
  "data": {
    "count": 59
  }
}
```

RAG response example:

```json
{
  "answer": "Employees are entitled to ...",
  "source": "rag",
  "documents": [
    {
      "name": "Leave_Policy.pdf",
      "page": 4
    }
  ]
}
```

The frontend should not need to know how the SQL/RAG engine internally works.

---

# 19. Git/GitHub workflow

Recommended repository:

```text
CogniCore
```

Use branches:

```text
main
 |
 +-- feature/schema-intelligence
 +-- feature/query-router
 +-- feature/rag
 +-- feature/frontend
 +-- feature/auth-rbac
```

Workflow:

```text
Create feature
      ↓
Work on branch
      ↓
Test
      ↓
Commit
      ↓
Pull Request
      ↓
Review
      ↓
Merge into main
```

Keep the current working version backed up before major changes.

---

# 20. Recommended development order

## Phase 1 — Stabilize current system

1. Active database switching
2. Schema reader
3. Dynamic query engine
4. Existing tools
5. Frontend/backend connection
6. Test Chinook
7. Test newcheck database

Goal:

```text
Different database
      ↓
Schema detected
      ↓
Natural-language query
      ↓
Correct result
```

---

## Phase 2 — Schema Intelligence

Build:

```text
Schema metadata
+
Aliases
+
Semantic matching
+
Validation
```

Goal:

```text
"How many clients?"
       ↓
customers table
       ↓
SQL
```

---

## Phase 3 — Query Router

Build:

```text
SQL
RAG
TOOL
HYBRID
```

Goal:

```text
Question
   ↓
Correct capability
```

---

## Phase 4 — RAG

Build:

```text
Upload
 ↓
Extract
 ↓
Chunk
 ↓
Embed
 ↓
FAISS
 ↓
Retrieve
 ↓
LLM
```

Goal:

```text
"What is our refund policy?"
       ↓
Relevant document section
       ↓
Grounded answer
```

---

## Phase 5 — LLM response layer

Improve:

```text
SQL result
   ↓
LLM
   ↓
Natural-language answer
```

and:

```text
RAG context
   ↓
LLM
   ↓
Grounded answer
```

---

## Phase 6 — Hybrid reasoning

Combine:

```text
SQL + RAG + LLM
```

Goal:

```text
Complex enterprise question
       ↓
Multiple sources
       ↓
One grounded answer
```

---

## Phase 7 — Security

Build:

```text
Authentication
RBAC
Authorization
Audit logs
```

---

## Phase 8 — Enterprise features

Build:

```text
Dashboard
Reports
Conversation history
Automation
```

---

## Phase 9 — Final polish

- Error handling
- Loading states
- UI polish
- Security testing
- Performance testing
- SQL testing
- RAG accuracy testing
- Documentation
- Deployment

---

# 21. Final architecture

```text
                         COGNICORE
                  ENTERPRISE AI COPILOT
                              |
                              v
                       React Frontend
                              |
                              v
                     Authentication/RBAC
                              |
                              v
                         API Layer
                              |
                              v
                       QUERY ROUTER
                              |
        +---------------------+---------------------+
        |                     |                     |
        v                     v                     v
   SCHEMA/SQL                RAG                  TOOLS
   INTELLIGENCE                |                     |
        |                      |                     |
        v                      v                     v
   SQL Generator          Retriever            Actions
        |                      |                     |
        v                      v                     v
   Enterprise DBs         Vector Store          Tool APIs
        |                      |                     |
        +----------------------+---------------------+
                              |
                              v
                       LLM / REASONING
                              |
                              v
                    GROUNDED RESPONSE
                              |
          +-------------------+-------------------+
          |                   |                   |
          v                   v                   v
      Dashboard            Reports            History
```

---

# 22. Final project statement

> CogniCore is a domain-agnostic Enterprise AI Copilot that combines natural-language query processing, dynamic database analytics, retrieval-augmented generation, controlled tool execution, and LLM-based reasoning to provide grounded conversational analytics and automation across structured enterprise data and unstructured organizational knowledge.

---

# 23. Golden development rule

Do not make many changes at once.

For every component:

```text
Build
  ↓
Run
  ↓
Test
  ↓
Fix
  ↓
Commit to Git
  ↓
Move to next component
```

Immediate priority:

```text
CURRENT WORKING SYSTEM
        ↓
Schema Intelligence
        ↓
Query Router
        ↓
RAG
        ↓
LLM
        ↓
SQL + RAG Hybrid
        ↓
Security
        ↓
Dashboard / Reports / Automation
        ↓
Final Integration
```

This keeps the project modular, domain-agnostic, explainable, testable and suitable for a final-year project.
