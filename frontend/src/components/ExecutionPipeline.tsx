import { useEffect, useRef } from 'react';
import { animate, createScope, createTimeline, stagger, spring } from 'animejs';
import type { SSEStepEvent } from '../api/graphApi';
import './ExecutionPipeline.css';

const PIPELINE_STEPS = [
  { id: 'reformulation', label: 'Reformulate', icon: 'R' },
  { id: 'embedding', label: 'Embed Query', icon: 'E' },
  { id: 'seed_search', label: 'Seed Search', icon: 'S' },
  { id: 'beam_search', label: 'Graph Traverse', icon: 'G' },
  { id: 'context', label: 'Build Context', icon: 'C' },
  { id: 'llm', label: 'Generate Answer', icon: 'A' },
  { id: 'highlight', label: 'Map Sources', icon: 'M' },
];

interface ExecutionPipelineProps {
  visible: boolean;
  steps: Record<string, SSEStepEvent>;
}

export default function ExecutionPipeline({
  visible,
  steps,
}: ExecutionPipelineProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const hasAnimated = useRef(false);
  const runningAnims = useRef<Map<string, ReturnType<typeof animate>>>(new Map());

  // Orchestrated entrance animation when first shown
  useEffect(() => {
    if (visible && !hasAnimated.current && rootRef.current) {
      hasAnimated.current = true;

      const scope = createScope({ root: rootRef }).add(() => {
        const tl = createTimeline({
          defaults: { ease: 'out(3)' },
        });

        // Container fade in
        tl.add(rootRef.current!, {
          opacity: [0, 1],
          translateY: [-10, 0],
          duration: 400,
        });

        // Nodes stagger in with scale + opacity
        tl.add('.execution-node', {
          scale: [0, 1],
          opacity: [0, 1],
          delay: stagger(80),
          duration: 500,
          ease: spring({ stiffness: 150, damping: 12 }),
        }, '<+=100');

        // Edges expand in staggered
        tl.add('.execution-edge', {
          width: [0, 30],
          opacity: [0, 1],
          delay: stagger(80, { start: 40 }),
          duration: 400,
          ease: 'out(3)',
        }, '<+=50');
      });

      return () => scope.revert();
    }
  }, [visible]);

  // Animate individual step state changes (running / completed)
  useEffect(() => {
    Object.values(steps).forEach((step) => {
      const nodeEl = document.getElementById(`exec-node-${step.step_id}`);
      if (!nodeEl) return;

      if (step.status === 'running') {
        // Kill any previous running animation for this node
        const prev = runningAnims.current.get(step.step_id);
        if (prev) prev.pause();

        // Running: looping boxShadow pulse + subtle scale
        const anim = animate(nodeEl, {
          boxShadow: [
            '0 0 15px rgba(14, 165, 233, 0.3)',
            '0 0 25px rgba(14, 165, 233, 0.6)',
          ],
          scale: [1, 1.06, 1],
          loop: true,
          alternate: true,
          duration: 1200,
          ease: 'inOut(2)',
        });
        runningAnims.current.set(step.step_id, anim);
      }

      if (step.status === 'completed') {
        // Stop the running animation
        const prev = runningAnims.current.get(step.step_id);
        if (prev) prev.pause();
        runningAnims.current.delete(step.step_id);

        // Completed: green flash keyframe + checkmark scale-in
        animate(nodeEl, {
          borderColor: ['#0ea5e9', '#34d399', '#10b981'],
          backgroundColor: ['#0c4a6e', '#064e3b'],
          scale: [1, 1.12, 1],
          boxShadow: [
            '0 0 25px rgba(14, 165, 233, 0.6)',
            '0 0 20px rgba(16, 185, 129, 0.5)',
            '0 0 10px rgba(16, 185, 129, 0.2)',
          ],
          duration: 500,
          ease: spring({ stiffness: 200, damping: 10 }),
        });
      }
    });
  }, [steps]);

  if (!visible) return null;

  return (
    <div ref={rootRef} className="execution-flow-container" style={{ opacity: 0 }}>
      <div className="execution-flow-header">
        <span>Execution Pipeline</span>
      </div>
      <div className="execution-flow-content">
        <div className="execution-flow-pipeline">
          {PIPELINE_STEPS.map((step, index) => {
            const stepData = steps[step.id];
            const status = stepData?.status || 'pending';
            const duration = stepData?.duration_ms || 0;

            return (
              <div key={step.id} style={{ display: 'flex', alignItems: 'center' }}>
                <div
                  id={`exec-node-${step.id}`}
                  className={`execution-node ${status}`}
                  style={{ opacity: 0 }}
                >
                  <span className="node-icon">{step.icon}</span>
                  <span className="node-label">{step.label}</span>
                  {status === 'completed' && duration > 0 && (
                    <span className="node-duration">{duration}ms</span>
                  )}
                </div>
                {index < PIPELINE_STEPS.length - 1 && (
                  <div
                    className={`execution-edge ${
                      status === 'completed'
                        ? 'completed'
                        : status === 'running'
                        ? 'active'
                        : ''
                    }`}
                    style={{ opacity: 0 }}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
