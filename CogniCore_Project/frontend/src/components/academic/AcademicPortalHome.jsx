import React, { useState } from "react";
import { UniversitySeal, GraduationCapIcon, UserCheckIcon, ShieldBuildingIcon, AlertCircleIcon } from "./Icons.jsx";

export default function AcademicPortalHome({ onQuickLogin, onCredentialLogin, loading }) {
  const [selectedRole, setSelectedRole] = useState("student");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const roleConfig = {
    student: {
      title: "Student Portal Login",
      label: "University Registration Number or Student Email",
      placeholder: "e.g. 2026030001 or vivek.reddy1@student.edu",
      defaultId: "vivek.reddy1@student.edu",
      defaultPass: "student123",
      sampleName: "Vivek Reddy (Reg: 2026030001)",
      primaryColor: "#1e3a8a",
      roleBadge: "STUDENT RECORD",
      icon: GraduationCapIcon
    },
    faculty: {
      title: "Faculty & Instructor Console Login",
      label: "Employee ID or University Email",
      placeholder: "e.g. FAC0001 or karthik.menon1@university.edu",
      defaultId: "karthik.menon1@university.edu",
      defaultPass: "faculty123",
      sampleName: "Prof. Karthik Menon (FAC0001)",
      primaryColor: "#065f46",
      roleBadge: "FACULTY NETID",
      icon: UserCheckIcon
    },
    admin: {
      title: "Office of the Registrar & Deans",
      label: "Institutional Administrative Username",
      placeholder: "e.g. admin@university.edu",
      defaultId: "admin@university.edu",
      defaultPass: "admin123",
      sampleName: "Office of Academic Affairs",
      primaryColor: "#581c87",
      roleBadge: "EXECUTIVE OVERSIGHT",
      icon: ShieldBuildingIcon
    }
  };

  const currentRole = roleConfig[selectedRole];
  const IconComponent = currentRole.icon;

  const handleAutofill = (roleKey) => {
    setSelectedRole(roleKey);
    setIdentifier(roleConfig[roleKey].defaultId);
    setPassword(roleConfig[roleKey].defaultPass);
    setErrorMessage("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage("");
    if (!identifier.trim()) {
      setErrorMessage("Please enter your university identifier or email address.");
      return;
    }
    if (!password.trim()) {
      setErrorMessage("Please enter your account password.");
      return;
    }

    if (onCredentialLogin) {
      const res = await onCredentialLogin(identifier.trim(), password.trim(), selectedRole);
      if (res && !res.success) {
        setErrorMessage(res.error || "Authentication failed. Please verify credentials.");
      }
    }
  };

  return (
    <div style={{ minHeight: "100%", background: "#f8fafc", padding: "40px 20px", display: "flex", flexDirection: "column", alignItems: "center" }}>
      
      {/* University Identity Header */}
      <div style={{ textAlign: "center", marginBottom: "32px", maxWidth: "680px" }}>
        <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: "56px", height: "56px", borderRadius: "12px", background: "#0f2942", color: "#ffffff", marginBottom: "16px", boxShadow: "0 2px 8px rgba(15, 41, 66, 0.15)" }}>
          <UniversitySeal size={32} color="#ffffff" />
        </div>
        <h1 style={{ fontSize: "26px", fontWeight: "800", color: "#0f172a", margin: "0 0 6px 0", letterSpacing: "-0.3px", fontFamily: "system-ui, -apple-system, sans-serif" }}>
          UNIVERSITY X
        </h1>
        <div style={{ fontSize: "14px", fontWeight: "600", color: "#475569", letterSpacing: "0.5px", textTransform: "uppercase", marginBottom: "8px" }}>
          Academic Information & Governance System (AIGS)
        </div>
        <p style={{ fontSize: "13px", color: "#64748b", margin: 0, lineHeight: "1.5" }}>
          Official portal for statutory attendance monitoring, early-warning trajectory projections, auditory mark entry, and institutional performance governance.
        </p>
      </div>

      {/* Main Authentication Box (SSO / CAS Style) */}
      <div style={{
        width: "100%",
        maxWidth: "480px",
        background: "#ffffff",
        border: "1px solid #e2e8f0",
        borderRadius: "12px",
        boxShadow: "0 4px 20px -2px rgba(15, 23, 42, 0.08)",
        overflow: "hidden",
        marginBottom: "32px"
      }}>
        
        {/* Role Tabs */}
        <div style={{ display: "flex", borderBottom: "1px solid #e2e8f0", background: "#f1f5f9" }}>
          <button
            type="button"
            onClick={() => { setSelectedRole("student"); setErrorMessage(""); }}
            style={{
              flex: 1,
              padding: "14px 10px",
              border: "none",
              borderBottom: selectedRole === "student" ? "2px solid #1e3a8a" : "2px solid transparent",
              background: selectedRole === "student" ? "#ffffff" : "transparent",
              color: selectedRole === "student" ? "#1e3a8a" : "#64748b",
              fontSize: "13px",
              fontWeight: "700",
              cursor: "pointer",
              transition: "all 0.15s ease"
            }}
          >
            Student
          </button>
          <button
            type="button"
            onClick={() => { setSelectedRole("faculty"); setErrorMessage(""); }}
            style={{
              flex: 1,
              padding: "14px 10px",
              border: "none",
              borderBottom: selectedRole === "faculty" ? "2px solid #065f46" : "2px solid transparent",
              background: selectedRole === "faculty" ? "#ffffff" : "transparent",
              color: selectedRole === "faculty" ? "#065f46" : "#64748b",
              fontSize: "13px",
              fontWeight: "700",
              cursor: "pointer",
              transition: "all 0.15s ease"
            }}
          >
            Faculty
          </button>
          <button
            type="button"
            onClick={() => { setSelectedRole("admin"); setErrorMessage(""); }}
            style={{
              flex: 1,
              padding: "14px 10px",
              border: "none",
              borderBottom: selectedRole === "admin" ? "2px solid #581c87" : "2px solid transparent",
              background: selectedRole === "admin" ? "#ffffff" : "transparent",
              color: selectedRole === "admin" ? "#581c87" : "#64748b",
              fontSize: "13px",
              fontWeight: "700",
              cursor: "pointer",
              transition: "all 0.15s ease"
            }}
          >
            Registrar / Dean
          </button>
        </div>

        {/* Form Body */}
        <div style={{ padding: "28px 24px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
            <div>
              <div style={{ fontSize: "16px", fontWeight: "700", color: "#0f172a" }}>
                {currentRole.title}
              </div>
              <div style={{ fontSize: "12px", color: "#64748b" }}>
                Sign in with institutional credentials
              </div>
            </div>
            <span style={{ fontSize: "11px", fontWeight: "700", padding: "4px 8px", borderRadius: "4px", background: "#f1f5f9", color: "#475569", border: "1px solid #e2e8f0" }}>
              {currentRole.roleBadge}
            </span>
          </div>

          {errorMessage && (
            <div style={{ background: "#fef2f2", border: "1px solid #fecdd3", borderRadius: "6px", padding: "10px 14px", marginBottom: "18px", color: "#991b1b", fontSize: "13px", display: "flex", alignItems: "center", gap: "8px" }}>
              <AlertCircleIcon size={16} color="#991b1b" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: "600", color: "#334155", marginBottom: "6px" }}>
                {currentRole.label}
              </label>
              <input
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder={currentRole.placeholder}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: "6px",
                  border: "1px solid #cbd5e1",
                  background: "#ffffff",
                  color: "#0f172a",
                  fontSize: "13px",
                  outline: "none",
                  boxSizing: "border-box"
                }}
              />
            </div>

            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                <label style={{ fontSize: "12px", fontWeight: "600", color: "#334155" }}>
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{ background: "transparent", border: "none", color: "#2563eb", fontSize: "11px", cursor: "pointer", fontWeight: "500" }}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter account password"
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: "6px",
                  border: "1px solid #cbd5e1",
                  background: "#ffffff",
                  color: "#0f172a",
                  fontSize: "13px",
                  outline: "none",
                  boxSizing: "border-box"
                }}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                marginTop: "6px",
                padding: "11px",
                borderRadius: "6px",
                background: "#0f2942",
                color: "#ffffff",
                fontWeight: "600",
                fontSize: "13px",
                border: "none",
                cursor: loading ? "not-allowed" : "pointer",
                transition: "background 0.15s ease"
              }}
            >
              {loading ? "Authenticating Session..." : `Sign In to ${selectedRole === "admin" ? "Administrative Console" : selectedRole.charAt(0).toUpperCase() + selectedRole.slice(1) + " Portal"}`}
            </button>
          </form>

          {/* Discreet Evaluation Autofill */}
          <div style={{ marginTop: "20px", paddingTop: "14px", borderTop: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "11px", color: "#64748b" }}>
              Sample: <strong>{currentRole.sampleName}</strong>
            </span>
            <button
              type="button"
              onClick={() => handleAutofill(selectedRole)}
              style={{
                background: "#f8fafc",
                border: "1px solid #cbd5e1",
                color: "#334155",
                borderRadius: "4px",
                padding: "4px 8px",
                fontSize: "11px",
                fontWeight: "600",
                cursor: "pointer"
              }}
            >
              Autofill Credentials
            </button>
          </div>
        </div>

        {/* Footer Security Notice */}
        <div style={{ background: "#f8fafc", borderTop: "1px solid #e2e8f0", padding: "10px 20px", fontSize: "11px", color: "#64748b", textAlign: "center", lineHeight: "1.4" }}>
          Single Sign-On (SSO) session secured with Row-Level Security (RLS) and cryptographic token governance.
        </div>
      </div>

      {/* Evaluator Fast-Track Section */}
      <div style={{ width: "100%", maxWidth: "860px" }}>
        <div style={{ fontSize: "12px", fontWeight: "700", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "12px", textAlign: "center" }}>
          Evaluator Quick-Access Ledgers
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "14px" }}>
          
          <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "16px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                <GraduationCapIcon size={16} color="#1e3a8a" />
                <span style={{ fontWeight: "700", fontSize: "13px", color: "#0f172a" }}>Student View</span>
              </div>
              <p style={{ fontSize: "12px", color: "#64748b", margin: "0 0 12px 0", lineHeight: "1.4" }}>
                Statutory attendance health, 10-class forecast, recovery targets, and multi-factor risk advisory.
              </p>
            </div>
            <button
              onClick={() => onQuickLogin("student", 1)}
              disabled={loading}
              style={{ width: "100%", padding: "8px", borderRadius: "6px", background: "#f1f5f9", color: "#1e3a8a", border: "1px solid #cbd5e1", fontSize: "12px", fontWeight: "600", cursor: "pointer" }}
            >
              Open Vivek Reddy (83.8%)
            </button>
          </div>

          <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "16px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                <UserCheckIcon size={16} color="#065f46" />
                <span style={{ fontWeight: "700", fontSize: "13px", color: "#0f172a" }}>Faculty Console</span>
              </div>
              <p style={{ fontSize: "12px", color: "#64748b", margin: "0 0 12px 0", lineHeight: "1.4" }}>
                Hands-free auditory gradebook entry, phonetic parsing, and ambiguity conflict resolution.
              </p>
            </div>
            <button
              onClick={() => onQuickLogin("faculty", 1)}
              disabled={loading}
              style={{ width: "100%", padding: "8px", borderRadius: "6px", background: "#f1f5f9", color: "#065f46", border: "1px solid #cbd5e1", fontSize: "12px", fontWeight: "600", cursor: "pointer" }}
            >
              Open Prof. Menon (Roster CS101)
            </button>
          </div>

          <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "16px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                <ShieldBuildingIcon size={16} color="#581c87" />
                <span style={{ fontWeight: "700", fontSize: "13px", color: "#0f172a" }}>Registrar & Deans</span>
              </div>
              <p style={{ fontSize: "12px", color: "#64748b", margin: "0 0 12px 0", lineHeight: "1.4" }}>
                Campus-wide academic health heatmap across 3,000 students, 8 departments, and audit logs.
              </p>
            </div>
            <button
              onClick={() => onQuickLogin("admin")}
              disabled={loading}
              style={{ width: "100%", padding: "8px", borderRadius: "6px", background: "#f1f5f9", color: "#581c87", border: "1px solid #cbd5e1", fontSize: "12px", fontWeight: "600", cursor: "pointer" }}
            >
              Open Institutional Heatmap
            </button>
          </div>

        </div>
      </div>

    </div>
  );
}
