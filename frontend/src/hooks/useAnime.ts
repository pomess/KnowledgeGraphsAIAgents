import { useEffect, useRef } from 'react';
import { createScope } from 'animejs';
import type { Scope } from 'animejs';

/**
 * A reusable hook that creates an anime.js scope bound to a DOM ref.
 * All animations declared inside the setup callback are automatically
 * scoped to the root element and cleaned up on unmount.
 *
 * Usage:
 *   const root = useAnime((scope) => {
 *     animate('.my-el', { opacity: [0, 1] });
 *   });
 *   return <div ref={root}>...</div>;
 */
export function useAnime(
  setup: (scope: Scope) => void,
  deps: React.DependencyList = []
) {
  const root = useRef<HTMLDivElement>(null);
  const scopeRef = useRef<Scope | null>(null);

  useEffect(() => {
    if (!root.current) return;

    scopeRef.current = createScope({ root }).add(setup);

    return () => {
      scopeRef.current?.revert();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return root;
}

export default useAnime;
