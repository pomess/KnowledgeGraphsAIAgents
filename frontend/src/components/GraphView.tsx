import { useEffect, useRef, useState, useCallback } from "react";
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
  type SimulationNodeDatum,
  type SimulationLinkDatum,
} from "d3-force";
import { fetchGraph } from "../lib/api";

interface GraphViewProps {
  onNavigate: (slug: string) => void;
  brain?: string;
}

interface GNode extends SimulationNodeDatum {
  id: string;
  label: string;
  type: string;
  connections: number;
}

interface GEdge extends SimulationLinkDatum<GNode> {
  source: string | GNode;
  target: string | GNode;
}

const TYPE_COLORS: Record<string, string> = {
  source: "#60a5fa",
  entity: "#a78bfa",
  concept: "#4ade80",
  analysis: "#fbbf24",
  overview: "#9496b0",
};

function getColor(type: string): string {
  return TYPE_COLORS[type] || "#9496b0";
}

function nodeRadius(connections: number): number {
  return Math.max(5, Math.min(14, 4 + connections * 1.5));
}

export default function GraphView({ onNavigate, brain }: GraphViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const simRef = useRef<ReturnType<typeof forceSimulation<GNode>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    label: string;
    type: string;
  } | null>(null);

  const stateRef = useRef({
    nodes: [] as GNode[],
    edges: [] as GEdge[],
    hovered: null as GNode | null,
    dragging: null as GNode | null,
    dragMoved: false,
    transform: { x: 0, y: 0, k: 1 },
    width: 0,
    height: 0,
    animFrame: 0,
  });

  const screenToWorld = useCallback((sx: number, sy: number) => {
    const { x, y, k } = stateRef.current.transform;
    return {
      wx: (sx - x) / k,
      wy: (sy - y) / k,
    };
  }, []);

  const findNode = useCallback(
    (sx: number, sy: number): GNode | null => {
      const { wx, wy } = screenToWorld(sx, sy);
      const { nodes } = stateRef.current;
      for (let i = nodes.length - 1; i >= 0; i--) {
        const n = nodes[i];
        const r = nodeRadius(n.connections) / stateRef.current.transform.k + 4;
        const dx = (n.x ?? 0) - wx;
        const dy = (n.y ?? 0) - wy;
        if (dx * dx + dy * dy < r * r) return n;
      }
      return null;
    },
    [screenToWorld]
  );

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { nodes, edges, hovered, transform, width, height } = stateRef.current;
    const { x: tx, y: ty, k } = transform;

    ctx.clearRect(0, 0, width, height);
    ctx.save();
    ctx.translate(tx, ty);
    ctx.scale(k, k);

    const hoveredId = hovered?.id ?? null;
    const connectedIds = new Set<string>();
    if (hoveredId) {
      for (const e of edges) {
        const sid = typeof e.source === "object" ? e.source.id : e.source;
        const tid = typeof e.target === "object" ? e.target.id : e.target;
        if (sid === hoveredId) connectedIds.add(tid);
        if (tid === hoveredId) connectedIds.add(sid);
      }
      connectedIds.add(hoveredId);
    }

    for (const e of edges) {
      const s = e.source as GNode;
      const t = e.target as GNode;
      if (s.x == null || s.y == null || t.x == null || t.y == null) continue;

      const sid = s.id;
      const tid = t.id;
      const edgeActive =
        !hoveredId || (connectedIds.has(sid) && connectedIds.has(tid));

      ctx.beginPath();
      const mx = (s.x + t.x) / 2;
      const my = (s.y + t.y) / 2;
      const dx = t.x - s.x;
      const dy = t.y - s.y;
      const len = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
      const offset = len * 0.08;
      const cx = mx - (dy * offset) / len;
      const cy = my + (dx * offset) / len;

      ctx.moveTo(s.x, s.y);
      ctx.quadraticCurveTo(cx, cy, t.x, t.y);
      ctx.strokeStyle = edgeActive
        ? "rgba(148, 150, 176, 0.2)"
        : "rgba(148, 150, 176, 0.04)";
      ctx.lineWidth = edgeActive ? 1.2 / k : 0.8 / k;
      ctx.stroke();
    }

    for (const n of nodes) {
      if (n.x == null || n.y == null) continue;
      const r = nodeRadius(n.connections);
      const color = getColor(n.type);
      const isActive = !hoveredId || connectedIds.has(n.id);
      const isHovered = n.id === hoveredId;

      if (isHovered) {
        ctx.beginPath();
        ctx.arc(n.x, n.y, r + 6, 0, Math.PI * 2);
        ctx.fillStyle = color.replace(")", ", 0.12)").replace("rgb", "rgba");
        ctx.fill();
      }

      ctx.beginPath();
      ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
      ctx.fillStyle = isActive ? color : `rgba(148, 150, 176, 0.15)`;
      ctx.fill();

      if (isHovered) {
        ctx.strokeStyle = color;
        ctx.lineWidth = 2 / k;
        ctx.stroke();
      }

      const fontSize = Math.max(10, 11) / k;
      ctx.font = `500 ${fontSize}px Inter, system-ui, sans-serif`;
      ctx.fillStyle = isActive
        ? "rgba(232, 233, 240, 0.85)"
        : "rgba(148, 150, 176, 0.15)";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(n.label, n.x + r + 5, n.y);
    }

    ctx.restore();
  }, []);

  useEffect(() => {
    let destroyed = false;

    async function init() {
      const data = await fetchGraph(brain);
      if (destroyed) return;

      const connectionCount: Record<string, number> = {};
      for (const e of data.edges) {
        connectionCount[e.source] = (connectionCount[e.source] || 0) + 1;
        connectionCount[e.target] = (connectionCount[e.target] || 0) + 1;
      }

      const nodes: GNode[] = data.nodes.map((n) => ({
        ...n,
        connections: connectionCount[n.id] || 0,
      }));

      const edges: GEdge[] = data.edges.map((e) => ({
        source: e.source,
        target: e.target,
      }));

      stateRef.current.nodes = nodes;
      stateRef.current.edges = edges;
      setLoading(false);

      const sim = forceSimulation<GNode>(nodes)
        .force(
          "link",
          forceLink<GNode, GEdge>(edges)
            .id((d) => d.id)
            .distance(100)
            .strength(0.4)
        )
        .force("charge", forceManyBody<GNode>().strength(-300).distanceMax(400))
        .force("center", forceCenter(0, 0))
        .force("collide", forceCollide<GNode>((d) => nodeRadius(d.connections) + 8))
        .alpha(0.8)
        .alphaDecay(0.015);

      simRef.current = sim;

      sim.on("tick", () => {
        if (!destroyed) draw();
      });

      const cleanup = () => {
        sim.stop();
        simRef.current = null;
      };

      return cleanup;
    }

    let simCleanup: (() => void) | undefined;
    init().then((fn) => {
      simCleanup = fn;
    });

    return () => {
      destroyed = true;
      simCleanup?.();
      cancelAnimationFrame(stateRef.current.animFrame);
    };
  }, [draw]);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        const dpr = window.devicePixelRatio || 1;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
        const ctx = canvas.getContext("2d");
        if (ctx) ctx.scale(dpr, dpr);
        stateRef.current.width = width;
        stateRef.current.height = height;
        stateRef.current.transform.x = width / 2;
        stateRef.current.transform.y = height / 2;
        draw();
      }
    });

    ro.observe(container);
    return () => ro.disconnect();
  }, [draw]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let isPanning = false;
    let panStart = { x: 0, y: 0 };

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;

      if (stateRef.current.dragging) {
        stateRef.current.dragMoved = true;
        const { wx, wy } = screenToWorld(sx, sy);
        stateRef.current.dragging.fx = wx;
        stateRef.current.dragging.fy = wy;
        simRef.current?.alpha(0.3).restart();
        return;
      }

      if (isPanning) {
        const dx = e.clientX - panStart.x;
        const dy = e.clientY - panStart.y;
        stateRef.current.transform.x += dx;
        stateRef.current.transform.y += dy;
        panStart = { x: e.clientX, y: e.clientY };
        draw();
        return;
      }

      const node = findNode(sx, sy);
      stateRef.current.hovered = node;
      canvas.style.cursor = node ? "pointer" : "grab";

      if (node) {
        setTooltip({
          x: e.clientX - (containerRef.current?.getBoundingClientRect().left ?? 0),
          y: e.clientY - (containerRef.current?.getBoundingClientRect().top ?? 0),
          label: node.label,
          type: node.type,
        });
      } else {
        setTooltip(null);
      }
      draw();
    };

    const handleMouseDown = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const node = findNode(sx, sy);

      if (node) {
        stateRef.current.dragging = node;
        stateRef.current.dragMoved = false;
        const { wx, wy } = screenToWorld(sx, sy);
        node.fx = wx;
        node.fy = wy;
        simRef.current?.alphaTarget(0.3).restart();
        canvas.style.cursor = "grabbing";
      } else {
        isPanning = true;
        panStart = { x: e.clientX, y: e.clientY };
        canvas.style.cursor = "grabbing";
      }
    };

    const handleMouseUp = () => {
      if (stateRef.current.dragging) {
        const node = stateRef.current.dragging;
        node.fx = null;
        node.fy = null;
        stateRef.current.dragging = null;
        simRef.current?.alphaTarget(0);
      }
      isPanning = false;
      canvas.style.cursor = stateRef.current.hovered ? "pointer" : "grab";
    };

    const handleClick = (e: MouseEvent) => {
      if (stateRef.current.dragMoved) return;
      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const node = findNode(sx, sy);
      if (node) {
        onNavigate(node.id);
      }
    };

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;

      const t = stateRef.current.transform;
      const factor = e.deltaY > 0 ? 0.92 : 1.08;
      const newK = Math.max(0.15, Math.min(5, t.k * factor));

      t.x = sx - (sx - t.x) * (newK / t.k);
      t.y = sy - (sy - t.y) * (newK / t.k);
      t.k = newK;

      draw();
    };

    canvas.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("mousedown", handleMouseDown);
    canvas.addEventListener("mouseup", handleMouseUp);
    canvas.addEventListener("mouseleave", handleMouseUp);
    canvas.addEventListener("click", handleClick);
    canvas.addEventListener("wheel", handleWheel, { passive: false });

    return () => {
      canvas.removeEventListener("mousemove", handleMouseMove);
      canvas.removeEventListener("mousedown", handleMouseDown);
      canvas.removeEventListener("mouseup", handleMouseUp);
      canvas.removeEventListener("mouseleave", handleMouseUp);
      canvas.removeEventListener("click", handleClick);
      canvas.removeEventListener("wheel", handleWheel);
    };
  }, [draw, findNode, screenToWorld, onNavigate]);

  return (
    <div ref={containerRef} className="graph-view">
      <canvas ref={canvasRef} />
      {loading && (
        <div className="graph-loading">
          <div className="spinner" />
          <span>Loading graph...</span>
        </div>
      )}
      {tooltip && (
        <div
          className="graph-tooltip"
          style={{ left: tooltip.x + 14, top: tooltip.y - 10 }}
        >
          <span className="graph-tooltip-label">{tooltip.label}</span>
          <span
            className="graph-tooltip-type"
            style={{ color: getColor(tooltip.type) }}
          >
            {tooltip.type}
          </span>
        </div>
      )}
      <div className="graph-legend">
        {Object.entries(TYPE_COLORS).map(([type, color]) => (
          <div key={type} className="graph-legend-item">
            <span className="graph-legend-dot" style={{ background: color }} />
            <span>{type}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
