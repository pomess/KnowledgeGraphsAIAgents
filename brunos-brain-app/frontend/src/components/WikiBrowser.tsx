import { useState, useEffect, useCallback, useMemo } from "react";
import { Search, BookOpen } from "lucide-react";
import { fetchPages, fetchPage } from "../lib/api";
import WikiPage from "./WikiPage";

interface PageEntry {
  path: string;
  slug: string;
  title: string;
  type: string;
}

interface WikiBrowserProps {
  initialTarget: string | null;
  onClearTarget: () => void;
  brain?: string;
}

const TYPE_ORDER = ["source", "entity", "concept", "analysis", "overview"];

const TYPE_LABELS: Record<string, string> = {
  source: "Sources",
  entity: "Entities",
  concept: "Concepts",
  analysis: "Analyses",
  overview: "Overview",
};

function pluralizeType(type: string): string {
  return TYPE_LABELS[type] || `${type.charAt(0).toUpperCase()}${type.slice(1)}s`;
}

function groupByType(pages: PageEntry[]): Record<string, PageEntry[]> {
  const groups: Record<string, PageEntry[]> = {};
  for (const p of pages) {
    const t = p.type || "other";
    if (!groups[t]) groups[t] = [];
    groups[t].push(p);
  }
  return groups;
}

function resolveSlug(raw: string): string {
  let s = raw.trim();
  if (s.endsWith(".md")) s = s.slice(0, -3);
  if (s.includes("/")) s = s.split("/").pop()!;
  return s.toLowerCase().replace(/\s+/g, "-");
}

function findPage(pages: PageEntry[], raw: string): PageEntry | undefined {
  const slug = resolveSlug(raw);
  return (
    pages.find((p) => p.slug === slug) ||
    pages.find((p) => p.slug === raw) ||
    pages.find((p) => p.title.toLowerCase() === raw.toLowerCase())
  );
}

export default function WikiBrowser({ initialTarget, onClearTarget, brain }: WikiBrowserProps) {
  const [pages, setPages] = useState<PageEntry[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [pageContent, setPageContent] = useState<string>("");
  const [pageFm, setPageFm] = useState<Record<string, unknown>>({});
  const [search, setSearch] = useState("");

  const loadPages = useCallback(async () => {
    try {
      const { pages: p } = await fetchPages(brain);
      setPages(p);
    } catch { /* backend not ready */ }
  }, [brain]);

  useEffect(() => {
    loadPages();
  }, [loadPages]);

  useEffect(() => {
    if (initialTarget && pages.length > 0) {
      const match = findPage(pages, initialTarget);
      if (match) {
        selectPage(match.path);
      }
      onClearTarget();
    }
  }, [initialTarget, pages, onClearTarget]);

  const selectPage = async (path: string) => {
    setSelected(path);
    try {
      const data = await fetchPage(path, brain);
      setPageContent(data.content || "");
      setPageFm(data.frontmatter || {});
    } catch {
      setPageContent("Failed to load page.");
      setPageFm({});
    }
  };

  const handleWikiLink = (slug: string) => {
    const match = findPage(pages, slug);
    if (match) {
      selectPage(match.path);
    }
  };

  const filteredPages = useMemo(() => {
    if (!search.trim()) return pages;
    const q = search.toLowerCase();
    return pages.filter((p) => p.title.toLowerCase().includes(q));
  }, [pages, search]);

  const grouped = groupByType(filteredPages);
  const sortedTypes = Object.keys(grouped).sort(
    (a, b) => (TYPE_ORDER.indexOf(a) === -1 ? 99 : TYPE_ORDER.indexOf(a)) -
              (TYPE_ORDER.indexOf(b) === -1 ? 99 : TYPE_ORDER.indexOf(b))
  );

  return (
    <div className="wiki-browser">
      <div className="wiki-sidebar">
        <div className="wiki-search-wrap">
          <div className="wiki-search">
            <Search size={14} className="wiki-search-icon" />
            <input
              placeholder="Filter pages..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {pages.length > 0 && (
              <span className="wiki-search-count">{filteredPages.length}</span>
            )}
          </div>
        </div>

        {sortedTypes.map((type) => (
          <div key={type} className="wiki-group">
            <div className="wiki-group-header">
              <span className="wiki-group-title">{pluralizeType(type)}</span>
              <span className="wiki-group-count">{grouped[type].length}</span>
            </div>
            {grouped[type].map((page) => (
              <button
                key={page.path}
                className={`wiki-page-link${selected === page.path ? " active" : ""}`}
                onClick={() => selectPage(page.path)}
              >
                <span className={`wiki-type-dot ${page.type}`} />
                {page.title}
              </button>
            ))}
          </div>
        ))}
        {pages.length === 0 && (
          <p style={{ color: "var(--text-muted)", fontSize: 13, padding: 12 }}>
            No wiki pages found. Is the backend running?
          </p>
        )}
        {pages.length > 0 && filteredPages.length === 0 && (
          <p style={{ color: "var(--text-muted)", fontSize: 13, padding: 12 }}>
            No pages match your search.
          </p>
        )}
      </div>
      <div className="wiki-content">
        {selected ? (
          <WikiPage
            content={pageContent}
            frontmatter={pageFm}
            onWikiLink={handleWikiLink}
          />
        ) : (
          <div className="wiki-content-empty">
            <div className="wiki-content-empty-icon">
              <BookOpen size={24} />
            </div>
            <span>Select a page to view</span>
          </div>
        )}
      </div>
    </div>
  );
}
