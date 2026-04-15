import { useRef, useEffect, useState } from "react";
import { Send, Trash2, Brain, Sparkles } from "lucide-react";
import { useStreamChat } from "../hooks/useStreamChat";
import ChatMessage from "./ChatMessage";
import ChatSkeleton from "./ChatSkeleton";

interface ChatPanelProps {
  onWikiLink: (slug: string) => void;
  brain?: string;
}

const SUGGESTIONS = [
  "What's in this knowledge base?",
  "Summarize the key topics",
  "What are the main entities?",
  "What concepts are covered?",
];

export default function ChatPanel({ onWikiLink, brain }: ChatPanelProps) {
  const { messages, isStreaming, sendMessage, clearMessages } = useStreamChat(brain);
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || isStreaming) return;
    setInput("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "36px";
    }
    sendMessage(msg);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleTextareaInput = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "36px";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  };

  const showSkeleton =
    isStreaming &&
    messages.length > 0 &&
    messages[messages.length - 1].role === "assistant" &&
    messages[messages.length - 1].content === "";

  return (
    <div className="chat-panel">
      <div className="chat-header">
        <div className="chat-header-icon">
          <Sparkles size={18} />
        </div>
        <div className="chat-header-info" style={{ flex: 1 }}>
          <h2>{brain || "Knowledge Base"}</h2>
          <span className="subtitle">Ask anything about this knowledge base</span>
        </div>
        {messages.length > 0 && (
          <button
            className="chat-clear-btn"
            onClick={clearMessages}
            title="Clear chat"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>

      <div className="chat-messages">
        {messages.length === 0 && (
          <div className="chat-empty">
            <div className="chat-empty-orb">
              <div className="chat-empty-orb-inner">
                <Brain size={32} />
              </div>
            </div>
            <div className="chat-empty-text">
              <h3>Ask your second brain</h3>
              <p>Query your wiki, explore concepts, and discover connections across your knowledge base.</p>
            </div>
            <div className="chat-empty-suggestions">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  className="chat-suggestion"
                  onClick={() => handleSend(s)}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((msg, i) => {
          if (showSkeleton && i === messages.length - 1 && msg.role === "assistant") {
            return <ChatSkeleton key={i} />;
          }
          if (msg.role === "assistant" && msg.content === "") return null;
          return (
            <ChatMessage
              key={i}
              role={msg.role}
              content={msg.content}
              onWikiLink={onWikiLink}
            />
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div className="chat-input-area">
        <div className="chat-input-wrap">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onInput={handleTextareaInput}
            onKeyDown={handleKeyDown}
            placeholder="Ask your knowledge base..."
            rows={1}
          />
          <button
            className="send-btn"
            onClick={() => handleSend()}
            disabled={!input.trim() || isStreaming}
          >
            {isStreaming ? <div className="spinner" /> : <Send size={16} />}
          </button>
        </div>
      </div>
    </div>
  );
}
