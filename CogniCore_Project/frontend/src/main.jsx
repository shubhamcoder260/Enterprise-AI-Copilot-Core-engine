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
import { UniversitySeal, GraduationCapIcon, UserCheckIcon, ShieldBuildingIcon, BookOpenIcon } from "./components/academic/Icons.jsx";

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

  // Credential-based Login Handler (Email/Roll + Password)
  async function handleCredentialLogin(identifier, password, role) {
    try {
      setAcademicLoading(true);
      const res = await fetch("http://localhost:5000/api/academic/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, password, role })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || "Authentication failed." };
      }
      if (data.token) {
        try { localStorage.setItem("cognicore_auth_token", data.token); } catch {}
      }
      setAcademicUser(data.user);
      setAcademicRole(data.user.role);

      if (data.user.role === "student") {
        const profRes = await fetch(`http://localhost:5000/api/academic/student/dashboard?studentId=${data.user.id}`);
        const profData = await profRes.json();
        if (profData.profile) setAcademicStudentProfile(profData.profile);
      }
      return { success: true, user: data.user };
    } catch (err) {
      return { success: false, error: err.message };
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
    <div className="app-container" style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "#f8fafc", color: "#0f172a" }}>
      {/* Global Institutional Top Navbar */}
      <header style={{ height: "60px", background: "#0f2942", borderBottom: "1px solid #1e3a5f", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 24px", position: "sticky", top: 0, zIndex: 50, color: "#ffffff" }}>
        {/* Brand */}
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer" }} onClick={() => { setActiveView("academic"); setAcademicRole(null); }}>
            <div style={{ width: "34px", height: "34px", borderRadius: "8px", background: "#1e3a5f", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <UniversitySeal size={22} color="#ffffff" />
            </div>
            <div>
              <div style={{ fontSize: "14px", fontWeight: "800", letterSpacing: "0.5px", color: "#ffffff" }}>UNIVERSITY X</div>
              <div style={{ fontSize: "11px", color: "#93c5fd", fontWeight: "500" }}>Academic Information System (AIS)</div>
            </div>
          </div>

          {/* Primary View Switcher */}
          <div style={{ display: "flex", gap: "4px", marginLeft: "16px", background: "#0a1c2e", padding: "3px", borderRadius: "6px", border: "1px solid #1e3a5f" }}>
            <button
              onClick={() => setActiveView("academic")}
              style={{
                padding: "5px 12px",
                borderRadius: "4px",
                fontSize: "12px",
                fontWeight: "600",
                border: "none",
                cursor: "pointer",
                background: activeView === "academic" ? "#1e3a5f" : "transparent",
                color: activeView === "academic" ? "#ffffff" : "#94a3b8"
              }}
            >
              Academic Records
            </button>
            <button
              onClick={() => setActiveView("enterprise")}
              style={{
                padding: "5px 12px",
                borderRadius: "4px",
                fontSize: "12px",
                fontWeight: "600",
                border: "none",
                cursor: "pointer",
                background: activeView === "enterprise" ? "#1e3a5f" : "transparent",
                color: activeView === "enterprise" ? "#ffffff" : "#94a3b8"
              }}
            >
              Data Terminal
            </button>
          </div>
        </div>

        {/* Right Section: Evaluator Quick-Role Switcher & Query Terminal Toggle */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          {activeView === "academic" && academicRole && (
            <div style={{ display: "flex", alignItems: "center", gap: "6px", background: "#0a1c2e", padding: "4px 8px", borderRadius: "6px", border: "1px solid #1e3a5f" }}>
              <span style={{ fontSize: "11px", color: "#94a3b8", marginRight: "4px" }}>Evaluation Switch:</span>
              <button
                onClick={() => handleQuickLogin("student", 1)}
                style={{ background: academicRole === "student" ? "#1e3a8a" : "transparent", color: "#fff", border: "none", borderRadius: "4px", padding: "4px 8px", fontSize: "11px", fontWeight: "600", cursor: "pointer" }}
              >
                Student
              </button>
              <button
                onClick={() => handleQuickLogin("faculty", 1)}
                style={{ background: academicRole === "faculty" ? "#065f46" : "transparent", color: "#fff", border: "none", borderRadius: "4px", padding: "4px 8px", fontSize: "11px", fontWeight: "600", cursor: "pointer" }}
              >
                Faculty
              </button>
              <button
                onClick={() => handleQuickLogin("admin")}
                style={{ background: academicRole === "admin" ? "#581c87" : "transparent", color: "#fff", border: "none", borderRadius: "4px", padding: "4px 8px", fontSize: "11px", fontWeight: "600", cursor: "pointer" }}
              >
                Registrar
              </button>
              <button
                onClick={() => { setAcademicRole(null); setAcademicUser(null); }}
                style={{ background: "transparent", color: "#fca5a5", border: "none", padding: "4px 8px", fontSize: "11px", fontWeight: "600", cursor: "pointer" }}
              >
                Sign Out
              </button>
            </div>
          )}

          {/* Copilot Chat Dock Toggle Button */}
          {activeView === "academic" && (
            <button
              onClick={() => setShowCopilotDock(!showCopilotDock)}
              style={{
                padding: "6px 14px",
                borderRadius: "6px",
                background: showCopilotDock ? "#1e3a8a" : "#1e3a5f",
                color: "#ffffff",
                fontWeight: "600",
                fontSize: "12px",
                border: "none",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "6px"
              }}
            >
              <BookOpenIcon size={14} color="#ffffff" />
              {showCopilotDock ? "Close Data Terminal" : "Query Terminal"}
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
                  onCredentialLogin={handleCredentialLogin}
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
                    <BookOpenIcon size={16} color="#93c5fd" />
                    <strong style={{ fontSize: "14px", color: "#f8fafc" }}>Academic Analytics Terminal</strong>
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