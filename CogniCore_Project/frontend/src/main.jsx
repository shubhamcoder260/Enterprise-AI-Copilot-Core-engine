import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import "./style.css";

function App() {
  const [organization, setOrganization] = useState("college");
  const [query, setQuery] = useState("");

  const [messages, setMessages] = useState([
    {
      type: "ai",
      text: "Hello! I'm CogniCore, your AI analytics assistant. Ask me anything about your organization data."
    }
  ]);

  const [loading, setLoading] = useState(false);

  // DATABASE UPLOAD STATES
  const [selectedDatabase, setSelectedDatabase] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState("");


  // ==========================================
  // ASK COGNICORE
  // ==========================================

  async function askCogniCore(customQuery = null) {
    const question = customQuery || query;

    if (!question.trim() || loading) return;

    const userMessage = {
      type: "user",
      text: question
    };

    setMessages((previous) => [...previous, userMessage]);

    setQuery("");
    setLoading(true);

    try {
      const response = await fetch(
        "http://localhost:5000/api/ai/query",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            query: question,
            organization,
            role: "admin"
          })
        }
      );

      const result = await response.json();

      setMessages((previous) => [
        ...previous,
        {
          type: "ai",
          text: result.answer || "I could not generate an answer.",
          result
        }
      ]);

    } catch (error) {
      console.error(error);

      setMessages((previous) => [
        ...previous,
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


  // ==========================================
  // UPLOAD DATABASE
  // ==========================================

  async function uploadDatabase() {
    if (!selectedDatabase || uploading) return;

    setUploading(true);
    setUploadStatus("Uploading database...");

    try {
      const formData = new FormData();

      formData.append("database", selectedDatabase);

      const response = await fetch(
        "http://localhost:5000/api/database/upload",
        {
          method: "POST",
          body: formData
        }
      );

      const result = await response.json();

      if (result.success) {

        setUploadStatus(
          `✅ ${selectedDatabase.name} uploaded and activated successfully!`
        );

        setMessages((previous) => [
          ...previous,
          {
            type: "ai",
            text: `Database "${selectedDatabase.name}" is now active. You can ask me questions about its data.`
          }
        ]);

        setSelectedDatabase(null);

      } else {

        setUploadStatus(
          `❌ Upload failed: ${result.message || "Unknown error"}`
        );

      }

    } catch (error) {
      console.error(error);

      setUploadStatus(
        "❌ Cannot connect to the backend. Make sure the backend is running."
      );

    } finally {
      setUploading(false);
    }
  }


  // ==========================================
  // KEYBOARD HANDLER
  // ==========================================

  function handleKeyDown(event) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      askCogniCore();
    }
  }


  // ==========================================
  // NEW CHAT
  // ==========================================

  function startNewChat() {
    setMessages([
      {
        type: "ai",
        text: "New conversation started. What would you like to know?"
      }
    ]);

    setQuery("");
  }


  // ==========================================
  // USE EXAMPLE
  // ==========================================

  function useExample(example) {
    setQuery(example);
  }


  // ==========================================
  // UI
  // ==========================================

  return (
    <div className="app">

      {/* SIDEBAR */}

      <aside className="sidebar">

        <div className="logo">
          <div className="logo-icon">C</div>

          <div>
            <h2>CogniCore</h2>
            <span>AI Analytics Engine</span>
          </div>
        </div>


        <button
          className="new-chat"
          onClick={startNewChat}
        >
          + New Chat
        </button>


        {/* DATABASE UPLOAD */}

        <div className="database-upload">

          <p className="sidebar-title">
            DATABASE
          </p>


          <input
            type="file"
            accept=".db,.sqlite,.sqlite3"
            id="database-file"
            style={{ display: "none" }}
            onChange={(event) => {

              if (
                event.target.files &&
                event.target.files[0]
              ) {

                setSelectedDatabase(
                  event.target.files[0]
                );

                setUploadStatus("");
              }
            }}
          />


          <label
            htmlFor="database-file"
            className="upload-select-button"
          >
            📁 Choose Database
          </label>


          {selectedDatabase && (
            <div className="selected-file">
              📄 {selectedDatabase.name}
            </div>
          )}


          <button
            className="upload-button"
            onClick={uploadDatabase}
            disabled={
              !selectedDatabase || uploading
            }
          >
            {uploading
              ? "Uploading..."
              : "⬆ Upload Database"}
          </button>


          {uploadStatus && (
            <p className="upload-status">
              {uploadStatus}
            </p>
          )}

        </div>


        {/* ORGANIZATION */}

        <div className="sidebar-section">

          <p className="sidebar-title">
            ORGANIZATION
          </p>


          <button
            className={`organization-button ${
              organization === "college"
                ? "active"
                : ""
            }`}
            onClick={() =>
              setOrganization("college")
            }
          >
            🎓 Education
          </button>


          <button
            className={`organization-button ${
              organization === "hospital"
                ? "active"
                : ""
            }`}
            onClick={() =>
              setOrganization("hospital")
            }
          >
            🏥 Hospital
          </button>

        </div>


        <div className="sidebar-bottom">

          <div className="status">
            <span className="status-dot"></span>
            System Online
          </div>

          <p>CogniCore AI v1.0</p>

        </div>

      </aside>


      {/* MAIN CHAT AREA */}

      <main className="chat-container">


        {/* HEADER */}

        <header className="chat-header">

          <div>

            <h1>CogniCore AI</h1>

            <p>
              {organization === "college"
                ? "Education Analytics Workspace"
                : "Hospital Analytics Workspace"}
            </p>

          </div>


          <div className="header-status">

            <span className="status-dot"></span>

            Connected

          </div>

        </header>


        {/* MESSAGES */}

        <div className="messages">

          {messages.map((message, index) => (

            <div
              key={index}
              className={`message-row ${message.type}`}
            >

              <div className="avatar">
                {message.type === "ai"
                  ? "AI"
                  : "YOU"}
              </div>


              <div className="message-content">

                <div className="message-label">

                  {message.type === "ai"
                    ? "CogniCore"
                    : "You"}

                </div>


                <div
                  className={`message-bubble ${
                    message.error
                      ? "error-message"
                      : ""
                  }`}
                >

                  <p>{message.text}</p>


                  {message.result && (

                    <div className="result-card">

                      <div className="result-grid">


                        <div className="result-item">

                          <span>Engine</span>

                          <strong>

                            {message.result.meta?.engineMode ===
                            "dynamic_query"
                              ? "Dynamic Query"
                              : "Configured Tool"}

                          </strong>

                        </div>


                        <div className="result-item">

                          <span>Tool</span>

                          <strong>

                            {message.result.tool || "N/A"}

                          </strong>

                        </div>


                        {message.result.data?.value !==
                          undefined && (

                          <div className="result-item highlight">

                            <span>Result</span>

                            <strong>

                              {message.result.data.value}

                            </strong>

                          </div>

                        )}

                      </div>


                      {message.result.data?.records &&
                        message.result.data.records.length > 0 && (

                          <details>

                            <summary>

                              View matching records (
                              {message.result.data.records.length}
                              )

                            </summary>


                            <pre>

                              {JSON.stringify(
                                message.result.data.records,
                                null,
                                2
                              )}

                            </pre>

                          </details>

                        )}

                    </div>

                  )}

                </div>

              </div>

            </div>

          ))}


          {loading && (

            <div className="message-row ai">

              <div className="avatar">
                AI
              </div>


              <div className="message-content">

                <div className="message-label">
                  CogniCore
                </div>


                <div className="message-bubble thinking">

                  <span></span>
                  <span></span>
                  <span></span>

                </div>

              </div>

            </div>

          )}

        </div>


        {/* EXAMPLES */}

        <div className="examples-container">

          <p>Try asking:</p>


          <div className="examples">

            <button
              onClick={() =>
                useExample(
                  "How many students are there?"
                )
              }
            >
              How many students are there?
            </button>


            <button
              onClick={() =>
                useExample(
                  "Show students from Nepal"
                )
              }
            >
              Show students from Nepal
            </button>


            <button
              onClick={() =>
                useExample(
                  "Show students with CGPA above 8.5"
                )
              }
            >
              CGPA above 8.5
            </button>


            <button
              onClick={() =>
                useExample(
                  "How many patients visited cardiology in September 2026?"
                )
              }
            >
              Cardiology visits
            </button>

          </div>

        </div>


        {/* INPUT */}

        <div className="input-area">

          <div className="input-box">

            <textarea
              placeholder="Ask CogniCore about your organization data..."
              value={query}
              onChange={(event) =>
                setQuery(event.target.value)
              }
              onKeyDown={handleKeyDown}
            />


            <button
              className="send-button"
              onClick={() => askCogniCore()}
              disabled={
                loading || !query.trim()
              }
            >

              {loading ? "..." : "➤"}

            </button>

          </div>


          <p className="input-hint">

            Press Enter to send • Shift + Enter for a new line

          </p>

        </div>

      </main>

    </div>
  );
}


createRoot(
  document.getElementById("root")
).render(<App />);