import ReactMarkdown, { defaultUrlTransform } from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import type { Components } from "react-markdown";
import { useMemo, useCallback } from "react";
import { Brain, User } from "lucide-react";

interface ChatMessageProps {
  role: "user" | "assistant";
  content: string;
  onWikiLink: (slug: string) => void;
}

const WIKI_LINK_RE = /\[\[\s*([^\]|]+?)\s*(?:\|\s*([^\]]+?)\s*)?\]\]/g;

function preprocessContent(text: string): string {
  let result = text;

  // Strip :** patterns globally — model uses these as broken section markers
  result = result.replace(/\]?\]?:\s*\*\*\s*/g, ': ');

  // Convert [[wiki links]] to markdown links with wiki: scheme
  result = result.replace(WIKI_LINK_RE, (_match, slug: string, label?: string) => {
    const display = label || slug.replace(/-/g, " ");
    return `[${display}](wiki:${slug.trim()})`;
  });

  // Strip any remaining :** after link conversion (e.g. "):** ")
  result = result.replace(/:\s*\*\*\s(?!\S*\*\*)/g, ': ');

  // Remove orphaned ** per line (odd count = one is unpaired)
  result = result.split('\n').map(line => {
    const count = (line.match(/\*\*/g) || []).length;
    if (count % 2 !== 0) {
      return line.replace('**', '');
    }
    return line;
  }).join('\n');

  // Clean up stray ]] or [[ that weren't part of valid wiki links
  result = result.replace(/\]\]/g, '');
  result = result.replace(/\[\[/g, '');

  return result;
}

export default function ChatMessage({ role, content, onWikiLink }: ChatMessageProps) {
  const processed = useMemo(() => role === "assistant" ? preprocessContent(content) : content, [content, role]);

  const urlTransform = useCallback((url: string) => {
    if (url.startsWith("wiki:")) return url;
    return defaultUrlTransform(url);
  }, []);

  const components = useMemo<Components>(
    () => ({
      a({ href, children }) {
        if (href?.startsWith("wiki:")) {
          const slug = href.slice(5);
          return (
            <span
              className="wiki-link"
              onClick={() => onWikiLink(slug)}
            >
              {children}
            </span>
          );
        }
        return (
          <a href={href} target="_blank" rel="noopener noreferrer">
            {children}
          </a>
        );
      },
    }),
    [onWikiLink]
  );

  if (role === "user") {
    return (
      <div className="chat-msg-row user">
        <div className="chat-avatar user-avatar">
          <User size={14} />
        </div>
        <div className="chat-message user">{content}</div>
      </div>
    );
  }

  return (
    <div className="chat-msg-row assistant">
      <div className="chat-avatar assistant-avatar">
        <Brain size={14} />
      </div>
      <div className="chat-message assistant">
        <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]} components={components} urlTransform={urlTransform}>
          {processed}
        </ReactMarkdown>
      </div>
    </div>
  );
}
