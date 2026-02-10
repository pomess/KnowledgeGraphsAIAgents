import { useState, useEffect, useRef } from 'react';
import { animate, spring } from 'animejs';
import { listSessions, saveSession, loadSession, deleteSession } from '../api/graphApi';
import type { SessionInfo, CytoscapeElement } from '../api/graphApi';
import './SessionPanel.css';

interface SessionPanelProps {
  hasGraph: boolean;
  onSessionLoaded: (elements: CytoscapeElement[]) => void;
  onClose: () => void;
}

export default function SessionPanel({ hasGraph, onSessionLoaded, onClose }: SessionPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [saveName, setSaveName] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (panelRef.current) {
      animate(panelRef.current, {
        opacity: [0, 1],
        translateY: [10, 0],
        duration: 350,
        ease: spring({ stiffness: 200, damping: 16 }),
      });
    }
  }, []);

  const fetchSessions = async () => {
    setLoading(true);
    try {
      const data = await listSessions();
      setSessions(data.sessions);
    } catch (err) {
      console.error('Failed to list sessions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  const handleSave = async () => {
    if (!saveName.trim()) return;
    setSaving(true);
    try {
      await saveSession(saveName.trim());
      setSaveName('');
      fetchSessions();
    } catch (err) {
      console.error('Save failed:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleLoad = async (name: string) => {
    try {
      const data = await loadSession(name);
      onSessionLoaded(data.elements);
    } catch (err) {
      console.error('Load failed:', err);
    }
  };

  const handleDelete = async (name: string) => {
    try {
      await deleteSession(name);
      fetchSessions();
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  const formatDate = (ts: number) => {
    return new Date(ts * 1000).toLocaleString();
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    return `${(bytes / 1024).toFixed(1)} KB`;
  };

  return (
    <div ref={panelRef} className="session-panel" style={{ opacity: 0 }}>
      <div className="session-header">
        <span>Sessions</span>
        <button className="session-close" onClick={onClose}>&times;</button>
      </div>

      {hasGraph && (
        <div className="session-save">
          <input
            className="session-name-input"
            value={saveName}
            onChange={(e) => setSaveName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            placeholder="Session name..."
          />
          <button
            className="session-save-btn"
            onClick={handleSave}
            disabled={!saveName.trim() || saving}
          >
            {saving ? '...' : 'Save'}
          </button>
        </div>
      )}

      <div className="session-list">
        {loading ? (
          <div className="session-empty">Loading...</div>
        ) : sessions.length === 0 ? (
          <div className="session-empty">No saved sessions</div>
        ) : (
          sessions.map((s) => (
            <div key={s.name} className="session-item">
              <div className="session-item-info">
                <span className="session-item-name">{s.name}</span>
                <span className="session-item-meta">
                  {formatDate(s.created)} &middot; {formatSize(s.size)}
                </span>
              </div>
              <div className="session-item-actions">
                <button className="session-load-btn" onClick={() => handleLoad(s.name)}>
                  Load
                </button>
                <button className="session-delete-btn" onClick={() => handleDelete(s.name)}>
                  &times;
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
