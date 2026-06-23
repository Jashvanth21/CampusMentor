import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import apiService from "../../../api/apiService";
import { useAuth } from "../../../context/AuthContext";

const MAX_MESSAGE_LENGTH = 500;
const MAX_STORED_MESSAGES = 10;
const MAX_SENT_HISTORY = 6;

const StudentChatbot = () => {
  const location = useLocation();
  const { token } = useAuth();
  const [studentId, setStudentId] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState("");
  const scrollRef = useRef(null);

  const isStudentRoute = location.pathname.startsWith("/student");
  const isTestRoute = location.pathname.startsWith("/student/test/");
  const storageKey = useMemo(
    () => (studentId ? `student_chatbot_history_${studentId}` : "student_chatbot_history_guest"),
    [studentId]
  );

  useEffect(() => {
    let isMounted = true;

    const loadUser = async () => {
      if (!token || !isStudentRoute) {
        return;
      }

      try {
        const user = await apiService.getCurrentUser();
        if (isMounted) {
          setStudentId(user?._id || "");
        }
      } catch (requestError) {
        if (isMounted) {
          setStudentId("");
        }
      }
    };

    loadUser();

    return () => {
      isMounted = false;
    };
  }, [isStudentRoute, token]);

  useEffect(() => {
    if (!storageKey) {
      return;
    }

    try {
      const raw = localStorage.getItem(storageKey);
      const parsed = raw ? JSON.parse(raw) : [];
      setMessages(Array.isArray(parsed) ? parsed : []);
    } catch (storageError) {
      setMessages([]);
    }
  }, [storageKey]);

  useEffect(() => {
    if (!storageKey) {
      return;
    }

    localStorage.setItem(storageKey, JSON.stringify(messages.slice(-MAX_STORED_MESSAGES)));
  }, [messages, storageKey]);

  useEffect(() => {
    if (!isOpen || !scrollRef.current) {
      return;
    }

    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [isOpen, messages, isSending]);

  useEffect(() => {
    if (isTestRoute) {
      setIsOpen(false);
    }
  }, [isTestRoute]);

  if (!isStudentRoute || isTestRoute) {
    return null;
  }

  const handleSend = async () => {
    const trimmedMessage = message.trim();
    if (!trimmedMessage || isSending) {
      return;
    }

    if (trimmedMessage.length > MAX_MESSAGE_LENGTH) {
      setError(`Message must be ${MAX_MESSAGE_LENGTH} characters or fewer.`);
      return;
    }

    const userMessage = {
      id: `${Date.now()}-user`,
      role: "user",
      content: trimmedMessage
    };
    const recentHistory = messages
      .slice(-MAX_SENT_HISTORY)
      .map((entry) => ({ role: entry.role, content: entry.content }));

    setError("");
    setMessages((prev) => [...prev, userMessage].slice(-MAX_STORED_MESSAGES));
    setMessage("");
    setIsSending(true);

    try {
      let resolvedStudentId = studentId;
      if (!resolvedStudentId) {
        const user = await apiService.getCurrentUser();
        resolvedStudentId = user?._id || "";
        setStudentId(resolvedStudentId);
      }

      const response = await apiService.sendStudentChatMessage({
        message: trimmedMessage,
        studentId: resolvedStudentId,
        chatHistory: recentHistory
      });

      const assistantMessage = {
        id: `${Date.now()}-assistant`,
        role: "assistant",
        content: response?.reply || "I could not generate a response right now.",
        source: response?.source || "ai"
      };

      setMessages((prev) => [...prev, assistantMessage].slice(-MAX_STORED_MESSAGES));
    } catch (requestError) {
      setError(requestError?.response?.data?.message || "Unable to reach the AI mentor right now.");
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="student-chatbot-root">
      {isOpen ? (
        <section className="student-chatbot-panel" aria-label="AI mentor chat">
          <div className="student-chatbot-head">
            <div>
              <p className="student-chatbot-kicker">AI Mentor</p>
              <h3>Placement Doubt Solver</h3>
            </div>
            <button type="button" className="student-chatbot-close" onClick={() => setIsOpen(false)}>
              Close
            </button>
          </div>

          <div className="student-chatbot-messages" ref={scrollRef}>
            {messages.length === 0 ? (
              <article className="student-chatbot-empty">
                <strong>Ask anything about coding, aptitude, interviews, or placement prep.</strong>
                <p>I will answer using your student context when available.</p>
              </article>
            ) : (
              messages.map((entry) => (
                <article
                  className={`student-chatbot-message ${entry.role === "assistant" ? "assistant" : "user"}`}
                  key={entry.id}
                >
                  <div className="student-chatbot-bubble">
                    <p>{entry.content}</p>
                  </div>
                </article>
              ))
            )}

            {isSending ? (
              <article className="student-chatbot-message assistant">
                <div className="student-chatbot-bubble student-chatbot-typing">
                  <span />
                  <span />
                  <span />
                </div>
              </article>
            ) : null}
          </div>

          <div className="student-chatbot-compose">
            {error ? <p className="dashboard-inline-hint error-text">{error}</p> : null}
            <div className="student-chatbot-input-row">
              <textarea
                className="student-chatbot-input"
                rows={2}
                maxLength={MAX_MESSAGE_LENGTH}
                placeholder="Ask your placement doubt..."
                value={message}
                onChange={(event) => {
                  setError("");
                  setMessage(event.target.value);
                }}
                onKeyDown={handleKeyDown}
              />
              <button type="button" className="student-chatbot-send" onClick={handleSend} disabled={isSending}>
                Send
              </button>
            </div>
            <p className="student-chatbot-counter">{message.length}/{MAX_MESSAGE_LENGTH}</p>
          </div>
        </section>
      ) : null}

      <button
        type="button"
        className="student-chatbot-trigger"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label="Open AI mentor chat"
      >
        <span className="student-chatbot-trigger__label">AI</span>
      </button>
    </div>
  );
};

export default StudentChatbot;
