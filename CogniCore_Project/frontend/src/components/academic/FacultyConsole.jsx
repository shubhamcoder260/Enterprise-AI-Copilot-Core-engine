import React, { useState, useEffect, useRef } from "react";
import { MicIcon, UserCheckIcon, AlertCircleIcon, CheckCircleIcon, BookOpenIcon, ChevronDownIcon } from "./Icons.jsx";
import { academicFetch } from "../../lib/academicApi.js";

// Number words parser for client-side rapid proctor mode
const NUMBER_WORDS = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
  ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16,
  seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50,
  sixty: 60, seventy: 70, eighty: 80, ninety: 90, hundred: 100
};

function parseClientSpokenNumber(input) {
  if (typeof input === "number") return input;
  if (!input) return null;
  const clean = String(input).trim().toLowerCase().replace(/-/g, " ");

  if (clean.includes("absent") || clean.includes("not present")) return 0;

  const direct = parseFloat(clean);
  if (!isNaN(direct) && String(direct) === clean) return direct;

  const parts = clean.split(/\s+point\s+/);
  const wholePart = parts[0];
  const decimalPart = parts[1] || null;

  const words = wholePart.split(/\s+/);
  let total = 0;
  let current = 0;
  let matched = false;

  for (const w of words) {
    if (NUMBER_WORDS[w] !== undefined) {
      matched = true;
      const val = NUMBER_WORDS[w];
      if (val === 100) {
        current = (current === 0 ? 1 : current) * 100;
      } else {
        current += val;
      }
    } else if (!isNaN(parseFloat(w))) {
      matched = true;
      current += parseFloat(w);
    }
  }
  total += current;

  if (!matched) {
    const fallback = parseFloat(input);
    return isNaN(fallback) ? null : fallback;
  }

  if (decimalPart) {
    const decWords = decimalPart.split(/\s+/);
    let decStr = "";
    for (const dw of decWords) {
      if (NUMBER_WORDS[dw] !== undefined) decStr += NUMBER_WORDS[dw];
      else if (!isNaN(parseInt(dw, 10))) decStr += dw;
    }
    if (decStr.length > 0) return parseFloat(`${total}.${decStr}`);
  }

  return total;
}

export default function FacultyConsole({ facultyUser, onLogout }) {
  const [courses, setCourses] = useState([]);
  const [selectedOffering, setSelectedOffering] = useState(null);
  const [roster, setRoster] = useState([]);
  const [atRiskList, setAtRiskList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("roster"); // 'roster', 'voice', 'at-risk'
  const [voiceSubMode, setVoiceSubMode] = useState("proctor"); // 'proctor', 'dictation'

  // Assessment & parameters
  const [assessmentName, setAssessmentName] = useState("Internal 1");
  const maxMarks = assessmentName.includes("Assignment") ? 25 : 50;

  // Free-form Voice Dictation states (R4 Primary)
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [parsedBatch, setParsedBatch] = useState(null);
  const [commitStatus, setCommitStatus] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Spreadsheet Gradebook states (Fast inline editing & keyboard navigation)
  const [spreadsheetDraft, setSpreadsheetDraft] = useState({});
  const inputRefs = useRef([]);

  // Conversational Proctor Assistant states (Turn-by-turn hands-free exam grading)
  const [proctorActive, setProctorActive] = useState(false);
  const [proctorIndex, setProctorIndex] = useState(0);
  const [proctorStatus, setProctorStatus] = useState("idle"); // 'idle' | 'speaking' | 'listening' | 'recorded'
  const [proctorLastSpoken, setProctorLastSpoken] = useState("");
  const [proctorDraft, setProctorDraft] = useState({});
  const recognitionRef = useRef(null);

  // Load faculty courses on mount
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const res = await academicFetch("http://localhost:5000/api/academic/faculty/courses?facultyId=" + (facultyUser?.id || 1));
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

  // Load roster and at-risk when course or assessment changes
  useEffect(() => {
    if (!selectedOffering) return;
    (async () => {
      try {
        const offId = selectedOffering.offering_id;
        const [rosRes, riskRes] = await Promise.all([
          academicFetch(`http://localhost:5000/api/academic/faculty/course/${offId}/roster?assessmentName=${encodeURIComponent(assessmentName)}`),
          academicFetch(`http://localhost:5000/api/academic/faculty/course/${offId}/at-risk`)
        ]);
        const rosData = await rosRes.json();
        const riskData = await riskRes.json();
        if (rosData.roster) {
          setRoster(rosData.roster);
          // Initialize spreadsheet draft from loaded database marks
          const initialDraft = {};
          rosData.roster.forEach((st) => {
            if (st.current_mark !== null && st.current_mark !== undefined) {
              initialDraft[st.enrollment_id] = st.current_mark;
            }
          });
          setSpreadsheetDraft(initialDraft);
        }
        if (riskData.students) setAtRiskList(riskData.students);
      } catch (err) {
        console.error("Failed to load course details:", err);
      }
    })();
  }, [selectedOffering, assessmentName]);

  // -------------------------------------------------------------
  // SPREADSHEET GRADEBOOK LOGIC
  // -------------------------------------------------------------
  function handleSpreadsheetChange(enrollmentId, val) {
    setSpreadsheetDraft((prev) => ({
      ...prev,
      [enrollmentId]: val
    }));
  }

  function handleSpreadsheetKeyDown(e, currentIndex) {
    if (e.key === "Enter" || e.key === "ArrowDown") {
      e.preventDefault();
      const nextIndex = currentIndex + 1;
      if (inputRefs.current[nextIndex]) {
        inputRefs.current[nextIndex].focus();
        inputRefs.current[nextIndex].select?.();
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const prevIndex = currentIndex - 1;
      if (prevIndex >= 0 && inputRefs.current[prevIndex]) {
        inputRefs.current[prevIndex].focus();
        inputRefs.current[prevIndex].select?.();
      }
    }
  }

  // Compute dirty entries in spreadsheet gradebook
  const dirtySpreadsheetEntries = roster.filter((s) => {
    const draftVal = spreadsheetDraft[s.enrollment_id];
    const originalVal = s.current_mark;
    if (draftVal === undefined || draftVal === "") return false;
    const numDraft = parseFloat(draftVal);
    if (isNaN(numDraft)) return false;
    return originalVal === null || originalVal === undefined || numDraft !== originalVal;
  });

  async function handleSaveSpreadsheetGradebook() {
    if (dirtySpreadsheetEntries.length === 0) return;
    try {
      setSubmitting(true);
      const payloadEntries = dirtySpreadsheetEntries.map((s) => ({
        enrollmentId: s.enrollment_id,
        assessmentName,
        obtainedMarks: parseFloat(spreadsheetDraft[s.enrollment_id]),
        maxMarks
      }));

      const res = await academicFetch("http://localhost:5000/api/academic/faculty/submit-marks", {
        method: "POST",
        body: JSON.stringify({
          entries: payloadEntries,
          facultyName: facultyUser?.name || "Faculty",
          assessmentName
        })
      });

      const data = await res.json();
      if (data.success) {
        setCommitStatus({
          count: data.savedCount,
          message: `Successfully saved and committed ${data.savedCount} marks to the institutional ledger. Student notifications dispatched.`
        });
        // Refresh roster
        const rosRes = await academicFetch(`http://localhost:5000/api/academic/faculty/course/${selectedOffering.offering_id}/roster?assessmentName=${encodeURIComponent(assessmentName)}`);
        const rosData = await rosRes.json();
        if (rosData.roster) {
          setRoster(rosData.roster);
          const initialDraft = {};
          rosData.roster.forEach((st) => {
            if (st.current_mark !== null && st.current_mark !== undefined) {
              initialDraft[st.enrollment_id] = st.current_mark;
            }
          });
          setSpreadsheetDraft(initialDraft);
        }
      } else {
        alert("Failed to save gradebook: " + (data.error || "Unknown error"));
      }
    } catch (err) {
      console.error(err);
      alert("Error saving gradebook: " + err.message);
    } finally {
      setSubmitting(false);
    }
  }

  // -------------------------------------------------------------
  // CONVERSATIONAL PROCTOR ASSISTANT (TURN-BY-TURN HANDS-FREE)
  // -------------------------------------------------------------
  function speakPrompt(text, onEnd) {
    if (!("speechSynthesis" in window)) {
      if (onEnd) onEnd();
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.lang = "en-US";
    utterance.onend = () => {
      if (onEnd) onEnd();
    };
    utterance.onerror = () => {
      if (onEnd) onEnd();
    };
    window.speechSynthesis.speak(utterance);
  }

  function startProctorListening(currentStudent) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setProctorStatus("listening");
      return;
    }

    try {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
      const recognition = new SpeechRecognition();
      recognitionRef.current = recognition;
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = "en-US";

      recognition.onstart = () => {
        setProctorStatus("listening");
      };

      recognition.onerror = (e) => {
        console.warn("Proctor speech recognition error:", e);
        setProctorStatus("idle");
      };

      recognition.onresult = (event) => {
        const text = event.results[0][0].transcript;
        setProctorLastSpoken(text);

        // Check if teacher says "read out" or "audit"
        if (/read\s*out|read\s*all|audit|review\s*marks/i.test(text)) {
          readOutEnteredMarks();
          return;
        }

        // Check if teacher says "skip" or "next"
        if (/skip|pass/i.test(text)) {
          advanceProctor(proctorIndex + 1);
          return;
        }

        // Parse numerical mark
        const parsed = parseClientSpokenNumber(text);
        if (parsed !== null && parsed >= 0 && parsed <= maxMarks) {
          setProctorDraft((prev) => ({
            ...prev,
            [currentStudent.enrollment_id]: parsed
          }));
          setProctorStatus("recorded");
          // Play quick voice ack and advance
          speakPrompt(`${parsed}`, () => {
            advanceProctor(proctorIndex + 1);
          });
        } else {
          // Unrecognized or range error
          speakPrompt("Pardon? Please say the mark between zero and " + maxMarks, () => {
            startProctorListening(currentStudent);
          });
        }
      };

      recognition.start();
    } catch (err) {
      console.error(err);
      setProctorStatus("idle");
    }
  }

  function promptStudent(index) {
    if (!roster || index >= roster.length) {
      setProctorActive(false);
      setProctorStatus("idle");
      speakPrompt("All students in the roster have been completed. Please review and commit the ledger.");
      return;
    }
    const student = roster[index];
    setProctorIndex(index);
    setProctorStatus("speaking");
    const promptText = `Roll ${student.register_number.slice(-3)}, ${student.first_name} ${student.last_name}`;
    speakPrompt(promptText, () => {
      startProctorListening(student);
    });
  }

  function advanceProctor(nextIndex) {
    if (nextIndex < roster.length) {
      promptStudent(nextIndex);
    } else {
      setProctorActive(false);
      setProctorStatus("idle");
      speakPrompt("Session finished. All marks captured.");
    }
  }

  function toggleProctorSession() {
    if (proctorActive) {
      // Stop proctor
      window.speechSynthesis?.cancel();
      if (recognitionRef.current) recognitionRef.current.abort();
      setProctorActive(false);
      setProctorStatus("idle");
    } else {
      // Start proctor
      setProctorActive(true);
      promptStudent(proctorIndex);
    }
  }

  function readOutEnteredMarks() {
    window.speechSynthesis?.cancel();
    if (recognitionRef.current) recognitionRef.current.abort();
    setProctorStatus("speaking");

    const enteredList = roster
      .map((s) => ({
        name: `${s.first_name} ${s.last_name}`,
        roll: s.register_number.slice(-3),
        mark: proctorDraft[s.enrollment_id] ?? s.current_mark
      }))
      .filter((s) => s.mark !== undefined && s.mark !== null);

    if (enteredList.length === 0) {
      speakPrompt("No marks have been recorded yet.", () => setProctorStatus("idle"));
      return;
    }

    const sentences = enteredList.map((item) => `Roll ${item.roll}, ${item.mark} marks`).join(". ");
    speakPrompt(`Reading entered marks for ${enteredList.length} students. ${sentences}. End of report.`, () => {
      setProctorStatus("idle");
    });
  }

  async function handleCommitProctorMarks() {
    const entriesToSave = Object.keys(proctorDraft).map((enrId) => ({
      enrollmentId: parseInt(enrId, 10),
      assessmentName,
      obtainedMarks: proctorDraft[enrId],
      maxMarks
    }));

    if (entriesToSave.length === 0) {
      alert("No marks in proctor queue to commit.");
      return;
    }

    try {
      setSubmitting(true);
      const res = await academicFetch("http://localhost:5000/api/academic/faculty/submit-marks", {
        method: "POST",
        body: JSON.stringify({
          entries: entriesToSave,
          facultyName: facultyUser?.name || "Faculty",
          assessmentName
        })
      });

      const data = await res.json();
      if (data.success) {
        setCommitStatus({
          count: data.savedCount,
          message: `Successfully committed ${data.savedCount} marks from conversational proctor session to institutional records.`
        });
        setProctorDraft({});
        // Refresh roster
        const rosRes = await academicFetch(`http://localhost:5000/api/academic/faculty/course/${selectedOffering.offering_id}/roster?assessmentName=${encodeURIComponent(assessmentName)}`);
        const rosData = await rosRes.json();
        if (rosData.roster) setRoster(rosData.roster);
      } else {
        alert("Failed to commit marks: " + (data.error || "Unknown error"));
      }
    } catch (err) {
      console.error(err);
      alert("Error committing marks: " + err.message);
    } finally {
      setSubmitting(false);
    }
  }

  // -------------------------------------------------------------
  // CONTINUOUS FREE-FORM VOICE DICTATION (R4 PRIMARY)
  // -------------------------------------------------------------
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
      recognition.interimResults = false; // Final results only to prevent duplication (AUD-D02)
      recognition.lang = "en-US";

      recognition.onstart = () => setIsRecording(true);
      recognition.onend = () => setIsRecording(false);
      recognition.onerror = (e) => {
        console.error("Speech recognition error:", e);
        setIsRecording(false);
      };

      recognition.onresult = (event) => {
        const text = event.results[0][0].transcript;
        setTranscript((prev) => (prev ? prev + "; " + text : text));
      };

      recognition.start();
    } catch (err) {
      console.error(err);
      setIsRecording(false);
    }
  }

  async function handleParseMarks() {
    if (!transcript.trim() || !selectedOffering) return;
    try {
      setLoading(true);
      setCommitStatus(null);
      const res = await academicFetch("http://localhost:5000/api/academic/faculty/parse-voice-marks", {
        method: "POST",
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

  function handleSelectAmbiguousCandidate(entryIndex, candidate) {
    if (!parsedBatch) return;
    const updatedEntries = [...parsedBatch.entries];
    updatedEntries[entryIndex].matchedStudent = candidate;
    updatedEntries[entryIndex].isAmbiguous = false;
    updatedEntries[entryIndex].requiresReview = updatedEntries[entryIndex].hasRangeError || updatedEntries[entryIndex].isOverwrite;
    setParsedBatch({ ...parsedBatch, entries: updatedEntries });
  }

  function handleEditMarkValue(entryIndex, val) {
    if (!parsedBatch) return;
    const num = parseFloat(val);
    const updatedEntries = [...parsedBatch.entries];
    updatedEntries[entryIndex].obtainedMarks = isNaN(num) ? "" : num;
    updatedEntries[entryIndex].hasRangeError = num > updatedEntries[entryIndex].maxMarks || num < 0;
    setParsedBatch({ ...parsedBatch, entries: updatedEntries });
  }

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

      const res = await academicFetch("http://localhost:5000/api/academic/faculty/submit-marks", {
        method: "POST",
        body: JSON.stringify({
          entries: payloadEntries,
          facultyName: facultyUser?.name || "Faculty",
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
        const rosRes = await academicFetch(`http://localhost:5000/api/academic/faculty/course/${selectedOffering.offering_id}/roster?assessmentName=${encodeURIComponent(assessmentName)}`);
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

  const currentStudent = roster[proctorIndex] || null;

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
              {facultyUser?.name || "Faculty Console"}
            </h1>
            <span style={{ fontSize: "12px", background: "#f1f5f9", color: "#334155", padding: "3px 8px", borderRadius: "4px", fontWeight: "600", border: "1px solid #e2e8f0" }}>
              NetID: {facultyUser?.employeeNumber || "FAC0001"}
            </span>
            <span style={{ fontSize: "12px", background: "#ecfdf5", color: "#065f46", padding: "3px 8px", borderRadius: "4px", fontWeight: "600", border: "1px solid #a7f3d0" }}>
              Faculty of Engineering & Technology
            </span>
          </div>
          <div style={{ fontSize: "13px", color: "#64748b" }}>
            Course Gradebook, Voice Proctor & At-Risk Academic Tracking
          </div>
        </div>

        {/* Course & Assessment Selectors */}
        <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
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

      {/* Primary Navigation Tabs */}
      <div style={{ display: "flex", borderBottom: "1px solid #e2e8f0", marginBottom: "20px" }}>
        <button
          onClick={() => setActiveTab("roster")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            padding: "10px 18px",
            border: "none",
            borderBottom: activeTab === "roster" ? "2px solid #0f2942" : "2px solid transparent",
            background: "transparent",
            color: activeTab === "roster" ? "#0f2942" : "#64748b",
            fontSize: "13px",
            fontWeight: "700",
            cursor: "pointer"
          }}
        >
          <BookOpenIcon size={15} color={activeTab === "roster" ? "#0f2942" : "#64748b"} />
          Gradebook & Roster ({roster.length})
        </button>

        <button
          onClick={() => setActiveTab("voice")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            padding: "10px 18px",
            border: "none",
            borderBottom: activeTab === "voice" ? "2px solid #0f2942" : "2px solid transparent",
            background: "transparent",
            color: activeTab === "voice" ? "#0f2942" : "#64748b",
            fontSize: "13px",
            fontWeight: "700",
            cursor: "pointer"
          }}
        >
          <MicIcon size={15} color={activeTab === "voice" ? "#0f2942" : "#64748b"} />
          AI Voice & Proctor Assist
        </button>

        <button
          onClick={() => setActiveTab("at-risk")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            padding: "10px 18px",
            border: "none",
            borderBottom: activeTab === "at-risk" ? "2px solid #0f2942" : "2px solid transparent",
            background: "transparent",
            color: activeTab === "at-risk" ? "#0f2942" : "#64748b",
            fontSize: "13px",
            fontWeight: "700",
            cursor: "pointer"
          }}
        >
          <AlertCircleIcon size={15} color={activeTab === "at-risk" ? "#0f2942" : "#64748b"} />
          At-Risk ({atRiskList.length})
        </button>
      </div>

      {/* Success Notification Alert */}
      {commitStatus && (
        <div style={{ background: "#ecfdf5", border: "1px solid #a7f3d0", borderRadius: "6px", padding: "12px 16px", marginBottom: "20px", color: "#065f46", fontSize: "13px", display: "flex", alignItems: "center", gap: "10px" }}>
          <CheckCircleIcon size={16} color="#059669" />
          <span>{commitStatus.message}</span>
        </div>
      )}

      {/* TAB 1: SPREADSHEET GRADEBOOK & ROSTER */}
      {activeTab === "roster" && (
        <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "10px", overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid #e2e8f0", background: "#f8fafc", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
            <div>
              <h3 style={{ fontSize: "15px", fontWeight: "700", color: "#0f172a", margin: "0 0 2px 0" }}>
                Interactive Spreadsheet Gradebook — {selectedOffering?.course_code} (Section {selectedOffering?.section})
              </h3>
              <div style={{ fontSize: "12px", color: "#64748b" }}>
                Use <kbd style={{ background: "#e2e8f0", padding: "1px 4px", borderRadius: "3px" }}>Enter</kbd> or <kbd style={{ background: "#e2e8f0", padding: "1px 4px", borderRadius: "3px" }}>↓</kbd> to rapidly enter marks row by row. Component: <strong>{assessmentName}</strong> (Max: {maxMarks}).
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              {dirtySpreadsheetEntries.length > 0 && (
                <span style={{ fontSize: "12px", fontWeight: "700", color: "#b45309", background: "#fef3c7", padding: "4px 8px", borderRadius: "4px", border: "1px solid #fde68a" }}>
                  {dirtySpreadsheetEntries.length} Unsaved Changes
                </span>
              )}
              <button
                type="button"
                onClick={handleSaveSpreadsheetGradebook}
                disabled={submitting || dirtySpreadsheetEntries.length === 0}
                style={{
                  padding: "8px 18px",
                  borderRadius: "6px",
                  background: dirtySpreadsheetEntries.length > 0 ? "#059669" : "#cbd5e1",
                  color: "#ffffff",
                  fontSize: "13px",
                  fontWeight: "600",
                  border: "none",
                  cursor: dirtySpreadsheetEntries.length > 0 && !submitting ? "pointer" : "not-allowed"
                }}
              >
                {submitting ? "Saving Ledger..." : `💾 Commit Marks (${dirtySpreadsheetEntries.length})`}
              </button>
            </div>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
              <thead>
                <tr style={{ background: "#f1f5f9", borderBottom: "1px solid #e2e8f0", textAlign: "left" }}>
                  <th style={{ padding: "10px 14px", color: "#475569", width: "130px" }}>Reg. Number</th>
                  <th style={{ padding: "10px 14px", color: "#475569" }}>Student Full Name</th>
                  <th style={{ padding: "10px 14px", color: "#475569" }}>Email</th>
                  <th style={{ padding: "10px 14px", color: "#475569", width: "120px" }}>Db Record</th>
                  <th style={{ padding: "10px 14px", color: "#475569", width: "160px" }}>Score Entry (/{maxMarks})</th>
                  <th style={{ padding: "10px 14px", color: "#475569", width: "120px" }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {roster.map((s, idx) => {
                  const draftVal = spreadsheetDraft[s.enrollment_id] ?? "";
                  const isDirty = draftVal !== "" && parseFloat(draftVal) !== s.current_mark;
                  const isOutOfRange = draftVal !== "" && (parseFloat(draftVal) < 0 || parseFloat(draftVal) > maxMarks);

                  return (
                    <tr
                      key={s.enrollment_id}
                      style={{
                        borderBottom: "1px solid #f1f5f9",
                        background: isOutOfRange ? "#fff1f2" : isDirty ? "#f0fdf4" : "transparent"
                      }}
                    >
                      <td style={{ padding: "10px 14px", fontWeight: "600", color: "#0f172a" }}>
                        {s.register_number}
                      </td>
                      <td style={{ padding: "10px 14px", color: "#0f172a" }}>
                        <strong>{s.first_name} {s.last_name}</strong>
                      </td>
                      <td style={{ padding: "10px 14px", color: "#64748b", fontSize: "12px" }}>
                        {s.email}
                      </td>
                      <td style={{ padding: "10px 14px", color: "#475569" }}>
                        {s.current_mark !== null && s.current_mark !== undefined ? (
                          <span>{s.current_mark} / {s.max_marks || maxMarks}</span>
                        ) : (
                          <span style={{ color: "#94a3b8", fontStyle: "italic" }}>None</span>
                        )}
                      </td>
                      <td style={{ padding: "10px 14px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <input
                            ref={(el) => (inputRefs.current[idx] = el)}
                            type="number"
                            step="0.5"
                            min="0"
                            max={maxMarks}
                            value={draftVal}
                            onChange={(e) => handleSpreadsheetChange(s.enrollment_id, e.target.value)}
                            onKeyDown={(e) => handleSpreadsheetKeyDown(e, idx)}
                            placeholder="Mark"
                            style={{
                              width: "72px",
                              padding: "6px 8px",
                              borderRadius: "4px",
                              border: isOutOfRange ? "1.5px solid #e11d48" : isDirty ? "1.5px solid #059669" : "1px solid #cbd5e1",
                              fontSize: "13px",
                              fontWeight: "600",
                              outline: "none",
                              background: "#ffffff"
                            }}
                          />
                          <span style={{ fontSize: "11px", color: "#64748b" }}>/ {maxMarks}</span>
                        </div>
                      </td>
                      <td style={{ padding: "10px 14px" }}>
                        {isOutOfRange ? (
                          <span style={{ fontSize: "11px", fontWeight: "700", color: "#991b1b", background: "#fef2f2", padding: "2px 6px", borderRadius: "4px", border: "1px solid #fecdd3" }}>
                            MAX {maxMarks}
                          </span>
                        ) : isDirty ? (
                          <span style={{ fontSize: "11px", fontWeight: "700", color: "#065f46", background: "#ecfdf5", padding: "2px 6px", borderRadius: "4px", border: "1px solid #a7f3d0" }}>
                            MODIFIED
                          </span>
                        ) : s.current_mark !== null && s.current_mark !== undefined ? (
                          <span style={{ fontSize: "11px", fontWeight: "600", color: "#475569" }}>
                            SAVED
                          </span>
                        ) : (
                          <span style={{ fontSize: "11px", fontWeight: "600", color: "#94a3b8" }}>
                            PENDING
                          </span>
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

      {/* TAB 2: VOICE & PROCTOR ASSIST (DUAL-MODE) */}
      {activeTab === "voice" && (
        <div>
          {/* Sub-mode Pill Switcher */}
          <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
            <button
              type="button"
              onClick={() => setVoiceSubMode("proctor")}
              style={{
                padding: "8px 14px",
                borderRadius: "6px",
                background: voiceSubMode === "proctor" ? "#0f2942" : "#f1f5f9",
                color: voiceSubMode === "proctor" ? "#ffffff" : "#475569",
                border: "1px solid #cbd5e1",
                fontSize: "12px",
                fontWeight: "700",
                cursor: "pointer"
              }}
            >
              🎙️ Interactive Proctor Assistant (Hands-Free Turn-by-Turn)
            </button>
            <button
              type="button"
              onClick={() => setVoiceSubMode("dictation")}
              style={{
                padding: "8px 14px",
                borderRadius: "6px",
                background: voiceSubMode === "dictation" ? "#0f2942" : "#f1f5f9",
                color: voiceSubMode === "dictation" ? "#ffffff" : "#475569",
                border: "1px solid #cbd5e1",
                fontSize: "12px",
                fontWeight: "700",
                cursor: "pointer"
              }}
            >
              ⚡ Continuous Speech Dictation (R4 Roster Matching)
            </button>
          </div>

          {/* SUB-MODE A: INTERACTIVE PROCTOR ASSISTANT */}
          {voiceSubMode === "proctor" && (
            <div>
              {/* Proctor Control Console Card */}
              <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "10px", padding: "20px", marginBottom: "20px", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px", marginBottom: "16px" }}>
                  <div>
                    <h2 style={{ fontSize: "16px", fontWeight: "700", color: "#0f172a", margin: "0 0 4px 0" }}>
                      Conversational Proctor Mode
                    </h2>
                    <p style={{ fontSize: "12px", color: "#64748b", margin: 0, maxWidth: "650px" }}>
                      Hands-free mark entry designed for grading physical exam papers. The AI assistant reads each student aloud in roster sequence; simply speak the mark (e.g. <em>"forty two"</em> or <em>"absent"</em>). Click <strong>"Read Out Marks"</strong> to verbally audit without viewing the screen.
                    </p>
                  </div>

                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                    <button
                      type="button"
                      onClick={toggleProctorSession}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        padding: "9px 16px",
                        borderRadius: "6px",
                        background: proctorActive ? "#be123c" : "#0f2942",
                        color: "#ffffff",
                        border: "none",
                        fontSize: "13px",
                        fontWeight: "700",
                        cursor: "pointer"
                      }}
                    >
                      <MicIcon size={16} color="#ffffff" />
                      {proctorActive ? "Pause Proctor Session" : "Start Hands-Free Session"}
                    </button>

                    <button
                      type="button"
                      onClick={readOutEnteredMarks}
                      style={{
                        padding: "9px 14px",
                        borderRadius: "6px",
                        background: "#f8fafc",
                        border: "1px solid #cbd5e1",
                        color: "#0f172a",
                        fontSize: "13px",
                        fontWeight: "600",
                        cursor: "pointer"
                      }}
                    >
                      📢 Read Out Entered Marks
                    </button>
                  </div>
                </div>

                {/* Current Student Active Card */}
                {currentStudent ? (
                  <div style={{ background: "#f8fafc", border: "1.5px solid #cbd5e1", borderRadius: "8px", padding: "18px", marginBottom: "16px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                      <span style={{ fontSize: "12px", fontWeight: "700", color: "#64748b", textTransform: "uppercase" }}>
                        Active Student ({proctorIndex + 1} of {roster.length})
                      </span>
                      <span style={{
                        fontSize: "12px",
                        fontWeight: "700",
                        padding: "3px 8px",
                        borderRadius: "4px",
                        background: proctorStatus === "speaking" ? "#eff6ff" : proctorStatus === "listening" ? "#fef2f2" : "#ecfdf5",
                        color: proctorStatus === "speaking" ? "#1d4ed8" : proctorStatus === "listening" ? "#be123c" : "#065f46",
                        border: "1px solid rgba(0,0,0,0.1)"
                      }}>
                        {proctorStatus === "speaking" ? "AI Speaking Name..." : proctorStatus === "listening" ? "Listening for Mark..." : proctorStatus === "recorded" ? "Mark Captured" : "Ready"}
                      </span>
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
                      <div>
                        <div style={{ fontSize: "20px", fontWeight: "700", color: "#0f172a" }}>
                          {currentStudent.first_name} {currentStudent.last_name}
                        </div>
                        <div style={{ fontSize: "13px", color: "#64748b" }}>
                          Register Number: <strong>{currentStudent.register_number}</strong> | Target: {assessmentName} (Max: {maxMarks})
                        </div>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <div style={{ fontSize: "13px", fontWeight: "600", color: "#334155" }}>
                          Captured: <strong style={{ fontSize: "18px", color: "#0f2942" }}>
                            {proctorDraft[currentStudent.enrollment_id] !== undefined ? `${proctorDraft[currentStudent.enrollment_id]} / ${maxMarks}` : "—"}
                          </strong>
                        </div>

                        {/* Quick Manual Actions */}
                        <button
                          type="button"
                          onClick={() => {
                            setProctorDraft((prev) => ({ ...prev, [currentStudent.enrollment_id]: 0 }));
                            advanceProctor(proctorIndex + 1);
                          }}
                          style={{ padding: "6px 10px", borderRadius: "4px", background: "#fef2f2", border: "1px solid #fecdd3", color: "#991b1b", fontSize: "12px", fontWeight: "600", cursor: "pointer" }}
                        >
                          Absent (0)
                        </button>
                        <button
                          type="button"
                          onClick={() => promptStudent(proctorIndex)}
                          style={{ padding: "6px 10px", borderRadius: "4px", background: "#f1f5f9", border: "1px solid #cbd5e1", color: "#334155", fontSize: "12px", fontWeight: "600", cursor: "pointer" }}
                        >
                          Repeat
                        </button>
                        <button
                          type="button"
                          onClick={() => advanceProctor(proctorIndex + 1)}
                          style={{ padding: "6px 10px", borderRadius: "4px", background: "#0f2942", border: "none", color: "#ffffff", fontSize: "12px", fontWeight: "600", cursor: "pointer" }}
                        >
                          Next ▶
                        </button>
                      </div>
                    </div>

                    {proctorLastSpoken && (
                      <div style={{ marginTop: "10px", fontSize: "12px", color: "#64748b", background: "#ffffff", padding: "6px 10px", borderRadius: "4px", border: "1px solid #e2e8f0" }}>
                        Last heard: <em>"{proctorLastSpoken}"</em>
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ padding: "20px", textAlign: "center", color: "#64748b" }}>
                    No students loaded in this roster.
                  </div>
                )}

                {/* Queue Summary & Commit Bar */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid #e2e8f0", paddingTop: "14px" }}>
                  <div style={{ fontSize: "13px", color: "#475569" }}>
                    Marks captured in this session: <strong>{Object.keys(proctorDraft).length}</strong> / {roster.length}
                  </div>
                  <button
                    type="button"
                    onClick={handleCommitProctorMarks}
                    disabled={submitting || Object.keys(proctorDraft).length === 0}
                    style={{
                      padding: "8px 18px",
                      borderRadius: "6px",
                      background: Object.keys(proctorDraft).length > 0 ? "#059669" : "#cbd5e1",
                      color: "#ffffff",
                      fontSize: "13px",
                      fontWeight: "700",
                      border: "none",
                      cursor: Object.keys(proctorDraft).length > 0 && !submitting ? "pointer" : "not-allowed"
                    }}
                  >
                    {submitting ? "Committing..." : `Commit ${Object.keys(proctorDraft).length} Proctor Marks to Ledger`}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* SUB-MODE B: CONTINUOUS FREE-FORM VOICE DICTATION (R4 PRIMARY) */}
          {voiceSubMode === "dictation" && (
            <div>
              <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "20px", marginBottom: "20px", boxShadow: "0 1px 2px rgba(0,0,0,0.03)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "14px" }}>
                  <div>
                    <h2 style={{ fontSize: "15px", fontWeight: "700", color: "#0f172a", margin: "0 0 2px 0" }}>
                      Continuous Voice Dictation
                    </h2>
                    <p style={{ fontSize: "12px", color: "#64748b", margin: 0 }}>
                      Dictate multiple student marks in one continuous utterance. The NLP resolver matches student names and rolls from the active course roster.
                    </p>
                  </div>

                  <button
                    onClick={toggleSpeechRecognition}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      padding: "8px 14px",
                      borderRadius: "6px",
                      background: isRecording ? "#be123c" : "#0f2942",
                      color: "#ffffff",
                      border: "none",
                      fontSize: "12px",
                      fontWeight: "600",
                      cursor: "pointer"
                    }}
                  >
                    <MicIcon size={15} color="#ffffff" />
                    {isRecording ? "Listening..." : "Dictate Marks"}
                  </button>
                </div>

                <div style={{ marginBottom: "12px" }}>
                  <textarea
                    value={transcript}
                    onChange={(e) => setTranscript(e.target.value)}
                    placeholder="Example: Roll 101 forty-five out of fifty; Sneha Patel 48; Roll 103 42.5"
                    rows={2}
                    style={{
                      width: "100%",
                      padding: "8px 10px",
                      borderRadius: "6px",
                      border: "1px solid #cbd5e1",
                      fontSize: "13px",
                      outline: "none",
                      boxSizing: "border-box",
                      fontFamily: "inherit"
                    }}
                  />
                </div>

                {/* Quick Test Presets */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                    <span style={{ fontSize: "11px", color: "#64748b" }}>Test samples:</span>
                    <button
                      type="button"
                      onClick={() => setTranscript("Roll 2026030001, forty-seven out of fifty; Roll 2025060002, 38; Sneha, forty")}
                      style={{ background: "#f8fafc", border: "1px solid #cbd5e1", borderRadius: "4px", padding: "3px 7px", fontSize: "11px", fontWeight: "500", cursor: "pointer", color: "#334155" }}
                    >
                      Sample 1: Multi-Student
                    </button>
                    <button
                      type="button"
                      onClick={() => setTranscript("Roll 2026030001, fifty-eight out of fifty")}
                      style={{ background: "#fef2f2", border: "1px solid #fecdd3", borderRadius: "4px", padding: "3px 7px", fontSize: "11px", fontWeight: "500", cursor: "pointer", color: "#991b1b" }}
                    >
                      Sample 2: Invalid Mark (&gt;50)
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={handleParseMarks}
                    disabled={loading || !transcript.trim()}
                    style={{
                      padding: "7px 16px",
                      borderRadius: "6px",
                      background: "#0f2942",
                      color: "#ffffff",
                      fontSize: "12px",
                      fontWeight: "600",
                      border: "none",
                      cursor: loading || !transcript.trim() ? "not-allowed" : "pointer"
                    }}
                  >
                    {loading ? "Parsing..." : "Process Transcript"}
                  </button>
                </div>
              </div>

              {/* Parsed Review Ledger Table */}
              {parsedBatch && (
                <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "10px", overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.04)", marginBottom: "24px" }}>
                  <div style={{ padding: "16px 20px", borderBottom: "1px solid #e2e8f0", background: "#f8fafc", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <h3 style={{ fontSize: "14px", fontWeight: "700", color: "#0f172a", margin: "0 0 2px 0" }}>
                        Verification & Ambiguity Resolution
                      </h3>
                      <div style={{ fontSize: "12px", color: "#64748b" }}>
                        Verify parsed names, resolve any student ambiguities, and confirm marks before committing.
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
                      {submitting ? "Saving..." : "Save Verified Marks"}
                    </button>
                  </div>

                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                      <thead>
                        <tr style={{ background: "#f1f5f9", borderBottom: "1px solid #e2e8f0", textAlign: "left" }}>
                          <th style={{ padding: "10px 14px", color: "#475569" }}>Input Spoken Phrase</th>
                          <th style={{ padding: "10px 14px", color: "#475569" }}>Matched Student</th>
                          <th style={{ padding: "10px 14px", color: "#475569" }}>Score</th>
                          <th style={{ padding: "10px 14px", color: "#475569" }}>Max</th>
                          <th style={{ padding: "10px 14px", color: "#475569" }}>Status</th>
                          <th style={{ padding: "10px 14px", color: "#475569" }}>Action</th>
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
        </div>
      )}

      {/* TAB 3: AT-RISK STUDENTS */}
      {activeTab === "at-risk" && (
        <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "10px", overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid #e2e8f0", background: "#f8fafc" }}>
            <h3 style={{ fontSize: "14px", fontWeight: "700", color: "#0f172a", margin: "0 0 2px 0" }}>
              At-Risk Students in this Course Offering
            </h3>
            <div style={{ fontSize: "12px", color: "#64748b" }}>
              Students requiring early academic intervention based on statutory attendance and multi-factor assessment trends.
            </div>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
              <thead>
                <tr style={{ background: "#f1f5f9", borderBottom: "1px solid #e2e8f0", textAlign: "left" }}>
                  <th style={{ padding: "10px 14px", color: "#475569" }}>Reg. Number</th>
                  <th style={{ padding: "10px 14px", color: "#475569" }}>Student Name</th>
                  <th style={{ padding: "10px 14px", color: "#475569" }}>Attendance</th>
                  <th style={{ padding: "10px 14px", color: "#475569" }}>Risk Level</th>
                  <th style={{ padding: "10px 14px", color: "#475569" }}>Risk Factors</th>
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
