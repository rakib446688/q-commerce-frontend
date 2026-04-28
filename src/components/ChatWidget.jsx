import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { sendChatMessage } from "../lib/chatApi";

const INITIAL_MESSAGES = [
  {
    role: "assistant",
    content: "Hi! I'm your Q-Commerce assistant. Ask me about products, sizes, or your recent orders.",
  },
];

export default function ChatWidget() {
  const { session } = useAuth();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState(INITIAL_MESSAGES);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const chatEndRef = useRef(null);

  useEffect(() => {
    function handleToggle(event) {
      const prompt = typeof event?.detail?.prompt === "string" ? event.detail.prompt : "";
      if (event?.detail?.open === true) {
        setOpen(true);
      } else if (event?.detail?.open === false) {
        setOpen(false);
      } else {
        setOpen((prev) => !prev);
      }

      if (prompt) {
        setOpen(true);
        setInput(prompt);
      }
    }

    window.addEventListener("qcommerce:toggle-chat", handleToggle);
    return () => window.removeEventListener("qcommerce:toggle-chat", handleToggle);
  }, []);

  useEffect(() => {
    if (!open) return;
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [open, messages, loading]);

  const accessToken = useMemo(() => session?.access_token || "", [session?.access_token]);

  async function handleSend() {
    const trimmed = input.trim();
    if (!trimmed || loading) return;

    setError("");
    setInput("");

    const nextMessages = [...messages, { role: "user", content: trimmed }];
    setMessages(nextMessages);
    setLoading(true);

    try {
      const reply = await sendChatMessage({
        message: trimmed,
        messages: nextMessages,
        accessToken,
      });
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch (err) {
      const message = err?.message || "Assistant is unavailable right now.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {open ? (
        <div className="chat" role="dialog" aria-modal="false" aria-label="Q Assistant chat">
          <div className="chatHead">
            <strong>Q Assistant</strong>
            <button className="btn" type="button" onClick={() => setOpen(false)}>
              Close
            </button>
          </div>
          <div className="chatBody">
            {messages.map((message, index) => (
              <div
                key={`${message.role}-${index}`}
                className={`bubble ${message.role === "user" ? "chatUser" : "chatAssistant"}`}
              >
                {message.content}
              </div>
            ))}
            {loading ? <div className="bubble chatAssistant">Thinking...</div> : null}
            {error ? <div className="bubble chatError">{error}</div> : null}
            <div ref={chatEndRef} />
          </div>
          <div className="chatFoot">
            <input
              className="input"
              placeholder="Type a message..."
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  handleSend();
                }
              }}
            />
            <button className="btnPrimary" type="button" onClick={handleSend} disabled={loading}>
              {loading ? "..." : "Send"}
            </button>
          </div>
        </div>
      ) : null}
      <button className="fab" type="button" onClick={() => setOpen((prev) => !prev)} title="Assistant">
        Q
      </button>
    </>
  );
}
