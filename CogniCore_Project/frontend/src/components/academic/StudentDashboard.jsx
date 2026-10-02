import React, { useState } from "react";
import { BookOpenIcon, BellIcon, AlertCircleIcon, CheckCircleIcon, ChevronDownIcon, ChevronUpIcon } from "./Icons.jsx";

export default function StudentDashboard({ profile, onRefresh, loading }) {
  const [activeTab, setActiveTab] = useState("courses");
  const [expandedRiskCourse, setExpandedRiskCourse] = useState(null);

  if (!profile || !profile.student) {
    return (
      <div style={{ padding: "60px 20px", textAlign: "center", color: "#64748b", fontSize: "14px" }}>
        Loading student record...
      </div>
    );
  }

  const { student, courses = [], notifications = [] } = profile;

  // Filter courses by compliance status
  const criticalCourses = courses.filter((c) => c.attendance?.alertLevel === "CRITICAL" || c.attendance?.alertLevel === "DANGER");
  const warningCourses = courses.filter((c) => c.attendance?.alertLevel === "WARNING");
  const hasAlerts = criticalCourses.length > 0 || warningCourses.length > 0;

  const getAlertBadgeStyle = (level) => {
    switch (level) {
      case "SAFE":
        return { bg: "#ecfdf5", text: "#047857", border: "#a7f3d0", label: "COMPLIANT" };
      case "WARNING":
        return { bg: "#fffbeb", text: "#b45309", border: "#fde68a", label: "EARLY ADVISORY" };
      case "DANGER":
        return { bg: "#fff1f2", text: "#be123c", border: "#fecdd3", label: "NON-COMPLIANT" };
      case "CRITICAL":
        return { bg: "#fef2f2", text: "#b91c1c", border: "#fca5a5", label: "DEBARRED" };
      default:
        return { bg: "#f1f5f9", text: "#475569", border: "#e2e8f0", label: "RECORD PENDING" };
    }
  };

  const getRiskBadgeStyle = (level) => {
    switch (level) {
      case "LOW":
        return { bg: "#f0fdf4", text: "#166534", border: "#bbf7d0", label: "LOW RISK" };
      case "MEDIUM":
        return { bg: "#fffbeb", text: "#92400e", border: "#fde68a", label: "MODERATE RISK" };
      case "HIGH":
        return { bg: "#fef2f2", text: "#991b1b", border: "#fecdd3", label: "HIGH RISK" };
      default:
        return { bg: "#f8fafc", text: "#475569", border: "#e2e8f0", label: "EVALUATING" };
    }
  };

  return (
    <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "28px 20px", color: "#0f172a" }}>
      
      {/* Official Student Identity Banner */}
      <div style={{
        background: "#ffffff",
        border: "1px solid #e2e8f0",
        borderRadius: "10px",
        padding: "24px",
        marginBottom: "24px",
        boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "space-between",
        alignItems: "center",
        gap: "18px"
      }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
            <h1 style={{ fontSize: "22px", fontWeight: "700", color: "#0f172a", margin: 0 }}>
              {student.first_name} {student.last_name}
            </h1>
            <span style={{ fontSize: "12px", background: "#f1f5f9", color: "#334155", padding: "3px 8px", borderRadius: "4px", fontWeight: "600", border: "1px solid #e2e8f0" }}>
              Reg: {student.register_number}
            </span>
            <span style={{ fontSize: "12px", background: "#ecfdf5", color: "#065f46", padding: "3px 8px", borderRadius: "4px", fontWeight: "600", border: "1px solid #a7f3d0" }}>
              CGPA: {student.cgpa ? Number(student.cgpa).toFixed(2) : "7.50"} / 10.0
            </span>
          </div>
          <div style={{ fontSize: "13px", color: "#64748b" }}>
            {student.program_name || "Bachelor of Technology in Computer Science"} • Semester {student.current_semester || "1"} • Section {student.section || "A"} • Status: <strong style={{ color: "#047857" }}>Active</strong>
          </div>
        </div>

        {/* Tab Navigation */}
        <div style={{ display: "flex", gap: "8px" }}>
          <button
            onClick={() => setActiveTab("courses")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "9px 16px",
              borderRadius: "6px",
              fontSize: "13px",
              fontWeight: "600",
              border: "1px solid",
              cursor: "pointer",
              background: activeTab === "courses" ? "#0f2942" : "#ffffff",
              color: activeTab === "courses" ? "#ffffff" : "#475569",
              borderColor: activeTab === "courses" ? "#0f2942" : "#cbd5e1"
            }}
          >
            <BookOpenIcon size={15} color={activeTab === "courses" ? "#ffffff" : "#64748b"} />
            Courses ({courses.length})
          </button>
          <button
            onClick={() => setActiveTab("notifications")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "9px 16px",
              borderRadius: "6px",
              fontSize: "13px",
              fontWeight: "600",
              border: "1px solid",
              cursor: "pointer",
              background: activeTab === "notifications" ? "#0f2942" : "#ffffff",
              color: activeTab === "notifications" ? "#ffffff" : "#475569",
              borderColor: activeTab === "notifications" ? "#0f2942" : "#cbd5e1",
              position: "relative"
            }}
          >
            <BellIcon size={15} color={activeTab === "notifications" ? "#ffffff" : "#64748b"} />
            Notifications ({notifications.length})
            {notifications.some((n) => n.is_read === 0) && (
              <span style={{ position: "absolute", top: "-3px", right: "-3px", width: "8px", height: "8px", background: "#be123c", borderRadius: "50%" }}></span>
            )}
          </button>
        </div>
      </div>

      {/* Attendance Advisory Banner */}
      {hasAlerts && (
        <div style={{
          background: "#fffbeb",
          border: "1px solid #fde68a",
          borderRadius: "8px",
          padding: "14px 18px",
          marginBottom: "20px",
          display: "flex",
          alignItems: "flex-start",
          gap: "12px"
        }}>
          <AlertCircleIcon size={18} color="#b45309" />
          <div>
            <div style={{ fontSize: "13px", fontWeight: "700", color: "#92400e", marginBottom: "3px" }}>
              Attendance Alert
            </div>
            <div style={{ fontSize: "13px", color: "#78350f", lineHeight: "1.4" }}>
              {criticalCourses.length > 0 && (
                <div>• Attendance below 75% in <strong>{criticalCourses.map((c) => c.course_code).join(", ")}</strong>. Recovery attendance required for exam eligibility.</div>
              )}
              {warningCourses.length > 0 && (
                <div>• Approaching 75% limit in <strong>{warningCourses.map((c) => c.course_code).join(", ")}</strong>.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 1: Enrolled Courses & Attendance Health */}
      {activeTab === "courses" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: "18px" }}>
          {courses.map((c) => {
            const att = c.attendance || { alertLevel: "SAFE", currentPct: 100, held: 0, attended: 0, missBuffer: 0, recoveryNeeded: 0, projectedFinalPct: 100, recentRate: 100, explanation: "" };
            const badge = getAlertBadgeStyle(att.alertLevel);
            const risk = c.risk || { riskLevel: "LOW", totalRiskScore: 0, reasons: [] };
            const riskBadge = getRiskBadgeStyle(risk.riskLevel);
            const isExpanded = expandedRiskCourse === c.course_id;

            return (
              <div
                key={c.course_id}
                style={{
                  background: "#ffffff",
                  border: "1px solid #e2e8f0",
                  borderRadius: "8px",
                  padding: "18px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  boxShadow: "0 1px 2px rgba(0,0,0,0.03)"
                }}
              >
                <div>
                  {/* Card Header */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
                    <div>
                      <span style={{ fontSize: "11px", fontWeight: "700", color: "#64748b" }}>
                        {c.course_code} • {c.credits || 4} Credits
                      </span>
                      <h2 style={{ fontSize: "15px", fontWeight: "700", color: "#0f172a", margin: "2px 0 2px 0" }}>
                        {c.course_name}
                      </h2>
                      <div style={{ fontSize: "12px", color: "#64748b" }}>{c.facultyName}</div>
                    </div>
                    <span style={{ fontSize: "11px", fontWeight: "700", padding: "3px 8px", borderRadius: "4px", background: badge.bg, color: badge.text, border: `1px solid ${badge.border}` }}>
                      {badge.label} ({att.currentPct}%)
                    </span>
                  </div>

                  {/* Attendance Progress */}
                  <div style={{ marginBottom: "14px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "#64748b", marginBottom: "5px" }}>
                      <span>Attended: <strong>{att.attended}</strong> / {att.held}</span>
                      <span>Target: 75%</span>
                    </div>
                    <div style={{ width: "100%", height: "6px", background: "#f1f5f9", borderRadius: "3px", overflow: "hidden" }}>
                      <div
                        style={{
                          width: `${Math.min(100, att.currentPct)}%`,
                          height: "100%",
                          background: att.currentPct >= 75.0 ? "#059669" : "#dc2626",
                          borderRadius: "3px"
                        }}
                      ></div>
                    </div>
                  </div>

                  {/* Status & Forecast */}
                  <div style={{ background: "#f8fafc", borderRadius: "6px", padding: "10px 12px", marginBottom: "14px", border: "1px solid #e2e8f0" }}>
                    <div style={{ fontSize: "12px", fontWeight: "600", color: "#1e293b", marginBottom: "2px" }}>
                      {att.currentPct >= 75.0 ? (
                        <span style={{ color: "#065f46" }}>Absence buffer: <strong>{att.missBuffer} classes</strong></span>
                      ) : (
                        <span style={{ color: "#991b1b" }}>Recovery target: <strong>Attend next {att.recoveryNeeded} classes</strong></span>
                      )}
                    </div>
                    <div style={{ fontSize: "11px", color: "#64748b" }}>
                      Projected attendance: <strong>{att.projectedFinalPct}%</strong> at term end
                    </div>
                  </div>

                  {/* Internal Scores */}
                  <div style={{ marginBottom: "12px" }}>
                    <div style={{ fontSize: "11px", fontWeight: "700", color: "#64748b", marginBottom: "6px" }}>
                      Marks:
                    </div>
                    {c.marks && c.marks.length > 0 ? (
                      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                        {c.marks.map((m) => (
                          <div key={m.mark_id} style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "4px", padding: "3px 8px", fontSize: "12px" }}>
                            <span style={{ color: "#64748b" }}>{m.assessment_name}: </span>
                            <strong style={{ color: "#0f172a" }}>{m.obtained_marks}/{m.max_marks}</strong>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ fontSize: "12px", color: "#94a3b8", fontStyle: "italic" }}>No scores posted yet</div>
                    )}
                  </div>
                </div>

                {/* Risk Factors */}
                <div style={{ borderTop: "1px solid #f1f5f9", paddingTop: "10px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <span style={{ fontSize: "12px", color: "#64748b" }}>Academic Risk:</span>
                      <span style={{ fontSize: "11px", fontWeight: "700", padding: "2px 6px", borderRadius: "4px", background: riskBadge.bg, color: riskBadge.text, border: `1px solid ${riskBadge.border}` }}>
                        {riskBadge.label} ({risk.totalRiskScore}/100)
                      </span>
                    </div>
                    <button
                      onClick={() => setExpandedRiskCourse(isExpanded ? null : c.course_id)}
                      style={{ background: "transparent", border: "none", color: "#2563eb", fontSize: "11px", cursor: "pointer", fontWeight: "600", display: "flex", alignItems: "center", gap: "3px" }}
                    >
                      {isExpanded ? "Hide Details" : "View Factors"}
                      {isExpanded ? <ChevronUpIcon size={12} color="#2563eb" /> : <ChevronDownIcon size={12} color="#2563eb" />}
                    </button>
                  </div>

                  {isExpanded && (
                    <div style={{ background: "#f8fafc", borderRadius: "6px", padding: "8px 10px", marginTop: "8px", fontSize: "12px", color: "#334155", border: "1px solid #e2e8f0" }}>
                      <ul style={{ margin: 0, paddingLeft: "14px", lineHeight: "1.4" }}>
                        {(risk.reasons || []).map((r, i) => (
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

      {/* TAB 2: Official Notices Drawer */}
      {activeTab === "notifications" && (
        <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "10px", overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid #e2e8f0", background: "#f8fafc", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2 style={{ fontSize: "15px", fontWeight: "700", color: "#0f172a", margin: 0 }}>
              Notifications
            </h2>
            <span style={{ fontSize: "12px", color: "#64748b" }}>
              {notifications.length} notices
            </span>
          </div>

          <div style={{ divideY: "1px solid #f1f5f9" }}>
            {notifications.map((n) => (
              <div key={n.notification_id} style={{ padding: "16px 20px", borderBottom: "1px solid #f1f5f9", display: "flex", alignItems: "flex-start", gap: "12px" }}>
                <div style={{ marginTop: "2px" }}>
                  <CheckCircleIcon size={16} color="#059669" />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2px" }}>
                    <strong style={{ fontSize: "13px", color: "#0f172a" }}>{n.title}</strong>
                    <span style={{ fontSize: "11px", color: "#94a3b8" }}>
                      {new Date(n.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", month: "short", day: "numeric" })}
                    </span>
                  </div>
                  <div style={{ fontSize: "13px", color: "#475569", lineHeight: "1.4" }}>
                    {n.message}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
