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

function App() {
  const [sessionId, setSessionId] = useState(getInitialSessionId);
  const [organization, setOrganization] = useState("college");
  const [query, setQuery] = useState("");
  const [selectedModel, setSelectedModel] = useState(getInitialModel);
  const [availableModels, setAvailableModels] = useState(["gemma3:4b"]);
  const [llmOnline, setLlmOnline] = useState(true);
  const [loading, setLoading] = useState(false);
  const [inspectorTarget, setInspectorTarget] = useState(null);
  const [messages, setMessages] = useState([
    { type: "ai", text: "Hello! I'm CogniCore, your AI analytics assistant. Ask me anything about your organization data." }
  ]);

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
    <div className="app">
      <DatabaseSidebar
        sessionId={sessionId} onNewChat={startNewChat} organization={organization}
        onSelectOrganization={setOrganization} selectedModel={selectedModel} availableModels={availableModels}
        llmOnline={llmOnline} onSelectModel={setSelectedModel}
        onDatabaseActivated={(name) => setMessages((p) => [...p, { type: "ai", text: `Database "${name}" is now active. You can ask me questions about its data.` }])}
      />
      <ChatWindow
        organization={organization} messages={messages} loading={loading} query={query}
        onQueryChange={setQuery} onSendQuery={() => askCogniCore()} onUseExample={(ex) => askCogniCore(ex)}
        onInspectSql={(res) => setInspectorTarget(res)}
      />
      <SqlModal
        isOpen={Boolean(inspectorTarget)} onClose={() => setInspectorTarget(null)}
        sql={inspectorTarget?.data?.sql || inspectorTarget?.sql}
        meta={inspectorTarget?.meta} source={inspectorTarget?.source} error={inspectorTarget?.error}
      />
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);