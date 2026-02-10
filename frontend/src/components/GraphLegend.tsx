import { useMemo, useState, useEffect, useRef } from 'react';
import { animate, createScope, stagger, spring } from 'animejs';
import type { CytoscapeElement } from '../api/graphApi';
import './GraphLegend.css';

/** Visual config per entity type — must match GraphViewer's Cytoscape styles */
const TYPE_STYLES: Record<string, { bg: string; border: string; shape: string }> = {
  Person:       { bg: '#064e3b', border: '#059669', shape: 'ellipse' },
  Organization: { bg: '#1e1b4b', border: '#4338ca', shape: 'round-rect' },
  Location:     { bg: '#451a03', border: '#b45309', shape: 'round-rect' },
  Document:     { bg: '#1c1917', border: '#78716c', shape: 'rect' },
  Entity:       { bg: '#1e293b', border: '#334155', shape: 'round-rect' },
};

function getTypeStyle(type: string) {
  return TYPE_STYLES[type] || TYPE_STYLES.Entity;
}

interface GraphLegendProps {
  elements: CytoscapeElement[];
  hiddenTypes: Set<string>;
  onToggleType: (type: string) => void;
}

export default function GraphLegend({ elements, hiddenTypes, onToggleType }: GraphLegendProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [collapsed, setCollapsed] = useState(false);
  const hasAnimated = useRef(false);

  // Compute type -> count from elements
  const typeCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const el of elements) {
      const type = el.data.type;
      if (type) {
        counts.set(type, (counts.get(type) || 0) + 1);
      }
    }
    // Sort by count descending
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [elements]);

  // Entrance animation
  useEffect(() => {
    if (typeCounts.length > 0 && !hasAnimated.current && rootRef.current) {
      hasAnimated.current = true;
      createScope({ root: rootRef }).add(() => {
        animate('.legend-container', {
          opacity: [0, 1],
          translateY: [10, 0],
          duration: 400,
          ease: 'out(3)',
        });
        animate('.legend-item', {
          opacity: [0, 1],
          translateX: [-8, 0],
          delay: stagger(60),
          duration: 350,
          ease: spring({ stiffness: 180, damping: 14 }),
        });
      });
    }
  }, [typeCounts]);

  // Reset animation flag when graph is cleared so it replays on next load
  useEffect(() => {
    if (typeCounts.length === 0) {
      hasAnimated.current = false;
    }
  }, [typeCounts]);

  if (typeCounts.length === 0) return null;

  return (
    <div ref={rootRef} className="legend-wrapper">
      <div className="legend-container" style={{ opacity: hasAnimated.current ? 1 : 0 }}>
        <button className="legend-toggle" onClick={() => setCollapsed((c) => !c)}>
          <span className="legend-title">Legend</span>
          <span className={`legend-chevron${collapsed ? ' collapsed' : ''}`}>&#x25BE;</span>
        </button>
        {!collapsed && (
          <div className="legend-items">
            {typeCounts.map(([type, count]) => {
              const style = getTypeStyle(type);
              const isHidden = hiddenTypes.has(type);
              return (
                <button
                  key={type}
                  className={`legend-item${isHidden ? ' hidden-type' : ''}`}
                  onClick={() => onToggleType(type)}
                  style={{ opacity: hasAnimated.current ? 1 : 0 }}
                >
                  <span
                    className={`legend-swatch${style.shape === 'ellipse' ? ' circle' : ''}`}
                    style={{
                      backgroundColor: isHidden ? 'transparent' : style.bg,
                      borderColor: style.border,
                    }}
                  />
                  <span className="legend-type-name">{type}</span>
                  <span className="legend-count">{count}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
