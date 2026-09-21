import React, { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import "./style.css";
import {
  SESSION_STORAGE_KEY,
  MODEL_STORAGE_KEY,
  generateSessionId,
  getInitialSessionId,
  getInitialModel,
  fetchModels as apiFetchModels,
  fetchSessionHistory as apiFetchSessionHistory,
  sendQuery as apiSendQuery
} from "./lib/api.js";
import DatabaseSidebar from "./components/DatabaseSidebar.jsx";
import ChatWindow from "./components/ChatWindow.jsx";
import SqlModal from "./components/SqlModal.jsx";

function App() {
  const [sessionId, setSessionId] = useState(getInitialSessionId);
  const [organization, setOrganization] = useState("college");
  const [query, setQuery] = useState("");
  const [selectedModel, setSelectedModel] = useState(getInitialModel);
  const [availableModels, setAvailableModels] = useState(["gemma3:4b"]);
  const [llmOnline, setLlmOnline] = useState(true);
  const [messages, setMessages] = useState([
    {
      type: "ai",
      text: "Hello! I'm CogniCore, your AI analytics assistant. Ask me anything about your organization data."
    }
  ]);
  const [loading, setLoading] = useState(false);
  const [inspectorTarget, setInspectorTarget] = useState(null);

  useEffect(() => {
    async function loadModels() {
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
    }
    loadModels();
  }, []);

  useEffect(() => {
    async function hydrateHistory() {
      const activeSession = getInitialSessionId();
      if (!activeSession) return;
      try {
        const data = await apiFetchSessionHistory(activeSession);
        const list = data.exchanges || data.history;
        if (Array.isArray(list) && list.length > 0) {
          const hydrated = [];
          for (const ex of list) {
            if (ex.question) hydrated.push({ type: "user", text: ex.question });
            if (ex.answer || ex.sql) {
              hydrated.push({
                type: "ai",
                text: ex.answer || (ex.sql ? "Query executed successfully." : ""),
                result: {
                  source: ex.source || "unknown",
                  meta: { model: ex.model },
                  data: ex.sql ? { sql: ex.sql } : null
                }
              });
            }
          }
          if (hydrated.length > 0) setMessages(hydrated);
        }
      } catch (err) {
        console.warn("Could not hydrate conversation history:", err);
      }
    }
    hydrateHistory();
  }, []);

  async function askCogniCore(customQuery = null) {
    const question = customQuery || query;
    if (!question.trim() || loading) return;

    setMessages((prev) => [...prev, { type: "user", text: question }]);
    setQuery("");
    setLoading(true);

    try {
      const result = await apiSendQuery({
        query: question,
        organization,
        sessionId,
        model: selectedModel
      });

      const respSessionId = result.meta?.sessionId || result.sessionId;
      if (respSessionId && respSessionId !== sessionId) {
        setSessionId(respSessionId);
        try { localStorage.setItem(SESSION_STORAGE_KEY, respSessionId); } catch {}
      }

      setMessages((prev) => [
        ...prev,
        { type: "ai", text: result.answer || "I could not generate an answer.", result }
      ]);
    } catch (error) {
      console.error(error);
      setMessages((prev) => [
        ...prev,
        {
          type: "ai",
          text: "Cannot connect to the backend. Please make sure the backend server is running.",
          error: true
        }
      ]);
    } finally {
      setLoading(false);
    }
  }

  function startNewChat() {
    const newSessionId = generateSessionId();
    try { localStorage.setItem(SESSION_STORAGE_KEY, newSessionId); } catch {}
    setSessionId(newSessionId);
    setMessages([
      { type: "ai", text: "New conversation started. What would you like to know?" }
    ]);
    setQuery("");
  }

  return (
    <div className="app">
      <DatabaseSidebar
        sessionId={sessionId}
        onNewChat={startNewChat}
        organization={organization}
        onSelectOrganization={setOrganization}
        selectedModel={selectedModel}
        availableModels={availableModels}
        llmOnline={llmOnline}
        onSelectModel={setSelectedModel}
        onDatabaseActivated={(dbName) =>
          setMessages((prev) => [
            ...prev,
            { type: "ai", text: `Database "${dbName}" is now active. You can ask me questions about its data.` }
          ])
        }
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
      <SqlModal
        isOpen={Boolean(inspectorTarget)}
        onClose={() => setInspectorTarget(null)}
        sql={inspectorTarget?.data?.sql || inspectorTarget?.sql}
        meta={inspectorTarget?.meta}
        source={inspectorTarget?.source}
        error={inspectorTarget?.error}
      />
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);