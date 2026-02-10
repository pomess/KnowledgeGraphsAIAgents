import { useState, useCallback, useRef } from 'react';
import { animate } from 'animejs';
import LandingPage from './components/LandingPage';
import Workspace from './components/Workspace';
import './App.css';

export default function App() {
  const [showWorkspace, setShowWorkspace] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const viewRef = useRef<HTMLDivElement>(null);

  const handleEnterWorkspace = useCallback(() => {
    if (isTransitioning) return;
    setIsTransitioning(true);

    const el = viewRef.current;
    if (el) {
      animate(el, {
        opacity: [1, 0],
        scale: [1, 0.98],
        filter: ['blur(0px)', 'blur(6px)'],
        duration: 350,
        ease: 'in(3)',
        onComplete: () => {
          document.body.style.backgroundColor = '#0b0f1a';
          setShowWorkspace(true);
          setIsTransitioning(false);
          // Entrance animation for new view
          requestAnimationFrame(() => {
            if (viewRef.current) {
              animate(viewRef.current, {
                opacity: [0, 1],
                scale: [0.98, 1],
                filter: ['blur(6px)', 'blur(0px)'],
                duration: 450,
                ease: 'out(3)',
                onComplete: () => {
                  // Clear inline transform/filter so they don't create
                  // a containing block that breaks position:fixed descendants
                  if (viewRef.current) {
                    viewRef.current.style.transform = '';
                    viewRef.current.style.filter = '';
                  }
                },
              });
            }
          });
        },
      });
    } else {
      document.body.style.backgroundColor = '#0b0f1a';
      setShowWorkspace(true);
      setIsTransitioning(false);
    }
  }, [isTransitioning]);

  const handleGoLanding = useCallback(() => {
    if (isTransitioning) return;
    setIsTransitioning(true);

    const el = viewRef.current;
    if (el) {
      animate(el, {
        opacity: [1, 0],
        scale: [1, 0.98],
        filter: ['blur(0px)', 'blur(6px)'],
        duration: 350,
        ease: 'in(3)',
        onComplete: () => {
          document.body.style.backgroundColor = '#000';
          setShowWorkspace(false);
          setIsTransitioning(false);
          requestAnimationFrame(() => {
            if (viewRef.current) {
              animate(viewRef.current, {
                opacity: [0, 1],
                scale: [0.98, 1],
                filter: ['blur(6px)', 'blur(0px)'],
                duration: 450,
                ease: 'out(3)',
                onComplete: () => {
                  if (viewRef.current) {
                    viewRef.current.style.transform = '';
                    viewRef.current.style.filter = '';
                  }
                },
              });
            }
          });
        },
      });
    } else {
      document.body.style.backgroundColor = '#000';
      setShowWorkspace(false);
      setIsTransitioning(false);
    }
  }, [isTransitioning]);

  const nav = (
    <nav className="page-nav">
      <button
        className={`page-nav-btn${!showWorkspace ? ' active' : ''}`}
        onClick={handleGoLanding}
        disabled={isTransitioning}
      >
        Landing
      </button>
      <button
        className={`page-nav-btn${showWorkspace ? ' active' : ''}`}
        onClick={handleEnterWorkspace}
        disabled={isTransitioning}
      >
        Demo
      </button>
    </nav>
  );

  return (
    <>
      {nav}
      <div ref={viewRef} className="view-container">
        {showWorkspace ? <Workspace /> : <LandingPage onEnter={handleEnterWorkspace} />}
      </div>
    </>
  );
}
