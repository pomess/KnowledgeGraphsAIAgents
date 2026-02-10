import { useEffect, useRef } from 'react';
import { animate, createScope, utils } from 'animejs';
import './BackgroundParticles.css';

const PARTICLE_COUNT = 25;

export default function BackgroundParticles() {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!root.current) return;

    const scope = createScope({ root }).add(() => {
      // Animate each particle with looping random motion
      animate('.bg-particle', {
        translateX: () => utils.random(-30, 30),
        translateY: () => utils.random(-30, 30),
        opacity: [0.1, () => utils.random(0.2, 0.5)],
        duration: () => utils.random(3000, 8000),
        loop: true,
        alternate: true,
        ease: 'inOut(2)',
        delay: () => utils.random(0, 3000),
      });

      // Animate connecting lines with subtle opacity pulse
      animate('.bg-particle-line', {
        opacity: [0, 0.08, 0],
        duration: () => utils.random(4000, 7000),
        loop: true,
        alternate: true,
        ease: 'inOut(2)',
        delay: () => utils.random(0, 2000),
      });
    });

    return () => scope.revert();
  }, []);

  // Generate particles with random initial positions
  const particles = Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
    id: i,
    x: utils.random(2, 98),
    y: utils.random(2, 98),
    size: utils.random(2, 4),
  }));

  // Generate some connecting lines between nearby particles
  const lines: { key: string; x1: number; y1: number; x2: number; y2: number }[] = [];
  for (let i = 0; i < particles.length; i++) {
    for (let j = i + 1; j < particles.length; j++) {
      const dx = particles[i].x - particles[j].x;
      const dy = particles[i].y - particles[j].y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 25) {
        lines.push({
          key: `${i}-${j}`,
          x1: particles[i].x,
          y1: particles[i].y,
          x2: particles[j].x,
          y2: particles[j].y,
        });
      }
    }
  }

  return (
    <div ref={root} className="bg-particles-container">
      <svg className="bg-particles-svg" viewBox="0 0 100 100" preserveAspectRatio="none">
        {lines.map((line) => (
          <line
            key={line.key}
            className="bg-particle-line"
            x1={`${line.x1}`}
            y1={`${line.y1}`}
            x2={`${line.x2}`}
            y2={`${line.y2}`}
            stroke="#38bdf8"
            strokeWidth="0.15"
            opacity="0"
          />
        ))}
      </svg>
      {particles.map((p) => (
        <div
          key={p.id}
          className="bg-particle"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: `${p.size}px`,
            height: `${p.size}px`,
          }}
        />
      ))}
    </div>
  );
}
