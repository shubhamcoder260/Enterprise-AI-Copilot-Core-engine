import React, { useState, useEffect } from "react";

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
        alert("Student not found");
      }
    } catch (err) {
      alert("Error: " + err.message);
    } finally {
      setDrillLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: "1280px", margin: "0 auto", padding: "24px 20px" }}>
      {/* Header */}
      <div style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: "16px", padding: "24px", marginBottom: "24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "6px" }}>
          <h1 style={{ fontSize: "22px", fontWeight: "700", color: "#f8fafc", margin: 0 }}>
            🏛️ Institutional Academic Intelligence & Health Heatmap
          </h1>
          <span style={{ fontSize: "12px", background: "rgba(168, 85, 247, 0.2)", color: "#c084fc", padding: "4px 10px", borderRadius: "999px", fontWeight: "600" }}>
            Admin Console
          </span>
        </div>
        <p style={{ fontSize: "13px", color: "#94a3b8", margin: 0 }}>
          Campus-wide academic indicators, department-level risk distributions, and individual student drilldown.
        </p>
      </div>

      {/* Summary KPI Cards */}
      {heatmapData?.summary && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px", marginBottom: "24px" }}>
          <div style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: "12px", padding: "20px" }}>
            <div style={{ fontSize: "12px", color: "#94a3b8", fontWeight: "600", marginBottom: "4px" }}>TOTAL STUDENTS</div>
            <div style={{ fontSize: "28px", fontWeight: "800", color: "#38bdf8" }}>{heatmapData.summary.total_students?.toLocaleString()}</div>
            <div style={{ fontSize: "11px", color: "#64748b" }}>Across 8 degree programs</div>
          </div>
          <div style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: "12px", padding: "20px" }}>
            <div style={{ fontSize: "12px", color: "#94a3b8", fontWeight: "600", marginBottom: "4px" }}>ACTIVE COURSES</div>
            <div style={{ fontSize: "28px", fontWeight: "800", color: "#34d399" }}>{heatmapData.summary.total_courses}</div>
            <div style={{ fontSize: "11px", color: "#64748b" }}>Current Academic Year</div>
          </div>
          <div style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: "12px", padding: "20px" }}>
            <div style={{ fontSize: "12px", color: "#94a3b8", fontWeight: "600", marginBottom: "4px" }}>FACULTY MEMBERS</div>
            <div style={{ fontSize: "28px", fontWeight: "800", color: "#fbbf24" }}>{heatmapData.summary.total_faculty}</div>
            <div style={{ fontSize: "11px", color: "#64748b" }}>Teaching faculty & staff</div>
          </div>
          <div style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: "12px", padding: "20px" }}>
            <div style={{ fontSize: "12px", color: "#94a3b8", fontWeight: "600", marginBottom: "4px" }}>DEPARTMENTS</div>
            <div style={{ fontSize: "28px", fontWeight: "800", color: "#a855f7" }}>{heatmapData.summary.total_departments}</div>
            <div style={{ fontSize: "11px", color: "#64748b" }}>Academic divisions</div>
          </div>
        </div>
      )}

      {/* Department Academic Heatmap Table */}
      <div style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: "16px", padding: "24px", marginBottom: "28px" }}>
        <h2 style={{ fontSize: "18px", fontWeight: "700", color: "#f8fafc", margin: "0 0 16px 0" }}>
          Department Academic & Attendance Distribution
        </h2>
        {heatmapData?.departments && (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", color: "#cbd5e1" }}>
              <thead>
                <tr style={{ background: "#0f172a", borderBottom: "1px solid #334155", textAlign: "left" }}>
                  <th style={{ padding: "12px 14px" }}>Dept Code</th>
                  <th style={{ padding: "12px 14px" }}>Department Name</th>
                  <th style={{ padding: "12px 14px" }}>Student Enrollment</th>
                  <th style={{ padding: "12px 14px" }}>Average CGPA</th>
                  <th style={{ padding: "12px 14px" }}>Health Status</th>
                </tr>
              </thead>
              <tbody>
                {heatmapData.departments.map((d) => (
                  <tr key={d.department_id} style={{ borderBottom: "1px solid #334155" }}>
                    <td style={{ padding: "12px 14px", fontWeight: "700", color: "#38bdf8" }}>{d.department_code}</td>
                    <td style={{ padding: "12px 14px", color: "#f8fafc" }}>{d.department_name}</td>
                    <td style={{ padding: "12px 14px" }}>{d.student_count} students</td>
                    <td style={{ padding: "12px 14px", fontWeight: "600" }}>{d.avg_cgpa} / 10.0</td>
                    <td style={{ padding: "12px 14px" }}>
                      <span style={{ fontSize: "11px", fontWeight: "700", padding: "3px 10px", borderRadius: "999px", background: "rgba(16, 185, 129, 0.15)", color: "#10b981", border: "1px solid rgba(16, 185, 129, 0.3)" }}>
                        Healthy (91% Eligible)
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Student Deep Drill-Down Inspector */}
      <div style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: "16px", padding: "24px" }}>
        <h2 style={{ fontSize: "18px", fontWeight: "700", color: "#f8fafc", margin: "0 0 6px 0" }}>
          Single-Student Academic Drill-Down Inspector (R7)
        </h2>
        <p style={{ fontSize: "13px", color: "#94a3b8", margin: "0 0 16px 0" }}>
          Inspect the full attendance trajectory, multi-factor risk scores, and internal marks for any student across the university.
        </p>

        <div style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
          <input
            type="number"
            value={drilldownId}
            onChange={(e) => setDrilldownId(e.target.value)}
            placeholder="Student ID (e.g. 1)"
            style={{ width: "160px", background: "#0f172a", border: "1px solid #334155", borderRadius: "8px", padding: "8px 12px", color: "#f8fafc", fontSize: "14px" }}
          />
          <button
            onClick={handleDrilldown}
            disabled={drillLoading}
            style={{ padding: "8px 18px", borderRadius: "8px", background: "#7c3aed", color: "#fff", fontWeight: "700", fontSize: "13px", border: "none", cursor: "pointer" }}
          >
            {drillLoading ? "Loading..." : "🔎 Inspect Academic File"}
          </button>
        </div>

        {drilldownProfile && (
          <div style={{ background: "#0f172a", border: "1px solid #334155", borderRadius: "12px", padding: "20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <div>
                <h3 style={{ fontSize: "16px", fontWeight: "700", color: "#f8fafc", margin: "0 0 4px 0" }}>
                  {drilldownProfile.student.first_name} {drilldownProfile.student.last_name}
                </h3>
                <div style={{ fontSize: "12px", color: "#94a3b8" }}>
                  Roll: {drilldownProfile.student.register_number} • {drilldownProfile.student.program_name} • CGPA: {drilldownProfile.student.cgpa}
                </div>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "12px" }}>
              {drilldownProfile.courses.map((c) => (
                <div key={c.course_id} style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: "8px", padding: "12px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                    <strong style={{ color: "#f8fafc", fontSize: "13px" }}>{c.course_code}</strong>
                    <span style={{ fontSize: "11px", fontWeight: "700", color: c.attendance.alertLevel === "SAFE" ? "#10b981" : "#f59e0b" }}>
                      {c.attendance.currentPct}% ({c.attendance.alertLevel})
                    </span>
                  </div>
                  <div style={{ fontSize: "11px", color: "#94a3b8", marginBottom: "4px" }}>
                    Buffer: {c.attendance.missBuffer} class(es) • Risk: {c.risk.riskLevel}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
