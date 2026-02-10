import { useState, useEffect, useRef } from 'react';
import { animate, spring } from 'animejs';
import { fetchAnalytics } from '../api/graphApi';
import type { AnalyticsData } from '../api/graphApi';
import './AnalyticsPanel.css';

interface AnalyticsPanelProps {
  onClose: () => void;
}

type Tab = 'overview' | 'centrality' | 'communities';

export default function AnalyticsPanel({ onClose }: AnalyticsPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('overview');

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

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchAnalytics()
      .then((d) => { if (!cancelled) setData(d); })
      .catch((err) => console.error('Analytics failed:', err))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const renderOverview = () => {
    if (!data) return null;
    return (
      <div className="analytics-section">
        <div className="analytics-stat-grid">
          <div className="analytics-stat">
            <span className="analytics-stat-value">{data.node_count}</span>
            <span className="analytics-stat-label">Nodes</span>
          </div>
          <div className="analytics-stat">
            <span className="analytics-stat-value">{data.edge_count}</span>
            <span className="analytics-stat-label">Edges</span>
          </div>
          <div className="analytics-stat">
            <span className="analytics-stat-value">{data.num_communities}</span>
            <span className="analytics-stat-label">Communities</span>
          </div>
          <div className="analytics-stat">
            <span className="analytics-stat-value">{data.num_components}</span>
            <span className="analytics-stat-label">Components</span>
          </div>
          <div className="analytics-stat">
            <span className="analytics-stat-value">{data.largest_component}</span>
            <span className="analytics-stat-label">Largest Component</span>
          </div>
          <div className="analytics-stat">
            <span className="analytics-stat-value">{data.avg_clustering.toFixed(3)}</span>
            <span className="analytics-stat-label">Avg Clustering</span>
          </div>
        </div>
      </div>
    );
  };

  const renderCentrality = () => {
    if (!data) return null;
    return (
      <div className="analytics-section">
        <div className="analytics-subsection">
          <h4 className="analytics-subtitle">Degree Centrality</h4>
          <div className="analytics-ranking">
            {data.top_degree.map((item, i) => (
              <div key={item.node} className="ranking-row">
                <span className="ranking-rank">#{i + 1}</span>
                <span className="ranking-node">{item.node}</span>
                <div className="ranking-bar-container">
                  <div
                    className="ranking-bar degree"
                    style={{ width: `${Math.max(item.score * 100, 4)}%` }}
                  />
                </div>
                <span className="ranking-score">{item.score.toFixed(3)}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="analytics-subsection">
          <h4 className="analytics-subtitle">Betweenness Centrality</h4>
          <div className="analytics-ranking">
            {data.top_betweenness.map((item, i) => (
              <div key={item.node} className="ranking-row">
                <span className="ranking-rank">#{i + 1}</span>
                <span className="ranking-node">{item.node}</span>
                <div className="ranking-bar-container">
                  <div
                    className="ranking-bar betweenness"
                    style={{ width: `${Math.max(item.score * 100, 4)}%` }}
                  />
                </div>
                <span className="ranking-score">{item.score.toFixed(3)}</span>
              </div>
            ))}
          </div>
        </div>
        {data.top_pagerank.length > 0 && (
          <div className="analytics-subsection">
            <h4 className="analytics-subtitle">PageRank</h4>
            <div className="analytics-ranking">
              {data.top_pagerank.map((item, i) => (
                <div key={item.node} className="ranking-row">
                  <span className="ranking-rank">#{i + 1}</span>
                  <span className="ranking-node">{item.node}</span>
                  <div className="ranking-bar-container">
                    <div
                      className="ranking-bar pagerank"
                      style={{ width: `${Math.max(item.score * 200, 4)}%` }}
                    />
                  </div>
                  <span className="ranking-score">{item.score.toFixed(4)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderCommunities = () => {
    if (!data) return null;
    // Group nodes by community
    const groups = new Map<number, string[]>();
    for (const [node, comm] of Object.entries(data.communities)) {
      if (!groups.has(comm)) groups.set(comm, []);
      groups.get(comm)!.push(node);
    }
    const sorted = [...groups.entries()].sort((a, b) => b[1].length - a[1].length);

    return (
      <div className="analytics-section">
        <p className="analytics-info">{data.num_communities} communities detected</p>
        {sorted.map(([id, nodes]) => (
          <div key={id} className="community-group">
            <span className="community-label">Community {id + 1} ({nodes.length})</span>
            <div className="community-nodes">
              {nodes.map((n) => (
                <span key={n} className="community-node-tag">{n}</span>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div ref={panelRef} className="analytics-panel" style={{ opacity: 0 }}>
      <div className="analytics-header">
        <span>Graph Analytics</span>
        <button className="analytics-close" onClick={onClose}>&times;</button>
      </div>

      <div className="analytics-tabs">
        {(['overview', 'centrality', 'communities'] as Tab[]).map((t) => (
          <button
            key={t}
            className={`analytics-tab${tab === t ? ' active' : ''}`}
            onClick={() => setTab(t)}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      <div className="analytics-body">
        {loading ? (
          <div className="analytics-loading">Computing analytics...</div>
        ) : (
          <>
            {tab === 'overview' && renderOverview()}
            {tab === 'centrality' && renderCentrality()}
            {tab === 'communities' && renderCommunities()}
          </>
        )}
      </div>
    </div>
  );
}
