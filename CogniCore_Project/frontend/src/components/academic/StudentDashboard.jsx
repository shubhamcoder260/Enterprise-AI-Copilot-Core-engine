import React, { useState } from "react";

export default function StudentDashboard({ profile, onRefresh, loading }) {
  const [activeTab, setActiveTab] = useState("courses"); // 'courses' or 'notifications'
  const [expandedRiskCourse, setExpandedRiskCourse] = useState(null);

  if (!profile || !profile.student) {
    return (
      <div style={{ padding: "40px", textAlign: "center", color: "#94a3b8" }}>
        Loading student academic profile...
      </div>
    );
  }

  const { student, courses = [], notifications = [] } = profile;

  // Check if any course is in WARNING, DANGER, or CRITICAL
  const criticalCourses = courses.filter((c) => c.attendance.alertLevel === "CRITICAL" || c.attendance.alertLevel === "DANGER");
  const warningCourses = courses.filter((c) => c.attendance.alertLevel === "WARNING");
  const hasAlerts = criticalCourses.length > 0 || warningCourses.length > 0;

  const getAlertBadgeStyle = (level) => {
    switch (level) {
      case "SAFE":
        return { bg: "rgba(16, 185, 129, 0.15)", text: "#10b981", border: "rgba(16, 185, 129, 0.3)" };
      case "WARNING":
        return { bg: "rgba(245, 158, 11, 0.15)", text: "#f59e0b", border: "rgba(245, 158, 11, 0.3)" };
      case "DANGER":
        return { bg: "rgba(239, 68, 68, 0.15)", text: "#ef4444", border: "rgba(239, 68, 68, 0.3)" };
      case "CRITICAL":
        return { bg: "rgba(185, 28, 28, 0.25)", text: "#f87171", border: "rgba(185, 28, 28, 0.4)" };
      default:
        return { bg: "#334155", text: "#94a3b8", border: "#475569" };
    }
  };

  const getRiskBadgeStyle = (level) => {
    switch (level) {
      case "LOW":
        return { bg: "rgba(16, 185, 129, 0.15)", text: "#10b981" };
      case "MEDIUM":
        return { bg: "rgba(245, 158, 11, 0.15)", text: "#f59e0b" };
      case "HIGH":
        return { bg: "rgba(239, 68, 68, 0.15)", text: "#ef4444" };
      default:
        return { bg: "#334155", text: "#94a3b8" };
    }
  };

  return (
    <div style={{ maxWidth: "1280px", margin: "0 auto", padding: "24px 20px" }}>
      {/* Student Profile Header Bar */}
      <div style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: "16px", padding: "24px", marginBottom: "24px", display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "16px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "6px" }}>
            <h1 style={{ fontSize: "24px", fontWeight: "700", color: "#f8fafc", margin: 0 }}>
              {student.first_name} {student.last_name}
            </h1>
            <span style={{ fontSize: "12px", background: "rgba(59, 130, 246, 0.2)", color: "#60a5fa", padding: "4px 10px", borderRadius: "999px", fontWeight: "600" }}>
              Roll: {student.register_number}
            </span>
            <span style={{ fontSize: "12px", background: "rgba(16, 185, 129, 0.2)", color: "#34d399", padding: "4px 10px", borderRadius: "999px", fontWeight: "600" }}>
              CGPA: {student.cgpa || "7.5"}
            </span>
          </div>
          <div style={{ fontSize: "14px", color: "#94a3b8" }}>
            {student.program_name || "B.Tech Computer Science"} • Semester {student.current_semester || "1"} • Section {student.section || "A"}
          </div>
        </div>

        {/* View Switcher (Courses vs Notifications) */}
        <div style={{ display: "flex", gap: "10px" }}>
          <button
            onClick={() => setActiveTab("courses")}
            style={{
              padding: "10px 18px",
              borderRadius: "8px",
              fontSize: "14px",
              fontWeight: "600",
              border: "none",
              cursor: "pointer",
              background: activeTab === "courses" ? "#2563eb" : "#334155",
              color: "#fff"
            }}
          >
            📚 My Courses ({courses.length})
          </button>
          <button
            onClick={() => setActiveTab("notifications")}
            style={{
              padding: "10px 18px",
              borderRadius: "8px",
              fontSize: "14px",
              fontWeight: "600",
              border: "none",
              cursor: "pointer",
              background: activeTab === "notifications" ? "#2563eb" : "#334155",
              color: "#fff",
              position: "relative"
            }}
          >
            🔔 Notifications ({notifications.length})
            {notifications.some((n) => n.is_read === 0) && (
              <span style={{ position: "absolute", top: "-4px", right: "-4px", width: "10px", height: "10px", background: "#ef4444", borderRadius: "50%" }}></span>
            )}
          </button>
        </div>
      </div>

      {/* Proactive Pre-75% Early Alert Banner */}
      {hasAlerts && (
        <div style={{ background: "rgba(245, 158, 11, 0.1)", border: "1px solid rgba(245, 158, 11, 0.3)", borderRadius: "12px", padding: "16px 20px", marginBottom: "24px", display: "flex", alignItems: "flex-start", gap: "12px" }}>
          <div style={{ fontSize: "20px" }}>⚠️</div>
          <div>
            <div style={{ fontSize: "15px", fontWeight: "700", color: "#fbbf24", marginBottom: "4px" }}>
              Proactive Academic & Attendance Alerts Active
            </div>
            <div style={{ fontSize: "13px", color: "#cbd5e1", lineHeight: "1.5" }}>
              {criticalCourses.length > 0 && (
                <div>• <strong>Critical Alert:</strong> You are below 75% in {criticalCourses.map((c) => c.course_code).join(", ")}. Immediate recovery attendance is required.</div>
              )}
              {warningCourses.length > 0 && (
                <div>• <strong>Early Warning:</strong> You are trending close to the 75% threshold in {warningCourses.map((c) => c.course_code).join(", ")}. Review your buffer below.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 1: Enrolled Courses & Attendance Health */}
      {activeTab === "courses" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: "20px" }}>
          {courses.map((c) => {
            const att = c.attendance;
            const badge = getAlertBadgeStyle(att.alertLevel);
            const riskBadge = getRiskBadgeStyle(c.risk.riskLevel);
            const isExpanded = expandedRiskCourse === c.course_id;

            return (
              <div
                key={c.course_id}
                style={{
                  background: "#1e293b",
                  border: `1px solid ${badge.border}`,
                  borderRadius: "14px",
                  padding: "20px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  boxShadow: "0 4px 15px rgba(0,0,0,0.2)"
                }}
              >
                <div>
                  {/* Card Header */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
                    <div>
                      <span style={{ fontSize: "12px", color: "#94a3b8", fontWeight: "600" }}>{c.course_code}</span>
                      <h2 style={{ fontSize: "18px", fontWeight: "700", color: "#f8fafc", margin: "2px 0 4px 0" }}>
                        {c.course_name}
                      </h2>
                      <div style={{ fontSize: "12px", color: "#64748b" }}>{c.facultyName}</div>
                    </div>
                    <span style={{ fontSize: "12px", fontWeight: "700", padding: "4px 10px", borderRadius: "999px", background: badge.bg, color: badge.text, border: `1px solid ${badge.border}` }}>
                      {att.alertLevel} ({att.currentPct}%)
                    </span>
                  </div>

                  {/* Attendance Progress Bar */}
                  <div style={{ marginBottom: "16px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "#94a3b8", marginBottom: "6px" }}>
                      <span>Attended: {att.attended} / {att.held} classes</span>
                      <span>Target: 75% min</span>
                    </div>
                    <div style={{ width: "100%", height: "8px", background: "#334155", borderRadius: "999px", overflow: "hidden", position: "relative" }}>
                      <div
                        style={{
                          width: `${Math.min(100, att.currentPct)}%`,
                          height: "100%",
                          background: badge.text,
                          borderRadius: "999px",
                          transition: "width 0.4s ease"
                        }}
                      ></div>
                    </div>
                  </div>

                  {/* Actionable Math (Buffer / Recovery) */}
                  <div style={{ background: "rgba(15, 23, 42, 0.6)", borderRadius: "10px", padding: "12px", marginBottom: "16px", border: "1px solid #334155" }}>
                    <div style={{ fontSize: "13px", fontWeight: "600", color: "#f1f5f9", marginBottom: "4px" }}>
                      {att.currentPct >= 75.0 ? (
                        <span>🟢 Miss Buffer: <strong>{att.missBuffer} class(es)</strong> can be missed</span>
                      ) : (
                        <span>🔴 Recovery Target: Attend <strong>{att.recoveryNeeded} consecutive class(es)</strong></span>
                      )}
                    </div>
                    <div style={{ fontSize: "12px", color: "#94a3b8", lineHeight: "1.4" }}>
                      {att.explanation}
                    </div>
                    <div style={{ fontSize: "11px", color: "#64748b", marginTop: "6px" }}>
                      10-Class Projection: <strong>{att.projectedFinalPct}%</strong> at semester end
                    </div>
                  </div>

                  {/* Internal Marks Summary */}
                  <div style={{ marginBottom: "16px" }}>
                    <div style={{ fontSize: "12px", fontWeight: "600", color: "#94a3b8", marginBottom: "8px" }}>
                      Internal Assessments:
                    </div>
                    {c.marks && c.marks.length > 0 ? (
                      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                        {c.marks.map((m) => (
                          <div key={m.mark_id} style={{ background: "#0f172a", border: "1px solid #334155", borderRadius: "8px", padding: "6px 12px", fontSize: "12px" }}>
                            <span style={{ color: "#94a3b8" }}>{m.assessment_name}: </span>
                            <strong style={{ color: "#f8fafc" }}>{m.obtained_marks}/{m.max_marks}</strong>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ fontSize: "12px", color: "#64748b", fontStyle: "italic" }}>No internal marks recorded yet</div>
                    )}
                  </div>
                </div>

                {/* Multi-Factor Academic Risk Section */}
                <div style={{ borderTop: "1px solid #334155", paddingTop: "14px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ fontSize: "12px", color: "#94a3b8" }}>Academic Risk:</span>
                      <span style={{ fontSize: "11px", fontWeight: "700", padding: "2px 8px", borderRadius: "6px", background: riskBadge.bg, color: riskBadge.text }}>
                        {c.risk.riskLevel} (Score: {c.risk.totalRiskScore}/100)
                      </span>
                    </div>
                    <button
                      onClick={() => setExpandedRiskCourse(isExpanded ? null : c.course_id)}
                      style={{ background: "transparent", border: "none", color: "#60a5fa", fontSize: "12px", cursor: "pointer", fontWeight: "600" }}
                    >
                      {isExpanded ? "Hide Reasons ▲" : "Explain Drivers ▼"}
                    </button>
                  </div>

                  {/* Expandable Reasons Drawer */}
                  {isExpanded && (
                    <div style={{ background: "#0f172a", borderRadius: "8px", padding: "10px 12px", marginTop: "10px", fontSize: "12px", color: "#cbd5e1" }}>
                      <div style={{ fontWeight: "600", marginBottom: "6px", color: "#94a3b8" }}>35/30/20/15 Weighted Formula Drivers:</div>
                      <ul style={{ margin: 0, paddingLeft: "18px", lineHeight: "1.6" }}>
                        {c.risk.reasons.map((r, i) => (
                          <li key={i}>{r}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* TAB 2: Notifications Drawer */}
      {activeTab === "notifications" && (
        <div style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: "16px", padding: "24px" }}>
          <h2 style={{ fontSize: "18px", fontWeight: "700", color: "#f8fafc", margin: "0 0 16px 0" }}>
            In-App Notifications & Mark Edit Alerts (R3)
          </h2>
          {notifications.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px", color: "#64748b" }}>
              No notifications on record.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {notifications.map((n) => (
                <div
                  key={n.notification_id}
                  style={{
                    background: n.is_read === 0 ? "rgba(37, 99, 235, 0.1)" : "#0f172a",
                    border: `1px solid ${n.is_read === 0 ? "rgba(37, 99, 235, 0.4)" : "#334155"}`,
                    borderRadius: "10px",
                    padding: "16px"
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                    <div style={{ fontSize: "14px", fontWeight: "700", color: "#f1f5f9" }}>
                      {n.title}
                    </div>
                    <span style={{ fontSize: "11px", color: "#64748b" }}>
                      {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {new Date(n.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <div style={{ fontSize: "13px", color: "#cbd5e1", lineHeight: "1.5" }}>
                    {n.message}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
