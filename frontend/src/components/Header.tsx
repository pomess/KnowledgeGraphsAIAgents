import { useEffect, useRef } from 'react';
import { createScope, createTimeline, spring } from 'animejs';
import './Header.css';

export default function Header() {
  const root = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!root.current) return;
    const scope = createScope({ root }).add(() => {
      const tl = createTimeline({
        defaults: { ease: 'out(3)' },
      });

      // Animate the whole title element (gradient background-clip breaks on split chars)
      tl.add('.header-title', {
        opacity: [0, 1],
        translateY: [20, 0],
        duration: 700,
        ease: 'out(3)',
      });

      // Badge slides in after title
      tl.add('.header-badge', {
        opacity: [0, 1],
        scale: [0.6, 1],
        duration: 600,
        ease: spring({ stiffness: 200, damping: 12 }),
      }, '<+=200');
    });
    return () => scope.revert();
  }, []);

  return (
    <header ref={root} className="app-header">
      <h1 className="header-title">Knowledge Graph Creator</h1>
      <span className="header-badge">Powered by Gemini</span>
    </header>
  );
}
