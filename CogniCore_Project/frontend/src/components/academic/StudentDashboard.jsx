import React, { useState, useEffect } from "react";
import { BookOpenIcon, BellIcon, AlertCircleIcon, CheckCircleIcon, ChevronDownIcon, ChevronUpIcon } from "./Icons.jsx";
import { academicFetch } from "../../lib/academicApi.js";

export default function StudentDashboard({ profile, onRefresh, loading }) {
  const [activeTab, setActiveTab] = useState("courses"); // 'courses', 'planner', 'notifications', 'outbox'
  const [expandedRiskCourse, setExpandedRiskCourse] = useState(null);

  // Recovery Simulator State
  const [selectedCourseId, setSelectedCourseId] = useState(null);
  const [futureClassesToAttend, setFutureClassesToAttend] = useState(6);
  const [futureTotalClasses, setFutureTotalClasses] = useState(8);

  // Outbox State
  const [outboxMessages, setOutboxMessages] = useState([]);
  const [outboxLoading, setOutboxLoading] = useState(false);

  if (!profile || !profile.student) {
    return (
      <div style={{ padding: "60px 20px", textAlign: "center", color: "#64748b", fontSize: "14px" }}>
        Loading student record...
      </div>
    );
  }

  const { student, courses = [], notifications = [] } = profile;

  // Set default selected course for recovery planner
  useEffect(() => {
    if (courses.length > 0 && !selectedCourseId) {
      setSelectedCourseId(courses[0].offering_id || courses[0].course_id);
    }
  }, [courses, selectedCourseId]);

  // Load off-portal outbox messages when Outbox tab is selected
  useEffect(() => {
    if (activeTab === "outbox" && outboxMessages.length === 0) {
      (async () => {
        try {
          setOutboxLoading(true);
          const res = await academicFetch(`http://localhost:5000/api/academic/outbox?studentId=${student.student_id}&limit=20`);
          const data = await res.json();
          if (data.messages) {
            setOutboxMessages(data.messages);
          }
        } catch (err) {
          console.error("Failed to load outbox:", err);
        } finally {
          setOutboxLoading(false);
        }
      })();
    }
  }, [activeTab, student.student_id, outboxMessages.length]);

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

  // Selected course for recovery planner
  const activePlanningCourse = courses.find((c) => (c.offering_id || c.course_id) === selectedCourseId) || courses[0];
  const currentAttended = activePlanningCourse?.attendance?.attendedClasses ?? 20;
  const currentHeld = activePlanningCourse?.attendance?.heldClasses ?? 28;

  // Recovery formula calculation
  const totalHeldAfter = currentHeld + futureTotalClasses;
  const totalAttendedAfter = currentAttended + futureClassesToAttend;
  const resultingPct = totalHeldAfter > 0 ? Number(((totalAttendedAfter / totalHeldAfter) * 100).toFixed(2)) : 100;
  const neededConsecutiveToReach75 = Math.max(0, Math.ceil(0.75 * totalHeldAfter - currentAttended));
  const isEligibleAfterPlan = resultingPct >= 75.0;

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
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
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
            onClick={() => setActiveTab("planner")}
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
              background: activeTab === "planner" ? "#0f2942" : "#ffffff",
              color: activeTab === "planner" ? "#ffffff" : "#475569",
              borderColor: activeTab === "planner" ? "#0f2942" : "#cbd5e1"
            }}
          >
            📊 What-If Recovery Planner
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
              borderColor: activeTab === "notifications" ? "#0f2942" : "#cbd5e1"
            }}
          >
            <BellIcon size={15} color={activeTab === "notifications" ? "#ffffff" : "#64748b"} />
            In-App Notices ({notifications.length})
          </button>

          <button
            onClick={() => setActiveTab("outbox")}
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
              background: activeTab === "outbox" ? "#0f2942" : "#ffffff",
              color: activeTab === "outbox" ? "#ffffff" : "#475569",
              borderColor: activeTab === "outbox" ? "#0f2942" : "#cbd5e1"
            }}
          >
            📬 Off-Portal Outbox (SMS/Email)
          </button>
        </div>
      </div>

      {/* Early-Warning Statutory Banner */}
      {hasAlerts && (
        <div style={{
          background: criticalCourses.length > 0 ? "#fef2f2" : "#fffbeb",
          border: `1px solid ${criticalCourses.length > 0 ? "#fca5a5" : "#fde68a"}`,
          borderRadius: "8px",
          padding: "16px 20px",
          marginBottom: "24px",
          display: "flex",
          alignItems: "flex-start",
          gap: "14px"
        }}>
          <AlertCircleIcon size={20} color={criticalCourses.length > 0 ? "#b91c1c" : "#b45309"} />
          <div>
            <div style={{ fontSize: "14px", fontWeight: "700", color: criticalCourses.length > 0 ? "#991b1b" : "#92400e", marginBottom: "2px" }}>
              {criticalCourses.length > 0 ? "Mandatory Attendance Non-Compliance Action Required" : "Academic Advisory: Approaching 75% Statutory Limit"}
            </div>
            <div style={{ fontSize: "13px", color: criticalCourses.length > 0 ? "#b91c1c" : "#b45309", lineHeight: "1.4" }}>
              You have {criticalCourses.length + warningCourses.length} course(s) requiring immediate attention. Per University Regulation 14.2, students with less than 75.0% aggregate attendance are barred from appearing in end-semester examinations.
            </div>
          </div>
        </div>
      )}

      {/* TAB 1: ENROLLED COURSES & MARKS */}
      {activeTab === "courses" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))", gap: "20px" }}>
          {courses.map((c) => {
            const att = c.attendance || {};
            const marks = c.marks || [];
            const risk = c.risk || {};
            const alertBadge = getAlertBadgeStyle(att.alertLevel);
            const riskBadge = getRiskBadgeStyle(risk.riskLevel);
            const isExpanded = expandedRiskCourse === c.course_id;

            return (
              <div key={c.course_id} style={{
                background: "#ffffff",
                border: "1px solid #e2e8f0",
                borderRadius: "10px",
                padding: "20px",
                boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between"
              }}>
                <div>
                  {/* Course Header */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
                    <div>
                      <span style={{ fontSize: "11px", fontWeight: "700", background: "#f1f5f9", color: "#475569", padding: "2px 6px", borderRadius: "4px" }}>
                        {c.course_code}
                      </span>
                      <h3 style={{ fontSize: "16px", fontWeight: "700", color: "#0f172a", margin: "6px 0 2px 0" }}>
                        {c.course_name}
                      </h3>
                      <div style={{ fontSize: "12px", color: "#64748b" }}>
                        Instructor: {c.facultyName || "Faculty Assigned"}
                      </div>
                    </div>

                    <span style={{ fontSize: "11px", fontWeight: "700", padding: "3px 8px", borderRadius: "4px", background: alertBadge.bg, color: alertBadge.text, border: `1px solid ${alertBadge.border}` }}>
                      {alertBadge.label}
                    </span>
                  </div>

                  {/* Attendance Progress & Projection */}
                  <div style={{ background: "#f8fafc", borderRadius: "8px", padding: "14px", marginBottom: "16px", border: "1px solid #e2e8f0" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "6px" }}>
                      <span style={{ fontSize: "12px", fontWeight: "600", color: "#64748b" }}>Attendance Ratio</span>
                      <span style={{ fontSize: "18px", fontWeight: "700", color: att.currentPct < 75 ? "#be123c" : "#0f172a" }}>
                        {att.currentPct}%
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div style={{ height: "6px", background: "#e2e8f0", borderRadius: "3px", overflow: "hidden", position: "relative", marginBottom: "8px" }}>
                      <div style={{ height: "100%", width: `${Math.min(100, att.currentPct)}%`, background: att.currentPct < 75 ? "#be123c" : att.currentPct < 80 ? "#d97706" : "#059669", borderRadius: "3px" }} />
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "#64748b", marginBottom: "6px" }}>
                      <span>Attended: <strong>{att.attendedClasses} / {att.heldClasses}</strong> classes</span>
                      <span>Projected: <strong>{att.projectedFinalPct}%</strong></span>
                    </div>

                    <div style={{ fontSize: "12px", color: "#334155", background: "#ffffff", padding: "6px 8px", borderRadius: "4px", border: "1px solid #e2e8f0", lineHeight: "1.4" }}>
                      {att.explanation}
                    </div>
                  </div>

                  {/* Internal Assessment Marks */}
                  <div style={{ marginBottom: "16px" }}>
                    <div style={{ fontSize: "12px", fontWeight: "700", color: "#475569", textTransform: "uppercase", marginBottom: "8px" }}>
                      Internal Assessment Ledger
                    </div>
                    {marks.length > 0 ? (
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                        {marks.map((m, idx) => (
                          <div key={idx} style={{ background: "#f8fafc", padding: "8px 10px", borderRadius: "6px", border: "1px solid #e2e8f0" }}>
                            <div style={{ fontSize: "11px", color: "#64748b" }}>{m.assessment_name}</div>
                            <div style={{ fontSize: "14px", fontWeight: "700", color: "#0f172a" }}>
                              {m.obtained_marks} <span style={{ fontSize: "11px", color: "#94a3b8", fontWeight: "normal" }}>/ {m.max_marks}</span>
                            </div>
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

      {/* TAB 2: INTERACTIVE RECOVERY WHAT-IF PLANNER (USP 5) */}
      {activeTab === "planner" && (
        <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "10px", padding: "24px", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
          <div style={{ marginBottom: "20px" }}>
            <h2 style={{ fontSize: "16px", fontWeight: "700", color: "#0f172a", margin: "0 0 4px 0" }}>
              Interactive Academic Recovery Simulator
            </h2>
            <p style={{ fontSize: "13px", color: "#64748b", margin: 0 }}>
              Model your future attendance pace and discover the exact number of classes you need to attend to cross the 75% statutory exam eligibility threshold.
            </p>
          </div>

          {/* Select Course Offering */}
          <div style={{ marginBottom: "20px", maxWidth: "400px" }}>
            <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "#475569", textTransform: "uppercase", marginBottom: "4px" }}>
              Select Course Offering
            </label>
            <select
              value={selectedCourseId || ""}
              onChange={(e) => setSelectedCourseId(parseInt(e.target.value, 10))}
              style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "13px", fontWeight: "600", outline: "none" }}
            >
              {courses.map((c) => (
                <option key={c.offering_id || c.course_id} value={c.offering_id || c.course_id}>
                  {c.course_code}: {c.course_name} (Current: {c.attendance.currentPct}%)
                </option>
              ))}
            </select>
          </div>

          {/* Interactive Slider Grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "20px", marginBottom: "24px" }}>
            <div style={{ background: "#f8fafc", padding: "18px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
              <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "#334155", marginBottom: "8px" }}>
                Next Classes Conducted: <strong>{futureTotalClasses} classes</strong>
              </label>
              <input
                type="range"
                min="1"
                max="20"
                value={futureTotalClasses}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  setFutureTotalClasses(val);
                  if (futureClassesToAttend > val) setFutureClassesToAttend(val);
                }}
                style={{ width: "100%" }}
              />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "#64748b" }}>
                <span>1 class</span>
                <span>20 classes</span>
              </div>
            </div>

            <div style={{ background: "#f8fafc", padding: "18px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
              <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "#334155", marginBottom: "8px" }}>
                Classes You Will Attend: <strong>{futureClassesToAttend} / {futureTotalClasses} classes</strong>
              </label>
              <input
                type="range"
                min="0"
                max={futureTotalClasses}
                value={futureClassesToAttend}
                onChange={(e) => setFutureClassesToAttend(parseInt(e.target.value, 10))}
                style={{ width: "100%" }}
              />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "#64748b" }}>
                <span>0 attended</span>
                <span>{futureTotalClasses} attended (100%)</span>
              </div>
            </div>
          </div>

          {/* Simulation Outcome Card */}
          <div style={{
            background: isEligibleAfterPlan ? "#ecfdf5" : "#fff1f2",
            border: `1.5px solid ${isEligibleAfterPlan ? "#a7f3d0" : "#fecdd3"}`,
            borderRadius: "8px",
            padding: "20px"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px", flexWrap: "wrap", gap: "10px" }}>
              <div>
                <span style={{ fontSize: "12px", fontWeight: "700", textTransform: "uppercase", color: isEligibleAfterPlan ? "#047857" : "#991b1b" }}>
                  Projected Compliance Status
                </span>
                <div style={{ fontSize: "24px", fontWeight: "700", color: isEligibleAfterPlan ? "#065f46" : "#be123c", marginTop: "2px" }}>
                  {isEligibleAfterPlan ? "✅ EXAM ELIGIBLE (ABOVE 75%)" : "⚠️ NON-COMPLIANT (BELOW 75%)"}
                </div>
              </div>

              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: "12px", color: "#64748b" }}>Resulting Attendance</div>
                <div style={{ fontSize: "28px", fontWeight: "700", color: "#0f172a" }}>
                  {resultingPct}%
                </div>
                <div style={{ fontSize: "11px", color: "#64748b" }}>
                  ({totalAttendedAfter} / {totalHeldAfter} total classes)
                </div>
              </div>
            </div>

            <div style={{ fontSize: "13px", color: isEligibleAfterPlan ? "#065f46" : "#991b1b", borderTop: "1px solid rgba(0,0,0,0.08)", paddingTop: "12px", marginTop: "8px" }}>
              {isEligibleAfterPlan ? (
                <span>
                  🎉 Under this plan, your attendance will rise from <strong>{((currentAttended / currentHeld) * 100).toFixed(1)}%</strong> to <strong>{resultingPct}%</strong>. You will be fully cleared for the end-semester exams in {activePlanningCourse?.course_code}.
                </span>
              ) : (
                <span>
                  🚨 Even with this plan, your attendance will only reach <strong>{resultingPct}%</strong>. To regain the statutory 75.0% threshold, you must attend at least <strong>{neededConsecutiveToReach75} consecutive classes</strong> without absence.
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: IN-APP NOTIFICATIONS */}
      {activeTab === "notifications" && (
        <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "10px", overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid #e2e8f0", background: "#f8fafc", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2 style={{ fontSize: "15px", fontWeight: "700", color: "#0f172a", margin: 0 }}>
              Institutional Notifications
            </h2>
            <span style={{ fontSize: "12px", color: "#64748b" }}>
              {notifications.length} notices
            </span>
          </div>

          <div>
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

      {/* TAB 4: OFF-PORTAL DISPATCHED OUTBOX (USP 4) */}
      {activeTab === "outbox" && (
        <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "10px", overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid #e2e8f0", background: "#f8fafc", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h2 style={{ fontSize: "15px", fontWeight: "700", color: "#0f172a", margin: "0 0 2px 0" }}>
                Off-Portal Outbox Ledger (SMS & Email)
              </h2>
              <div style={{ fontSize: "12px", color: "#64748b" }}>
                External carrier dispatches delivered directly to student mobile and institutional email addresses.
              </div>
            </div>
            <span style={{ fontSize: "12px", fontWeight: "600", color: "#059669" }}>
              {outboxMessages.length} Dispatches Recorded
            </span>
          </div>

          {outboxLoading ? (
            <div style={{ padding: "40px", textAlign: "center", color: "#64748b" }}>
              Loading dispatched outbox log...
            </div>
          ) : outboxMessages.length > 0 ? (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                <thead>
                  <tr style={{ background: "#f1f5f9", borderBottom: "1px solid #e2e8f0", textAlign: "left" }}>
                    <th style={{ padding: "10px 14px", color: "#475569" }}>Channel</th>
                    <th style={{ padding: "10px 14px", color: "#475569" }}>Recipient Address</th>
                    <th style={{ padding: "10px 14px", color: "#475569" }}>Subject / Header</th>
                    <th style={{ padding: "10px 14px", color: "#475569" }}>Message Body</th>
                    <th style={{ padding: "10px 14px", color: "#475569" }}>Delivery Status</th>
                    <th style={{ padding: "10px 14px", color: "#475569" }}>Dispatched At</th>
                  </tr>
                </thead>
                <tbody>
                  {outboxMessages.map((m) => (
                    <tr key={m.outbox_id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td style={{ padding: "12px 14px" }}>
                        <span style={{ fontSize: "11px", fontWeight: "700", padding: "2px 6px", borderRadius: "4px", background: m.channel === "SMS" ? "#eff6ff" : "#f3e8ff", color: m.channel === "SMS" ? "#1d4ed8" : "#7e22ce", border: "1px solid rgba(0,0,0,0.1)" }}>
                          {m.channel}
                        </span>
                      </td>
                      <td style={{ padding: "12px 14px", color: "#0f172a", fontWeight: "600", fontSize: "12px" }}>
                        {m.channel === "SMS" ? m.recipient_phone : m.recipient_email}
                      </td>
                      <td style={{ padding: "12px 14px", color: "#0f172a", fontWeight: "600" }}>
                        {m.subject}
                      </td>
                      <td style={{ padding: "12px 14px", color: "#475569", fontSize: "12px", maxWidth: "340px", lineHeight: "1.4" }}>
                        {m.body}
                      </td>
                      <td style={{ padding: "12px 14px" }}>
                        <span style={{ fontSize: "11px", fontWeight: "700", color: "#065f46", background: "#ecfdf5", padding: "2px 6px", borderRadius: "4px", border: "1px solid #a7f3d0" }}>
                          {m.dispatch_status}
                        </span>
                      </td>
                      <td style={{ padding: "12px 14px", color: "#64748b", fontSize: "11px" }}>
                        {m.created_at ? new Date(m.created_at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ padding: "30px", textAlign: "center", color: "#64748b", fontSize: "13px" }}>
              No off-portal outbox alerts recorded for this student record.
            </div>
          )}
        </div>
      )}

    </div>
  );
}
