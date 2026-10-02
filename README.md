# University X — Intelligent Student Academic Monitoring & Support System

> **Hackathon Track:** Problem Statement 2 (Intelligent Student Academic Monitoring and Support System for University X)  
> **Core Mission:** Real-time student academic tracking, predictive attendance warning mechanisms ($\ge 75\%$ threshold), explainable early-intervention risk modeling, multi-stakeholder governance (Students, Faculty, Deans), and verified grade recording.

---

## 🏛️ Pre-Existing vs. Built-During-Event Disclosure

In accordance with strict hackathon transparency standards, the codebase provenance is disclosed below:

| Component | Provenance | Git Commit Range | Details |
| :--- | :--- | :--- | :--- |
| **CogniCore Kernel Base** | **Pre-Existing** | `72ad130` .. `a6dee5e` | General-purpose on-prem NL-to-SQL copilot, AST gate, SQL validator, ERPNext/Postgres adapters, and vector store. |
| **Academic Monitoring System (R1–R7)** | **Built During Event** | `7af7ae2` .. `HEAD` | **Entirely created during the hackathon**: University X schema, attendance predictive engine, multi-factor risk engine, R1–R7 REST APIs, security middleware, and role-specific frontends. |

---

## 🎯 Problem Statement 2 Requirements Mapping (R1 – R7)

Every feature in this project is directly traceable to the official problem statement:

| Req | Requirement Name | Implementation Location | Verification Evidence |
| :--- | :--- | :--- | :--- |
| **R1** | **Academic Data Management & RBAC** | `academic.controller.js`, `auth.js` | `test/verify_credential_login.js` |
| **R2** | **Attendance Trajectory & $\ge 75\%$ Warnings** | `academic.service.js` (`calculateAttendanceMetrics`) | `test/verify_academic_service.js` |
| **R3** | **Marks Change Audit & Notifications** | `academic.service.js` (`saveOrUpdateMark`) | `test/verify_academic_e2e_full.js` |
| **R4** | **Speech-Assisted Grade Recording** | `voice.mark.service.js` (`parseVoiceMarksBatch`) | `test/verify_voice_mark_service.js` |
| **R5** | **Multi-Factor Explainable Risk Analysis** | `academic.service.js` (`calculateSubjectRisk`) | `test/verify_academic_service.js` |
| **R6** | **Institutional Heatmaps & At-Risk Lists** | `academic.controller.js` (`getAdminHeatmap`, `getCourseAtRisk`) | `test/verify_academic_e2e_full.js` |
| **R7** | **Role-Specific Interfaces** | `StudentDashboard.jsx`, `FacultyConsole.jsx`, `AdminDashboard.jsx` | Full UI demo across Student, Faculty, Admin |

---

## 🚀 Quick Start & Verification

### 1. Prerequisites
- Node.js $\ge 18$
- npm $\ge 9$

### 2. Start Backend Server
```bash
cd CogniCore_Project/backend
npm install
node src/server.js
# Backend runs on http://localhost:5000
```

### 3. Start Frontend Development Server
```bash
cd CogniCore_Project/frontend
npm install
npm run dev
# Frontend runs on http://localhost:5174
```

### 4. Run the Master Verification Battery
Run the single verification script that validates security, calculations, and end-to-end flows:
```bash
cd CogniCore_Project/backend
npm run verify
```

---

## 🔐 Security & Access Control
- **Strict Digit Parameter Validation:** Regex `/^\d+$/` enforcement on `studentId`, `offeringId`, and `enrollmentId`.
- **Object-Level Authorization (IDOR Defense):** Students can only query their own profiles; Faculty can only access their assigned offerings; Admins have institutional access.
- **ACID Batch Transactions:** Batch mark commits execute within atomic `BEGIN TRANSACTION` ... `COMMIT` / `ROLLBACK` blocks.
- **Audit Immutability:** Grade edits generate append-only notification records and log previous vs. new values.
