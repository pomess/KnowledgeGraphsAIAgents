import { useState } from "react";
import {
  MessageSquare,
  BookOpen,
  Network,
  Upload,
  ShieldCheck,
  PanelLeftClose,
  PanelLeft,
  ChevronDown,
  Brain,
} from "lucide-react";
import type { BrainInfo } from "../lib/api";

export type View = "chat" | "wiki" | "graph" | "ingest" | "lint";

interface SidebarProps {
  active: View;
  onNavigate: (view: View) => void;
  stats: { sources: number; pages: number } | null;
  brains: BrainInfo[];
  activeBrain: string;
  onBrainChange: (brainId: string) => void;
}

const navItems: { id: View; icon: typeof MessageSquare; label: string }[] = [
  { id: "chat", icon: MessageSquare, label: "Chat" },
  { id: "wiki", icon: BookOpen, label: "Wiki" },
  { id: "graph", icon: Network, label: "Graph" },
  { id: "ingest", icon: Upload, label: "Ingest" },
  { id: "lint", icon: ShieldCheck, label: "Lint" },
];

function brainInitial(name: string): string {
  const words = name.replace(/['']/g, " ").split(/\s+/).filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export default function Sidebar({
  active,
  onNavigate,
  stats,
  brains,
  activeBrain,
  onBrainChange,
}: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [brainMenuOpen, setBrainMenuOpen] = useState(false);

  const currentBrain = brains.find((b) => b.id === activeBrain);
  const displayName = currentBrain?.name ?? "Select Brain";

  return (
    <aside className={`sidebar${collapsed ? " collapsed" : ""}`}>
      {/* Brain switcher */}
      <div className="brain-switcher-wrap">
        <button
          className={`brain-switcher${brainMenuOpen ? " open" : ""}`}
          onClick={() => setBrainMenuOpen(!brainMenuOpen)}
          title={collapsed ? displayName : undefined}
        >
          <div className="sidebar-logo">{brainInitial(displayName)}</div>
          <div className="sidebar-brand-text">
            <span className="brand-name">{displayName}</span>
            <span className="brand-sub">Knowledge Base</span>
          </div>
          {!collapsed && (
            <ChevronDown
              size={14}
              className={`brain-chevron${brainMenuOpen ? " rotated" : ""}`}
            />
          )}
        </button>
        {brainMenuOpen && (
          <div className="brain-menu">
            {brains.map((b) => (
              <button
                key={b.id}
                className={`brain-menu-item${b.id === activeBrain ? " active" : ""}`}
                onClick={() => {
                  onBrainChange(b.id);
                  setBrainMenuOpen(false);
                }}
              >
                <div className="brain-menu-icon">{brainInitial(b.name)}</div>
                <span className="brain-menu-label">{b.name}</span>
                {b.id === activeBrain && (
                  <Brain size={12} className="brain-menu-check" />
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="sidebar-divider" />

      <div className="sidebar-nav">
        {navItems.map((item) => (
          <button
            key={item.id}
            className={`sidebar-btn${active === item.id ? " active" : ""}`}
            onClick={() => onNavigate(item.id)}
            title={collapsed ? item.label : undefined}
          >
            <span className="sidebar-btn-icon">
              <item.icon size={18} />
            </span>
            <span className="sidebar-btn-label">{item.label}</span>
          </button>
        ))}
      </div>

      <div className="sidebar-bottom">
        {stats && (
          <div className="sidebar-stats">
            <div className="sidebar-stat-pill">
              <span className="sidebar-stat-num">{stats.sources}</span>
              <span className="sidebar-stat-label">Sources</span>
            </div>
            <div className="sidebar-stat-pill">
              <span className="sidebar-stat-num">{stats.pages}</span>
              <span className="sidebar-stat-label">Pages</span>
            </div>
          </div>
        )}
        <button
          className="sidebar-collapse-btn"
          onClick={() => setCollapsed(!collapsed)}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <PanelLeft size={14} /> : <PanelLeftClose size={14} />}
        </button>
      </div>
    </aside>
  );
}
