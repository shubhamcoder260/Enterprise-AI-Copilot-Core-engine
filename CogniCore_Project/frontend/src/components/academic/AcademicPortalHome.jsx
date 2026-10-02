import React from "react";

export default function AcademicPortalHome({ onSelectRole, onQuickLogin, loading }) {
  return (
    <div className="academic-home-container" style={{ padding: "40px 24px", maxWidth: "1200px", margin: "0 auto" }}>
      {/* Header Banner */}
      <div style={{ textAlign: "center", marginBottom: "48px" }}>
        <div style={{ display: "inline-block", padding: "6px 16px", borderRadius: "999px", background: "rgba(59, 130, 246, 0.15)", color: "#60a5fa", fontSize: "14px", fontWeight: "600", marginBottom: "16px" }}>
          🏛️ University X Academic Intelligence & Governance
        </div>
        <h1 style={{ fontSize: "36px", fontWeight: "800", color: "#f8fafc", margin: "0 0 12px 0", letterSpacing: "-0.5px" }}>
          Intelligent Student Monitoring & Support System
        </h1>
        <p style={{ fontSize: "16px", color: "#94a3b8", maxWidth: "680px", margin: "0 auto", lineHeight: "1.6" }}>
          Predicting attendance trajectories before the 75% threshold, transparent multi-factor risk analysis, instant notifications, and AI voice-assisted mark entry.
        </p>
      </div>

      {/* Role Access Cards */}
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
              onClick={() => onQuickLogin("faculty", 150)}
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
