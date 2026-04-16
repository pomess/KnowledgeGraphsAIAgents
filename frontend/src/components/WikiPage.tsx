import ReactMarkdown, { defaultUrlTransform } from "react-markdown";
import remarkGfm from "remark-gfm";
import { useCallback } from "react";

interface WikiPageProps {
  content: string;
  frontmatter: Record<string, unknown>;
  onWikiLink: (slug: string) => void;
}

export default function WikiPage({ content, frontmatter, onWikiLink }: WikiPageProps) {
  const bodyContent = content.replace(/^---[\s\S]*?---\n*/, "");

  const processedContent = bodyContent.replace(
    /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g,
    (_match, slug: string, display?: string) => {
      const label = display || slug.replace(/-/g, " ");
      return `[${label}](wikilink:${slug})`;
    }
  );

  const urlTransform = useCallback((url: string) => {
    if (url.startsWith("wikilink:")) return url;
    return defaultUrlTransform(url);
  }, []);

  const type = frontmatter.type as string;
  const confidence = frontmatter.confidence as string;
  const tags = (frontmatter.tags as string[]) || [];
  const updated = frontmatter.updated as string;

  return (
    <div>
      <div className="wiki-frontmatter">
        {type && <span className="wiki-chip type">{type}</span>}
        {confidence && (
          <span className={`wiki-chip confidence-${confidence}`}>
            {confidence} confidence
          </span>
        )}
        {updated && <span className="wiki-chip">{updated}</span>}
        {tags.map((tag) => (
          <span key={tag} className="wiki-chip">
            #{tag}
          </span>
        ))}
      </div>
      <div className="wiki-rendered">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          urlTransform={urlTransform}
          components={{
            a: ({ href, children }) => {
              if (href?.startsWith("wikilink:")) {
                const slug = href.replace("wikilink:", "");
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
          }}
        >
          {processedContent}
        </ReactMarkdown>
      </div>
    </div>
  );
}
