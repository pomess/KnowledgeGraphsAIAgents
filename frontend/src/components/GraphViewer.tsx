import { useEffect, useRef, useCallback, useImperativeHandle, forwardRef } from 'react';
import cytoscape from 'cytoscape';
import type { Core } from 'cytoscape';
// @ts-expect-error no type declarations for cytoscape-fcose
import fcose from 'cytoscape-fcose';
import { animate, createScope, stagger, spring } from 'animejs';
import type { CytoscapeElement } from '../api/graphApi';
import type { TraversalEvent } from './Workspace';
import './GraphViewer.css';

// Register fcose layout extension (guard against duplicate registration in HMR)
try { cytoscape.use(fcose); } catch { /* already registered */ }

interface GraphViewerProps {
  elements: CytoscapeElement[];
  seedNodes: string[];
  traversedNodes: string[];
  contextNodes: string[];
  highlightMode: 'seeds' | 'traversed' | 'context';
  hiddenTypes?: Set<string>;
  traversalEvents?: TraversalEvent[];
  onSelectNode?: (nodeId: string | null) => void;
  focusNodeId?: string | null;
  focusHops?: number;
}

const cytoscapeStyles: cytoscape.Stylesheet[] = [
  {
    selector: 'node',
    style: {
      label: 'data(label)',
      'background-color': '#1e293b',
      color: '#f8fafc',
      'text-valign': 'center',
      'text-halign': 'center',
      'font-size': '8.5px',
      'font-weight': 600,
      width: '46px',
      height: '46px',
      shape: 'round-rectangle',
      'text-outline-width': 0,
      'border-width': 1.5,
      'border-color': '#334155',
      'border-opacity': 1,
      'text-wrap': 'wrap',
      'text-max-width': '68px',
      'overlay-padding': '4px',
      'overlay-opacity': 0,
      'transition-property':
        'background-color, border-color, border-width, width, height, opacity, text-opacity',
      'transition-duration': '0.4s',
    } as unknown as cytoscape.Css.Node,
  },
  {
    selector: 'node[type="Person"]',
    style: {
      shape: 'ellipse',
      'background-color': '#064e3b',
      'border-color': '#059669',
      width: '44px',
      height: '44px',
    } as unknown as cytoscape.Css.Node,
  },
  {
    selector: 'node[type="Organization"]',
    style: {
      shape: 'round-rectangle',
      'background-color': '#1e1b4b',
      'border-color': '#4338ca',
      width: '50px',
      height: '50px',
    } as unknown as cytoscape.Css.Node,
  },
  {
    selector: 'node[type="Location"]',
    style: {
      shape: 'round-rectangle',
      'background-color': '#451a03',
      'border-color': '#b45309',
    } as unknown as cytoscape.Css.Node,
  },
  {
    selector: 'node[type="Document"]',
    style: {
      shape: 'rectangle',
      'background-color': '#1c1917',
      'border-color': '#78716c',
    } as unknown as cytoscape.Css.Node,
  },
  {
    selector: 'edge',
    style: {
      width: 0.75,
      'line-color': 'rgba(148, 163, 184, 0.15)',
      'line-style': 'solid',
      'target-arrow-color': 'rgba(148, 163, 184, 0.15)',
      'target-arrow-shape': 'triangle',
      'arrow-scale': 0.5,
      'curve-style': 'bezier',
      'control-point-step-size': 40,
      label: 'data(label)',
      'font-size': '7.5px',
      'font-weight': 400,
      color: 'rgba(148, 163, 184, 0.6)',
      'text-rotation': 'autorotate',
      'text-background-opacity': 0,
      'text-margin-y': -10,
      'transition-property': 'line-color, target-arrow-color, width, opacity',
      'transition-duration': '0.6s',
    } as unknown as cytoscape.Css.Edge,
  },
  {
    selector: '.highlighted',
    style: {
      'background-color': '#0ea5e9',
      'border-width': 2,
      'border-color': '#f8fafc',
      width: '54px',
      height: '54px',
      'font-size': '9.5px',
      'z-index': 100,
      opacity: 1,
      'text-opacity': 1,
      'text-outline-color': '#0ea5e9',
      'text-outline-width': 1.5,
    } as unknown as cytoscape.Css.Node,
  },
  {
    selector: '.dimmed',
    style: {
      opacity: 0.15,
      'text-opacity': 0,
      'transition-duration': '0.8s',
    } as unknown as cytoscape.Css.Node,
  },
  {
    selector: '.faded',
    style: {
      opacity: 0.2,
      'text-opacity': 0,
    } as unknown as cytoscape.Css.Node,
  },
  {
    selector: 'node:active',
    style: {
      'overlay-color': '#38bdf8',
      'overlay-padding': '6px',
      'overlay-opacity': 0.3,
    } as unknown as cytoscape.Css.Node,
  },
];

export interface GraphViewerHandle {
  getCy: () => Core | null;
}

const GraphViewer = forwardRef<GraphViewerHandle, GraphViewerProps>(function GraphViewer({
  elements,
  seedNodes,
  traversedNodes,
  contextNodes,
  highlightMode,
  hiddenTypes,
  traversalEvents,
  onSelectNode,
  focusNodeId,
  focusHops = 2,
}, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<Core | null>(null);
  const controlsRef = useRef<HTMLDivElement>(null);
  const revealRef = useRef<HTMLDivElement>(null);
  const scopeRef = useRef<ReturnType<typeof createScope> | null>(null);

  // Draggable controls + button entrance on mount
  useEffect(() => {
    if (!controlsRef.current) return;

    scopeRef.current = createScope({ root: controlsRef }).add(() => {
      // Staggered spring entrance for control buttons
      animate('.control-btn', {
        scale: [0, 1],
        opacity: [0, 1],
        delay: stagger(100),
        duration: 500,
        ease: spring({ stiffness: 200, damping: 12 }),
      });
    });

    return () => {
      scopeRef.current?.revert();
    };
  }, []);

  // Expose cytoscape instance via ref
  useImperativeHandle(ref, () => ({
    getCy: () => cyRef.current,
  }), []);

  // Initialize/update cytoscape when elements change
  useEffect(() => {
    if (!containerRef.current) return;

    if (cyRef.current) {
      cyRef.current.destroy();
    }

    const hasElements = elements.length > 0;

    const cy = cytoscape({
      container: containerRef.current,
      elements: elements,
      style: cytoscapeStyles,
      // Don't auto-run layout — we'll run it manually so we can hook layoutstop
      layout: { name: 'preset' },
      userZoomingEnabled: true,
      userPanningEnabled: true,
      boxSelectionEnabled: false,
    });

    // --- Hover effects ---
    cy.on('mouseover', 'node', (e) => {
      const node = e.target;
      node.animate(
        { style: { 'border-width': 3, width: '52px', height: '52px' } },
        { duration: 200 }
      );
      cy.elements().difference(node.closedNeighborhood()).addClass('faded');
      node.connectedEdges().animate(
        {
          style: {
            'line-color': '#38bdf8',
            'target-arrow-color': '#38bdf8',
            width: 2,
          },
        },
        { duration: 200 }
      );
    });

    cy.on('mouseout', 'node', (e) => {
      const node = e.target;
      node.animate(
        { style: { 'border-width': 1.5, width: '46px', height: '46px' } },
        { duration: 200 }
      );
      cy.elements().removeClass('faded');
      node.connectedEdges().animate(
        {
          style: {
            'line-color': 'rgba(148, 163, 184, 0.15)',
            'target-arrow-color': 'rgba(148, 163, 184, 0.15)',
            width: 0.75,
          },
        },
        { duration: 200 }
      );
    });

    // --- Click to select node for detail panel ---
    cy.on('tap', 'node', (e) => {
      const nodeId = e.target.id();
      onSelectNode?.(nodeId);
    });

    // Click on background deselects
    cy.on('tap', (e) => {
      if (e.target === cy) {
        onSelectNode?.(null);
      }
    });

    cyRef.current = cy;

    if (!hasElements) return;

    // --- Hide everything before layout ---
    cy.nodes().style({ opacity: 0, 'text-opacity': 0 });
    cy.edges().style({ opacity: 0 });

    // --- Run layout, then stagger-reveal nodes ---
    const layout = cy.layout({
      name: 'fcose',
      animate: false,      // compute positions instantly (no visual animation yet)
      fit: true,
      padding: 80,
      nodeDimensionsIncludeLabels: true,
      // @ts-expect-error fcose-specific options
      uniformNodeDimensions: false,
      packComponents: true,
      quality: 'proof',
      idealEdgeLength: 120,
      nodeRepulsion: 6500,
      edgeElasticity: 0.45,
    });

    layout.on('layoutstop', () => {
      // Compute centroid
      const bb = cy.nodes().boundingBox();
      const centX = (bb.x1 + bb.x2) / 2;
      const centY = (bb.y1 + bb.y2) / 2;

      // Sort nodes by distance from centroid (center-out reveal)
      const sortedNodes = cy.nodes().sort((a, b) => {
        const ap = a.position();
        const bp = b.position();
        const da = Math.hypot(ap.x - centX, ap.y - centY);
        const db = Math.hypot(bp.x - centX, bp.y - centY);
        return da - db;
      });

      const NODE_STAGGER = 40;   // ms between each node
      const NODE_ANIM_DUR = 500; // ms for each node's fade-in

      // Stagger-reveal nodes center-out
      sortedNodes.forEach((node, i) => {
        const delay = i * NODE_STAGGER;
        setTimeout(() => {
          node.animate(
            {
              style: { opacity: 1, 'text-opacity': 1 },
            },
            {
              duration: NODE_ANIM_DUR,
              easing: 'ease-out-cubic',
            }
          );
        }, delay);
      });

      // Edges fade in after a short delay (once enough nodes are visible)
      const edgeDelay = sortedNodes.length * NODE_STAGGER * 0.4;
      const EDGE_STAGGER = 25;

      cy.edges().forEach((edge, i) => {
        setTimeout(() => {
          edge.animate(
            {
              style: {
                opacity: 1,
                'line-color': 'rgba(148, 163, 184, 0.15)',
                'target-arrow-color': 'rgba(148, 163, 184, 0.15)',
              },
            },
            {
              duration: 600,
              easing: 'ease-out-cubic',
            }
          );
        }, edgeDelay + i * EDGE_STAGGER);
      });

      // Camera: start zoomed-in on center, then pull back to fit
      const currentZoom = cy.zoom();
      cy.zoom({ level: currentZoom * 1.8, position: { x: centX, y: centY } });
      cy.animate(
        {
          fit: { eles: cy.elements(), padding: 80 },
        },
        {
          duration: 1800,
          easing: 'ease-in-out-cubic',
        }
      );

      // Reveal ring pulse
      if (revealRef.current) {
        animate(revealRef.current, {
          scale: [0, 4],
          opacity: [0.6, 0],
          duration: 1600,
          ease: 'out(3)',
        });
      }
    });

    layout.run();
  }, [elements]);

  // Apply 3-tier highlights:
  //   seeds    = initial RAG hits (smallest, cyan)
  //   expanded = ALL explored nodes during beam search (largest, slate)
  //   context  = seeds + relevant nodes from expansion (medium, teal)
  const applyHighlights = useCallback(() => {
    const cy = cyRef.current;
    if (!cy) return;

    // Reset everything
    cy.elements()
      .removeClass('dimmed')
      .removeClass('highlighted')
      .removeStyle();

    const seedSet = new Set(seedNodes);
    const traversedSet = new Set(traversedNodes);   // all expanded
    const contextSet = new Set(contextNodes);        // seeds + relevant

    // If nothing to highlight, bail
    if (traversedSet.size === 0 && seedSet.size === 0) return;

    // Determine which nodes to show based on mode
    let primaryIds: string[];
    if (highlightMode === 'seeds') {
      primaryIds = seedNodes;
    } else if (highlightMode === 'traversed') {
      // Expanded: show ALL explored nodes
      primaryIds = [...new Set([...seedNodes, ...traversedNodes])];
    } else {
      // Context: seeds + only relevant nodes
      primaryIds = [...contextNodes];
    }

    if (primaryIds.length === 0) return;

    // Dim everything first
    cy.elements().addClass('dimmed');

    const allPrimary = cy.nodes().filter((n) => primaryIds.includes(n.id()));

    // Style each node by tier
    allPrimary.each((node) => {
      const id = node.id();
      node.removeClass('dimmed').addClass('highlighted');

      if (seedSet.has(id)) {
        // Seeds — bright cyan, most prominent
        node.style({
          opacity: 1,
          'text-opacity': 1,
          'border-color': '#38bdf8',
          'border-width': 2.5,
          'background-color': '#0c4a6e',
          width: '60px',
          height: '60px',
          'z-index': 1000,
          'text-outline-color': '#0c4a6e',
          'text-outline-width': 1.5,
          'font-size': '9.5px',
        });
      } else if (contextSet.has(id)) {
        // Context (relevant) — teal/emerald, medium emphasis
        node.style({
          opacity: 1,
          'text-opacity': 1,
          'border-color': '#34d399',
          'border-width': 2,
          'background-color': '#064e3b',
          width: '54px',
          height: '54px',
          'z-index': 999,
          'text-outline-color': '#064e3b',
          'text-outline-width': 1.5,
          'font-size': '9px',
        });
      } else {
        // Expanded only (explored but not relevant) — dim slate
        node.style({
          opacity: 0.55,
          'text-opacity': 0.6,
          'border-color': '#64748b',
          'border-width': 1.5,
          'background-color': '#1e293b',
          width: '48px',
          height: '48px',
          'z-index': 998,
          'text-outline-color': '#1e293b',
          'text-outline-width': 1,
          'font-size': '8.5px',
        });
      }
    });

    // Highlight edges between visible nodes
    const internalEdges = allPrimary.edgesWith(allPrimary);
    internalEdges.removeClass('dimmed').style({
      opacity: 0.7,
      width: 1.5,
      'line-color': '#38bdf8',
      'target-arrow-color': '#38bdf8',
      'z-index': 998,
    });

    // Fit camera to highlighted nodes
    cy.animate({
      fit: { eles: allPrimary, padding: 100 },
      duration: 1000,
      easing: 'ease-in-out-cubic',
    });
  }, [seedNodes, traversedNodes, contextNodes, highlightMode]);

  useEffect(() => {
    applyHighlights();
  }, [applyHighlights]);

  // Live traversal animation — animate seeds and hops as SSE events arrive
  const lastTraversalLen = useRef(0);
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy || !traversalEvents || traversalEvents.length === 0) return;

    // Only process new events
    const newEvents = traversalEvents.slice(lastTraversalLen.current);
    lastTraversalLen.current = traversalEvents.length;

    let cumulativeDelay = 0;

    for (const event of newEvents) {
      if (event.type === 'traversal_seeds') {
        // Pulse seed nodes with a bright cyan glow
        const seedIds = event.seeds;
        const nodes = cy.nodes().filter((n) => seedIds.includes(n.id()));
        nodes.each((node) => {
          setTimeout(() => {
            node.animate(
              {
                style: {
                  'background-color': '#0c4a6e',
                  'border-color': '#38bdf8',
                  'border-width': 3,
                  width: '58px',
                  height: '58px',
                  opacity: 1,
                  'text-opacity': 1,
                },
              },
              { duration: 400, easing: 'ease-out-cubic' }
            );
          }, cumulativeDelay);
        });
        // Also glow their edges briefly
        const seedEdges = nodes.connectedEdges();
        seedEdges.each((edge) => {
          setTimeout(() => {
            edge.animate(
              { style: { 'line-color': 'rgba(56, 189, 248, 0.4)', 'target-arrow-color': 'rgba(56, 189, 248, 0.4)', width: 1.5 } },
              { duration: 300 }
            );
          }, cumulativeDelay + 200);
        });
        cumulativeDelay += 500;
      }

      if (event.type === 'traversal_hop') {
        const frontierIds = event.frontier;
        const frontierNodes = cy.nodes().filter((n) => frontierIds.includes(n.id()));

        // Stagger the frontier nodes appearing with a wave effect
        frontierNodes.each((node, i) => {
          const nodeDelay = cumulativeDelay + i * 60;
          setTimeout(() => {
            // Briefly enlarge and glow, then settle to a subtle highlight
            node.animate(
              {
                style: {
                  'border-color': '#34d399',
                  'border-width': 2,
                  width: '52px',
                  height: '52px',
                  opacity: 0.8,
                  'text-opacity': 0.8,
                },
              },
              { duration: 350, easing: 'ease-out-cubic' }
            );
          }, nodeDelay);

          // Animate edges from this frontier node to its already-lit neighbors
          setTimeout(() => {
            node.connectedEdges().each((edge) => {
              edge.animate(
                { style: { 'line-color': 'rgba(52, 211, 153, 0.3)', 'target-arrow-color': 'rgba(52, 211, 153, 0.3)', width: 1.2 } },
                { duration: 250 }
              );
            });
          }, nodeDelay + 100);
        });
        cumulativeDelay += frontierNodes.length * 60 + 400;
      }
    }
  }, [traversalEvents]);

  // Reset traversal styling when traversal events are cleared (new query)
  useEffect(() => {
    if (traversalEvents && traversalEvents.length === 0) {
      lastTraversalLen.current = 0;
    }
  }, [traversalEvents]);

  // Show/hide nodes based on entity type filtering from legend
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy || !hiddenTypes) return;

    cy.nodes().forEach((node) => {
      const type = node.data('type') || 'Entity';
      if (hiddenTypes.has(type)) {
        node.style('display', 'none');
      } else {
        node.style('display', 'element');
      }
    });

    // Hide edges where both endpoints are hidden
    cy.edges().forEach((edge) => {
      const srcType = edge.source().data('type') || 'Entity';
      const tgtType = edge.target().data('type') || 'Entity';
      if (hiddenTypes.has(srcType) || hiddenTypes.has(tgtType)) {
        edge.style('display', 'none');
      } else {
        edge.style('display', 'element');
      }
    });
  }, [hiddenTypes]);

  // Subgraph focus mode — show only k-hop neighborhood of focused node
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;

    if (!focusNodeId) {
      // Clear focus — show all nodes
      cy.elements().forEach((el) => {
        el.style('display', 'element');
      });
      return;
    }

    const focusNode = cy.getElementById(focusNodeId);
    if (focusNode.empty()) return;

    // BFS to find k-hop neighborhood
    const neighborhood = focusNode.closedNeighborhood();
    let frontier = neighborhood;
    for (let i = 1; i < focusHops; i++) {
      frontier = frontier.closedNeighborhood();
    }

    // Hide everything outside the neighborhood
    cy.elements().forEach((el) => {
      if (frontier.contains(el)) {
        el.style('display', 'element');
      } else {
        el.style('display', 'none');
      }
    });

    // Fit to the visible subgraph
    cy.fit(frontier, 60);
  }, [focusNodeId, focusHops]);

  const handleZoomIn = (e: React.MouseEvent<HTMLButtonElement>) => {
    // Spring bounce on button click
    animate(e.currentTarget, {
      scale: [1, 1.2, 1],
      duration: 300,
      ease: spring({ stiffness: 300, damping: 10 }),
    });
    cyRef.current?.zoom(cyRef.current.zoom() * 1.2);
  };
  const handleZoomOut = (e: React.MouseEvent<HTMLButtonElement>) => {
    animate(e.currentTarget, {
      scale: [1, 1.2, 1],
      duration: 300,
      ease: spring({ stiffness: 300, damping: 10 }),
    });
    cyRef.current?.zoom(cyRef.current.zoom() / 1.2);
  };
  const handleFit = (e: React.MouseEvent<HTMLButtonElement>) => {
    animate(e.currentTarget, {
      scale: [1, 1.2, 1],
      duration: 300,
      ease: spring({ stiffness: 300, damping: 10 }),
    });
    cyRef.current?.fit(undefined, 80);
  };

  return (
    <div className="graph-viewer-wrapper">
      <div ref={containerRef} className="graph-container" />
      {/* Cinematic reveal ring overlay */}
      <div ref={revealRef} className="reveal-ring" />
      <div ref={controlsRef} className="graph-controls">
        <button className="control-btn" onClick={handleZoomIn} title="Zoom In" style={{ opacity: 0 }}>
          +
        </button>
        <button
          className="control-btn"
          onClick={handleZoomOut}
          title="Zoom Out"
          style={{ opacity: 0 }}
        >
          -
        </button>
        <button
          className="control-btn"
          onClick={handleFit}
          title="Fit to Screen"
          style={{ opacity: 0 }}
        >
          &#x26F6;
        </button>
      </div>
    </div>
  );
});

export default GraphViewer;
