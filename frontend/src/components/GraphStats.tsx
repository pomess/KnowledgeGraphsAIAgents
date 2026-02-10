import { useMemo, useEffect, useRef } from 'react';
import { animate, createScope, stagger, spring } from 'animejs';
import type { CytoscapeElement } from '../api/graphApi';
import './GraphStats.css';

interface GraphStatsProps {
  elements: CytoscapeElement[];
}

export default function GraphStats({ elements }: GraphStatsProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const hasAnimated = useRef(false);

  const stats = useMemo(() => {
    let nodeCount = 0;
    let edgeCount = 0;
    const typeCounts = new Map<string, number>();

    for (const el of elements) {
      if (el.data.source && el.data.target) {
        edgeCount++;
      } else if (el.data.id) {
        nodeCount++;
        const type = el.data.type || 'Entity';
        typeCounts.set(type, (typeCounts.get(type) || 0) + 1);
      }
    }

    const density = nodeCount > 1 ? (2 * edgeCount) / (nodeCount * (nodeCount - 1)) : 0;
    const avgDegree = nodeCount > 0 ? (2 * edgeCount) / nodeCount : 0;

    return { nodeCount, edgeCount, density, avgDegree, typeCounts };
  }, [elements]);

  // Entrance animation
  useEffect(() => {
    if (stats.nodeCount > 0 && !hasAnimated.current && rootRef.current) {
      hasAnimated.current = true;

      const scope = createScope({ root: rootRef }).add(() => {
        animate('.graph-stats-container', {
          opacity: [0, 1],
          translateY: [-10, 0],
          duration: 500,
          ease: 'out(3)',
        });
        animate('.stat-item', {
          opacity: [0, 1],
          translateY: [8, 0],
          delay: stagger(80),
          duration: 400,
          ease: spring({ stiffness: 180, damping: 14 }),
        });
      });

      // Animate counters rolling up
      const counterEls = rootRef.current.querySelectorAll('.stat-counter');
      counterEls.forEach((el) => {
        const target = parseInt(el.getAttribute('data-target') || '0', 10);
        animate(el, {
          textContent: [0, target],
          round: 1,
          duration: 1200,
          ease: 'out(3)',
        });
      });

      return () => {
        scope.revert();
      };
    }
  }, [stats.nodeCount]);

  // Reset animation flag when elements are replaced
  useEffect(() => {
    if (stats.nodeCount === 0) {
      hasAnimated.current = false;
    }
  }, [stats.nodeCount]);

  if (stats.nodeCount === 0) return null;

  return (
    <div
      ref={rootRef}
      className="graph-stats-wrapper"
    >
      <div className="graph-stats-container" style={{ opacity: 0 }}>
        <div className="stat-item" style={{ opacity: 0 }}>
          <span className="stat-label">Nodes</span>
          <span className="stat-counter" data-target={stats.nodeCount}>0</span>
        </div>
        <div className="stat-item" style={{ opacity: 0 }}>
          <span className="stat-label">Edges</span>
          <span className="stat-counter" data-target={stats.edgeCount}>0</span>
        </div>
        <div className="stat-item" style={{ opacity: 0 }}>
          <span className="stat-label">Avg Degree</span>
          <span className="stat-value">{stats.avgDegree.toFixed(1)}</span>
        </div>
        <div className="stat-item" style={{ opacity: 0 }}>
          <span className="stat-label">Density</span>
          <span className="stat-value">{(stats.density * 100).toFixed(1)}%</span>
        </div>
        <div className="stat-item types-row" style={{ opacity: 0 }}>
          <span className="stat-label">Types</span>
          <span className="stat-value">{stats.typeCounts.size}</span>
        </div>
      </div>
    </div>
  );
}
