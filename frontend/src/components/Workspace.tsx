import { useState, useCallback, useRef } from 'react';
import Header from './Header';
import LeftPanel from './LeftPanel';
import RightPanel from './RightPanel';
import type { ChatMessage } from './ChatBot';
import {
  generateGraph as apiGenerateGraph,
  chatStream,
} from '../api/graphApi';
import type { CytoscapeElement, SSEStepEvent, SSETraversalSeedsEvent, SSETraversalHopEvent } from '../api/graphApi';

export type TraversalEvent = SSETraversalSeedsEvent | SSETraversalHopEvent;
import './Workspace.css';

export default function Workspace() {
  // Graph state
  const [elements, setElements] = useState<CytoscapeElement[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  // Chat state
  const [chatEnabled, setChatEnabled] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { role: 'bot', text: 'Hello! Generate a graph first, then you can ask me questions about it.' },
  ]);
  const [isChatLoading, setIsChatLoading] = useState(false);

  // Pipeline state
  const [pipelineVisible, setPipelineVisible] = useState(false);
  const [pipelineSteps, setPipelineSteps] = useState<Record<string, SSEStepEvent>>({});

  // Highlight state — 3-tier: seeds (RAG hits), traversed (expanded), context (all)
  const [seedNodes, setSeedNodes] = useState<string[]>([]);
  const [traversedNodes, setTraversedNodes] = useState<string[]>([]);
  const [contextNodes, setContextNodes] = useState<string[]>([]);
  const [highlightMode, setHighlightMode] = useState<'seeds' | 'traversed' | 'context'>('context');

  // Scanning effect
  const [isScanning, setIsScanning] = useState(false);

  // Streaming state — index of the bot message currently being streamed
  const [streamingIndex, setStreamingIndex] = useState<number | null>(null);
  const streamingTextRef = useRef('');

  // Live traversal events for graph animation
  const [traversalEvents, setTraversalEvents] = useState<TraversalEvent[]>([]);

  // Selected node for detail panel
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // Entity resolution panel
  const [showResolution, setShowResolution] = useState(false);

  // Subgraph focus mode
  const [focusNodeId, setFocusNodeId] = useState<string | null>(null);
  const [focusHops, setFocusHops] = useState(2);

  // Session panel
  const [showSessions, setShowSessions] = useState(false);

  // Analytics panel
  const [showAnalytics, setShowAnalytics] = useState(false);

  // --- Generate graph ---
  const handleGenerate = useCallback(async (text: string, files: File[], url?: string, mode?: 'replace' | 'merge') => {
    setIsGenerating(true);
    try {
      const data = await apiGenerateGraph(text, files, url, mode || 'replace');
      setElements(data.elements);
      if (data.elements.length > 0) {
        setChatEnabled(true);
        setChatMessages((prev) => [
          ...prev,
          { role: 'bot', text: 'Graph generated! How can I help you explore this knowledge?' },
        ]);
      }
    } catch (err) {
      console.error('Graph generation failed:', err);
    } finally {
      setIsGenerating(false);
    }
  }, []);

  // --- Send chat message via SSE ---
  const handleSendChat = useCallback(async (message: string) => {
    // Add user message
    setChatMessages((prev) => [...prev, { role: 'user', text: message }]);
    setIsChatLoading(true);
    setIsScanning(true);

    // Reset pipeline
    setPipelineVisible(true);
    setPipelineSteps({});

    // Reset highlights
    setSeedNodes([]);
    setTraversedNodes([]);
    setContextNodes([]);

    // Reset streaming and traversal state
    streamingTextRef.current = '';
    setTraversalEvents([]);
    let botMessageIndex: number | null = null;

    try {
      await chatStream(
        message,
        // onStep
        (step) => {
          setPipelineSteps((prev) => ({ ...prev, [step.step_id]: step }));
        },
        // onResult
        (result) => {
          // Finalize the streaming message with highlight data
          setChatMessages((prev) => {
            const updated = [...prev];
            if (botMessageIndex !== null && updated[botMessageIndex]) {
              // Update existing streaming message
              updated[botMessageIndex] = {
                ...updated[botMessageIndex],
                text: result.answer,
                seedNodes: result.seed_nodes,
                traversedNodes: result.traversed_nodes,
                contextNodes: result.context_nodes,
              };
            } else {
              // Fallback: no tokens were streamed — create the message from the result
              updated.push({
                role: 'bot',
                text: result.answer,
                seedNodes: result.seed_nodes,
                traversedNodes: result.traversed_nodes,
                contextNodes: result.context_nodes,
              });
            }
            return updated;
          });
          setStreamingIndex(null);
          // Apply 3-tier highlights — show full context by default
          if (result.seed_nodes?.length > 0) setSeedNodes(result.seed_nodes);
          if (result.traversed_nodes?.length > 0) setTraversedNodes(result.traversed_nodes);
          if (result.context_nodes?.length > 0) setContextNodes(result.context_nodes);
          setHighlightMode('context');
        },
        // onError
        (error) => {
          setStreamingIndex(null);
          setChatMessages((prev) => [
            ...prev,
            { role: 'bot', text: 'Sorry, I encountered an error: ' + error.message },
          ]);
        },
        // onToken — stream LLM response character by character
        (token) => {
          streamingTextRef.current += token.text;
          const currentText = streamingTextRef.current;

          setChatMessages((prev) => {
            // Create the streaming bot message on the first token
            if (botMessageIndex === null) {
              botMessageIndex = prev.length;
              setStreamingIndex(botMessageIndex);
              return [...prev, { role: 'bot', text: currentText }];
            }
            // Append to existing streaming message
            const updated = [...prev];
            if (updated[botMessageIndex]) {
              updated[botMessageIndex] = { ...updated[botMessageIndex], text: currentText };
            }
            return updated;
          });
        },
        // onTraversal — live graph traversal animation events
        (event) => {
          setTraversalEvents((prev) => [...prev, event]);
        }
      );
    } catch (err) {
      console.error('Chat stream failed:', err);
      setStreamingIndex(null);
      setChatMessages((prev) => [
        ...prev,
        { role: 'bot', text: 'Sorry, I encountered an error.' },
      ]);
    } finally {
      setIsChatLoading(false);
      setIsScanning(false);
      setStreamingIndex(null);
    }
  }, []);

  // --- Handle session loaded ---
  const handleSessionLoaded = useCallback((newElements: CytoscapeElement[]) => {
    setElements(newElements);
    setChatEnabled(newElements.length > 0);
    setShowSessions(false);
  }, []);

  // --- Handle graph editing updates (node/edge CRUD) ---
  const handleGraphUpdated = useCallback((newElements: CytoscapeElement[]) => {
    setElements(newElements);
  }, []);

  // --- Handle entity resolution merge result ---
  const handleResolutionMerged = useCallback((newElements: CytoscapeElement[]) => {
    setElements(newElements);
    setShowResolution(false);
  }, []);

  // --- Ask about a specific node (from detail panel) ---
  const handleAskAboutNode = useCallback((question: string) => {
    if (chatEnabled && !isChatLoading) {
      handleSendChat(question);
    }
  }, [chatEnabled, isChatLoading, handleSendChat]);

  // --- Clear all highlights (view full graph) ---
  const handleClearHighlights = useCallback(() => {
    setSeedNodes([]);
    setTraversedNodes([]);
    setContextNodes([]);
  }, []);

  // --- Toggle highlight mode ---
  const handleToggleHighlight = useCallback(
    (mode: 'seeds' | 'traversed' | 'context', seeds: string[], traversed: string[], context: string[]) => {
      setHighlightMode(mode);
      setSeedNodes(seeds);
      setTraversedNodes(traversed);
      setContextNodes(context);
    },
    []
  );

  return (
    <div className="workspace">
      <Header />
      <div className="workspace-body">
        <LeftPanel
          onGenerate={handleGenerate}
          isGenerating={isGenerating}
          hasGraph={elements.length > 0}
          chatEnabled={chatEnabled}
          chatMessages={chatMessages}
          onSendChat={handleSendChat}
          isChatLoading={isChatLoading}
          pipelineVisible={pipelineVisible}
          pipelineSteps={pipelineSteps}
          onToggleHighlight={handleToggleHighlight}
          streamingIndex={streamingIndex}
        />
        <RightPanel
          elements={elements}
          isLoading={isGenerating}
          seedNodes={seedNodes}
          traversedNodes={traversedNodes}
          contextNodes={contextNodes}
          highlightMode={highlightMode}
          isScanning={isScanning}
          traversalEvents={traversalEvents}
          selectedNodeId={selectedNodeId}
          onSelectNode={setSelectedNodeId}
          onAskAboutNode={handleAskAboutNode}
          onGraphUpdated={handleGraphUpdated}
          showResolution={showResolution}
          onToggleResolution={() => setShowResolution((v) => !v)}
          onResolutionMerged={handleResolutionMerged}
          focusNodeId={focusNodeId}
          focusHops={focusHops}
          onFocusNode={(nodeId, hops) => { setFocusNodeId(nodeId); setFocusHops(hops ?? 2); }}
          onClearHighlights={handleClearHighlights}
          onClearFocus={() => setFocusNodeId(null)}
          showSessions={showSessions}
          onToggleSessions={() => setShowSessions((v) => !v)}
          onSessionLoaded={handleSessionLoaded}
          showAnalytics={showAnalytics}
          onToggleAnalytics={() => setShowAnalytics((v) => !v)}
        />
      </div>
    </div>
  );
}
