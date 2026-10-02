import React, { useState, useEffect } from "react";
import { MicIcon, UserCheckIcon, AlertCircleIcon, CheckCircleIcon, BookOpenIcon, ChevronDownIcon } from "./Icons.jsx";

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
        const res = await fetch("http://localhost:5000/api/academic/faculty/courses?facultyId=" + (facultyUser?.id || 1));
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
        alert("No valid entries ready to submit. Please resolve ambiguous or out-of-range rows.");
        return;
      }

      const res = await fetch("http://localhost:5000/api/academic/faculty/submit-marks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entries: payloadEntries,
          facultyName: facultyUser?.name || "Prof. Karthik Menon",
          assessmentName
        })
      });

      const data = await res.json();
      if (data.success) {
        setCommitStatus({
          count: data.savedCount,
          message: `Successfully verified and committed ${data.savedCount} marks to the institutional ledger. Student notifications dispatched.`
        });
        setTranscript("");
        setParsedBatch(null);

        // Refresh roster
        const rosRes = await fetch(`http://localhost:5000/api/academic/faculty/course/${selectedOffering.offering_id}/roster?assessmentName=${encodeURIComponent(assessmentName)}`);
        const rosData = await rosRes.json();
        if (rosData.roster) setRoster(rosData.roster);
      }
    } catch (err) {
      console.error(err);
      alert("Failed to submit marks: " + err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "28px 20px", color: "#0f172a" }}>
      
      {/* Faculty Console Identity Bar */}
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
            <h1 style={{ fontSize: "20px", fontWeight: "700", color: "#0f172a", margin: 0 }}>
              {facultyUser?.name || "Prof. Karthik Menon"}
            </h1>
            <span style={{ fontSize: "12px", background: "#f1f5f9", color: "#334155", padding: "3px 8px", borderRadius: "4px", fontWeight: "600", border: "1px solid #e2e8f0" }}>
              NetID: {facultyUser?.employeeNumber || "FAC0001"}
            </span>
            <span style={{ fontSize: "12px", background: "#ecfdf5", color: "#065f46", padding: "3px 8px", borderRadius: "4px", fontWeight: "600", border: "1px solid #a7f3d0" }}>
              Faculty of Engineering & Technology
            </span>
          </div>
          <div style={{ fontSize: "13px", color: "#64748b" }}>
            Official Course Gradebook & Statutory Academic Monitoring System
          </div>
        </div>

        {/* Course & Assessment Selectors */}
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <div>
            <label style={{ display: "block", fontSize: "11px", fontWeight: "700", color: "#64748b", textTransform: "uppercase", marginBottom: "3px" }}>
              Course Offering
            </label>
            <select
              value={selectedOffering?.offering_id || ""}
              onChange={(e) => {
                const found = courses.find((c) => String(c.offering_id) === e.target.value);
                if (found) setSelectedOffering(found);
              }}
              style={{
                padding: "8px 12px",
                borderRadius: "6px",
                border: "1px solid #cbd5e1",
                background: "#ffffff",
                color: "#0f172a",
                fontSize: "13px",
                fontWeight: "600",
                outline: "none"
              }}
            >
              {courses.map((c) => (
                <option key={c.offering_id} value={c.offering_id}>
                  {c.course_code}: {c.course_name} (Sec {c.section})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: "block", fontSize: "11px", fontWeight: "700", color: "#64748b", textTransform: "uppercase", marginBottom: "3px" }}>
              Assessment Component
            </label>
            <select
              value={assessmentName}
              onChange={(e) => setAssessmentName(e.target.value)}
              style={{
                padding: "8px 12px",
                borderRadius: "6px",
                border: "1px solid #cbd5e1",
                background: "#ffffff",
                color: "#0f172a",
                fontSize: "13px",
                fontWeight: "600",
                outline: "none"
              }}
            >
              <option value="Internal 1">Internal Assessment 1 (50 Marks)</option>
              <option value="Internal 2">Internal Assessment 2 (50 Marks)</option>
              <option value="Assignment 1">Lab Assignment 1 (25 Marks)</option>
              <option value="Assignment 2">Lab Assignment 2 (25 Marks)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", borderBottom: "1px solid #e2e8f0", marginBottom: "24px" }}>
        <button
          onClick={() => setActiveTab("voice")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "12px 18px",
            border: "none",
            borderBottom: activeTab === "voice" ? "2px solid #0f2942" : "2px solid transparent",
            background: "transparent",
            color: activeTab === "voice" ? "#0f2942" : "#64748b",
            fontSize: "13px",
            fontWeight: "700",
            cursor: "pointer"
          }}
        >
          <MicIcon size={16} color={activeTab === "voice" ? "#0f2942" : "#64748b"} />
          Speech-Assisted Mark Dictation
        </button>
        <button
          onClick={() => setActiveTab("roster")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "12px 18px",
            border: "none",
            borderBottom: activeTab === "roster" ? "2px solid #0f2942" : "2px solid transparent",
            background: "transparent",
            color: activeTab === "roster" ? "#0f2942" : "#64748b",
            fontSize: "13px",
            fontWeight: "700",
            cursor: "pointer"
          }}
        >
          <BookOpenIcon size={16} color={activeTab === "roster" ? "#0f2942" : "#64748b"} />
          Course Roster & Gradebook ({roster.length} Students)
        </button>
        <button
          onClick={() => setActiveTab("at-risk")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "12px 18px",
            border: "none",
            borderBottom: activeTab === "at-risk" ? "2px solid #0f2942" : "2px solid transparent",
            background: "transparent",
            color: activeTab === "at-risk" ? "#0f2942" : "#64748b",
            fontSize: "13px",
            fontWeight: "700",
            cursor: "pointer"
          }}
        >
          <AlertCircleIcon size={16} color={activeTab === "at-risk" ? "#0f2942" : "#64748b"} />
          Statutory Intervention Required ({atRiskList.length})
        </button>
      </div>

      {/* Success Notification Alert */}
      {commitStatus && (
        <div style={{ background: "#ecfdf5", border: "1px solid #a7f3d0", borderRadius: "8px", padding: "14px 18px", marginBottom: "24px", color: "#065f46", fontSize: "13px", display: "flex", alignItems: "center", gap: "10px" }}>
          <CheckCircleIcon size={18} color="#059669" />
          <span>{commitStatus.message}</span>
        </div>
      )}

      {/* TAB 1: Voice Dictation */}
      {activeTab === "voice" && (
        <div>
          {/* Auditory Assistant Suite Card */}
          <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "10px", padding: "24px", marginBottom: "24px", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
              <div>
                <h2 style={{ fontSize: "16px", fontWeight: "700", color: "#0f172a", margin: "0 0 4px 0" }}>
                  Auditory Mark Dictation Suite
                </h2>
                <p style={{ fontSize: "13px", color: "#64748b", margin: 0 }}>
                  Dictate continuous marks for students verbally. The engine maps spoken names and roll numbers, verifies grade boundaries, and flags homophonic ambiguities.
                </p>
              </div>

              {/* Speech Controls */}
              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  onClick={toggleSpeechRecognition}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "9px 16px",
                    borderRadius: "6px",
                    background: isRecording ? "#be123c" : "#0f2942",
                    color: "#ffffff",
                    border: "none",
                    fontSize: "13px",
                    fontWeight: "600",
                    cursor: "pointer",
                    boxShadow: isRecording ? "0 0 10px rgba(190, 18, 60, 0.4)" : "none"
                  }}
                >
                  <MicIcon size={16} color="#ffffff" />
                  {isRecording ? "Listening (Click to Stop)..." : "Start Voice Dictation"}
                </button>
              </div>
            </div>

            {/* Transcript Textarea */}
            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", fontSize: "12px", fontWeight: "600", color: "#334155", marginBottom: "6px" }}>
                Spoken Speech Transcript / Typed Fallback
              </label>
              <textarea
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                placeholder="Example: Roll 101 forty-five out of fifty; Sneha Rao 48; Roll 103 42.5"
                rows={3}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: "6px",
                  border: "1px solid #cbd5e1",
                  fontSize: "13px",
                  outline: "none",
                  boxSizing: "border-box",
                  fontFamily: "inherit"
                }}
              />
            </div>

            {/* Evaluation Simulation Presets */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "12px", color: "#64748b" }}>Evaluation Test Prompts:</span>
                <button
                  type="button"
                  onClick={() => setTranscript("Roll 2026030001, forty-seven out of fifty; Roll 2025060002, 38; Sneha, forty")}
                  style={{ background: "#f1f5f9", border: "1px solid #cbd5e1", borderRadius: "4px", padding: "4px 8px", fontSize: "11px", fontWeight: "600", cursor: "pointer", color: "#1e293b" }}
                >
                  Load Roster & Ambiguity Sample
                </button>
                <button
                  type="button"
                  onClick={() => setTranscript("Roll 2026030001, fifty-eight out of fifty")}
                  style={{ background: "#fef2f2", border: "1px solid #fecdd3", borderRadius: "4px", padding: "4px 8px", fontSize: "11px", fontWeight: "600", cursor: "pointer", color: "#991b1b" }}
                >
                  Test Range Error (58 &gt; 50)
                </button>
              </div>

              <button
                type="button"
                onClick={handleParseMarks}
                disabled={loading || !transcript.trim()}
                style={{
                  padding: "8px 18px",
                  borderRadius: "6px",
                  background: "#0f2942",
                  color: "#ffffff",
                  fontSize: "13px",
                  fontWeight: "600",
                  border: "none",
                  cursor: loading || !transcript.trim() ? "not-allowed" : "pointer"
                }}
              >
                {loading ? "Parsing Speech Stream..." : "Process Transcript"}
              </button>
            </div>
          </div>

          {/* Parsed Review Ledger Table */}
          {parsedBatch && (
            <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "10px", overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.04)", marginBottom: "24px" }}>
              <div style={{ padding: "16px 20px", borderBottom: "1px solid #e2e8f0", background: "#f8fafc", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <h3 style={{ fontSize: "14px", fontWeight: "700", color: "#0f172a", margin: "0 0 2px 0" }}>
                    Speech Parsing Verification Ledger
                  </h3>
                  <div style={{ fontSize: "12px", color: "#64748b" }}>
                    Review matches and resolve any candidate ambiguities before committing to official records.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleCommitMarks}
                  disabled={submitting}
                  style={{
                    padding: "9px 18px",
                    borderRadius: "6px",
                    background: "#059669",
                    color: "#ffffff",
                    fontSize: "13px",
                    fontWeight: "600",
                    border: "none",
                    cursor: submitting ? "not-allowed" : "pointer"
                  }}
                >
                  {submitting ? "Committing Ledger..." : "Commit Verified Marks"}
                </button>
              </div>

              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                  <thead>
                    <tr style={{ background: "#f1f5f9", borderBottom: "1px solid #e2e8f0", textAlign: "left" }}>
                      <th style={{ padding: "10px 14px", color: "#475569" }}>Spoken Identifier</th>
                      <th style={{ padding: "10px 14px", color: "#475569" }}>Roster Match</th>
                      <th style={{ padding: "10px 14px", color: "#475569" }}>Obtained Score</th>
                      <th style={{ padding: "10px 14px", color: "#475569" }}>Max</th>
                      <th style={{ padding: "10px 14px", color: "#475569" }}>Integrity Status</th>
                      <th style={{ padding: "10px 14px", color: "#475569" }}>Resolution Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedBatch.entries.map((entry, idx) => {
                      return (
                        <tr key={idx} style={{ borderBottom: "1px solid #f1f5f9" }}>
                          <td style={{ padding: "12px 14px", fontWeight: "600", color: "#0f172a" }}>
                            "{entry.rawClause}"
                          </td>
                          <td style={{ padding: "12px 14px" }}>
                            {entry.matchedStudent ? (
                              <div>
                                <strong style={{ color: "#0f172a" }}>{entry.matchedStudent.first_name} {entry.matchedStudent.last_name}</strong>
                                <div style={{ fontSize: "11px", color: "#64748b" }}>Reg: {entry.matchedStudent.register_number}</div>
                              </div>
                            ) : (
                              <span style={{ color: "#991b1b", fontWeight: "600" }}>Ambiguity: Unresolved</span>
                            )}
                          </td>
                          <td style={{ padding: "12px 14px" }}>
                            <input
                              type="number"
                              value={entry.obtainedMarks}
                              onChange={(e) => handleEditMarkValue(idx, e.target.value)}
                              style={{ width: "64px", padding: "4px 8px", borderRadius: "4px", border: "1px solid #cbd5e1", fontSize: "13px", fontWeight: "600" }}
                            />
                          </td>
                          <td style={{ padding: "12px 14px", color: "#64748b" }}>
                            / {entry.maxMarks}
                          </td>
                          <td style={{ padding: "12px 14px" }}>
                            {entry.hasRangeError ? (
                              <span style={{ color: "#991b1b", fontSize: "11px", fontWeight: "700", background: "#fef2f2", padding: "2px 6px", borderRadius: "4px", border: "1px solid #fecdd3" }}>
                                RANGE ERROR (&gt;{entry.maxMarks})
                              </span>
                            ) : entry.isAmbiguous ? (
                              <span style={{ color: "#92400e", fontSize: "11px", fontWeight: "700", background: "#fffbeb", padding: "2px 6px", borderRadius: "4px", border: "1px solid #fde68a" }}>
                                CONFLICT ({entry.ambiguousCandidates?.length} MATCHES)
                              </span>
                            ) : (
                              <span style={{ color: "#065f46", fontSize: "11px", fontWeight: "700", background: "#ecfdf5", padding: "2px 6px", borderRadius: "4px", border: "1px solid #a7f3d0" }}>
                                VERIFIED
                              </span>
                            )}
                          </td>
                          <td style={{ padding: "12px 14px" }}>
                            {entry.isAmbiguous && entry.ambiguousCandidates ? (
                              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                                {entry.ambiguousCandidates.slice(0, 3).map((cand) => (
                                  <button
                                    key={cand.student_id}
                                    type="button"
                                    onClick={() => handleSelectAmbiguousCandidate(idx, cand)}
                                    style={{ background: "#ffffff", border: "1px solid #0f2942", color: "#0f2942", padding: "3px 6px", borderRadius: "4px", fontSize: "11px", fontWeight: "600", cursor: "pointer" }}
                                  >
                                    Assign: {cand.first_name} {cand.last_name} ({cand.register_number})
                                  </button>
                                ))}
                              </div>
                            ) : (
                              <span style={{ fontSize: "12px", color: "#64748b" }}>Ready to commit</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Course Roster */}
      {activeTab === "roster" && (
        <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "10px", overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid #e2e8f0", background: "#f8fafc", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h3 style={{ fontSize: "14px", fontWeight: "700", color: "#0f172a", margin: "0 0 2px 0" }}>
                Official Enrolled Roster — {selectedOffering?.course_code} (Section {selectedOffering?.section})
              </h3>
              <div style={{ fontSize: "12px", color: "#64748b" }}>
                Total Enrolled Students: {roster.length}
              </div>
            </div>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
              <thead>
                <tr style={{ background: "#f1f5f9", borderBottom: "1px solid #e2e8f0", textAlign: "left" }}>
                  <th style={{ padding: "10px 14px", color: "#475569" }}>Reg. Number</th>
                  <th style={{ padding: "10px 14px", color: "#475569" }}>Student Full Name</th>
                  <th style={{ padding: "10px 14px", color: "#475569" }}>Institutional Email</th>
                  <th style={{ padding: "10px 14px", color: "#475569" }}>Recorded {assessmentName}</th>
                  <th style={{ padding: "10px 14px", color: "#475569" }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {roster.map((s) => (
                  <tr key={s.enrollment_id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "12px 14px", fontWeight: "600", color: "#0f172a" }}>
                      {s.register_number}
                    </td>
                    <td style={{ padding: "12px 14px", color: "#0f172a" }}>
                      {s.first_name} {s.last_name}
                    </td>
                    <td style={{ padding: "12px 14px", color: "#64748b" }}>
                      {s.email}
                    </td>
                    <td style={{ padding: "12px 14px" }}>
                      {s.current_mark !== null && s.current_mark !== undefined ? (
                        <strong style={{ color: "#0f172a" }}>{s.current_mark} / {s.max_marks || 50}</strong>
                      ) : (
                        <span style={{ color: "#94a3b8", fontStyle: "italic" }}>Not Recorded</span>
                      )}
                    </td>
                    <td style={{ padding: "12px 14px" }}>
                      {s.current_mark !== null && s.current_mark !== undefined ? (
                        <span style={{ fontSize: "11px", fontWeight: "700", color: "#065f46", background: "#ecfdf5", padding: "2px 6px", borderRadius: "4px", border: "1px solid #a7f3d0" }}>
                          ENTERED
                        </span>
                      ) : (
                        <span style={{ fontSize: "11px", fontWeight: "700", color: "#92400e", background: "#fffbeb", padding: "2px 6px", borderRadius: "4px", border: "1px solid #fde68a" }}>
                          PENDING
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: At-Risk Students */}
      {activeTab === "at-risk" && (
        <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "10px", overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid #e2e8f0", background: "#f8fafc" }}>
            <h3 style={{ fontSize: "14px", fontWeight: "700", color: "#0f172a", margin: "0 0 2px 0" }}>
              Statutory Intervention Roster — Students Below 75% or Moderate Risk
            </h3>
            <div style={{ fontSize: "12px", color: "#64748b" }}>
              Identified through the 35/30/20/15 decomposition formula. Immediate academic counseling recommended.
            </div>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
              <thead>
                <tr style={{ background: "#f1f5f9", borderBottom: "1px solid #e2e8f0", textAlign: "left" }}>
                  <th style={{ padding: "10px 14px", color: "#475569" }}>Reg. Number</th>
                  <th style={{ padding: "10px 14px", color: "#475569" }}>Student Name</th>
                  <th style={{ padding: "10px 14px", color: "#475569" }}>Attendance %</th>
                  <th style={{ padding: "10px 14px", color: "#475569" }}>Risk Score</th>
                  <th style={{ padding: "10px 14px", color: "#475569" }}>Key Risk Drivers</th>
                </tr>
              </thead>
              <tbody>
                {atRiskList.map((st) => (
                  <tr key={st.student_id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "12px 14px", fontWeight: "600", color: "#0f172a" }}>
                      {st.register_number}
                    </td>
                    <td style={{ padding: "12px 14px", color: "#0f172a" }}>
                      {st.first_name} {st.last_name}
                    </td>
                    <td style={{ padding: "12px 14px" }}>
                      <span style={{ color: st.attendancePct < 75.0 ? "#991b1b" : "#b45309", fontWeight: "700" }}>
                        {st.attendancePct}%
                      </span>
                    </td>
                    <td style={{ padding: "12px 14px" }}>
                      <span style={{ fontSize: "11px", fontWeight: "700", padding: "2px 6px", borderRadius: "4px", background: st.riskLevel === "HIGH" ? "#fef2f2" : "#fffbeb", color: st.riskLevel === "HIGH" ? "#991b1b" : "#92400e", border: "1px solid #e2e8f0" }}>
                        {st.riskLevel} ({st.totalRiskScore}/100)
                      </span>
                    </td>
                    <td style={{ padding: "12px 14px", fontSize: "12px", color: "#475569" }}>
                      {(st.reasons || []).join("; ")}
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
