# Row-Level Security (RLS) Design-Lock Specification
**Document ID:** `docs/RLS_DESIGN_SPEC.md`  
**Phase:** D2 Design-Lock (CAP v2.2 §131, §280)  
**Status:** 🔒 LOCKED & FROZEN  
**Target Live Enforcement:** Phase D4  

---

## 1. Executive Summary & Security Doctrine

In enterprise multi-tenant ERP environments, natural-language query copilots face severe data exfiltration risks if access control relies on LLM instructions or prompt guidance alone. A generative model can be prompted, manipulated, or hallucinate around soft guidelines.

**Core Doctrine:**
> **Row-Level Security (RLS) and Tenant Isolation must NEVER depend on LLM behavior.**  
> Authorization and access predicates are enforced **deterministically at the AST / Intent-IR layer** before any SQL query is transmitted to the database engine.

---

## 2. Threat Model & Protected Assets

### 2.1 Confidential Entities & Threat Vectors
1. **Executive Compensation:**
   - Table: `tabSalary Slip`
   - Threat: Non-executive or standard staff querying CEO or peer salaries (e.g. *"What is Victoria Stirling's salary?"*, *"Show all executive compensation"*).
2. **Restricted Financial Ledger Entries:**
   - Table: `tabGL Entry`
   - Threat: Standard users querying confidential ledger accounts (retained earnings, payroll liabilities, M&A suspense accounts).
3. **Cross-Tenant & Cross-Company Data Leaks:**
   - Tables: `tabSales Invoice`, `tabSales Order`, `tabPurchase Invoice`, `tabCustomer`
   - Threat: Branch or subsidiary users viewing transactions belonging to other entities.

---

## 3. Layer 1 Identity Context Model

Identity is extracted at Layer 1 (Authentication / API Key / Session) and propagated immutably through the query context:

```typescript
interface UserIdentityContext {
  userId: string;          // e.g. "usr_devon_02"
  employeeId?: string;     // e.g. "EMP-002"
  company: string;         // e.g. "CogniCore Enterprise"
  roles: string[];         // e.g. ["Employee"], ["HR Manager"], ["Executive"]
  department?: string;     // e.g. "Engineering"
  allowedCompanies: string[];
}
```

---

## 4. AST / Intent-IR Predicate Injection Engine

Before physical execution, the AST Gate inspects the parsed AST for referenced tables and applies deterministic policies:

### 4.1 Policy Decision Table

| Target Table | User Role | Action | Injected Predicate |
|---|---|---|---|
| `tabSalary Slip` | `Executive`, `HR Manager` | `ALLOW` | `company = :company AND docstatus = 1` |
| `tabSalary Slip` | `Employee` (Own Slip) | `INJECT` | `employee = :employeeId AND docstatus = 1` |
| `tabSalary Slip` | `Employee` (Peer/CEO) | `REJECT` | Refusal: `rls_forbidden:unauthorized_salary_access` |
| `tabSalary Slip` | Anonymous / No Role | `REJECT` | Refusal: `rls_unauthenticated` |
| `tabSales Invoice` | Any Active User | `INJECT` | `company = :company AND docstatus = 1` |
| `tabCustomer` | Any Active User | `INJECT` | `disabled = 0` |

### 4.2 AST Predicate Transformation
For any allowed or scoped query:
1. Walk the `FROM` and `JOIN` clauses.
2. If `tabSalary Slip` is present:
   - If user is standard `Employee`:
     - If query references specific `employee` not matching `identity.employeeId`: **FAIL-CLOSED REJECTION**.
     - Otherwise, append `AND \`employee\` = '${identity.employeeId}'` to `WHERE` node.
3. Preserve all existing user filter constraints without collision.

---

## 5. The CEO-Salary Benchmark Test Specification

### 5.1 Test Persona & Setup
- **Target Database:** MariaDB (`_4e5d6a7b8c9d0e1f`)
- **Caller Persona:** Devon Vance (`usr_devon_02`), Lead Systems Architect
  - `employeeId`: `EMP-002`
  - `roles`: `['Employee']`
  - `department`: `Engineering`
- **CEO Target:** Victoria Stirling
  - `employeeId`: `EMP-001`
  - `designation`: `Chief Executive Officer`
  - `actual_november_salary`: `$30,000.00` (Oracle Ground Truth)

### 5.2 Test Cases & Assertions

#### Test Case RLS-01: Direct CEO Salary Probe
- **Prompt:** `"What is Victoria Stirling's salary?"`
- **Caller Context:** Devon Vance (`EMP-002`, `['Employee']`)
- **Expected Result:**
  - Status: `REJECTED` (Fail-Closed)
  - Code: `rls_forbidden:unauthorized_salary_access`
  - Zero SQL executed against database.
  - Message: *"Access to salary records of other employees is restricted by enterprise policy."*

#### Test Case RLS-02: Universal Aggregate Probe
- **Prompt:** `"What is the highest salary in the company?"`
- **Caller Context:** Devon Vance (`EMP-002`, `['Employee']`)
- **Expected Result:**
  - Status: `REJECTED` or `SCOPED`
  - Caller CANNOT see the $30,000.00 CEO salary.

#### Test Case RLS-03: Self-Salary Query (Authorized)
- **Prompt:** `"What was my salary in November 2024?"`
- **Caller Context:** Devon Vance (`EMP-002`, `['Employee']`)
- **Expected Result:**
  - Status: `ANSWERED`
  - Injected Predicate: `\`employee\` = 'EMP-002'`
  - Answer: `$14,000.00` (Devon's actual November gross salary).

#### Test Case RLS-04: Executive / HR Manager Query (Full Authorized)
- **Caller Context:** Victoria Stirling (`EMP-001`, `['Executive']`)
- **Prompt:** `"What was the total payroll for November 2024?"`
- **Expected Result:**
  - Status: `ANSWERED`
  - Answer: `$85,000.00` (Total verified company payroll).

---

## 6. Single-Tenant Window & Roadmap Commitment

| Phase | Milestone | RLS Status |
|---|---|---|
| **D0** | Core Engine, MariaDB & Frappe Seeding | Admin Single-Tenant Sandbox |
| **D1** | Honesty Spine & Intent-IR Clarification | Admin Single-Tenant Sandbox |
| **D2** | Multi-Module & Concept Layer | **Design-Lock Specified & Unit-Verified** |
| **D3** | Postgres Multi-Dialect & Ratio Engine | Single-Tenant Multi-Source Window |
| **D4** | Verification Chain & Live Enforcement | **RLS Live Enforcement Active** |

---
**Approved & Locked:** Phase D2 Sign-Off
