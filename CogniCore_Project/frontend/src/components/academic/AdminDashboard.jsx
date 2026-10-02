import React, { useState, useEffect } from "react";
import { ShieldBuildingIcon, DownloadIcon, CheckCircleIcon, AlertCircleIcon } from "./Icons.jsx";

export default function AdminDashboard() {
  const [heatmapData, setHeatmapData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [drilldownId, setDrilldownId] = useState("1");
  const [drilldownProfile, setDrilldownProfile] = useState(null);
  const [drillLoading, setDrillLoading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const res = await fetch("http://localhost:5000/api/academic/admin/heatmap");
        const data = await res.json();
        setHeatmapData(data);
      } catch (err) {
        console.error("Failed to load admin heatmap:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function handleDrilldown() {
    if (!drilldownId) return;
    try {
      setDrillLoading(true);
      const res = await fetch(`http://localhost:5000/api/academic/student/dashboard?studentId=${drilldownId}`);
      const data = await res.json();
      if (data.profile) {
        setDrilldownProfile(data.profile);
      } else {
        alert("Student record not found");
      }
    } catch (err) {
      alert("Error: " + err.message);
    } finally {
      setDrillLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "28px 20px", color: "#0f172a" }}>
      
      {/* Executive Header */}
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
        gap: "16px"
      }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
            <h1 style={{ fontSize: "20px", fontWeight: "700", color: "#0f172a", margin: 0 }}>
              Office of the Provost & University Registrar
            </h1>
            <span style={{ fontSize: "11px", fontWeight: "700", background: "#f3e8ff", color: "#6b21a8", padding: "3px 8px", borderRadius: "4px", border: "1px solid #d8b4fe" }}>
              INSTITUTIONAL GOVERNANCE
            </span>
          </div>
          <p style={{ fontSize: "13px", color: "#64748b", margin: 0 }}>
            Campus-wide academic metrics, multi-department risk distribution, and individual student audit drilldown.
          </p>
        </div>

        {/* CSV Export Button */}
        <button
          onClick={() => {
            if (!heatmapData?.departments) return;
            const csvRows = [
              ["Department Code", "Department Name", "Total Students", "Average CGPA", "Status"],
              ...heatmapData.departments.map((d) => [
                d.department_code,
                `"${d.department_name}"`,
                d.student_count,
                d.avg_cgpa,
                d.avg_cgpa >= 7.0 ? "OPTIMAL" : "ATTENTION"
              ])
            ];
            const blob = new Blob([csvRows.map((r) => r.join(",")).join("\n")], { type: "text/csv" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `academic_governance_report_${new Date().toISOString().slice(0, 10)}.csv`;
            a.click();
          }}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "9px 16px",
            borderRadius: "6px",
            background: "#0f2942",
            color: "#ffffff",
            fontSize: "13px",
            fontWeight: "600",
            border: "none",
            cursor: "pointer"
          }}
        >
          <DownloadIcon size={15} color="#ffffff" />
          Export Institutional CSV
        </button>
      </div>

      {/* KPI Cards */}
      {heatmapData?.summary && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px", marginBottom: "24px" }}>
          <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "18px", boxShadow: "0 1px 3px rgba(0,0,0,0.03)" }}>
            <div style={{ fontSize: "11px", color: "#64748b", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "4px" }}>
              Total Enrollment
            </div>
            <div style={{ fontSize: "26px", fontWeight: "800", color: "#0f2942" }}>
              {heatmapData.summary.total_students?.toLocaleString()}
            </div>
            <div style={{ fontSize: "12px", color: "#64748b" }}>Across 8 degree programs</div>
          </div>

          <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "18px", boxShadow: "0 1px 3px rgba(0,0,0,0.03)" }}>
            <div style={{ fontSize: "11px", color: "#64748b", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "4px" }}>
              Active Course Offerings
            </div>
            <div style={{ fontSize: "26px", fontWeight: "800", color: "#065f46" }}>
              {heatmapData.summary.total_courses}
            </div>
            <div style={{ fontSize: "12px", color: "#64748b" }}>Current Semester I</div>
          </div>

          <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "18px", boxShadow: "0 1px 3px rgba(0,0,0,0.03)" }}>
            <div style={{ fontSize: "11px", color: "#64748b", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "4px" }}>
              Appointed Faculty
            </div>
            <div style={{ fontSize: "26px", fontWeight: "800", color: "#1e3a8a" }}>
              {heatmapData.summary.total_faculty}
            </div>
            <div style={{ fontSize: "12px", color: "#64748b" }}>Instructors & lecturers</div>
          </div>

          <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "18px", boxShadow: "0 1px 3px rgba(0,0,0,0.03)" }}>
            <div style={{ fontSize: "11px", color: "#64748b", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "4px" }}>
              Academic Divisions
            </div>
            <div style={{ fontSize: "26px", fontWeight: "800", color: "#581c87" }}>
              {heatmapData.summary.total_departments}
            </div>
            <div style={{ fontSize: "12px", color: "#64748b" }}>Faculties & schools</div>
          </div>
        </div>
      )}

      {/* Department Heatmap Table */}
      <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "10px", overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.04)", marginBottom: "28px" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #e2e8f0", background: "#f8fafc" }}>
          <h2 style={{ fontSize: "14px", fontWeight: "700", color: "#0f172a", margin: "0 0 2px 0" }}>
            Departmental Academic & Attendance Distribution
          </h2>
          <div style={{ fontSize: "12px", color: "#64748b" }}>
            Aggregated institutional indicators across all schools for academic session 2025–26.
          </div>
        </div>

        {heatmapData?.departments && (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
              <thead>
                <tr style={{ background: "#f1f5f9", borderBottom: "1px solid #e2e8f0", textAlign: "left" }}>
                  <th style={{ padding: "10px 14px", color: "#475569" }}>Code</th>
                  <th style={{ padding: "10px 14px", color: "#475569" }}>Academic Department</th>
                  <th style={{ padding: "10px 14px", color: "#475569" }}>Student Enrollment</th>
                  <th style={{ padding: "10px 14px", color: "#475569" }}>Average CGPA</th>
                  <th style={{ padding: "10px 14px", color: "#475569" }}>Compliance Status</th>
                </tr>
              </thead>
              <tbody>
                {heatmapData.departments.map((dept) => {
                  const isOptimal = Number(dept.avg_cgpa) >= 7.0;
                  return (
                    <tr key={dept.department_id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td style={{ padding: "12px 14px", fontWeight: "700", color: "#0f172a" }}>
                        {dept.department_code}
                      </td>
                      <td style={{ padding: "12px 14px", color: "#0f172a" }}>
                        {dept.department_name}
                      </td>
                      <td style={{ padding: "12px 14px", color: "#475569" }}>
                        {dept.student_count} Students
                      </td>
                      <td style={{ padding: "12px 14px", fontWeight: "600", color: "#0f172a" }}>
                        {Number(dept.avg_cgpa).toFixed(2)}
                      </td>
                      <td style={{ padding: "12px 14px" }}>
                        {isOptimal ? (
                          <span style={{ fontSize: "11px", fontWeight: "700", color: "#065f46", background: "#ecfdf5", padding: "2px 6px", borderRadius: "4px", border: "1px solid #a7f3d0" }}>
                            OPTIMAL STANDING
                          </span>
                        ) : (
                          <span style={{ fontSize: "11px", fontWeight: "700", color: "#92400e", background: "#fffbeb", padding: "2px 6px", borderRadius: "4px", border: "1px solid #fde68a" }}>
                            ADVISORY MONITORING
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Student Audit Drilldown Section */}
      <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "10px", padding: "20px", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
        <h3 style={{ fontSize: "14px", fontWeight: "700", color: "#0f172a", margin: "0 0 4px 0" }}>
          Individual Student Record Audit
        </h3>
        <p style={{ fontSize: "12px", color: "#64748b", margin: "0 0 14px 0" }}>
          Inspect any student's statutory attendance ledger, internal assessments, and decomposition risk factors.
        </p>

        <div style={{ display: "flex", gap: "10px", marginBottom: "16px", maxWidth: "420px" }}>
          <input
            type="text"
            value={drilldownId}
            onChange={(e) => setDrilldownId(e.target.value)}
            placeholder="Enter Student ID (e.g. 1, 2, 19)"
            style={{ flex: 1, padding: "8px 12px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "13px" }}
          />
          <button
            onClick={handleDrilldown}
            disabled={drillLoading}
            style={{ padding: "8px 16px", borderRadius: "6px", background: "#0f2942", color: "#ffffff", fontSize: "13px", fontWeight: "600", border: "none", cursor: "pointer" }}
          >
            {drillLoading ? "Searching..." : "Inspect Record"}
          </button>
        </div>

        {drilldownProfile && (
          <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
              <div>
                <strong style={{ fontSize: "14px", color: "#0f172a" }}>
                  {drilldownProfile.student.first_name} {drilldownProfile.student.last_name}
                </strong>
                <span style={{ fontSize: "12px", color: "#64748b", marginLeft: "8px" }}>
                  (Reg: {drilldownProfile.student.register_number} • CGPA: {drilldownProfile.student.cgpa})
                </span>
              </div>
              <span style={{ fontSize: "11px", fontWeight: "700", color: "#065f46", background: "#ecfdf5", padding: "2px 6px", borderRadius: "4px", border: "1px solid #a7f3d0" }}>
                RECORD VERIFIED
              </span>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "10px" }}>
              {drilldownProfile.courses.map((c) => (
                <div key={c.course_id} style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "6px", padding: "10px 12px", fontSize: "12px" }}>
                  <div style={{ fontWeight: "700", color: "#0f172a", marginBottom: "2px" }}>{c.course_code}: {c.course_name}</div>
                  <div style={{ color: "#64748b" }}>Attendance: <strong>{c.attendance.currentPct}%</strong> ({c.attendance.alertLevel})</div>
                  <div style={{ color: "#64748b" }}>Absence Buffer: {c.attendance.missBuffer} classes</div>
                  <div style={{ color: "#64748b", marginTop: "4px" }}>Risk Level: <strong>{c.risk.riskLevel}</strong> ({c.risk.totalRiskScore}/100)</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
