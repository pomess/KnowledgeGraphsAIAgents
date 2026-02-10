import { useState, useEffect, useRef } from 'react';
import { animate, spring } from 'animejs';
import { resolveEntities, mergeEntities } from '../api/graphApi';
import type { DuplicateCandidate, CytoscapeElement } from '../api/graphApi';
import './ResolutionPanel.css';

interface ResolutionPanelProps {
  onMerged: (elements: CytoscapeElement[]) => void;
  onClose: () => void;
}

export default function ResolutionPanel({ onMerged, onClose }: ResolutionPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [candidates, setCandidates] = useState<DuplicateCandidate[]>([]);
  const [selected, setSelected] = useState<Map<number, { keep: string; remove: string }>>(new Map());
  const [loading, setLoading] = useState(true);
  const [merging, setMerging] = useState(false);
  const [threshold, setThreshold] = useState(0.85);

  // Entrance animation
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

  // Fetch candidates
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    resolveEntities(threshold)
      .then((data) => {
        if (!cancelled) {
          setCandidates(data.candidates);
          setSelected(new Map());
        }
      })
      .catch((err) => console.error('Resolution failed:', err))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [threshold]);

  const toggleSelect = (idx: number, keepNode: string, removeNode: string) => {
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(idx)) {
        next.delete(idx);
      } else {
        next.set(idx, { keep: keepNode, remove: removeNode });
      }
      return next;
    });
  };

  const swapKeep = (idx: number) => {
    setSelected((prev) => {
      const next = new Map(prev);
      const current = next.get(idx);
      if (current) {
        next.set(idx, { keep: current.remove, remove: current.keep });
      }
      return next;
    });
  };

  const handleMerge = async () => {
    if (selected.size === 0) return;
    setMerging(true);
    try {
      const pairs = [...selected.values()];
      const result = await mergeEntities(pairs);
      onMerged(result.elements);
    } catch (err) {
      console.error('Merge failed:', err);
    } finally {
      setMerging(false);
    }
  };

  return (
    <div ref={panelRef} className="resolution-panel" style={{ opacity: 0 }}>
      <div className="resolution-header">
        <span>Entity Resolution</span>
        <button className="resolution-close" onClick={onClose}>&times;</button>
      </div>

      <div className="resolution-controls">
        <label className="threshold-label">
          Threshold:
          <input
            type="range"
            min={0.6}
            max={0.98}
            step={0.01}
            value={threshold}
            onChange={(e) => setThreshold(parseFloat(e.target.value))}
            className="threshold-slider"
          />
          <span className="threshold-value">{threshold.toFixed(2)}</span>
        </label>
      </div>

      <div className="resolution-body">
        {loading ? (
          <div className="resolution-loading">Scanning for duplicates...</div>
        ) : candidates.length === 0 ? (
          <div className="resolution-empty">No duplicates found at this threshold.</div>
        ) : (
          candidates.map((c, i) => {
            const isSelected = selected.has(i);
            const sel = selected.get(i);
            return (
              <div key={i} className={`resolution-candidate${isSelected ? ' selected' : ''}`}>
                <div className="candidate-info">
                  <span className="candidate-node">{c.node_a}</span>
                  <span className="candidate-sim">{(c.similarity * 100).toFixed(0)}%</span>
                  <span className="candidate-node">{c.node_b}</span>
                </div>
                <div className="candidate-actions">
                  {!isSelected ? (
                    <button
                      className="candidate-btn select-btn"
                      onClick={() => toggleSelect(i, c.node_a, c.node_b)}
                    >
                      Merge
                    </button>
                  ) : (
                    <>
                      <span className="keep-label">
                        Keep: <strong>{sel?.keep}</strong>
                      </span>
                      <button className="candidate-btn swap-btn" onClick={() => swapKeep(i)}>
                        Swap
                      </button>
                      <button
                        className="candidate-btn deselect-btn"
                        onClick={() => toggleSelect(i, c.node_a, c.node_b)}
                      >
                        Undo
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="resolution-footer">
        <span className="resolution-count">{selected.size} pair(s) selected</span>
        <button
          className="resolution-merge-btn"
          onClick={handleMerge}
          disabled={selected.size === 0 || merging}
        >
          {merging ? 'Merging...' : `Merge ${selected.size} pair(s)`}
        </button>
      </div>
    </div>
  );
}
