import { useEffect, useRef } from 'react';
import { createScope, createTimeline, spring } from 'animejs';
import TextInput from './TextInput';
import ExecutionPipeline from './ExecutionPipeline';
import ChatBot from './ChatBot';
import type { ChatMessage } from './ChatBot';
import type { SSEStepEvent } from '../api/graphApi';
import './LeftPanel.css';

interface LeftPanelProps {
  onGenerate: (text: string, files: File[], url?: string, mode?: 'replace' | 'merge') => void;
  isGenerating: boolean;
  hasGraph?: boolean;
  chatEnabled: boolean;
  chatMessages: ChatMessage[];
  onSendChat: (message: string) => void;
  isChatLoading: boolean;
  pipelineVisible: boolean;
  pipelineSteps: Record<string, SSEStepEvent>;
  onToggleHighlight?: (
    mode: 'seeds' | 'traversed' | 'context',
    seedNodes: string[],
    traversedNodes: string[],
    contextNodes: string[]
  ) => void;
  streamingIndex?: number | null;
}

export default function LeftPanel({
  onGenerate,
  isGenerating,
  hasGraph,
  chatEnabled,
  chatMessages,
  onSendChat,
  isChatLoading,
  pipelineVisible,
  pipelineSteps,
  onToggleHighlight,
  streamingIndex,
}: LeftPanelProps) {
  const root = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!root.current) return;
    const scope = createScope({ root }).add(() => {
      // Orchestrated page-load timeline
      const tl = createTimeline({
        defaults: { ease: 'out(3)' },
      });

      // Left panel slides in from left
      tl.add('.left-panel-inner', {
        opacity: [0, 1],
        translateX: [-40, 0],
        duration: 600,
        ease: spring({ stiffness: 100, damping: 15 }),
      });
    });
    return () => scope.revert();
  }, []);

  return (
    <section ref={root} className="left-panel">
      <div className="left-panel-inner" style={{ opacity: 0 }}>
        <TextInput onGenerate={onGenerate} isLoading={isGenerating} hasGraph={hasGraph} />
        <ExecutionPipeline
          visible={pipelineVisible}
          steps={pipelineSteps}
        />
        <div className="chat-wrapper">
          <ChatBot
            messages={chatMessages}
            onSend={onSendChat}
            chatEnabled={chatEnabled}
            isLoading={isChatLoading}
            onToggleHighlight={onToggleHighlight}
            streamingIndex={streamingIndex}
          />
        </div>
      </div>
    </section>
  );
}
