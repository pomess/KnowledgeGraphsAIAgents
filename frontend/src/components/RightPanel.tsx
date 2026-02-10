import { useEffect, useRef, useState, useCallback } from 'react';
import { animate, createScope, createTimeline, spring, utils } from 'animejs';
import GraphViewer from './GraphViewer';
import type { GraphViewerHandle } from './GraphViewer';
import GraphLegend from './GraphLegend';
import GraphStats from './GraphStats';
import ExportMenu from './ExportMenu';
import NodeDetailPanel from './NodeDetailPanel';
import ResolutionPanel from './ResolutionPanel';
import SessionPanel from './SessionPanel';
import AnalyticsPanel from './AnalyticsPanel';
import LoaderOverlay from './LoaderOverlay';
import BackgroundParticles from './BackgroundParticles';
import type { CytoscapeElement } from '../api/graphApi';
import type { TraversalEvent } from './Workspace';
import './RightPanel.css';

interface RightPanelProps {
  elements: CytoscapeElement[];
  isLoading: boolean;
  seedNodes: string[];
  traversedNodes: string[];
  contextNodes: string[];
  highlightMode: 'seeds' | 'traversed' | 'context';
  isScanning: boolean;
  traversalEvents?: TraversalEvent[];
  selectedNodeId?: string | null;
  onSelectNode?: (nodeId: string | null) => void;
  onAskAboutNode?: (question: string) => void;
  onGraphUpdated?: (elements: import('../api/graphApi').CytoscapeElement[]) => void;
  showResolution?: boolean;
  onToggleResolution?: () => void;
  onResolutionMerged?: (elements: import('../api/graphApi').CytoscapeElement[]) => void;
  focusNodeId?: string | null;
  focusHops?: number;
  onFocusNode?: (nodeId: string, hops?: number) => void;
  onClearFocus?: () => void;
  showSessions?: boolean;
  onToggleSessions?: () => void;
  onSessionLoaded?: (elements: import('../api/graphApi').CytoscapeElement[]) => void;
  onClearHighlights?: () => void;
  showAnalytics?: boolean;
  onToggleAnalytics?: () => void;
}

export default function RightPanel({
  elements,
  isLoading,
  seedNodes,
  traversedNodes,
  contextNodes,
  highlightMode,
  isScanning,
  traversalEvents,
  selectedNodeId,
  onSelectNode,
  onAskAboutNode,
  onGraphUpdated,
  showResolution,
  onToggleResolution,
  onResolutionMerged,
  focusNodeId,
  focusHops,
  onFocusNode,
  onClearFocus,
  onClearHighlights,
  showSessions,
  onToggleSessions,
  onSessionLoaded,
  showAnalytics,
  onToggleAnalytics,
}: RightPanelProps) {
  const root = useRef<HTMLElement>(null);
  const scannerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<GraphViewerHandle>(null);
  const [hiddenTypes, setHiddenTypes] = useState<Set<string>>(new Set());

  const handleToggleType = useCallback((type: string) => {
    setHiddenTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }, []);

  useEffect(() => {
    if (!root.current) return;
    const scope = createScope({ root }).add(() => {
      // Right panel slide-in from right
      const tl = createTimeline({
        defaults: { ease: 'out(3)' },
      });

      tl.add('.right-panel-inner', {
        opacity: [0, 1],
        translateX: [40, 0],
        duration: 600,
        delay: 200,
        ease: spring({ stiffness: 100, damping: 15 }),
      });

      // Continuous subtle background float
      animate('.right-panel-bg-float', {
        translateY: () => utils.random(-5, 5),
        translateX: () => utils.random(-3, 3),
        loop: true,
        alternate: true,
        duration: () => utils.random(4000, 7000),
        ease: 'inOut(2)',
      });
    });
    return () => scope.revert();
  }, []);

  // Animate scanner line with anime.js instead of CSS
  useEffect(() => {
    if (isScanning && scannerRef.current) {
      const anim = animate(scannerRef.current, {
        translateX: ['-100%', '300%'],
        loop: true,
        duration: 2500,
        ease: 'inOut(3)',
      });
      return () => { anim.pause(); };
    }
  }, [isScanning]);

  return (
    <section ref={root} className="right-panel">
      <div className="right-panel-bg-float" />
      <div className="right-panel-inner" style={{ opacity: 0 }}>
        {isScanning && <div ref={scannerRef} className="scanner-line" />}
        <BackgroundParticles />
        <GraphViewer
          ref={graphRef}
          elements={elements}
          seedNodes={seedNodes}
          traversedNodes={traversedNodes}
          contextNodes={contextNodes}
          highlightMode={highlightMode}
          hiddenTypes={hiddenTypes}
          traversalEvents={traversalEvents}
          onSelectNode={onSelectNode}
          focusNodeId={focusNodeId}
          focusHops={focusHops}
        />
        <GraphLegend
          elements={elements}
          hiddenTypes={hiddenTypes}
          onToggleType={handleToggleType}
        />
        <GraphStats elements={elements} />
        {(seedNodes.length > 0 || contextNodes.length > 0) && (
          <button className="view-full-graph-btn" onClick={onClearHighlights}>
            View Full Graph
          </button>
        )}
        <ExportMenu elements={elements} graphRef={graphRef} />
        {selectedNodeId && (
          <NodeDetailPanel
            nodeId={selectedNodeId}
            elements={elements}
            onClose={() => onSelectNode?.(null)}
            onAskAbout={(q) => onAskAboutNode?.(q)}
            onGraphUpdated={(els) => onGraphUpdated?.(els)}
            onFocusNode={onFocusNode}
            isFocused={focusNodeId === selectedNodeId}
            onClearFocus={onClearFocus}
          />
        )}
        <div className="toolbar-top-right">
          <button className="toolbar-btn" onClick={onToggleSessions} title="Sessions">
            &#x1F4BE;
          </button>
          {elements.length > 0 && (
            <>
              <button className="toolbar-btn" onClick={onToggleAnalytics} title="Analytics">
                &#x1F4CA;
              </button>
              <button className="toolbar-btn" onClick={onToggleResolution} title="Entity Resolution">
                &#x2699;
              </button>
            </>
          )}
        </div>
        {showResolution && onResolutionMerged && (
          <ResolutionPanel
            onMerged={onResolutionMerged}
            onClose={() => onToggleResolution?.()}
          />
        )}
        {showSessions && onSessionLoaded && (
          <SessionPanel
            hasGraph={elements.length > 0}
            onSessionLoaded={onSessionLoaded}
            onClose={() => onToggleSessions?.()}
          />
        )}
        {showAnalytics && (
          <AnalyticsPanel
            onClose={() => onToggleAnalytics?.()}
          />
        )}
        <LoaderOverlay active={isLoading} />
      </div>
    </section>
  );
}
