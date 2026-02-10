import { useEffect, useRef } from 'react';
import './LoaderOverlay.css';

interface LoaderOverlayProps {
  active: boolean;
}

/* ------------------------------------------------------------------ */
/*  Procedural 3D Knowledge-Graph builder                              */
/*  Nodes appear first, then their edges trace out one-by-one.         */
/*  Timing is jittered for an organic, non-robotic feel.               */
/*  Lightsaber energy beams traverse the graph at high speed.          */
/* ------------------------------------------------------------------ */

const FOCAL_LENGTH    = 260;
const ROTATION_SPEED  = 0.18;
const SPAWN_BASE      = 0.6;
const SPAWN_JITTER    = 0.2;
const NODE_FADE_IN    = 0.65;
const EDGE_DELAY_MIN  = 0.3;
const EDGE_DELAY_MAX  = 0.55;
const EDGE_STAGGER    = 0.2;
const EDGE_DRAW_DUR   = 0.5;
const FADE_OUT_DUR    = 2.5;
const GROWTH_CAP      = 32;
const RETIRE_BATCH    = 3;
const SPREAD_MIN      = 90;
const SPREAD_MAX      = 220;
const SPREAD_RAMP     = 30;

// --- Beam traversal (lightsaber energy) ---
const BEAM_COUNT       = 1;       // single beam
const BEAM_SPEED_MIN   = 7;       // progress/sec (very fast traversal)
const BEAM_SPEED_MAX   = 13;      // progress/sec
const BEAM_TRAIL       = 0.28;    // visible trail fraction of edge
const BEAM_CORE_WIDTH  = 2.5;     // px, inner core line width
const BEAM_GLOW_WIDTH  = 6;       // px, outer glow line width
const FLASH_DURATION   = 0.12;    // seconds, node flash on beam arrival
const FLASH_RADIUS     = 18;      // px, max flash bloom radius
const BEAM_START_DELAY = 2.0;     // seconds before beams start (let nodes spawn first)

const PALETTE = [
  { color: '#38bdf8', glow: 'rgba(56,189,248,0.45)' },
  { color: '#818cf8', glow: 'rgba(129,140,248,0.40)' },
  { color: '#a78bfa', glow: 'rgba(167,139,250,0.40)' },
  { color: '#c084fc', glow: 'rgba(192,132,252,0.40)' },
  { color: '#34d399', glow: 'rgba(52,211,153,0.35)' },
  { color: '#22d3ee', glow: 'rgba(34,211,238,0.35)' },
];

interface LiveNode {
  x: number; y: number; z: number;
  radius: number;
  color: string;
  glow: string;
  birthTime: number;
  retireTime: number | null;
}

interface LiveEdge {
  a: number;
  b: number;
  birthTime: number;
}

interface LiveBeam {
  fromIdx: number;       // source node index
  toIdx: number;         // target node index
  progress: number;      // 0..1 along the edge
  speed: number;         // progress per second
  trailLength: number;   // visible trail fraction
}

interface NodeFlash {
  nodeIdx: number;
  birthTime: number;
  duration: number;
}

// --- Helpers ---

function rotateY(x: number, y: number, z: number, angle: number) {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return { x: x * cos + z * sin, y, z: -x * sin + z * cos };
}

function project(x: number, y: number, z: number, cx: number, cy: number) {
  const scale = FOCAL_LENGTH / (FOCAL_LENGTH + z);
  return { sx: cx + x * scale, sy: cy + y * scale, scale };
}

function easeOut(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

function randRange(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function randomSpherePoint(radius: number) {
  const theta = Math.random() * Math.PI * 2;
  const phi = Math.acos(2 * Math.random() - 1);
  const r = radius * (0.4 + Math.random() * 0.6);
  return {
    x: r * Math.sin(phi) * Math.cos(theta),
    y: r * Math.sin(phi) * Math.sin(theta),
    z: r * Math.cos(phi),
  };
}

function getSpread(now: number) {
  const t = Math.min(1, now / SPREAD_RAMP);
  return SPREAD_MIN + (SPREAD_MAX - SPREAD_MIN) * t;
}

function getNodeAlpha(node: LiveNode, now: number): number {
  const age = now - node.birthTime;
  if (age < 0) return 0;
  if (age < NODE_FADE_IN) return easeOut(age / NODE_FADE_IN);
  if (node.retireTime === null) return 1;
  const fadeElapsed = now - node.retireTime;
  if (fadeElapsed < 0) return 1;
  if (fadeElapsed >= FADE_OUT_DUR) return 0;
  return 1 - easeOut(fadeElapsed / FADE_OUT_DUR);
}

/** Returns 0->1 draw progress for an edge. */
function getEdgeProgress(edge: LiveEdge, now: number): number {
  const elapsed = now - edge.birthTime;
  if (elapsed <= 0) return 0;
  if (elapsed >= EDGE_DRAW_DUR) return 1;
  return easeOut(elapsed / EDGE_DRAW_DUR);
}

// --- Component ---

export default function LoaderOverlay({ active }: LoaderOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !active) return;

    const ctx = canvas.getContext('2d')!;
    const dpr = window.devicePixelRatio || 1;

    const parent = canvas.parentElement!;
    const W = parent.clientWidth;
    const H = parent.clientHeight;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const cx = W / 2;
    const cy = H / 2 - 24;

    const nodes: LiveNode[] = [];
    const edges: LiveEdge[] = [];
    const beams: LiveBeam[] = [];
    const flashes: NodeFlash[] = [];
    let nextSpawnAt = 0;
    let prevNow = 0;

    // Seed hub
    nodes.push({
      x: 0, y: 0, z: 0,
      radius: 5.5,
      color: PALETTE[0].color,
      glow: PALETTE[0].glow,
      birthTime: 0,
      retireTime: null,
    });

    let startTime: number | null = null;

    function scheduleNextSpawn(now: number) {
      nextSpawnAt = now + SPAWN_BASE + randRange(-SPAWN_JITTER, SPAWN_JITTER);
    }

    // --- Beam helpers ---

    /** Return all fully-drawn edges connected to a given node. */
    function getConnectedEdges(nodeIdx: number): LiveEdge[] {
      const result: LiveEdge[] = [];
      for (const e of edges) {
        if ((e.a === nodeIdx || e.b === nodeIdx) && getEdgeProgress(e, prevNow) >= 1) {
          result.push(e);
        }
      }
      return result;
    }

    function getOtherNode(edge: LiveEdge, nodeIdx: number): number {
      return edge.a === nodeIdx ? edge.b : edge.a;
    }

    /** Find a random visible node that has at least one fully-drawn edge. */
    function findNodeWithEdges(): number {
      const candidates: number[] = [];
      for (let i = 0; i < nodes.length; i++) {
        if (getNodeAlpha(nodes[i], prevNow) > 0.3 && getConnectedEdges(i).length > 0) {
          candidates.push(i);
        }
      }
      if (candidates.length === 0) return 0;
      return candidates[Math.floor(Math.random() * candidates.length)];
    }

    /** Create a new beam starting at a random connected node. */
    function initBeam(): LiveBeam | null {
      const fromIdx = findNodeWithEdges();
      const connected = getConnectedEdges(fromIdx);
      if (connected.length === 0) return null;
      const edge = connected[Math.floor(Math.random() * connected.length)];
      const toIdx = getOtherNode(edge, fromIdx);
      return {
        fromIdx,
        toIdx,
        progress: 0,
        speed: randRange(BEAM_SPEED_MIN, BEAM_SPEED_MAX),
        trailLength: BEAM_TRAIL,
      };
    }

    /** Advance a beam to its next edge. Returns false if completely stuck. */
    function pickNextEdge(beam: LiveBeam): boolean {
      const currentNode = beam.toIdx;
      const connected = getConnectedEdges(currentNode);
      // Prefer edges that don't go back where we came from
      const filtered = connected.filter(e => getOtherNode(e, currentNode) !== beam.fromIdx);
      const pool = filtered.length > 0 ? filtered : connected;

      if (pool.length === 0) {
        // Dead end — teleport to a random node with edges
        const newFrom = findNodeWithEdges();
        const newConnected = getConnectedEdges(newFrom);
        if (newConnected.length === 0) return false;
        const edge = newConnected[Math.floor(Math.random() * newConnected.length)];
        beam.fromIdx = newFrom;
        beam.toIdx = getOtherNode(edge, newFrom);
        beam.progress = 0;
        beam.speed = randRange(BEAM_SPEED_MIN, BEAM_SPEED_MAX);
        return true;
      }

      const edge = pool[Math.floor(Math.random() * pool.length)];
      beam.fromIdx = currentNode;
      beam.toIdx = getOtherNode(edge, currentNode);
      beam.progress = 0;
      beam.speed = randRange(BEAM_SPEED_MIN, BEAM_SPEED_MAX);
      return true;
    }

    // --- Node lifecycle ---

    function spawnNode(now: number) {
      const pal = PALETTE[Math.floor(Math.random() * PALETTE.length)];
      const spread = getSpread(now);
      const pos = randomSpherePoint(spread);
      const newIdx = nodes.length;

      nodes.push({
        ...pos,
        radius: randRange(3.5, 5.5),
        color: pal.color,
        glow: pal.glow,
        birthTime: now,
        retireTime: null,
      });

      // Schedule edges AFTER a delay (node appears first, then edges trace out)
      const connectionCount = Math.random() < 0.35 ? 2 : 1;
      const pool = nodes.length - 1;
      const used = new Set<number>();

      for (let c = 0; c < connectionCount && pool > 0; c++) {
        let target: number;
        let tries = 0;
        do {
          const bias = Math.pow(Math.random(), 1.4);
          target = Math.floor(bias * pool);
          tries++;
        } while (used.has(target) && tries < 12);

        if (!used.has(target)) {
          used.add(target);
          const delay = randRange(EDGE_DELAY_MIN, EDGE_DELAY_MAX) + c * EDGE_STAGGER;
          edges.push({
            a: newIdx,
            b: target,
            birthTime: now + delay,
          });
        }
      }

      scheduleNextSpawn(now);
    }

    function retireOldest(now: number) {
      let visibleCount = 0;
      for (const n of nodes) {
        if (n.retireTime === null && getNodeAlpha(n, now) > 0) visibleCount++;
      }
      if (visibleCount <= GROWTH_CAP) return;

      let retired = 0;
      for (let i = 1; i < nodes.length && retired < RETIRE_BATCH; i++) {
        if (nodes[i].retireTime === null) {
          nodes[i].retireTime = now;
          retired++;
        }
      }
    }

    function garbageCollect(now: number) {
      const alive = new Set<number>();
      for (let i = 0; i < nodes.length; i++) {
        if (getNodeAlpha(nodes[i], now) > 0.001) alive.add(i);
      }
      if (alive.size === nodes.length) return;

      const remap = new Map<number, number>();
      const newNodes: LiveNode[] = [];
      for (let i = 0; i < nodes.length; i++) {
        if (alive.has(i)) {
          remap.set(i, newNodes.length);
          newNodes.push(nodes[i]);
        }
      }

      const newEdges: LiveEdge[] = [];
      for (const e of edges) {
        const na = remap.get(e.a);
        const nb = remap.get(e.b);
        if (na !== undefined && nb !== undefined) {
          newEdges.push({ a: na, b: nb, birthTime: e.birthTime });
        }
      }

      // Remap beam node indices (remove beams whose nodes were garbage-collected)
      for (let i = beams.length - 1; i >= 0; i--) {
        const nf = remap.get(beams[i].fromIdx);
        const nt = remap.get(beams[i].toIdx);
        if (nf === undefined || nt === undefined) {
          beams.splice(i, 1);
        } else {
          beams[i].fromIdx = nf;
          beams[i].toIdx = nt;
        }
      }

      // Remap flash node indices
      for (let i = flashes.length - 1; i >= 0; i--) {
        const nIdx = remap.get(flashes[i].nodeIdx);
        if (nIdx === undefined) {
          flashes.splice(i, 1);
        } else {
          flashes[i].nodeIdx = nIdx;
        }
      }

      nodes.length = 0;
      nodes.push(...newNodes);
      edges.length = 0;
      edges.push(...newEdges);
    }

    function drawFrame(timestamp: number) {
      if (startTime === null) {
        startTime = timestamp;
        scheduleNextSpawn(0);
      }
      const now = (timestamp - startTime) / 1000;
      const dt = Math.min(now - prevNow, 0.1); // cap to avoid huge jumps on tab-switch
      prevNow = now;
      const angle = now * ROTATION_SPEED;

      // Spawn nodes with jittered timing
      if (now >= nextSpawnAt) {
        spawnNode(now);
      }

      retireOldest(now);
      if (nodes.length > GROWTH_CAP + 10) garbageCollect(now);

      // --- Spawn beams after delay (staggered) ---
      if (now >= BEAM_START_DELAY && beams.length < BEAM_COUNT) {
        const beamSpawnTime = BEAM_START_DELAY + beams.length * 0.3;
        if (now >= beamSpawnTime) {
          const b = initBeam();
          if (b) beams.push(b);
        }
      }

      // --- Update beams ---
      for (const beam of beams) {
        beam.progress += beam.speed * dt;
        if (beam.progress >= 1) {
          // Beam arrived — create flash and hop to next edge
          flashes.push({
            nodeIdx: beam.toIdx,
            birthTime: now,
            duration: FLASH_DURATION,
          });
          if (!pickNextEdge(beam)) {
            beam.progress = 0.99; // stall briefly if no path found
          }
        }
      }

      // --- Clean up expired flashes ---
      for (let i = flashes.length - 1; i >= 0; i--) {
        if (now - flashes[i].birthTime > flashes[i].duration) {
          flashes.splice(i, 1);
        }
      }

      ctx.clearRect(0, 0, W, H);

      // --- Project nodes ---
      type Proj = {
        sx: number; sy: number; scale: number; z: number;
        idx: number; alpha: number;
      };
      const projected: Proj[] = [];

      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        const alpha = getNodeAlpha(n, now);
        if (alpha <= 0) continue;

        const r = rotateY(n.x, n.y, n.z, angle);
        const p = project(r.x, r.y, r.z, cx, cy);
        projected.push({ sx: p.sx, sy: p.sy, scale: p.scale, z: r.z, idx: i, alpha });
      }

      const projMap = new Map<number, Proj>();
      for (const p of projected) projMap.set(p.idx, p);

      // --- Draw edges (with draw-progress animation) ---
      for (const e of edges) {
        const pa = projMap.get(e.a);
        const pb = projMap.get(e.b);
        if (!pa || !pb) continue;

        const progress = getEdgeProgress(e, now);
        if (progress <= 0) continue;

        const nodeAlpha = Math.min(pa.alpha, pb.alpha);
        if (nodeAlpha < 0.01) continue;

        // Interpolate: line grows from source (a) toward target (b)
        const ex = pa.sx + (pb.sx - pa.sx) * progress;
        const ey = pa.sy + (pb.sy - pa.sy) * progress;

        // Use a gradient along the edge for a softer look
        const edgeGrad = ctx.createLinearGradient(pa.sx, pa.sy, ex, ey);
        const na = nodes[e.a];
        const nb = nodes[e.b];
        const edgeColorA = na ? na.color : '#38bdf8';
        const edgeColorB = nb ? nb.color : '#38bdf8';

        ctx.save();
        ctx.globalAlpha = nodeAlpha * 0.22 * progress;
        edgeGrad.addColorStop(0, edgeColorA);
        edgeGrad.addColorStop(1, edgeColorB);
        ctx.strokeStyle = edgeGrad;
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(pa.sx, pa.sy);
        ctx.lineTo(ex, ey);
        ctx.stroke();
        ctx.restore();
      }

      // --- Depth-sort nodes ---
      projected.sort((a, b) => b.z - a.z);

      // --- Draw nodes ---
      for (const p of projected) {
        const n = nodes[p.idx];
        if (!n) continue;

        const age = now - n.birthTime;
        const popScale = age < NODE_FADE_IN ? easeOut(age / NODE_FADE_IN) : 1;
        const baseR = n.radius * p.scale * popScale;
        if (baseR < 0.4) continue;

        ctx.save();
        ctx.globalAlpha = p.alpha;

        // Soft outer glow
        ctx.shadowColor = n.glow;
        ctx.shadowBlur = 18 * p.scale;

        // Main body: smooth gradient from bright center to transparent edge
        const grad = ctx.createRadialGradient(p.sx, p.sy, 0, p.sx, p.sy, baseR);
        grad.addColorStop(0, n.color);
        grad.addColorStop(0.5, n.color);
        grad.addColorStop(1, 'transparent');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(p.sx, p.sy, baseR, 0, Math.PI * 2);
        ctx.fill();

        // Subtle inner highlight
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        const hlGrad = ctx.createRadialGradient(
          p.sx - baseR * 0.15, p.sy - baseR * 0.15, 0,
          p.sx, p.sy, baseR * 0.55
        );
        hlGrad.addColorStop(0, 'rgba(255,255,255,0.35)');
        hlGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = hlGrad;
        ctx.globalAlpha = p.alpha * 0.6;
        ctx.beginPath();
        ctx.arc(p.sx, p.sy, baseR * 0.55, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
      }

      // --- Draw energy beams (on top of everything) ---
      for (const beam of beams) {
        const pa = projMap.get(beam.fromIdx);
        const pb = projMap.get(beam.toIdx);
        if (!pa || !pb) continue;

        const headT = Math.min(beam.progress, 1);
        const tailT = Math.max(headT - beam.trailLength, 0);

        const hx = pa.sx + (pb.sx - pa.sx) * headT;
        const hy = pa.sy + (pb.sy - pa.sy) * headT;
        const tx = pa.sx + (pb.sx - pa.sx) * tailT;
        const ty = pa.sy + (pb.sy - pa.sy) * tailT;

        // Skip degenerate beam segments (head ≈ tail)
        const segDx = hx - tx;
        const segDy = hy - ty;
        if (segDx * segDx + segDy * segDy < 1) continue;

        // Layer 1: Outer glow — wide, diffuse deep-blue halo with trail fade
        ctx.save();
        const outerGrad = ctx.createLinearGradient(tx, ty, hx, hy);
        outerGrad.addColorStop(0, 'rgba(30,64,175,0)');
        outerGrad.addColorStop(1, 'rgba(30,64,175,0.4)');
        ctx.strokeStyle = outerGrad;
        ctx.shadowColor = '#1d4ed8';
        ctx.shadowBlur = 40;
        ctx.lineWidth = BEAM_GLOW_WIDTH;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(tx, ty);
        ctx.lineTo(hx, hy);
        ctx.stroke();
        ctx.restore();

        // Layer 2: Mid glow — brighter blue beam body
        ctx.save();
        const midGrad = ctx.createLinearGradient(tx, ty, hx, hy);
        midGrad.addColorStop(0, 'rgba(59,130,246,0)');
        midGrad.addColorStop(1, 'rgba(59,130,246,0.75)');
        ctx.strokeStyle = midGrad;
        ctx.shadowColor = '#2563eb';
        ctx.shadowBlur = 20;
        ctx.lineWidth = BEAM_CORE_WIDTH + 1.5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(tx, ty);
        ctx.lineTo(hx, hy);
        ctx.stroke();
        ctx.restore();

        // Layer 3: Core — bright white-blue center line
        ctx.save();
        const coreGrad = ctx.createLinearGradient(tx, ty, hx, hy);
        coreGrad.addColorStop(0, 'rgba(191,219,254,0)');
        coreGrad.addColorStop(0.5, 'rgba(191,219,254,0.55)');
        coreGrad.addColorStop(1, 'rgba(219,234,254,0.95)');
        ctx.strokeStyle = coreGrad;
        ctx.shadowColor = '#3b82f6';
        ctx.shadowBlur = 10;
        ctx.lineWidth = BEAM_CORE_WIDTH;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(tx, ty);
        ctx.lineTo(hx, hy);
        ctx.stroke();
        ctx.restore();
      }

      // --- Draw node flashes (energy impact on beam arrival) ---
      for (const flash of flashes) {
        const p = projMap.get(flash.nodeIdx);
        if (!p) continue;

        const elapsed = now - flash.birthTime;
        const t = Math.min(elapsed / flash.duration, 1);
        const alpha = 1 - easeOut(t);
        const r = FLASH_RADIUS * (0.5 + 0.5 * easeOut(t));

        ctx.save();
        ctx.globalAlpha = alpha * 0.8;
        const flashGrad = ctx.createRadialGradient(p.sx, p.sy, 0, p.sx, p.sy, r);
        flashGrad.addColorStop(0, 'rgba(219,234,254,0.9)');
        flashGrad.addColorStop(0.4, 'rgba(59,130,246,0.5)');
        flashGrad.addColorStop(1, 'rgba(30,64,175,0)');
        ctx.fillStyle = flashGrad;
        ctx.shadowColor = '#2563eb';
        ctx.shadowBlur = 30;
        ctx.beginPath();
        ctx.arc(p.sx, p.sy, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      rafRef.current = requestAnimationFrame(drawFrame);
    }

    rafRef.current = requestAnimationFrame(drawFrame);
    return () => cancelAnimationFrame(rafRef.current);
  }, [active]);

  const loaderText = 'Building Knowledge Graph';

  return (
    <div className={`loader-overlay ${active ? 'active' : ''}`}>
      <canvas ref={canvasRef} className="loader-canvas" />
      <p className="loader-label">
        {loaderText.split('').map((ch, i) => (
          <span
            key={i}
            className="loader-char"
            style={{ animationDelay: `${i * 0.04}s` }}
          >
            {ch === ' ' ? '\u00A0' : ch}
          </span>
        ))}
        <span className="loader-dots">
          <span className="loader-char" style={{ animationDelay: '0s' }}>.</span>
          <span className="loader-char" style={{ animationDelay: '0.3s' }}>.</span>
          <span className="loader-char" style={{ animationDelay: '0.6s' }}>.</span>
        </span>
      </p>
    </div>
  );
}
