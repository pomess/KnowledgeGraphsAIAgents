import { useState, useEffect, useCallback } from "react";
import Sidebar, { type View } from "./components/Sidebar";
import ChatPanel from "./components/ChatPanel";
import WikiBrowser from "./components/WikiBrowser";
import GraphView from "./components/GraphView";
import IngestPanel from "./components/IngestPanel";
import LintPanel from "./components/LintPanel";
import { fetchPages, fetchBrains, type BrainInfo } from "./lib/api";

export default function App() {
  const [view, setView] = useState<View>("chat");
  const [stats, setStats] = useState<{ sources: number; pages: number } | null>(null);
  const [wikiTarget, setWikiTarget] = useState<string | null>(null);

  const [brains, setBrains] = useState<BrainInfo[]>([]);
  const [activeBrain, setActiveBrain] = useState<string>("");

  useEffect(() => {
    fetchBrains().then(({ brains: list, default: def }) => {
      setBrains(list);
      if (def && !activeBrain) setActiveBrain(def);
    }).catch(() => {});
  }, []);

  const refreshStats = useCallback(async () => {
    if (!activeBrain) return;
    try {
      const { pages } = await fetchPages(activeBrain);
      const sources = pages.filter((p) => p.type === "source").length;
      setStats({ sources, pages: pages.length });
    } catch {
      /* backend not ready */
    }
  }, [activeBrain]);

  useEffect(() => {
    refreshStats();
  }, [refreshStats]);

  const handleWikiLink = (slug: string) => {
    setWikiTarget(slug);
    setView("wiki");
  };

  const handleBrainChange = (brainId: string) => {
    setActiveBrain(brainId);
    setStats(null);
    setWikiTarget(null);
  };

  return (
    <div className="app-layout">
      <Sidebar
        active={view}
        onNavigate={setView}
        stats={stats}
        brains={brains}
        activeBrain={activeBrain}
        onBrainChange={handleBrainChange}
      />
      <div className="main-panel">
        <div className="view-container" key={`${activeBrain}-${view}`}>
          {view === "chat" && (
            <ChatPanel onWikiLink={handleWikiLink} brain={activeBrain} />
          )}
          {view === "wiki" && (
            <WikiBrowser
              initialTarget={wikiTarget}
              onClearTarget={() => setWikiTarget(null)}
              brain={activeBrain}
            />
          )}
          {view === "graph" && (
            <GraphView onNavigate={handleWikiLink} brain={activeBrain} />
          )}
          {view === "ingest" && (
            <IngestPanel onComplete={refreshStats} brain={activeBrain} />
          )}
          {view === "lint" && (
            <LintPanel onNavigate={handleWikiLink} brain={activeBrain} />
          )}
        </div>
      </div>
    </div>
  );
}
