import React, { useState, useEffect } from "react";

export default function FacultyConsole({ facultyUser, onLogout }) {
  const [courses, setCourses] = useState([]);
  const [selectedOffering, setSelectedOffering] = useState(null);
  const [roster, setRoster] = useState([]);
  const [atRiskList, setAtRiskList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("voice"); // 'voice', 'roster', 'at-risk'

  // Voice entry states
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [assessmentName, setAssessmentName] = useState("Internal 1");
  const [maxMarks, setMaxMarks] = useState(50);
  const [parsedBatch, setParsedBatch] = useState(null);
  const [commitStatus, setCommitStatus] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Load faculty courses on mount
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const res = await fetch("http://localhost:5000/api/academic/faculty/courses?facultyId=" + (facultyUser?.id || 150));
        const data = await res.json();
        if (data.courses && data.courses.length > 0) {
          setCourses(data.courses);
          setSelectedOffering(data.courses[0]);
        }
      } catch (err) {
        console.error("Failed to load courses:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, [facultyUser]);

  // Load roster and at-risk when course changes
  useEffect(() => {
    if (!selectedOffering) return;
    (async () => {
      try {
        const offId = selectedOffering.offering_id;
        const [rosRes, riskRes] = await Promise.all([
          fetch(`http://localhost:5000/api/academic/faculty/course/${offId}/roster?assessmentName=${encodeURIComponent(assessmentName)}`),
          fetch(`http://localhost:5000/api/academic/faculty/course/${offId}/at-risk`)
        ]);
        const rosData = await rosRes.json();
        const riskData = await riskRes.json();
        if (rosData.roster) setRoster(rosData.roster);
        if (riskData.students) setAtRiskList(riskData.students);
      } catch (err) {
        console.error("Failed to load course details:", err);
      }
    })();
  }, [selectedOffering, assessmentName]);

  // Web Speech API Voice Recognition
  function toggleSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Web Speech API is not supported in this browser. Please use the typed text fallback.");
      return;
    }

    if (isRecording) {
      setIsRecording(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = "en-US";

      recognition.onstart = () => setIsRecording(true);
      recognition.onend = () => setIsRecording(false);
      recognition.onerror = (e) => {
        console.error("Speech recognition error:", e);
        setIsRecording(false);
      };

      recognition.onresult = (event) => {
        const current = event.resultIndex;
        const text = event.results[current][0].transcript;
        setTranscript((prev) => (prev ? prev + "; " + text : text));
      };

      recognition.start();
    } catch (err) {
      console.error(err);
      setIsRecording(false);
    }
  }

  // Parse Voice Marks Endpoint
  async function handleParseMarks() {
    if (!transcript.trim() || !selectedOffering) return;
    try {
      setLoading(true);
      setCommitStatus(null);
      const res = await fetch("http://localhost:5000/api/academic/faculty/parse-voice-marks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          offeringId: selectedOffering.offering_id,
          transcript,
          defaultMaxMarks: maxMarks,
          assessmentName
        })
      });
      const data = await res.json();
      if (data.batch) {
        setParsedBatch(data.batch);
      }
    } catch (err) {
      console.error(err);
      alert("Failed to parse speech transcript: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  // Ambiguity manual selection handler
  function handleSelectAmbiguousCandidate(entryIndex, candidate) {
    if (!parsedBatch) return;
    const updatedEntries = [...parsedBatch.entries];
    updatedEntries[entryIndex].matchedStudent = candidate;
    updatedEntries[entryIndex].isAmbiguous = false;
    updatedEntries[entryIndex].requiresReview = updatedEntries[entryIndex].hasRangeError || updatedEntries[entryIndex].isOverwrite;
    setParsedBatch({ ...parsedBatch, entries: updatedEntries });
  }

  // Mark edit handler inside review table
  function handleEditMarkValue(entryIndex, val) {
    if (!parsedBatch) return;
    const num = parseFloat(val);
    const updatedEntries = [...parsedBatch.entries];
    updatedEntries[entryIndex].obtainedMarks = isNaN(num) ? "" : num;
    updatedEntries[entryIndex].hasRangeError = num > updatedEntries[entryIndex].maxMarks || num < 0;
    setParsedBatch({ ...parsedBatch, entries: updatedEntries });
  }

  // Confirm and Submit Verified Marks
  async function handleCommitMarks() {
    if (!parsedBatch || !selectedOffering) return;
    try {
      setSubmitting(true);
      const payloadEntries = parsedBatch.entries
        .filter((e) => e.matchedStudent && !e.hasRangeError && !e.isAmbiguous)
        .map((e) => ({
          enrollmentId: e.matchedStudent.enrollment_id,
          assessmentName,
          obtainedMarks: e.obtainedMarks,
          maxMarks: e.maxMarks
        }));

      if (payloadEntries.length === 0) {
        alert("No valid entries ready to submit. Please resolve ambiguity and range errors first.");
        setSubmitting(false);
        return;
      }

      const res = await fetch("http://localhost:5000/api/academic/faculty/submit-marks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          facultyName: facultyUser?.name || "Prof. Harish Menon",
          assessmentName,
          entries: payloadEntries
        })
      });
      const data = await res.json();
      if (data.success) {
        setCommitStatus({
          type: "success",
          message: `Successfully committed ${data.savedCount} mark(s) and dispatched instant in-app notifications to students!`
        });
        setParsedBatch(null);
        setTranscript("");
      }
    } catch (err) {
      setCommitStatus({ type: "error", message: err.message });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ maxWidth: "1280px", margin: "0 auto", padding: "24px 20px" }}>
      {/* Faculty Console Header Bar */}
      <div style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: "16px", padding: "24px", marginBottom: "24px", display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "16px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "6px" }}>
            <h1 style={{ fontSize: "22px", fontWeight: "700", color: "#f8fafc", margin: 0 }}>
              {facultyUser?.name || "Prof. Harish Menon"}
            </h1>
            <span style={{ fontSize: "12px", background: "rgba(5, 150, 105, 0.2)", color: "#34d399", padding: "4px 10px", borderRadius: "999px", fontWeight: "600" }}>
              Faculty Portal
            </span>
          </div>
          <div style={{ fontSize: "13px", color: "#94a3b8" }}>
            Department of Information Technology • {courses.length} Assigned Course Offerings
          </div>
        </div>

        {/* Course Selector Dropdown */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <label style={{ fontSize: "13px", color: "#cbd5e1", fontWeight: "600" }}>Course Offering:</label>
          <select
            value={selectedOffering?.offering_id || ""}
            onChange={(e) => {
              const off = courses.find((c) => String(c.offering_id) === e.target.value);
              setSelectedOffering(off);
              setParsedBatch(null);
            }}
            style={{ background: "#0f172a", color: "#f8fafc", border: "1px solid #334155", borderRadius: "8px", padding: "8px 14px", fontSize: "13px", fontWeight: "600" }}
          >
            {courses.map((c) => (
              <option key={c.offering_id} value={c.offering_id}>
                {c.course_code} - {c.course_name} (Section {c.section}, {c.enrolled_count} Students)
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div style={{ display: "flex", gap: "12px", marginBottom: "20px" }}>
        <button
          onClick={() => setActiveTab("voice")}
          style={{
            padding: "10px 20px",
            borderRadius: "10px",
            fontSize: "14px",
            fontWeight: "600",
            border: "none",
            cursor: "pointer",
            background: activeTab === "voice" ? "#2563eb" : "#1e293b",
            color: "#fff"
          }}
        >
          🎙️ Voice Mark Entry (R4)
        </button>
        <button
          onClick={() => setActiveTab("at-risk")}
          style={{
            padding: "10px 20px",
            borderRadius: "10px",
            fontSize: "14px",
            fontWeight: "600",
            border: "none",
            cursor: "pointer",
            background: activeTab === "at-risk" ? "#2563eb" : "#1e293b",
            color: "#fff"
          }}
        >
          🚨 At-Risk Students ({atRiskList.length})
        </button>
        <button
          onClick={() => setActiveTab("roster")}
          style={{
            padding: "10px 20px",
            borderRadius: "10px",
            fontSize: "14px",
            fontWeight: "600",
            border: "none",
            cursor: "pointer",
            background: activeTab === "roster" ? "#2563eb" : "#1e293b",
            color: "#fff"
          }}
        >
          👥 Enrolled Roster ({roster.length})
        </button>
      </div>

      {/* TAB 1: Voice Mark Entry Console (Killer Feature R4) */}
      {activeTab === "voice" && (
        <div style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: "16px", padding: "24px" }}>
          <div style={{ marginBottom: "20px" }}>
            <h2 style={{ fontSize: "18px", fontWeight: "700", color: "#f8fafc", margin: "0 0 6px 0" }}>
              AI Audio-Assisted Mark Entry Console (R4)
            </h2>
            <p style={{ fontSize: "13px", color: "#94a3b8", margin: 0 }}>
              Speak or type student marks in natural batches. The engine matches students by roll number or fuzzy name, prompts for ambiguity, and alerts on range errors.
            </p>
          </div>

          {/* Assessment & Max Mark Configuration */}
          <div style={{ display: "flex", gap: "16px", marginBottom: "20px", flexWrap: "wrap" }}>
            <div>
              <label style={{ display: "block", fontSize: "12px", color: "#94a3b8", marginBottom: "4px" }}>Assessment:</label>
              <select
                value={assessmentName}
                onChange={(e) => setAssessmentName(e.target.value)}
                style={{ background: "#0f172a", color: "#f8fafc", border: "1px solid #334155", borderRadius: "8px", padding: "8px 12px", fontSize: "13px" }}
              >
                <option value="Internal 1">Internal 1</option>
                <option value="Internal 2">Internal 2</option>
                <option value="Midterm Exam">Midterm Exam</option>
                <option value="Assignment 1">Assignment 1</option>
              </select>
            </div>
            <div>
              <label style={{ display: "block", fontSize: "12px", color: "#94a3b8", marginBottom: "4px" }}>Maximum Marks:</label>
              <input
                type="number"
                value={maxMarks}
                onChange={(e) => setMaxMarks(Number(e.target.value))}
                style={{ background: "#0f172a", color: "#f8fafc", border: "1px solid #334155", borderRadius: "8px", padding: "8px 12px", fontSize: "13px", width: "100px" }}
              />
            </div>
          </div>

          {/* Speech Control & Transcript Box */}
          <div style={{ marginBottom: "20px" }}>
            <div style={{ display: "flex", gap: "12px", alignItems: "center", marginBottom: "10px" }}>
              <button
                onClick={toggleSpeechRecognition}
                style={{
                  padding: "10px 18px",
                  borderRadius: "10px",
                  fontSize: "13px",
                  fontWeight: "700",
                  border: "none",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  background: isRecording ? "#ef4444" : "#2563eb",
                  color: "#fff"
                }}
              >
                {isRecording ? "⏹️ Stop Recording" : "🎙️ Click & Dictate Marks"}
              </button>
              {isRecording && (
                <span style={{ fontSize: "13px", color: "#ef4444", fontWeight: "600", display: "flex", alignItems: "center", gap: "6px" }}>
                  <span style={{ width: "8px", height: "8px", background: "#ef4444", borderRadius: "50%" }}></span>
                  Listening to microphone...
                </span>
              )}
            </div>

            <textarea
              rows={3}
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              placeholder='Spoken or typed speech transcript, e.g.: "roll forty-five, forty-two out of fifty; Vivek Reddy, 38; Sneha, fifty-five out of fifty"'
              style={{ width: "100%", background: "#0f172a", border: "1px solid #334155", borderRadius: "10px", padding: "12px", color: "#f8fafc", fontSize: "14px", boxSizing: "border-box" }}
            />

            {/* Quick Demo Voice Sample Buttons */}
            <div style={{ marginTop: "8px", display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
              <span style={{ fontSize: "12px", color: "#64748b" }}>Quick Pitch Samples:</span>
              <button
                onClick={() => setTranscript("roll forty-five, forty-two out of fifty; Vivek Reddy, 38; Sneha, fifty-five out of fifty")}
                style={{ background: "#334155", border: "none", color: "#93c5fd", padding: "4px 10px", borderRadius: "6px", fontSize: "11px", cursor: "pointer" }}
              >
                Sample 1 (Roll 45, Vivek 38, Sneha 55 out-of-range)
              </button>
              <button
                onClick={() => setTranscript("Sneha, forty-two; Nisha Das, thirty-five out of fifty")}
                style={{ background: "#334155", border: "none", color: "#93c5fd", padding: "4px 10px", borderRadius: "6px", fontSize: "11px", cursor: "pointer" }}
              >
                Sample 2 (Sneha Ambiguity Trigger)
              </button>
            </div>
          </div>

          {/* Parse Button */}
          <div style={{ marginBottom: "24px" }}>
            <button
              onClick={handleParseMarks}
              disabled={loading || !transcript.trim()}
              style={{ padding: "12px 24px", borderRadius: "10px", background: "#059669", color: "#fff", fontWeight: "700", fontSize: "14px", border: "none", cursor: "pointer" }}
            >
              {loading ? "Parsing Voice Input..." : "⚡ Parse & Match Against Roster"}
            </button>
          </div>

          {/* Commit Status Alert Banner */}
          {commitStatus && (
            <div style={{ background: commitStatus.type === "success" ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)", border: `1px solid ${commitStatus.type === "success" ? "rgba(16, 185, 129, 0.3)" : "rgba(239, 68, 68, 0.3)"}`, borderRadius: "10px", padding: "14px 18px", marginBottom: "20px", color: commitStatus.type === "success" ? "#34d399" : "#f87171", fontSize: "14px", fontWeight: "600" }}>
              {commitStatus.message}
            </div>
          )}

          {/* Confirmation & Ambiguity Resolution Table */}
          {parsedBatch && (
            <div style={{ borderTop: "1px solid #334155", paddingTop: "20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                <div>
                  <h3 style={{ fontSize: "16px", fontWeight: "700", color: "#f8fafc", margin: "0 0 4px 0" }}>
                    Review & Confirmation Table ({parsedBatch.totalEntries} entries)
                  </h3>
                  <div style={{ fontSize: "12px", color: "#94a3b8" }}>
                    {parsedBatch.needsAttention > 0 && (
                      <span style={{ color: "#f59e0b", fontWeight: "600" }}>
                        ⚠️ {parsedBatch.needsAttention} item(s) require review (ambiguity, overwrite, or range warning).
                      </span>
                    )}
                  </div>
                </div>

                <button
                  onClick={handleCommitMarks}
                  disabled={submitting}
                  style={{ padding: "10px 20px", borderRadius: "8px", background: "#2563eb", color: "#fff", fontWeight: "700", fontSize: "13px", border: "none", cursor: "pointer" }}
                >
                  {submitting ? "Saving & Notifying..." : "✅ Confirm & Submit Marks to Database"}
                </button>
              </div>

              {/* Table */}
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", color: "#cbd5e1" }}>
                  <thead>
                    <tr style={{ background: "#0f172a", borderBottom: "1px solid #334155", textAlign: "left" }}>
                      <th style={{ padding: "10px" }}>Spoken Clause</th>
                      <th style={{ padding: "10px" }}>Matched Student</th>
                      <th style={{ padding: "10px" }}>Match Method</th>
                      <th style={{ padding: "10px" }}>Mark / Max</th>
                      <th style={{ padding: "10px" }}>Safety Warnings</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedBatch.entries.map((entry, idx) => (
                      <tr key={idx} style={{ borderBottom: "1px solid #334155" }}>
                        <td style={{ padding: "10px", color: "#94a3b8", fontStyle: "italic" }}>
                          "{entry.originalClause}"
                        </td>

                        {/* Matched Student Column with Ambiguity Selector */}
                        <td style={{ padding: "10px" }}>
                          {entry.isAmbiguous ? (
                            <div>
                              <div style={{ color: "#f59e0b", fontWeight: "700", marginBottom: "4px" }}>
                                ⚠️ Ambiguous Match — Select Student:
                              </div>
                              <select
                                onChange={(e) => {
                                  const cand = entry.ambiguousCandidates.find((c) => String(c.student_id) === e.target.value);
                                  if (cand) handleSelectAmbiguousCandidate(idx, cand);
                                }}
                                style={{ background: "#0f172a", color: "#f8fafc", border: "1px solid #f59e0b", borderRadius: "6px", padding: "6px 10px", fontSize: "12px" }}
                              >
                                <option value="">-- Choose Candidate --</option>
                                {entry.ambiguousCandidates.map((cand) => (
                                  <option key={cand.student_id} value={cand.student_id}>
                                    {cand.first_name} {cand.last_name} (Roll: {cand.register_number})
                                  </option>
                                ))}
                              </select>
                            </div>
                          ) : entry.matchedStudent ? (
                            <div>
                              <strong style={{ color: "#f8fafc" }}>
                                {entry.matchedStudent.first_name} {entry.matchedStudent.last_name}
                              </strong>
                              <div style={{ fontSize: "11px", color: "#64748b" }}>
                                Roll: {entry.matchedStudent.register_number}
                              </div>
                            </div>
                          ) : (
                            <span style={{ color: "#ef4444" }}>No match found</span>
                          )}
                        </td>

                        {/* Match Type Badge */}
                        <td style={{ padding: "10px" }}>
                          <span style={{ fontSize: "11px", background: "rgba(59, 130, 246, 0.15)", color: "#60a5fa", padding: "2px 8px", borderRadius: "4px" }}>
                            {entry.matchType}
                          </span>
                        </td>

                        {/* Editable Mark Column */}
                        <td style={{ padding: "10px" }}>
                          <input
                            type="number"
                            value={entry.obtainedMarks}
                            onChange={(e) => handleEditMarkValue(idx, e.target.value)}
                            style={{
                              width: "60px",
                              background: entry.hasRangeError ? "rgba(239, 68, 68, 0.2)" : "#0f172a",
                              border: `1px solid ${entry.hasRangeError ? "#ef4444" : "#334155"}`,
                              color: "#f8fafc",
                              padding: "4px 8px",
                              borderRadius: "6px",
                              fontWeight: "700"
                            }}
                          />
                          <span style={{ color: "#94a3b8" }}> / {entry.maxMarks}</span>
                        </td>

                        {/* Warnings */}
                        <td style={{ padding: "10px" }}>
                          {entry.hasRangeError && (
                            <span style={{ display: "inline-block", fontSize: "11px", background: "rgba(239, 68, 68, 0.2)", color: "#ef4444", padding: "2px 8px", borderRadius: "4px", marginRight: "6px" }}>
                              {entry.rangeErrorMsg}
                            </span>
                          )}
                          {entry.isOverwrite && (
                            <span style={{ display: "inline-block", fontSize: "11px", background: "rgba(245, 158, 11, 0.2)", color: "#f59e0b", padding: "2px 8px", borderRadius: "4px" }}>
                              Overwrite (Prev: {entry.previousMark})
                            </span>
                          )}
                          {!entry.hasRangeError && !entry.isOverwrite && !entry.isAmbiguous && (
                            <span style={{ fontSize: "11px", color: "#10b981" }}>Ready to save</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: At-Risk Students List (R5, R6) */}
      {activeTab === "at-risk" && (
        <div style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: "16px", padding: "24px" }}>
          <h2 style={{ fontSize: "18px", fontWeight: "700", color: "#f8fafc", margin: "0 0 16px 0" }}>
            At-Risk Students in {selectedOffering?.course_code} (35/30/20/15 Formula)
          </h2>
          {atRiskList.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px", color: "#64748b" }}>
              🎉 No at-risk students identified in this course! All students meeting academic thresholds.
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", color: "#cbd5e1" }}>
                <thead>
                  <tr style={{ background: "#0f172a", borderBottom: "1px solid #334155", textAlign: "left" }}>
                    <th style={{ padding: "10px" }}>Roll Number</th>
                    <th style={{ padding: "10px" }}>Student Name</th>
                    <th style={{ padding: "10px" }}>Attendance</th>
                    <th style={{ padding: "10px" }}>Risk Level & Score</th>
                    <th style={{ padding: "10px" }}>Top Driver Reasons</th>
                  </tr>
                </thead>
                <tbody>
                  {atRiskList.map((st) => (
                    <tr key={st.studentId} style={{ borderBottom: "1px solid #334155" }}>
                      <td style={{ padding: "10px", color: "#94a3b8" }}>{st.registerNumber}</td>
                      <td style={{ padding: "10px", fontWeight: "700", color: "#f8fafc" }}>{st.name}</td>
                      <td style={{ padding: "10px" }}>
                        <span style={{ fontWeight: "700", color: st.attendance.alertLevel === "SAFE" ? "#10b981" : "#ef4444" }}>
                          {st.attendance.currentPct}% ({st.attendance.alertLevel})
                        </span>
                      </td>
                      <td style={{ padding: "10px" }}>
                        <span style={{ fontSize: "11px", fontWeight: "700", padding: "3px 8px", borderRadius: "6px", background: st.risk.riskLevel === "HIGH" ? "rgba(239, 68, 68, 0.2)" : "rgba(245, 158, 11, 0.2)", color: st.risk.riskLevel === "HIGH" ? "#ef4444" : "#f59e0b" }}>
                          {st.risk.riskLevel} ({st.risk.totalRiskScore}/100)
                        </span>
                      </td>
                      <td style={{ padding: "10px", fontSize: "12px", color: "#94a3b8" }}>
                        {st.risk.reasons.join("; ")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: Enrolled Roster */}
      {activeTab === "roster" && (
        <div style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: "16px", padding: "24px" }}>
          <h2 style={{ fontSize: "18px", fontWeight: "700", color: "#f8fafc", margin: "0 0 16px 0" }}>
            Enrolled Students in {selectedOffering?.course_code} ({roster.length} Total)
          </h2>
          <div style={{ overflowX: "auto", maxHeight: "500px" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", color: "#cbd5e1" }}>
              <thead>
                <tr style={{ background: "#0f172a", borderBottom: "1px solid #334155", textAlign: "left", position: "sticky", top: 0 }}>
                  <th style={{ padding: "10px" }}>Roll Number</th>
                  <th style={{ padding: "10px" }}>Student Name</th>
                  <th style={{ padding: "10px" }}>Email</th>
                  <th style={{ padding: "10px" }}>Current Mark ({assessmentName})</th>
                </tr>
              </thead>
              <tbody>
                {roster.map((s) => (
                  <tr key={s.student_id} style={{ borderBottom: "1px solid #334155" }}>
                    <td style={{ padding: "8px 10px", color: "#94a3b8" }}>{s.register_number}</td>
                    <td style={{ padding: "8px 10px", fontWeight: "600", color: "#f8fafc" }}>{s.first_name} {s.last_name}</td>
                    <td style={{ padding: "8px 10px", color: "#64748b" }}>{s.email}</td>
                    <td style={{ padding: "8px 10px", fontWeight: "700" }}>
                      {s.current_mark !== null && s.current_mark !== undefined ? (
                        <span style={{ color: "#34d399" }}>{s.current_mark} / {s.max_marks || 50}</span>
                      ) : (
                        <span style={{ color: "#64748b", fontStyle: "italic" }}>Not Entered</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
