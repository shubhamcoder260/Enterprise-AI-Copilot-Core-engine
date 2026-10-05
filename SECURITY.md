# CogniCore Security Architecture & Guardrails

## 1. Security Architecture Overview

CogniCore does not rely on prompt engineering or model instruction adherence for security. Instead, security is enforced via deterministic code gates, cryptographic controls, AST-level query inspection, role-based database permissions, and verifiable audit logging.

### What Exists in the Code:
- **Gate Chain Per Dialect:** [`kernel/gate.selector.js`](file:///home/shubh/Documents/project/cognicore/Cognicore/CogniCore_Project/backend/src/kernel/gate.selector.js) dispatches dialect-specific gate chains. Incoming SQL is filtered through regex syntax validators ([`llm/mariadb.validator.js`](file:///home/shubh/Documents/project/cognicore/Cognicore/CogniCore_Project/backend/src/llm/mariadb.validator.js), `postgres.validator.js`, `sql.validator.js`), parsed into strict AST structures by [`kernel/ast.gate.mariadb.js`](file:///home/shubh/Documents/project/cognicore/Cognicore/CogniCore_Project/backend/src/kernel/ast.gate.mariadb.js) / `ast.gate.postgres.js` / `ast.gate.core.js`, and executed solely via read-only protocol executors.
- **Row-Level Security (RLS) Policy Engine:** [`security/rls.policy.js`](file:///home/shubh/Documents/project/cognicore/Cognicore/CogniCore_Project/backend/src/security/rls.policy.js) (512 lines) operates as a Tier-2 gate. It inverts authorization to fail-closed on any table not explicitly allowlisted. It provides zero-SQL refusal on cross-employee payroll probes (blocking calls before DBMS execution) and injects ownership predicates (`WHERE employee = 'EMP-001' AND docstatus = 1`) for authorized callers.
- **Action Gateway (Governed Write Pathway):** [`security/action.gateway.js`](file:///home/shubh/Documents/project/cognicore/Cognicore/CogniCore_Project/backend/src/security/action.gateway.js) (357 lines) manages all database mutations through an explicit propose $\rightarrow$ approve $\rightarrow$ execute lifecycle. Direct freeform LLM writes are disallowed; all mutations must match pre-approved, parameterized templates in [`security/write.templates.js`](file:///home/shubh/Documents/project/cognicore/Cognicore/CogniCore_Project/backend/src/security/write.templates.js) and enforce Separation of Duties (SoD).
- **Credential Vault at Rest:** [`security/credential.vault.js`](file:///home/shubh/Documents/project/cognicore/Cognicore/CogniCore_Project/backend/src/security/credential.vault.js) (191 lines) encrypts database credentials at rest using AES-256-GCM backed by `VAULT_MASTER_KEY` in an internal SQLite database (`cognicore_vault.db`). Secrets are never logged, returned over API endpoints, or exposed to the frontend.
- **Authentication & User Store:** [`middleware/auth.js`](file:///home/shubh/Documents/project/cognicore/Cognicore/CogniCore_Project/backend/src/middleware/auth.js) validates HMAC-SHA256 JWT tokens and injects verified identity claims. [`routes/auth.routes.js`](file:///home/shubh/Documents/project/cognicore/Cognicore/CogniCore_Project/backend/src/routes/auth.routes.js) stores credentials encrypted with AES-256-GCM, hashes passwords with PBKDF2-SHA512 (10,000 iterations, 16-byte random salt), and verifies passwords using `crypto.timingSafeEqual`.
- **Cryptographic Action Audit Log:** [`store/action.audit.log.js`](file:///home/shubh/Documents/project/cognicore/Cognicore/CogniCore_Project/backend/src/store/action.audit.log.js) records state transitions for all proposed and executed actions using SHA-256 hash chains where each entry cryptographically seals the previous record.
- **Database Switch Path Canonicalization:** [`controllers/database.controller.js`](file:///home/shubh/Documents/project/cognicore/Cognicore/CogniCore_Project/backend/src/controllers/database.controller.js) enforces strict directory traversal defense (`path.resolve`, checking `..` elements, and restricting files to `allowedDirs` under `uploads/` and `fixtures/`).
- **CORS Origin Restriction:** [`server.js`](file:///home/shubh/Documents/project/cognicore/Cognicore/CogniCore_Project/backend/src/server.js) restricts HTTP requests to explicitly whitelisted origins via `COGNICORE_ALLOWED_ORIGINS`, preventing cross-site scripting and unauthorized browser requests.
- **SQL LIMIT/OFFSET Clamping:** [`llm/sql.validator.js`](file:///home/shubh/Documents/project/cognicore/Cognicore/CogniCore_Project/backend/src/llm/sql.validator.js) strips benign trailing comments and clamps pagination limits to prevent memory exhaustion / denial of service.

---

## 2. Vulnerability Remediation Log (VULN-01 to VULN-13)

The following vulnerabilities were identified during development and systematically remediated:

| Vulnerability ID | Affected Module | Summary of Remediation |
| :--- | :--- | :--- |
| **VULN-01** | `controllers/database.controller.js` | Enforced path sanitization, rejected `..` directory traversal tokens, and restricted paths to `allowedDirs`. |
| **VULN-02** | `core/fastIntent.js` | Implemented strict character-set whitelisting for derived expressions and intent interpolation to block template injection. |
| **VULN-03** | `llm/sql.validator.js` | Stripped benign trailing comments on `LIMIT` clauses or semicolons prior to pagination clamping to eliminate evasion vectors. |
| **VULN-04** | `security/rls.policy.js` | Replaced string-concatenation predicate building with AST-based predicate injection to prevent SQL injection in RLS clauses. |
| **VULN-05** | `routes/auth.routes.js`, `server.js` | Built dedicated JWT authentication endpoints (`/api/auth/login`) and encrypted user credentials at rest with AES-256-GCM. |
| **VULN-06** | `controllers/ai.controller.js`, `controllers/action.controller.js` | Ensured verified cryptographic JWT identity claims take absolute precedence over unverified caller input in request bodies. |
| **VULN-07** | `controllers/source.controller.js` | Deprecated root privilege escalation endpoint (`/api/sources/auto-provision`), returning HTTP 410 Gone unless explicitly enabled. |
| **VULN-08** | `security/action.gateway.js` | Implemented cryptographic action proposal tokens to prevent execution token forgery and replay attacks. |
| **VULN-09** | `security/rls.policy.js` | Inverted default RLS posture to fail-closed on all unpolicied tables, preventing unintended data exposure on new DocTypes. |
| **VULN-10** | `security/credential.vault.js` | Migrated plaintext database passwords from environment/config files into an AES-256-GCM encrypted Credential Vault. |
| **VULN-11** | `services/connection.tester.js` | Enforced parameter sanitization on database connection strings to block driver protocol injection. |
| **VULN-12** | `llm/sql.validator.js` | Closed regex bypasses on trailing whitespace and comments around `LIMIT` and `OFFSET` clauses. |
| **VULN-13** | `server.js` | Eliminated open CORS wildcards by introducing origin-matching against `COGNICORE_ALLOWED_ORIGINS`. |

---

## 3. Known Security Boundaries

To maintain rigor, the following security boundaries are explicitly documented:

1. **Narrow RLS Policy Scope:** Dynamic RLS predicate injection is presently implemented for employee/HR salary data (`tabSalary Slip`, `tabEmployee`). All other unpolicied tables fail-closed; broader enterprise policies (e.g., multi-branch, territory, or customer scoping) are not yet authored.
2. **Dev-Fixture Tested Write Pathway:** The Action Gateway has been verified on development Docker containers and mock fixtures. It has not undergone end-to-end testing against an external production ERPNext instance.
3. **Unprovisioned Production Write Roles:** The dedicated write credential (`cognicore_write`) is defined in architectural specifications and local fixtures, but has not yet been provisioned in production ERP environments.
4. **No Formal External Security Audit:** CogniCore has been hardened internally against VULN-01..VULN-13 and validated across 26 regression suites, but has not been audited by an independent third-party cybersecurity firm.
5. **No Penetration Testing / Red-Teaming:** The codebase has not undergone adversarial red-team assessment or stress testing under live attack scenarios.
6. **Single-Tenant Deployment:** The application does not isolate DBMS connection credentials on a per-user basis; all authenticated users share the configured database connection lease appropriate for their role.

---

## 4. What This Means

CogniCore features a defense-in-depth security model that goes significantly beyond typical LLM wrapper architectures by enforcing deterministic AST validation, fail-closed RLS, encrypted credential vaulting, and cryptographic audit chains. 

However, these guardrails must be interpreted as active engineering measures rather than as proof of certified enterprise deployment readiness. CogniCore should be deployed within trusted private networks (air-gapped or VPC-internal), protected by upstream enterprise firewalls, and evaluated against the specific security policies of the host organization.
