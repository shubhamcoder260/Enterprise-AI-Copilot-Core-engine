import React, { useState } from "react";

export default function AcademicPortalHome({ onQuickLogin, onCredentialLogin, loading }) {
  const [selectedRole, setSelectedRole] = useState("student");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Role metadata and presets
  const roleConfig = {
    student: {
      title: "Student Portal Login",
      label: "Register Number or Student Email",
      placeholder: "e.g. 2026030001 or vivek.reddy1@student.edu",
      defaultId: "vivek.reddy1@student.edu",
      defaultPass: "student123",
      sampleName: "Vivek Reddy (Roll: 2026030001)",
      accentColor: "#2563eb",
      badge: "🎓 Student Access",
      demoStudentId: 1
    },
    faculty: {
      title: "Faculty Console Login",
      label: "Employee ID or Faculty Email",
      placeholder: "e.g. FAC0001 or karthik.menon1@university.edu",
      defaultId: "karthik.menon1@university.edu",
      defaultPass: "faculty123",
      sampleName: "Prof. Karthik Menon (ID: FAC0001)",
      accentColor: "#059669",
      badge: "👨‍🏫 Faculty Access",
      demoFacultyId: 1
    },
    admin: {
      title: "Academic Administration Login",
      label: "Administrator Email or Username",
      placeholder: "e.g. admin@university.edu or dean.academics@university.edu",
      defaultId: "admin@university.edu",
      defaultPass: "admin123",
      sampleName: "Dean of Academic Affairs",
      accentColor: "#7c3aed",
      badge: "🏛️ Executive Governance",
      demoId: "admin"
    }
  };

  const currentRole = roleConfig[selectedRole];

  // Autofill sample credentials into form
  const handleAutofill = (roleKey) => {
    setSelectedRole(roleKey);
    setIdentifier(roleConfig[roleKey].defaultId);
    setPassword(roleConfig[roleKey].defaultPass);
    setErrorMessage("");
  };

  // Submit credentials
  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage("");
    if (!identifier.trim()) {
      setErrorMessage("Please enter your email, roll number, or employee ID.");
      return;
    }
    if (!password.trim()) {
      setErrorMessage("Please enter your account password.");
      return;
    }

    if (onCredentialLogin) {
      const res = await onCredentialLogin(identifier.trim(), password.trim(), selectedRole);
      if (res && !res.success) {
        setErrorMessage(res.error || "Login failed. Please verify credentials.");
      }
    }
  };

  return (
    <div className="academic-home-container" style={{ padding: "40px 24px", maxWidth: "1200px", margin: "0 auto" }}>
      {/* Header Banner */}
      <div style={{ textAlign: "center", marginBottom: "36px" }}>
        <div style={{ display: "inline-block", padding: "6px 16px", borderRadius: "999px", background: "rgba(59, 130, 246, 0.15)", color: "#60a5fa", fontSize: "14px", fontWeight: "600", marginBottom: "16px" }}>
          🏛️ University X Academic Intelligence & Governance
        </div>
        <h1 style={{ fontSize: "36px", fontWeight: "800", color: "#f8fafc", margin: "0 0 12px 0", letterSpacing: "-0.5px" }}>
          Intelligent Student Monitoring & Support System
        </h1>
        <p style={{ fontSize: "16px", color: "#94a3b8", maxWidth: "720px", margin: "0 auto", lineHeight: "1.6" }}>
          Predicting attendance trajectories before the 75% threshold, transparent multi-factor risk analysis, instant notifications, and AI voice-assisted mark entry.
        </p>
      </div>

      {/* SECTION 1: CREDENTIAL-BASED AUTHENTICATION BOX */}
      <div style={{
        maxWidth: "600px",
        margin: "0 auto 48px auto",
        background: "#1e293b",
        border: "1px solid #334155",
        borderRadius: "20px",
        padding: "32px",
        boxShadow: "0 20px 35px -10px rgba(0, 0, 0, 0.4)"
      }}>
        {/* Role Selection Tabs */}
        <div style={{ display: "flex", gap: "8px", background: "#0f172a", padding: "6px", borderRadius: "12px", marginBottom: "24px" }}>
          <button
            type="button"
            onClick={() => { setSelectedRole("student"); setErrorMessage(""); }}
            style={{
              flex: 1,
              padding: "10px",
              borderRadius: "8px",
              border: "none",
              fontSize: "13px",
              fontWeight: "600",
              cursor: "pointer",
              background: selectedRole === "student" ? "#2563eb" : "transparent",
              color: selectedRole === "student" ? "#fff" : "#94a3b8",
              transition: "all 0.2s"
            }}
          >
            🎓 Student
          </button>
          <button
            type="button"
            onClick={() => { setSelectedRole("faculty"); setErrorMessage(""); }}
            style={{
              flex: 1,
              padding: "10px",
              borderRadius: "8px",
              border: "none",
              fontSize: "13px",
              fontWeight: "600",
              cursor: "pointer",
              background: selectedRole === "faculty" ? "#059669" : "transparent",
              color: selectedRole === "faculty" ? "#fff" : "#94a3b8",
              transition: "all 0.2s"
            }}
          >
            👨‍🏫 Faculty
          </button>
          <button
            type="button"
            onClick={() => { setSelectedRole("admin"); setErrorMessage(""); }}
            style={{
              flex: 1,
              padding: "10px",
              borderRadius: "8px",
              border: "none",
              fontSize: "13px",
              fontWeight: "600",
              cursor: "pointer",
              background: selectedRole === "admin" ? "#7c3aed" : "transparent",
              color: selectedRole === "admin" ? "#fff" : "#94a3b8",
              transition: "all 0.2s"
            }}
          >
            🏛️ Administrator
          </button>
        </div>

        {/* Login Title & Badge */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
          <div>
            <h2 style={{ fontSize: "18px", fontWeight: "700", color: "#f8fafc", margin: "0 0 4px 0" }}>
              {currentRole.title}
            </h2>
            <span style={{ fontSize: "12px", color: "#94a3b8" }}>
              Access secured by CogniCore Role-Based Access Control (RBAC)
            </span>
          </div>
          <span style={{ fontSize: "11px", fontWeight: "700", padding: "4px 10px", borderRadius: "999px", background: "rgba(255,255,255,0.08)", color: "#cbd5e1" }}>
            {currentRole.badge}
          </span>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div style={{ background: "rgba(239, 68, 68, 0.15)", border: "1px solid #ef4444", borderRadius: "10px", padding: "12px 16px", marginBottom: "20px", color: "#fca5a5", fontSize: "13px", display: "flex", alignItems: "center", gap: "8px" }}>
            <span>⚠️</span>
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Credential Form */}
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#cbd5e1", marginBottom: "6px" }}>
              {currentRole.label}
            </label>
            <input
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder={currentRole.placeholder}
              style={{
                width: "100%",
                padding: "12px 14px",
                borderRadius: "10px",
                background: "#0f172a",
                border: "1px solid #334155",
                color: "#f8fafc",
                fontSize: "14px",
                outline: "none",
                boxSizing: "border-box"
              }}
            />
          </div>

          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
              <label style={{ fontSize: "13px", fontWeight: "600", color: "#cbd5e1" }}>
                Password
              </label>
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{ background: "transparent", border: "none", color: "#60a5fa", fontSize: "12px", cursor: "pointer" }}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              style={{
                width: "100%",
                padding: "12px 14px",
                borderRadius: "10px",
                background: "#0f172a",
                border: "1px solid #334155",
                color: "#f8fafc",
                fontSize: "14px",
                outline: "none",
                boxSizing: "border-box"
              }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              padding: "14px",
              borderRadius: "10px",
              background: currentRole.accentColor,
              color: "#fff",
              fontWeight: "700",
              fontSize: "14px",
              border: "none",
              cursor: loading ? "not-allowed" : "pointer",
              boxShadow: "0 4px 14px rgba(0,0,0,0.25)",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              gap: "8px",
              marginTop: "4px"
            }}
          >
            {loading ? "Authenticating..." : `Sign In as ${selectedRole.charAt(0).toUpperCase() + selectedRole.slice(1)}`}
          </button>
        </form>

        {/* Demo Credential Autofill Helper */}
        <div style={{ marginTop: "20px", paddingTop: "16px", borderTop: "1px solid #334155", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: "12px", color: "#94a3b8" }}>
            💡 Demo Account: <strong>{currentRole.sampleName}</strong>
          </span>
          <button
            type="button"
            onClick={() => handleAutofill(selectedRole)}
            style={{
              background: "rgba(255,255,255,0.08)",
              border: "1px solid #475569",
              color: "#93c5fd",
              borderRadius: "6px",
              padding: "4px 10px",
              fontSize: "11px",
              fontWeight: "600",
              cursor: "pointer"
            }}
          >
            ⚡ Autofill Credentials
          </button>
        </div>
      </div>

      {/* DIVIDER */}
      <div style={{ textAlign: "center", position: "relative", marginBottom: "40px" }}>
        <div style={{ borderTop: "1px solid #334155", position: "absolute", top: "50%", left: 0, right: 0 }}></div>
        <span style={{ position: "relative", background: "#0b0f19", padding: "0 16px", color: "#64748b", fontSize: "12px", fontWeight: "700", letterSpacing: "1px", textTransform: "uppercase" }}>
          Or Select 1-Click Instant Demo Access
        </span>
      </div>

      {/* SECTION 2: ROLE ACCESS CARDS */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "24px", marginBottom: "48px" }}>
        
        {/* Student Card */}
        <div style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: "16px", padding: "28px", display: "flex", flexDirection: "column", justifyContent: "space-between", boxShadow: "0 10px 25px -5px rgba(0,0,0,0.3)" }}>
          <div>
            <div style={{ width: "48px", height: "48px", borderRadius: "12px", background: "rgba(16, 185, 129, 0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "24px", marginBottom: "16px" }}>
              🎓
            </div>
            <h2 style={{ fontSize: "20px", fontWeight: "700", color: "#f1f5f9", margin: "0 0 8px 0" }}>Student Portal</h2>
            <p style={{ fontSize: "14px", color: "#94a3b8", margin: "0 0 20px 0", lineHeight: "1.5" }}>
              Real-time attendance health, 10-class trajectory forecasts, recovery targets, marks history, and proactive exam alerts.
            </p>
            <ul style={{ listStyle: "none", padding: 0, margin: "0 0 24px 0", fontSize: "13px", color: "#cbd5e1", lineHeight: "2" }}>
              <li>✅ 75% Early Warning Projections</li>
              <li>✅ "Miss X more classes" Buffer Math</li>
              <li>✅ Multi-Factor Academic Risk Drivers</li>
              <li>✅ Instant In-App Mark Edit Alerts</li>
            </ul>
          </div>
          <div>
            <button
              onClick={() => onQuickLogin("student", 1)}
              disabled={loading}
              style={{ width: "100%", padding: "12px 18px", borderRadius: "10px", background: "#2563eb", color: "#fff", fontWeight: "600", fontSize: "14px", border: "none", cursor: "pointer", transition: "background 0.2s" }}
            >
              {loading ? "Authenticating..." : "⚡ Quick Demo: Student (Vivek Reddy)"}
            </button>
          </div>
        </div>

        {/* Faculty Card */}
        <div style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: "16px", padding: "28px", display: "flex", flexDirection: "column", justifyContent: "space-between", boxShadow: "0 10px 25px -5px rgba(0,0,0,0.3)" }}>
          <div>
            <div style={{ width: "48px", height: "48px", borderRadius: "12px", background: "rgba(59, 130, 246, 0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "24px", marginBottom: "16px" }}>
              👨‍🏫
            </div>
            <h2 style={{ fontSize: "20px", fontWeight: "700", color: "#f1f5f9", margin: "0 0 8px 0" }}>Faculty Console</h2>
            <p style={{ fontSize: "14px", color: "#94a3b8", margin: "0 0 20px 0", lineHeight: "1.5" }}>
              AI voice-assisted batch mark entry, automatic roll/fuzzy roster matching, ambiguity resolver, and at-risk student list.
            </p>
            <ul style={{ listStyle: "none", padding: 0, margin: "0 0 24px 0", fontSize: "13px", color: "#cbd5e1", lineHeight: "2" }}>
              <li>🎙️ Voice-to-Mark Dictation ("Rahul, 42/50")</li>
              <li>🔍 Roster Fuzzy & Roll Number Matcher</li>
              <li>⚠️ Human-in-the-Loop Ambiguity Selector</li>
              <li>🚨 Course-level At-Risk Student Attention</li>
            </ul>
          </div>
          <div>
            <button
              onClick={() => onQuickLogin("faculty", 1)}
              disabled={loading}
              style={{ width: "100%", padding: "12px 18px", borderRadius: "10px", background: "#059669", color: "#fff", fontWeight: "600", fontSize: "14px", border: "none", cursor: "pointer", transition: "background 0.2s" }}
            >
              {loading ? "Authenticating..." : "⚡ Quick Demo: Faculty (Prof. Menon)"}
            </button>
          </div>
        </div>

        {/* Admin Card */}
        <div style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: "16px", padding: "28px", display: "flex", flexDirection: "column", justifyContent: "space-between", boxShadow: "0 10px 25px -5px rgba(0,0,0,0.3)" }}>
          <div>
            <div style={{ width: "48px", height: "48px", borderRadius: "12px", background: "rgba(168, 85, 247, 0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "24px", marginBottom: "16px" }}>
              🏛️
            </div>
            <h2 style={{ fontSize: "20px", fontWeight: "700", color: "#f1f5f9", margin: "0 0 8px 0" }}>Administrator Hub</h2>
            <p style={{ fontSize: "14px", color: "#94a3b8", margin: "0 0 20px 0", lineHeight: "1.5" }}>
              Institution-wide health heatmap, department-level attendance trends, low-attendance counts, and audit logs.
            </p>
            <ul style={{ listStyle: "none", padding: 0, margin: "0 0 24px 0", fontSize: "13px", color: "#cbd5e1", lineHeight: "2" }}>
              <li>📊 8-Department Academic Heatmap</li>
              <li>📉 University-wide Low-Attendance Counters</li>
              <li>🛡️ Cryptographic Grade Audit History</li>
              <li>🔎 Single-Student Deep Drill-Down</li>
            </ul>
          </div>
          <div>
            <button
              onClick={() => onQuickLogin("admin")}
              disabled={loading}
              style={{ width: "100%", padding: "12px 18px", borderRadius: "10px", background: "#7c3aed", color: "#fff", fontWeight: "600", fontSize: "14px", border: "none", cursor: "pointer", transition: "background 0.2s" }}
            >
              {loading ? "Authenticating..." : "⚡ Quick Demo: Admin (Dean of Academics)"}
            </button>
          </div>
        </div>

      </div>

      {/* Feature Highlights Footer */}
      <div style={{ background: "rgba(15, 23, 42, 0.6)", border: "1px solid #334155", borderRadius: "12px", padding: "20px", textAlign: "center", fontSize: "13px", color: "#94a3b8" }}>
        🔒 <strong>Enterprise Security & Data Privacy:</strong> Row-Level Security (RLS) ensures students access strictly their own records. All queries pass deterministic AST validation.
      </div>
    </div>
  );
}
