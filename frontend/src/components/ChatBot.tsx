import { useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { animate } from 'animejs';
import './ChatBot.css';

export interface ChatMessage {
  role: 'user' | 'bot';
  text: string;
  seedNodes?: string[];
  traversedNodes?: string[];
  contextNodes?: string[];
}

interface ChatBotProps {
  messages: ChatMessage[];
  onSend: (message: string) => void;
  chatEnabled: boolean;
  isLoading: boolean;
  onToggleHighlight?: (
    mode: 'seeds' | 'traversed' | 'context',
    seedNodes: string[],
    traversedNodes: string[],
    contextNodes: string[]
  ) => void;
  streamingIndex?: number | null;
}

export default function ChatBot({
  messages,
  onSend,
  chatEnabled,
  isLoading,
  onToggleHighlight,
  streamingIndex,
}: ChatBotProps) {
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const lastMessageCountRef = useRef(0);
  // Track which message indices have been revealed (animated or streamed)
  // so React re-renders never reset their opacity back to 0.
  const revealedRef = useRef<Set<number>>(new Set());

  // Pre-reveal messages that already exist on mount (e.g. the welcome message)
  useEffect(() => {
    for (let i = 0; i < messages.length; i++) {
      revealedRef.current.add(i);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-scroll and fade in new messages
  useEffect(() => {
    if (!chatContainerRef.current) return;

    if (messages.length > lastMessageCountRef.current) {
      const newMessages = chatContainerRef.current.querySelectorAll(
        '.message:not(.animated):not(.streaming)'
      );
      newMessages.forEach((msg, idx) => {
        msg.classList.add('animated');
        // Mark as revealed so future re-renders keep opacity 1
        const msgIndex = lastMessageCountRef.current + idx;
        revealedRef.current.add(msgIndex);
        animate(msg as HTMLElement, {
          opacity: [0, 1],
          duration: 300,
          ease: 'out(3)',
        });
      });
    }

    lastMessageCountRef.current = messages.length;
    chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
  }, [messages]);

  // Keep scrolling to bottom during streaming updates
  useEffect(() => {
    if (streamingIndex !== null && chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  });

  const handleSend = () => {
    const value = inputRef.current?.value.trim();
    if (!value) return;
    onSend(value);
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSend();
  };

  const handleToggleClick = (
    mode: 'seeds' | 'traversed' | 'context',
    seedNodes: string[],
    traversedNodes: string[],
    contextNodes: string[]
  ) => {
    onToggleHighlight?.(mode, seedNodes, traversedNodes, contextNodes);
  };

  return (
    <div className="chatbot-container">
      <div className="chat-header">
        <span>Knowledge Assistant</span>
        {isLoading && <div className="chat-spinner" />}
      </div>
      <div ref={chatContainerRef} className="chat-messages">
        {messages.map((msg, i) => {
          const isStreaming = streamingIndex === i;
          // Persist visibility: once a message is streamed, keep it revealed
          if (isStreaming) revealedRef.current.add(i);
          const isVisible = isStreaming || revealedRef.current.has(i);
          return (
          <div
            key={i}
            className={`message ${msg.role}${isStreaming ? ' streaming' : ''}`}
            style={{ opacity: isVisible ? 1 : 0 }}
          >
            <div className="message-content">
              {msg.role === 'bot' ? (
                <>
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {msg.text}
                  </ReactMarkdown>
                  {isStreaming && <span className="streaming-cursor" />}
                </>
              ) : (
                msg.text
              )}
            </div>
            {msg.role === 'bot' && msg.contextNodes && msg.contextNodes.length > 0 && (
                <div className="message-actions">
                  {msg.seedNodes && msg.seedNodes.length > 0 && (
                    <button
                      className="toggle-highlight seed-mode"
                      onClick={() =>
                        handleToggleClick(
                          'seeds',
                          msg.seedNodes || [],
                          msg.traversedNodes || [],
                          msg.contextNodes || []
                        )
                      }
                    >
                      Seeds ({msg.seedNodes.length})
                    </button>
                  )}
                  <button
                    className="toggle-highlight context-mode"
                    onClick={() =>
                      handleToggleClick(
                        'context',
                        msg.seedNodes || [],
                        msg.traversedNodes || [],
                        msg.contextNodes || []
                      )
                    }
                  >
                    Context ({msg.contextNodes.length})
                  </button>
                  {msg.traversedNodes && msg.traversedNodes.length > 0 && (
                    <button
                      className="toggle-highlight traversed-mode"
                      onClick={() =>
                        handleToggleClick(
                          'traversed',
                          msg.seedNodes || [],
                          msg.traversedNodes || [],
                          msg.contextNodes || []
                        )
                      }
                    >
                      All Explored ({msg.traversedNodes.length})
                    </button>
                  )}
                </div>
              )}
          </div>
          );
        })}
      </div>
      <div className="chat-input-area">
        <input
          ref={inputRef}
          type="text"
          className="chat-input"
          placeholder={chatEnabled ? 'Ask a question...' : 'Generate a graph first...'}
          disabled={!chatEnabled || isLoading}
          onKeyDown={handleKeyDown}
        />
        <button
          className="send-btn"
          onClick={handleSend}
          disabled={!chatEnabled || isLoading}
        >
          Send
        </button>
      </div>
    </div>
  );
}
