import React, { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import "./style.css";
import {
  SESSION_STORAGE_KEY, MODEL_STORAGE_KEY, generateSessionId, getInitialSessionId,
  getInitialModel, fetchModels as apiFetchModels, fetchSessionHistory as apiFetchSessionHistory, sendQuery as apiSendQuery
} from "./lib/api.js";
import DatabaseSidebar from "./components/DatabaseSidebar.jsx";
import ChatWindow from "./components/ChatWindow.jsx";
import SqlModal from "./components/SqlModal.jsx";

// Academic Monitoring Portal Components (Hackathon R1 - R7)
import AcademicPortalHome from "./components/academic/AcademicPortalHome.jsx";
import StudentDashboard from "./components/academic/StudentDashboard.jsx";
import FacultyConsole from "./components/academic/FacultyConsole.jsx";
import AdminDashboard from "./components/academic/AdminDashboard.jsx";

function App() {
  // Navigation & View Mode
  const [activeView, setActiveView] = useState("academic"); // 'academic' or 'enterprise'
  const [academicRole, setAcademicRole] = useState(null); // null (home), 'student', 'faculty', 'admin'
  const [academicUser, setAcademicUser] = useState(null);
  const [academicStudentProfile, setAcademicStudentProfile] = useState(null);
  const [academicLoading, setAcademicLoading] = useState(false);
  const [showCopilotDock, setShowCopilotDock] = useState(false);

  // CogniCore Copilot Chat States
  const [sessionId, setSessionId] = useState(getInitialSessionId);
  const [organization, setOrganization] = useState("college");
  const [query, setQuery] = useState("");
  const [selectedModel, setSelectedModel] = useState(getInitialModel);
  const [availableModels, setAvailableModels] = useState(["gemma3:4b"]);
  const [llmOnline, setLlmOnline] = useState(true);
  const [loading, setLoading] = useState(false);
  const [inspectorTarget, setInspectorTarget] = useState(null);
  const [messages, setMessages] = useState([
    { type: "ai", text: "Hello! I'm CogniCore, your AI analytics assistant. Ask me anything about your university records or academic data." }
  ]);

  // Load models on boot
  useEffect(() => {
    (async () => {
      try {
        const data = await apiFetchModels();
        if (Array.isArray(data.models) && data.models.length > 0) {
          setAvailableModels(data.models);
          setLlmOnline(data.available !== false);
          if (!data.models.includes(selectedModel)) {
            const fallback = data.current || data.models[0];
            setSelectedModel(fallback);
            try { localStorage.setItem(MODEL_STORAGE_KEY, fallback); } catch {}
          }
        }
      } catch (err) {
        console.warn("Could not reach LLM models endpoint:", err);
        setLlmOnline(false);
      }
    })();
  }, []);

  // Hydrate chat history
  useEffect(() => {
    (async () => {
      const active = getInitialSessionId();
      if (!active) return;
      try {
        const data = await apiFetchSessionHistory(active);
        const list = data.exchanges || data.history;
        if (Array.isArray(list) && list.length > 0) {
          const hydrated = list.flatMap((ex) => [
            ex.question && { type: "user", text: ex.question },
            (ex.answer || ex.sql) && {
              type: "ai", text: ex.answer || "Query executed successfully.",
              result: { source: ex.source || "unknown", meta: { model: ex.model }, data: ex.sql ? { sql: ex.sql } : null }
            }
          ].filter(Boolean));
          if (hydrated.length > 0) setMessages(hydrated);
        }
      } catch (err) { console.warn("Could not hydrate history:", err); }
    })();
  }, []);

  // Quick Demo Login Handler
  async function handleQuickLogin(role, id = null) {
    try {
      setAcademicLoading(true);
      const res = await fetch("http://localhost:5000/api/academic/auth/demo-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, studentId: id || 1, facultyId: id || 150 })
      });
      const data = await res.json();
      if (data.success && data.user) {
        setAcademicUser(data.user);
        setAcademicRole(role);

        if (role === "student") {
          const profRes = await fetch(`http://localhost:5000/api/academic/student/dashboard?studentId=${data.user.id}`);
          const profData = await profRes.json();
          if (profData.profile) setAcademicStudentProfile(profData.profile);
        }
      }
    } catch (err) {
      alert("Login failed: " + err.message);
    } finally {
      setAcademicLoading(false);
    }
  }

  // Reload student profile
  async function refreshStudentProfile() {
    if (!academicUser || academicUser.role !== "student") return;
    try {
      const res = await fetch(`http://localhost:5000/api/academic/student/dashboard?studentId=${academicUser.id}`);
      const data = await res.json();
      if (data.profile) setAcademicStudentProfile(data.profile);
    } catch (err) {
      console.error(err);
    }
  }

  // Copilot Query Sender
  async function askCogniCore(customQuery = null) {
    const question = customQuery || query;
    if (!question.trim() || loading) return;
    setMessages((prev) => [...prev, { type: "user", text: question }]);
    setQuery("");
    setLoading(true);
    try {
      const result = await apiSendQuery({ query: question, organization, sessionId, model: selectedModel });
      const respId = result.meta?.sessionId || result.sessionId;
      if (respId && respId !== sessionId) {
        setSessionId(respId);
        try { localStorage.setItem(SESSION_STORAGE_KEY, respId); } catch {}
      }
      setMessages((prev) => [...prev, { type: "ai", text: result.answer || "I could not generate an answer.", result }]);
    } catch (error) {
      console.error(error);
      setMessages((prev) => [...prev, { type: "ai", text: "Cannot connect to the backend.", error: true }]);
    } finally { setLoading(false); }
  }

  function startNewChat() {
    const newId = generateSessionId();
    try { localStorage.setItem(SESSION_STORAGE_KEY, newId); } catch {}
    setSessionId(newId);
    setMessages([{ type: "ai", text: "New conversation started. What would you like to know?" }]);
    setQuery("");
  }

  return (
    <div className="app-container" style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "#0b1120", color: "#f8fafc" }}>
      {/* Global Top Navbar */}
      <header style={{ height: "64px", background: "#0f172a", borderBottom: "1px solid #1e293b", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 24px", position: "sticky", top: 0, zIndex: 50 }}>
        {/* Brand */}
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer" }} onClick={() => { setActiveView("academic"); setAcademicRole(null); }}>
            <span style={{ fontSize: "24px" }}>🏛️</span>
            <div>
              <div style={{ fontSize: "16px", fontWeight: "800", letterSpacing: "-0.3px", color: "#f8fafc" }}>University X Academic Portal</div>
              <div style={{ fontSize: "11px", color: "#60a5fa", fontWeight: "600" }}>Powered by CogniCore Intelligence</div>
            </div>
          </div>

          {/* Primary View Switcher */}
          <div style={{ display: "flex", gap: "6px", marginLeft: "20px", background: "#1e293b", padding: "4px", borderRadius: "8px" }}>
            <button
              onClick={() => setActiveView("academic")}
              style={{
                padding: "6px 14px",
                borderRadius: "6px",
                fontSize: "12px",
                fontWeight: "700",
                border: "none",
                cursor: "pointer",
                background: activeView === "academic" ? "#2563eb" : "transparent",
                color: activeView === "academic" ? "#fff" : "#94a3b8"
              }}
            >
              🎓 Academic Monitoring Portal
            </button>
            <button
              onClick={() => setActiveView("enterprise")}
              style={{
                padding: "6px 14px",
                borderRadius: "6px",
                fontSize: "12px",
                fontWeight: "700",
                border: "none",
                cursor: "pointer",
                background: activeView === "enterprise" ? "#2563eb" : "transparent",
                color: activeView === "enterprise" ? "#fff" : "#94a3b8"
              }}
            >
              ⚙️ Enterprise Data Copilot
            </button>
          </div>
        </div>

        {/* Right Section: 1-Click Role Switcher & Copilot Dock Toggle */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          {activeView === "academic" && academicRole && (
            <div style={{ display: "flex", alignItems: "center", gap: "8px", background: "#1e293b", padding: "4px 12px", borderRadius: "999px", border: "1px solid #334155" }}>
              <span style={{ fontSize: "12px", color: "#94a3b8" }}>Demo Switch:</span>
              <button
                onClick={() => handleQuickLogin("student", 1)}
                style={{ background: academicRole === "student" ? "#2563eb" : "transparent", color: "#fff", border: "none", borderRadius: "6px", padding: "4px 8px", fontSize: "11px", fontWeight: "600", cursor: "pointer" }}
              >
                🎓 Student
              </button>
              <button
                onClick={() => handleQuickLogin("faculty", 150)}
                style={{ background: academicRole === "faculty" ? "#059669" : "transparent", color: "#fff", border: "none", borderRadius: "6px", padding: "4px 8px", fontSize: "11px", fontWeight: "600", cursor: "pointer" }}
              >
                👨‍🏫 Faculty
              </button>
              <button
                onClick={() => handleQuickLogin("admin")}
                style={{ background: academicRole === "admin" ? "#7c3aed" : "transparent", color: "#fff", border: "none", borderRadius: "6px", padding: "4px 8px", fontSize: "11px", fontWeight: "600", cursor: "pointer" }}
              >
                🏛️ Admin
              </button>
              <button
                onClick={() => { setAcademicRole(null); setAcademicUser(null); }}
                style={{ background: "transparent", color: "#f87171", border: "none", padding: "4px 8px", fontSize: "11px", fontWeight: "600", cursor: "pointer" }}
              >
                🚪 Exit
              </button>
            </div>
          )}

          {/* Copilot Chat Dock Toggle Button */}
          {activeView === "academic" && (
            <button
              onClick={() => setShowCopilotDock(!showCopilotDock)}
              style={{
                padding: "8px 16px",
                borderRadius: "8px",
                background: showCopilotDock ? "#2563eb" : "#334155",
                color: "#fff",
                fontWeight: "700",
                fontSize: "12px",
                border: "none",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "6px"
              }}
            >
              💬 {showCopilotDock ? "Hide AI Copilot" : "Open AI Copilot"}
            </button>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        
        {/* VIEW 1: Academic Portal Mode */}
        {activeView === "academic" ? (
          <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
            <div style={{ flex: 1, overflowY: "auto" }}>
              {academicRole === null && (
                <AcademicPortalHome
                  onQuickLogin={handleQuickLogin}
                  loading={academicLoading}
                />
              )}
              {academicRole === "student" && (
                <StudentDashboard
                  profile={academicStudentProfile}
                  onRefresh={refreshStudentProfile}
                  loading={academicLoading}
                />
              )}
              {academicRole === "faculty" && (
                <FacultyConsole
                  facultyUser={academicUser}
                  onLogout={() => { setAcademicRole(null); setAcademicUser(null); }}
                />
              )}
              {academicRole === "admin" && (
                <AdminDashboard />
              )}
            </div>

            {/* Collapsible Copilot Chat Dock on the Right */}
            {showCopilotDock && (
              <div style={{ width: "420px", borderLeft: "1px solid #1e293b", background: "#0f172a", display: "flex", flexDirection: "column" }}>
                <div style={{ padding: "14px 18px", borderBottom: "1px solid #1e293b", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontSize: "18px" }}>🤖</span>
                    <strong style={{ fontSize: "14px", color: "#f8fafc" }}>Academic AI Copilot</strong>
                  </div>
                  <button
                    onClick={() => setShowCopilotDock(false)}
                    style={{ background: "transparent", border: "none", color: "#94a3b8", fontSize: "16px", cursor: "pointer" }}
                  >
                    ✕
                  </button>
                </div>
                <div style={{ flex: 1, overflow: "hidden" }}>
                  <ChatWindow
                    organization={organization}
                    messages={messages}
                    loading={loading}
                    query={query}
                    onQueryChange={setQuery}
                    onSendQuery={() => askCogniCore()}
                    onUseExample={(ex) => askCogniCore(ex)}
                    onInspectSql={(res) => setInspectorTarget(res)}
                  />
                </div>
              </div>
            )}
          </div>
        ) : (
          /* VIEW 2: Full Enterprise Copilot Mode */
          <div className="app" style={{ flex: 1, display: "flex" }}>
            <DatabaseSidebar
              sessionId={sessionId}
              onNewChat={startNewChat}
              organization={organization}
              onSelectOrganization={setOrganization}
              selectedModel={selectedModel}
              availableModels={availableModels}
              llmOnline={llmOnline}
              onSelectModel={setSelectedModel}
              onDatabaseActivated={(name) => setMessages((p) => [...p, { type: "ai", text: `Database "${name}" is now active. You can ask me questions about its data.` }])}
            />
            <ChatWindow
              organization={organization}
              messages={messages}
              loading={loading}
              query={query}
              onQueryChange={setQuery}
              onSendQuery={() => askCogniCore()}
              onUseExample={(ex) => askCogniCore(ex)}
              onInspectSql={(res) => setInspectorTarget(res)}
            />
          </div>
        )}

        {/* SQL Modal Inspector */}
        <SqlModal
          isOpen={Boolean(inspectorTarget)}
          onClose={() => setInspectorTarget(null)}
          sql={inspectorTarget?.data?.sql || inspectorTarget?.sql}
          meta={inspectorTarget?.meta}
          source={inspectorTarget?.source}
          error={inspectorTarget?.error}
        />
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);