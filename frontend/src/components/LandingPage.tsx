import { useEffect, useRef, useMemo } from 'react';
import {
  animate,
  createTimeline,
  createScope,
  stagger,
  spring,
  onScroll,
  svg,
  utils,
} from 'animejs';
import './LandingPage.css';

interface LandingPageProps {
  onEnter: () => void;
}

/* ------------------------------------------------------------------ */
/*  Geometry helpers for the SVG apparatus                              */
/* ------------------------------------------------------------------ */
const CX = 300;
const CY = 300;
const R_OUTER = 260;
const R_MID = 190;
const R_INNER = 120;
const TICK_COUNT = 72;
const PARTICLE_COUNT = 40;

function polarToXY(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = (angleDeg - 90) * (Math.PI / 180);
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arcPath(cx: number, cy: number, r: number, startDeg: number, endDeg: number) {
  const start = polarToXY(cx, cy, r, startDeg);
  const end = polarToXY(cx, cy, r, endDeg);
  const largeArc = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`;
}

function buildTicks() {
  const ticks = [];
  for (let i = 0; i < TICK_COUNT; i++) {
    const angle = (360 / TICK_COUNT) * i;
    const inner = polarToXY(CX, CY, R_OUTER - 8, angle);
    const outer = polarToXY(CX, CY, R_OUTER + (i % 6 === 0 ? 14 : 6), angle);
    ticks.push({ x1: inner.x, y1: inner.y, x2: outer.x, y2: outer.y, major: i % 6 === 0 });
  }
  return ticks;
}

function buildNodes() {
  const nodes: { x: number; y: number; r: number; ring: number }[] = [];
  const rings = [R_OUTER - 20, R_MID, R_INNER];
  const perRing = [5, 5, 4];
  rings.forEach((ringR, ri) => {
    for (let n = 0; n < perRing[ri]; n++) {
      const angle = (360 / perRing[ri]) * n + ri * 25;
      const p = polarToXY(CX, CY, ringR, angle);
      nodes.push({ x: p.x, y: p.y, r: ri === 0 ? 5 : ri === 1 ? 6 : 4.5, ring: ri });
    }
  });
  return nodes;
}

function buildConnections(nodes: ReturnType<typeof buildNodes>) {
  /* Group node indices by ring */
  const byRing: Map<number, number[]> = new Map();
  nodes.forEach((n, idx) => {
    if (!byRing.has(n.ring)) byRing.set(n.ring, []);
    byRing.get(n.ring)!.push(idx);
  });

  const conns: { x1: number; y1: number; x2: number; y2: number; ring: number }[] = [];
  const used = new Set<string>();

  const addEdge = (a: number, b: number, ring: number) => {
    if (a === b) return;
    const key = `${Math.min(a, b)}-${Math.max(a, b)}`;
    if (used.has(key)) return;
    used.add(key);
    conns.push({ x1: nodes[a].x, y1: nodes[a].y, x2: nodes[b].x, y2: nodes[b].y, ring });
  };

  byRing.forEach((indices, ring) => {
    const len = indices.length;
    for (let i = 0; i < len; i++) {
      /* Some adjacent edges (every other node — breaks the polygon) */
      if (i % 2 === 0) addEdge(indices[i], indices[(i + 1) % len], ring);
      /* Skip-one edges (opposite direction feel) */
      if (i % 2 === 1 && len >= 4) addEdge(indices[i], indices[(i + 2) % len], ring);
    }
    /* Cross-diagonals for variety */
    addEdge(indices[0], indices[Math.floor(len / 2)], ring);
    if (len >= 5) addEdge(indices[1], indices[len - 1], ring);
  });

  /* Hub spokes: connect inner-ring nodes to the center hub */
  const innerIndices = byRing.get(2) || [];
  innerIndices.forEach((idx) => {
    conns.push({ x1: nodes[idx].x, y1: nodes[idx].y, x2: CX, y2: CY, ring: 2 });
  });

  return conns;
}

function buildParticles() {
  const pts: { x: number; y: number; r: number }[] = [];
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const angle = Math.random() * 360;
    const dist = 40 + Math.random() * (R_OUTER - 30);
    const p = polarToXY(CX, CY, dist, angle);
    pts.push({ x: p.x, y: p.y, r: 1 + Math.random() * 1.5 });
  }
  return pts;
}

/* ------------------------------------------------------------------ */
/*  Hyperspace stars + streaks                                         */
/* ------------------------------------------------------------------ */
const STAR_COUNT = 30;
const STREAK_COUNT = 5;

function buildStars() {
  return Array.from({ length: STAR_COUNT }, () => ({
    left: Math.random() * 100,
    top: Math.random() * 100,
    size: 0.8 + Math.random() * 1,       // tiny: 0.8-1.8px
  }));
}

function buildStreaks() {
  return Array.from({ length: STREAK_COUNT }, () => ({
    left: 10 + Math.random() * 80,
    top: Math.random() * 100,
  }));
}

/* ------------------------------------------------------------------ */
/*  Step data (drives both text panels and SVG illumination)           */
/* ------------------------------------------------------------------ */
const STEPS = [
  {
    num: '01',
    title: 'Input Text',
    subtitle: 'Feed the engine with raw knowledge',
    desc: 'Paste text or upload documents. The system ingests raw information\u2009—\u2009articles, papers, notes\u2009—\u2009anything that contains knowledge worth connecting.',
    features: [
      'Articles, research papers, and reports',
      'Plain text or structured documents',
      'Any domain, any language',
    ],
    accent: '#22d3ee',
  },
  {
    num: '02',
    title: 'LLM Processing',
    subtitle: 'AI-powered semantic analysis',
    desc: 'Google Gemini analyzes the text, extracting entities and the relationships between them. The AI builds a structured understanding of your data.',
    features: [
      'Entity and relationship extraction',
      'Contextual understanding via Gemini 2.5',
      'Structured semantic graph construction',
    ],
    accent: '#818cf8',
  },
  {
    num: '03',
    title: 'Knowledge Graph',
    subtitle: 'Explore, query, and discover',
    desc: 'A visual, interactive knowledge graph emerges. Explore connections, ask questions through the RAG pipeline, and uncover hidden insights.',
    features: [
      'Interactive node-link visualization',
      'Conversational RAG-powered Q\u200A&\u200AA',
      'Discover hidden connections across data',
    ],
    accent: '#34d399',
  },
];

/* ================================================================== */
/*  Component                                                          */
/* ================================================================== */
export default function LandingPage({ onEnter }: LandingPageProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const scopeRef = useRef<ReturnType<typeof createScope> | null>(null);
  const onEnterRef = useRef(onEnter);
  onEnterRef.current = onEnter;

  const ticks = useMemo(() => buildTicks(), []);
  const nodes = useMemo(() => buildNodes(), []);
  const connections = useMemo(() => buildConnections(nodes), [nodes]);
  const particles = useMemo(() => buildParticles(), []);
  const stars = useMemo(() => buildStars(), []);
  const streaks = useMemo(() => buildStreaks(), []);

  /* ---- Animations ---- */
  useEffect(() => {
    if (!rootRef.current) return;

    scopeRef.current = createScope({ root: rootRef }).add((self) => {

      /* ============================================================
         1. HERO ENTRANCE — cinematic: dark hold → bloom → blur reveal
         ============================================================ */
      const heroTl = createTimeline({ defaults: { ease: 'out(3)' } });

      // Helper: remove .hero-hidden so the element becomes animatable
      const reveal = (selector: string) => () => {
        rootRef.current?.querySelectorAll(selector).forEach((el) => {
          el.classList.remove('hero-hidden');
        });
      };

      // Brief dark hold (400ms), then background blooms in
      heroTl.add('.bg-reveal', {
        opacity: [0, 1],
        duration: 600,
        ease: 'out(3)',
      }, 400);

      // KG visualization — slides in from the right with blur-to-sharp
      heroTl.add('.hero-viz', {
        opacity: [0, 1],
        translateX: [120, 0],
        filter: ['blur(10px)', 'blur(0px)'],
        duration: 900,
        ease: 'out(4)',
        onBegin: reveal('.hero-viz'),
      }, 500);

      // Title — slides in from the left
      heroTl.add('.hero-title', {
        opacity: [0, 1],
        translateX: [-80, 0],
        duration: 800,
        ease: 'out(4)',
        onBegin: reveal('.hero-title'),
      }, 650);

      // Subtitle — slides in from the left, slightly delayed
      heroTl.add('.hero-subtitle', {
        opacity: [0, 1],
        translateX: [-60, 0],
        duration: 700,
        ease: 'out(4)',
        onBegin: reveal('.hero-subtitle'),
      }, 850);

      // CTA row — slides in from the left
      heroTl.add('.hero-cta-row', {
        opacity: [0, 1],
        translateX: [-50, 0],
        duration: 700,
        ease: 'out(4)',
        onBegin: reveal('.hero-cta-row'),
      }, 1000);

      // Scroll hint — subtle fade
      heroTl.add('.hero-scroll-hint', {
        opacity: [0, 0.6],
        duration: 500,
        onBegin: reveal('.hero-scroll-hint'),
      }, 1300);

      /* ============================================================
         2. CONTINUOUS SVG ANIMATIONS — loop forever
         ============================================================ */

      // Tick marks: opacity wave
      animate('.viz-tick', {
        opacity: [0.15, 0.7],
        delay: stagger(25, { from: 'first' }),
        duration: 2000,
        loop: true,
        alternate: true,
        ease: 'inOut(2)',
      });

      // Middle ring rotation
      animate('.viz-ring-mid-group', {
        rotate: '1turn',
        duration: 60000,
        loop: true,
        ease: 'linear',
      });

      // Inner ring counter-rotation
      animate('.viz-ring-inner-group', {
        rotate: '-1turn',
        duration: 45000,
        loop: true,
        ease: 'linear',
      });

      // Node pulse (all rings — group opacity controls visibility)
      animate('.viz-node', {
        scale: [0.8, 1.3],
        opacity: [0.4, 1],
        delay: stagger(120),
        duration: 2500,
        loop: true,
        alternate: true,
        ease: 'inOut(2)',
      });

      // Connection lines: draw in/out
      const drawables = svg.createDrawable('.viz-connection');
      animate(drawables, {
        draw: ['0 0', '0 1', '1 1'],
        delay: stagger(100),
        duration: 3000,
        loop: true,
        ease: 'inOut(3)',
      });

      // Central hub: spring pulse
      animate('.viz-hub', {
        scale: [1, 1.25, 0.95, 1.1, 1],
        opacity: [0.7, 1],
        duration: 3000,
        loop: true,
        ease: spring({ stiffness: 80, damping: 8 }),
      });

      // Hub glow ring
      animate('.viz-hub-glow', {
        scale: [1, 1.8],
        opacity: [0.3, 0],
        duration: 2500,
        loop: true,
        ease: 'out(3)',
      });

      // Data particles: random drift
      animate('.viz-particle', {
        translateX: () => utils.random(-12, 12),
        translateY: () => utils.random(-12, 12),
        opacity: [0.1, () => 0.2 + Math.random() * 0.5],
        duration: () => utils.random(2500, 6000),
        loop: true,
        alternate: true,
        ease: 'inOut(2)',
        delay: () => utils.random(0, 2000),
      });

      // Scan beam rotation
      animate('.viz-scan-beam', {
        rotate: '1turn',
        duration: 4000,
        loop: true,
        ease: 'linear',
      });

      // Scroll arrow bounce
      animate('.scroll-arrow-icon', {
        translateY: [0, 8, 0],
        loop: true,
        duration: 1500,
        ease: 'inOut(2)',
      });

      // Continuous gentle float on the viz container
      animate('.hero-viz', {
        translateY: [0, -12, 0, 10, 0],
        duration: 7000,
        loop: true,
        ease: 'inOut(2)',
      });

      // HUD energy ring — continuous spin
      animate('.hud-energy-ring', {
        rotate: '1turn',
        duration: 12000,
        loop: true,
        ease: 'linear',
      });

      /* ============================================================
         3. MASTER SCROLL TIMELINE — sync: true
            Drives text panel fades AND SVG illumination.
            Duration budget: 10 000 units mapped to full scroll range.
            1×100vh hero + 3×300vh steps + 1×100vh CTA = 1100vh.
            Scroll ≈ 1000vh. Timeline maps 0→10 000 across that range.
            Phase 1 (Step 01): 500–3200  |  Phase 2 (Step 02): 3200–6200
            Phase 3 (Step 03): 6200–9200 |  CTA: 9200–10000
         ============================================================ */
      const scrollTarget = rootRef.current!;

      const scrollTl = createTimeline({
        defaults: { ease: 'out(3)' },
        autoplay: onScroll({
          target: scrollTarget,
          enter: 'top top',
          leave: 'bottom bottom',
          sync: true,
        }),
      });

      /* --- Text panels — each step has ~3000 units of hold time --- */

      // Hero text fades out
      scrollTl.add('.panel-hero .panel-content', {
        opacity: [1, 0],
        translateY: [0, -40],
        duration: 800,
      }, 300);

      // Scroll hint fades
      scrollTl.add('.hero-scroll-hint', {
        opacity: [0.6, 0],
        duration: 600,
      }, 300);

      // Step 01 — slides in, holds, slides out left
      scrollTl.add('.panel-step-0 .panel-content', {
        opacity: [0, 1],
        translateX: [60, 0],
        duration: 150,
      }, 500);
      scrollTl.add('.panel-step-0 .panel-content', {
        opacity: [1, 0],
        translateX: [0, -120],
        duration: 300,
      }, 3200);

      // Step 02 — slides in, holds, slides out left
      scrollTl.add('.panel-step-1 .panel-content', {
        opacity: [0, 1],
        translateX: [60, 0],
        duration: 150,
      }, 3200);
      scrollTl.add('.panel-step-1 .panel-content', {
        opacity: [1, 0],
        translateX: [0, -120],
        duration: 300,
      }, 6200);

      // Step 03 — slides in, holds, slides out left
      scrollTl.add('.panel-step-2 .panel-content', {
        opacity: [0, 1],
        translateX: [60, 0],
        duration: 150,
      }, 6200);
      scrollTl.add('.panel-step-2 .panel-content', {
        opacity: [1, 0],
        translateX: [0, -120],
        duration: 300,
      }, 9200);

      // KG dissolves outward across all sides (9000-9400)
      scrollTl.add('.viz-transform-wrapper', {
        opacity: [1, 0],
        scale: [1.05, 1.6],
        duration: 400,
      }, 9000);

      /* --- SVG progressive illumination --- */

      // Phase 1 (Step 01 — Input): outer ring lights up
      scrollTl.add('.viz-layer-outer', {
        opacity: [0.2, 1],
        duration: 2500,
      }, 800);

      scrollTl.add('.viz-arc-entities', {
        strokeDashoffset: [800, 0],
        duration: 2500,
      }, 800);

      scrollTl.add('.viz-arc-queries', {
        strokeDashoffset: [800, 0],
        duration: 2500,
      }, 1200);

      // Phase 2 (Step 02 — Processing): mid ring
      scrollTl.add('.viz-layer-mid', {
        opacity: [0.2, 1],
        duration: 2500,
      }, 3800);

      scrollTl.add('.viz-arc-relations', {
        strokeDashoffset: [800, 0],
        duration: 2500,
      }, 3800);

      // Phase 3 (Step 03 — KG): arcs + particles + scan
      scrollTl.add('.viz-arc-answers', {
        strokeDashoffset: [800, 0],
        duration: 2000,
      }, 6800);

      scrollTl.add('.viz-layer-particles', {
        opacity: [0.1, 0.7],
        duration: 2000,
      }, 6800);

      scrollTl.add('.viz-layer-scan', {
        opacity: [0.2, 1],
        duration: 2000,
      }, 6800);

      // Background glow grows throughout Phase 1
      scrollTl.add('.viz-glow-bg', {
        opacity: [0, 1],
        scale: [0.5, 1.2],
        duration: 3500,
      }, 0);

      // CTA enhancements
      scrollTl.add('.cta-glow', {
        scale: [0.8, 1.3],
        opacity: [0.05, 0.3],
        duration: 300,
      }, 9200);

      scrollTl.add('.cta-btn', {
        boxShadow: [
          '0 0 20px rgba(56,189,248,0.1)',
          '0 0 60px rgba(56,189,248,0.5)',
        ],
        duration: 200,
      }, 9200);

      /* --- 3D transforms — Peer Inside → Jarvis HUD → Completion --- */

      // Phase 1 (0-3500): Heavy X tilt to reveal interior (bowl effect)
      scrollTl.add('.viz-transform-wrapper', {
        rotateX: ['0deg', '58deg'],
        rotateY: ['-5deg', '12deg'],
        translateZ: [0, 80],
        scale: [1, 1.15],
        duration: 3500,
      }, 0);

      // Phase 2 (3500-6500): Jarvis HUD — scale up, rotate back to flat
      scrollTl.add('.viz-transform-wrapper', {
        rotateX: ['58deg', '0deg'],
        rotateY: ['12deg', '0deg'],
        scale: [1.15, 1.5],
        translateZ: [80, 0],
        duration: 3000,
      }, 3500);

      // Phase 3 (6500-9000): Replicate Phase 1 cylinder expansion
      // Start values must match Phase 2 end values (scale 1.5, translateZ 0)
      scrollTl.add('.viz-transform-wrapper', {
        rotateX: ['0deg', '58deg'],
        rotateY: ['0deg', '12deg'],
        translateZ: [0, 80],
        scale: [1.5, 1.15],
        duration: 2500,
      }, 6500);


      // Settle to CTA (9000-9800)
      scrollTl.add('.viz-transform-wrapper', {
        rotateX: ['58deg', '0deg'],
        rotateY: ['12deg', '0deg'],
        scale: [1.15, 1.05],
        duration: 800,
      }, 9000);

      /* --- Parallax depth: drift for stronger layer separation --- */

      scrollTl.add('.viz-layer-outer', {
        translateX: [0, 20],
        translateY: [0, -16],
        duration: 10000,
      }, 0);

      scrollTl.add('.viz-layer-mid', {
        translateX: [0, -14],
        translateY: [0, 12],
        duration: 10000,
      }, 0);

      scrollTl.add('.viz-layer-inner', {
        translateX: [0, -26],
        translateY: [0, 22],
        duration: 10000,
      }, 0);

      scrollTl.add('.viz-layer-particles', {
        translateX: [0, 18],
        translateY: [0, -14],
        duration: 10000,
      }, 0);

      scrollTl.add('.viz-layer-scan', {
        translateX: [0, -10],
        translateY: [0, 8],
        duration: 10000,
      }, 0);

      /* --- Z-depth pop: inner layers push toward the viewer during tilt --- */

      // Phase 1 pop-out (0-3500): front layers expand along Z
      scrollTl.add('.viz-layer-outer', { translateZ: [0, -60], duration: 3500 }, 0);
      scrollTl.add('.viz-layer-mid', { translateZ: [0, 40], duration: 3500 }, 0);
      scrollTl.add('.viz-layer-inner', { translateZ: [0, 120], duration: 3500 }, 0);
      scrollTl.add('.viz-layer-particles', { translateZ: [0, -30], duration: 3500 }, 0);
      scrollTl.add('.viz-layer-scan', { translateZ: [0, 70], duration: 3500 }, 0);

      // Phase 1 pop-out (0-3500): back mirror layers expand opposite direction
      scrollTl.add('.viz-layer-outer-back', { translateZ: [0, 60], opacity: [0, 0.5], duration: 3500 }, 0);
      scrollTl.add('.viz-layer-mid-back', { translateZ: [0, -40], opacity: [0, 0.4], duration: 3500 }, 0);
      scrollTl.add('.viz-layer-inner-back', { translateZ: [0, -120], opacity: [0, 0.35], duration: 3500 }, 0);

      // Phase 2 settle (3500-6500): all layers return to flat
      scrollTl.add('.viz-layer-outer', { translateZ: [-60, 0], duration: 3000 }, 3500);
      scrollTl.add('.viz-layer-mid', { translateZ: [40, 0], duration: 3000 }, 3500);
      scrollTl.add('.viz-layer-inner', { translateZ: [120, 0], duration: 3000 }, 3500);
      scrollTl.add('.viz-layer-particles', { translateZ: [-30, 0], duration: 3000 }, 3500);
      scrollTl.add('.viz-layer-scan', { translateZ: [70, 0], duration: 3000 }, 3500);
      scrollTl.add('.viz-layer-outer-back', { translateZ: [60, 0], opacity: [0.5, 0], duration: 3000 }, 3500);
      scrollTl.add('.viz-layer-mid-back', { translateZ: [-40, 0], opacity: [0.4, 0], duration: 3000 }, 3500);
      scrollTl.add('.viz-layer-inner-back', { translateZ: [-120, 0], opacity: [0.35, 0], duration: 3000 }, 3500);

      // Phase 3 re-expand (6500-8000): symmetric cylinder both directions
      scrollTl.add('.viz-layer-outer', { translateZ: [0, -60], duration: 1500 }, 6500);
      scrollTl.add('.viz-layer-mid', { translateZ: [0, 40], duration: 1500 }, 6500);
      scrollTl.add('.viz-layer-inner', { translateZ: [0, 120], duration: 1500 }, 6500);
      scrollTl.add('.viz-layer-particles', { translateZ: [0, -30], duration: 1500 }, 6500);
      scrollTl.add('.viz-layer-scan', { translateZ: [0, 70], duration: 1500 }, 6500);
      scrollTl.add('.viz-layer-outer-back', { translateZ: [0, 60], opacity: [0, 0.5], duration: 1500 }, 6500);
      scrollTl.add('.viz-layer-mid-back', { translateZ: [0, -40], opacity: [0, 0.4], duration: 1500 }, 6500);
      scrollTl.add('.viz-layer-inner-back', { translateZ: [0, -120], opacity: [0, 0.35], duration: 1500 }, 6500);

      // Phase 3 settle (8500-9200): all layers return to flat for CTA
      scrollTl.add('.viz-layer-outer', { translateZ: [-60, 0], duration: 700 }, 8500);
      scrollTl.add('.viz-layer-mid', { translateZ: [40, 0], duration: 700 }, 8500);
      scrollTl.add('.viz-layer-inner', { translateZ: [120, 0], duration: 700 }, 8500);
      scrollTl.add('.viz-layer-particles', { translateZ: [-30, 0], duration: 700 }, 8500);
      scrollTl.add('.viz-layer-scan', { translateZ: [70, 0], duration: 700 }, 8500);
      scrollTl.add('.viz-layer-outer-back', { translateZ: [60, 0], opacity: [0.5, 0], duration: 700 }, 8500);
      scrollTl.add('.viz-layer-mid-back', { translateZ: [-40, 0], opacity: [0.4, 0], duration: 700 }, 8500);
      scrollTl.add('.viz-layer-inner-back', { translateZ: [-120, 0], opacity: [0.35, 0], duration: 700 }, 8500);

      /* --- Hyperspace stars & streaks (full scroll range) --- */

      scrollTl.add('.hyper-star', {
        opacity: [0, 0.6, 0.25, 0.5, 0],
        scale: [0.8, 1.2, 0.9, 1.1, 0.8],
        duration: 6000,
        delay: stagger(200),
      }, 0);

      scrollTl.add('.hyper-streak', {
        scaleY: [0, 8],
        opacity: [0, 0.08, 0],
        duration: 5000,
        delay: stagger(900),
      }, 500);

      /* --- Phase 2: Jarvis HUD entrance (3500-4800) --- */

      scrollTl.add('.hud-bracket', {
        opacity: [0, 1],
        scale: [0.8, 1],
        delay: stagger(120),
        duration: 800,
        ease: spring({ stiffness: 100, damping: 14 }),
      }, 3500);

      scrollTl.add('.hud-label', {
        opacity: [0, 0.9],
        translateY: [10, 0],
        delay: stagger(100),
        duration: 700,
      }, 3800);

      scrollTl.add('.hud-energy-ring', {
        opacity: [0, 0.5],
        scale: [0.6, 1],
        duration: 1000,
        ease: 'out(3)',
      }, 3500);

      scrollTl.add('.hud-scanline', {
        opacity: [0, 0.6],
        duration: 400,
      }, 3800);

      // Scanline sweep
      scrollTl.add('.hud-scanline', {
        translateY: ['-100%', '800%'],
        duration: 2000,
        ease: 'inOut(2)',
      }, 3800);

      /* --- Phase 2: Entity annotation (4200-6200) --- */

      scrollTl.add('.entity-annotation', {
        opacity: [0, 1],
        translateX: [20, 0],
        duration: 600,
      }, 4600);

      /* --- Phase 2: Connection annotation (5000-5600) --- */

      scrollTl.add('.connection-annotation', {
        opacity: [0, 1],
        translateX: [-20, 0],
        duration: 600,
      }, 5000);

      /* --- Phase 2: Camera zoom → pan → hold → zoom-out (5200-6700) --- */

      // Single keyframed camera motion: zoom-in on entity → pan to connection → hold → zoom-out
      scrollTl.add('.hero-viz', {
        keyframes: [
          { scale: 2.4, translateX: '20%', translateY: '35%', duration: 400, ease: 'out(3)' },
          { scale: 2.4, translateX: '-25%', translateY: '-30%', duration: 400, ease: 'inOut(2)' },
          { scale: 2.4, translateX: '-25%', translateY: '-30%', duration: 200 },
          { scale: 1, translateX: '0%', translateY: '0%', duration: 400, ease: 'out(3)' },
        ],
      }, 5200);

      // Blur KG layers for depth-of-field (annotation stays sharp as a sibling)
      scrollTl.add('.viz-layer', {
        filter: ['blur(0px) brightness(1)', 'blur(4px) brightness(0.6)'],
        duration: 500,
      }, 5200);

      // Fade HUD elements during zoom
      scrollTl.add('.hud-overlay', {
        opacity: [1, 0],
        duration: 400,
      }, 5200);

      // Blur Phase 2 text during zoom (target parent to avoid conflicting with child animations)
      scrollTl.add('.panel-step-1', {
        filter: ['blur(0px)', 'blur(6px)'],
        opacity: [1, 0.3],
        duration: 500,
      }, 5200);

      // Fade entity annotation as camera pans away from it
      scrollTl.add('.entity-annotation', {
        opacity: [1, 0],
        translateX: [0, -20],
        duration: 400,
      }, 5700);

      // Remove blur from KG layers (during zoom-out phase at 6200)
      scrollTl.add('.viz-layer', {
        filter: ['blur(4px) brightness(0.6)', 'blur(0px) brightness(1)'],
        duration: 500,
      }, 6200);

      // Unblur Phase 2 text
      scrollTl.add('.panel-step-1', {
        filter: ['blur(6px)', 'blur(0px)'],
        opacity: [0.3, 1],
        duration: 500,
      }, 6200);

      // Fade connection annotation out during zoom-out
      scrollTl.add('.connection-annotation', {
        opacity: [1, 0],
        translateX: [0, 20],
        duration: 400,
      }, 6300);

      /* --- Phase 2: HUD exit (6500-7000) --- */

      scrollTl.add('.hud-bracket', {
        opacity: [1, 0],
        scale: [1, 1.1],
        delay: stagger(60),
        duration: 600,
      }, 6500);

      scrollTl.add('.hud-label', {
        opacity: [0.9, 0],
        delay: stagger(60),
        duration: 500,
      }, 6500);

      scrollTl.add('.hud-energy-ring', {
        opacity: [0.5, 0],
        scale: [1, 1.2],
        duration: 600,
      }, 6700);

      scrollTl.add('.hud-scanline', {
        opacity: [0.6, 0],
        duration: 400,
      }, 6700);

      /* --- Phase 2: SVG intensification (3500-6500) --- */

      scrollTl.add('.viz-glow-bg', {
        scale: [1.2, 1.5],
        opacity: [1, 1],
        duration: 3000,
      }, 3500);

      /* --- Phase 3: Sequential layer highlights (6800-8500) --- */

      // 6800-7200: Outer ring highlights
      scrollTl.add('.viz-layer-outer', { opacity: [1, 1], filter: ['brightness(1)', 'brightness(1.6)'], duration: 400 }, 6800);
      scrollTl.add('.viz-layer-outer', { filter: ['brightness(1.6)', 'brightness(1)'], duration: 300 }, 7200);
      scrollTl.add('.layer-label-outer', { opacity: [0, 1], translateX: [-10, 0], duration: 300 }, 6800);

      // 7200-7600: Mid ring highlights
      scrollTl.add('.viz-layer-mid', { opacity: [1, 1], filter: ['brightness(1)', 'brightness(1.6)'], duration: 400 }, 7200);
      scrollTl.add('.viz-layer-mid', { filter: ['brightness(1.6)', 'brightness(1)'], duration: 300 }, 7600);
      scrollTl.add('.layer-label-mid', { opacity: [0, 1], translateX: [-10, 0], duration: 300 }, 7200);

      // 7600-8000: Inner core highlights
      scrollTl.add('.viz-layer-inner', { opacity: [0.2, 1], duration: 400 }, 7600);
      scrollTl.add('.viz-layer-inner', { filter: ['brightness(1)', 'brightness(1.6)'], duration: 400 }, 7600);
      scrollTl.add('.viz-layer-inner', { filter: ['brightness(1.6)', 'brightness(1)'], duration: 300 }, 8000);
      scrollTl.add('.layer-label-inner', { opacity: [0, 1], translateX: [-10, 0], duration: 300 }, 7600);

      // Hub illumination during inner highlight
      scrollTl.add('.viz-hub', {
        opacity: [0.8, 1],
        scale: [1, 1.6],
        duration: 800,
      }, 7600);

      scrollTl.add('.viz-hub-glow', {
        opacity: [0.3, 0.8],
        scale: [1, 2.5],
        duration: 800,
      }, 7600);

      // 8500-8900: All labels fade out as layers settle
      scrollTl.add('.layer-label-outer', { opacity: [1, 0], duration: 400 }, 8500);
      scrollTl.add('.layer-label-mid', { opacity: [1, 0], duration: 400 }, 8500);
      scrollTl.add('.layer-label-inner', { opacity: [1, 0], duration: 400 }, 8500);

      /* ============================================================
         4. Enter-app transition
         ============================================================ */
      self.add('enterApp', () => {
        createTimeline({
          onComplete: () => {
            window.scrollTo(0, 0);
            onEnterRef.current();
          },
        }).add(rootRef.current!, {
          scale: [1, 0.96],
          opacity: [1, 0],
          duration: 500,
          ease: 'in(3)',
        });
      });
    });

    return () => { scopeRef.current?.revert(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleEnterClick = () => {
    if (scopeRef.current && scopeRef.current.methods.enterApp) {
      scopeRef.current.methods.enterApp();
    } else {
      window.scrollTo(0, 0);
      onEnterRef.current();
    }
  };

  /* ================================================================ */
  /*  RENDER                                                           */
  /* ================================================================ */
  return (
    <div ref={rootRef} className="landing-page">

      {/* ===== BACKGROUND REVEAL (pitch-black → dark blue radial fill) ===== */}
      <div className="bg-reveal" />

      {/* ===== HYPERSPACE PARTICLE LAYER ===== */}
      <div className="hyperspace-layer">
        {stars.map((s, i) => (
          <div
            key={`star-${i}`}
            className="hyper-star"
            style={{ left: `${s.left}%`, top: `${s.top}%`, width: s.size, height: s.size }}
          />
        ))}
        {streaks.map((s, i) => (
          <div
            key={`streak-${i}`}
            className="hyper-streak"
            style={{ left: `${s.left}%`, top: `${s.top}%` }}
          />
        ))}
      </div>

      <div className="scroll-experience">

        {/* ===== LEFT COLUMN: scroll panels ===== */}
        <div className="scroll-panels">

          {/* --- Hero --- */}
          <div className="scroll-panel panel-hero">
            <div className="panel-content">
              <h1 className="hero-title hero-hidden">Knowledge<br />Graph<br />Creator.</h1>
              <p className="hero-subtitle hero-hidden">
                A fast and intelligent engine to transform text
                into knowledge graphs.
              </p>
              <div className="hero-cta-row hero-hidden">
                <button className="hero-enter-btn" onClick={handleEnterClick}>
                  Enter the app
                </button>
                <span className="hero-scroll-label">Scroll to explore</span>
              </div>
            </div>
            <div className="hero-scroll-hint hero-hidden">
              <div className="scroll-arrow-icon">&#8595;</div>
            </div>
          </div>

          {/* --- Step panels --- */}
          {STEPS.map((step, i) => (
            <div key={step.num} className={`scroll-panel panel-step panel-step-${i}`}>
              <div className="panel-content" style={{ opacity: 0 }}>
                <span className="step-num" style={{ color: step.accent }}>{step.num}</span>
                <h2 className="step-title">{step.title}</h2>
                <p className="step-subtitle" style={{ color: step.accent }}>{step.subtitle}</p>
                <p className="step-desc">{step.desc}</p>
                <ul className="step-features">
                  {step.features.map((f, fi) => (
                    <li key={fi} className="step-feature" style={{ '--accent': step.accent } as React.CSSProperties}>
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}

          {/* --- CTA --- */}
          <div className="scroll-panel panel-cta">
            <div className="panel-content">
              <div className="cta-glow" />
              <h2 className="cta-title">Ready to Build<br />Knowledge?</h2>
              <button className="cta-btn" onClick={handleEnterClick}>
                Enter the App
              </button>
            </div>
          </div>
        </div>

        {/* ===== RIGHT COLUMN: sticky visualization ===== */}
        <div className="sticky-viz-col">
          <div className="sticky-viz hero-viz hero-hidden">
            <div className="viz-glow-bg" />
            <div className="viz-transform-wrapper">

            {/* Each ring lives in its own HTML div so translateZ actually works in 3D */}

            {/* === OUTER LAYER (illuminates at Step 01) === */}
            <div className="viz-layer viz-layer-outer">
              <svg viewBox="0 0 600 600" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx={CX} cy={CY} r={R_OUTER} stroke="#1e293b" strokeWidth="1.5" fill="none" />
                {ticks.map((t, i) => (
                  <line
                    key={`t-${i}`}
                    className="viz-tick"
                    x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2}
                    stroke={t.major ? '#475569' : '#334155'}
                    strokeWidth={t.major ? 1.5 : 0.8}
                    opacity="0.2"
                  />
                ))}
                <path
                  className="viz-arc viz-arc-entities"
                  d={arcPath(CX, CY, R_OUTER, 5, 80)}
                  stroke="#22d3ee" strokeWidth="3" fill="none"
                  strokeLinecap="round" strokeDasharray="800" strokeDashoffset="800"
                />
                <path
                  className="viz-arc viz-arc-queries"
                  d={arcPath(CX, CY, R_OUTER, 185, 260)}
                  stroke="#1e40af" strokeWidth="3" fill="none"
                  strokeLinecap="round" strokeDasharray="800" strokeDashoffset="800"
                />
                {connections.filter(c => c.ring === 0).map((c, i) => (
                  <line
                    key={`oc-${i}`}
                    className="viz-connection"
                    x1={c.x1} y1={c.y1} x2={c.x2} y2={c.y2}
                    stroke="#38bdf8" strokeWidth="1" opacity="0.35"
                  />
                ))}
                {nodes.filter(n => n.ring === 0).map((n, i) => (
                  <circle
                    key={`on-${i}`}
                    className="viz-node"
                    cx={n.x} cy={n.y} r={n.r}
                    fill="#38bdf8" opacity="0.6"
                    style={{ transformOrigin: `${n.x}px ${n.y}px` }}
                  />
                ))}
              </svg>
            </div>

            {/* === MID LAYER (illuminates at Step 02) === */}
            <div className="viz-layer viz-layer-mid">
              <svg viewBox="0 0 600 600" fill="none" xmlns="http://www.w3.org/2000/svg">
                <g className="viz-ring-mid-group" style={{ transformOrigin: `${CX}px ${CY}px` }}>
                  <circle cx={CX} cy={CY} r={R_MID} stroke="#1e293b" strokeWidth="1" fill="none" strokeDasharray="6 4" />
                </g>
                <path
                  className="viz-arc viz-arc-relations"
                  d={arcPath(CX, CY, R_MID, 95, 170)}
                  stroke="#818cf8" strokeWidth="3" fill="none"
                  strokeLinecap="round" strokeDasharray="800" strokeDashoffset="800"
                />
                {connections.filter(c => c.ring === 1).map((c, i) => (
                  <line
                    key={`mc-${i}`}
                    className="viz-connection"
                    x1={c.x1} y1={c.y1} x2={c.x2} y2={c.y2}
                    stroke="#818cf8" strokeWidth="1" opacity="0.35"
                  />
                ))}
                {nodes.filter(n => n.ring === 1).map((n, i) => (
                  <circle
                    key={`mn-${i}`}
                    className="viz-node"
                    cx={n.x} cy={n.y} r={n.r}
                    fill="#818cf8" opacity="0.6"
                    style={{ transformOrigin: `${n.x}px ${n.y}px` }}
                  />
                ))}
              </svg>
            </div>

            {/* === INNER LAYER + HUB (illuminates at Step 03) === */}
            <div className="viz-layer viz-layer-inner">
              <svg viewBox="0 0 600 600" fill="none" xmlns="http://www.w3.org/2000/svg">
                <g className="viz-ring-inner-group" style={{ transformOrigin: `${CX}px ${CY}px` }}>
                  <circle cx={CX} cy={CY} r={R_INNER} stroke="#1e293b" strokeWidth="0.8" fill="none" />
                </g>
                <path
                  className="viz-arc viz-arc-answers"
                  d={arcPath(CX, CY, R_INNER, 275, 350)}
                  stroke="#34d399" strokeWidth="3" fill="none"
                  strokeLinecap="round" strokeDasharray="800" strokeDashoffset="800"
                />
                {connections.filter(c => c.ring === 2).map((c, i) => (
                  <line
                    key={`ic-${i}`}
                    className="viz-connection"
                    x1={c.x1} y1={c.y1} x2={c.x2} y2={c.y2}
                    stroke="#c084fc" strokeWidth="1" opacity="0.35"
                  />
                ))}
                {nodes.filter(n => n.ring === 2).map((n, i) => (
                  <circle
                    key={`in-${i}`}
                    className="viz-node"
                    cx={n.x} cy={n.y} r={n.r}
                    fill="#c084fc" opacity="0.6"
                    style={{ transformOrigin: `${n.x}px ${n.y}px` }}
                  />
                ))}
                <circle className="viz-hub-glow" cx={CX} cy={CY} r="22" fill="none" stroke="#38bdf8" strokeWidth="1" opacity="0.3" style={{ transformOrigin: `${CX}px ${CY}px` }} />
                <circle className="viz-hub" cx={CX} cy={CY} r="12" fill="#38bdf8" opacity="0.8" style={{ transformOrigin: `${CX}px ${CY}px` }} />
                <circle cx={CX} cy={CY} r="4" fill="#fff" opacity="0.9" />
              </svg>
            </div>

            {/* === PARTICLES LAYER (illuminates at Step 03) === */}
            <div className="viz-layer viz-layer-particles">
              <svg viewBox="0 0 600 600" fill="none" xmlns="http://www.w3.org/2000/svg">
                {particles.map((p, i) => (
                  <circle
                    key={`p-${i}`}
                    className="viz-particle"
                    cx={p.x} cy={p.y} r={p.r}
                    fill="#ef4444" opacity="0.15"
                  />
                ))}
              </svg>
            </div>

            {/* === SCAN BEAM LAYER (illuminates at Step 03) === */}
            <div className="viz-layer viz-layer-scan">
              <svg viewBox="0 0 600 600" fill="none" xmlns="http://www.w3.org/2000/svg">
                <g className="viz-scan-beam" style={{ transformOrigin: `${CX}px ${CY}px` }}>
                  <line x1={CX} y1={CY} x2={CX} y2={CY - R_OUTER + 5} stroke="url(#scanGrad)" strokeWidth="1.5" />
                </g>
                <defs>
                  <linearGradient id="scanGrad" x1="0" y1="1" x2="0" y2="0">
                    <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.6" />
                    <stop offset="100%" stopColor="#38bdf8" stopOpacity="0" />
                  </linearGradient>
                </defs>
              </svg>
            </div>

            {/* === BACK MIRROR LAYERS (symmetric cylinder expansion) === */}
            <div className="viz-layer viz-layer-outer-back">
              <svg viewBox="0 0 600 600" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx={CX} cy={CY} r={R_OUTER} stroke="#1e293b" strokeWidth="1" fill="none" />
                {nodes.filter(n => n.ring === 0).map((n, i) => (
                  <circle key={`obn-${i}`} cx={n.x} cy={n.y} r={n.r} fill="#38bdf8" opacity="0.3" />
                ))}
              </svg>
            </div>
            <div className="viz-layer viz-layer-mid-back">
              <svg viewBox="0 0 600 600" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx={CX} cy={CY} r={R_MID} stroke="#1e293b" strokeWidth="0.8" fill="none" strokeDasharray="6 4" />
                {nodes.filter(n => n.ring === 1).map((n, i) => (
                  <circle key={`mbn-${i}`} cx={n.x} cy={n.y} r={n.r} fill="#818cf8" opacity="0.3" />
                ))}
              </svg>
            </div>
            <div className="viz-layer viz-layer-inner-back">
              <svg viewBox="0 0 600 600" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx={CX} cy={CY} r={R_INNER} stroke="#1e293b" strokeWidth="0.6" fill="none" />
                {nodes.filter(n => n.ring === 2).map((n, i) => (
                  <circle key={`ibn-${i}`} cx={n.x} cy={n.y} r={n.r} fill="#c084fc" opacity="0.3" />
                ))}
              </svg>
            </div>

            {/* Entity annotation (Phase 2) */}
            <div className="entity-annotation" style={{ opacity: 0 }}>
              <div className="entity-annotation-label">
                <span className="entity-annotation-title">Entity</span>
                <span className="entity-annotation-example">e.g. &quot;Revenue Recognition Policy&quot;</span>
              </div>
              <div className="entity-annotation-line" />
              <div className="entity-annotation-dot" />
            </div>

            {/* Connection annotation (Phase 2) */}
            <div className="connection-annotation" style={{ opacity: 0 }}>
              <div className="connection-annotation-dot" />
              <div className="connection-annotation-line-left" />
              <div className="connection-annotation-label">
                <span className="connection-annotation-title">Connection</span>
                <span className="connection-annotation-example">e.g. &quot;is regulated by&quot;</span>
              </div>
              <div className="connection-annotation-line-right" />
              <div className="connection-annotation-dot" />
            </div>

            {/* Layer labels (Phase 3 exploded diagram) */}
            <div className="layer-label layer-label-outer" style={{ opacity: 0 }}>
              <span className="layer-label-line" />
              <span className="layer-label-text">Entities &amp; Relationships</span>
            </div>
            <div className="layer-label layer-label-mid" style={{ opacity: 0 }}>
              <span className="layer-label-line" />
              <span className="layer-label-text">Semantic Connections</span>
            </div>
            <div className="layer-label layer-label-inner" style={{ opacity: 0 }}>
              <span className="layer-label-line" />
              <span className="layer-label-text">Knowledge Core</span>
            </div>
            </div>{/* end viz-transform-wrapper */}

            {/* ===== JARVIS HUD OVERLAY (Phase 2) ===== */}
            <div className="hud-overlay">
              <div className="hud-bracket hud-bracket-tl" />
              <div className="hud-bracket hud-bracket-tr" />
              <div className="hud-bracket hud-bracket-bl" />
              <div className="hud-bracket hud-bracket-br" />
              <div className="hud-scanline" />
              <span className="hud-label hud-label-0" style={{ top: '12%', left: '6%' }}>Analyzing Entities</span>
              <span className="hud-label hud-label-1" style={{ top: '18%', right: '6%' }}>Mapping Relations</span>
              <span className="hud-label hud-label-2" style={{ bottom: '22%', left: '8%' }}>Extracting Knowledge</span>
              <span className="hud-label hud-label-3" style={{ bottom: '14%', right: '10%' }}>Processing&hellip;</span>
              <div className="hud-energy-ring" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
