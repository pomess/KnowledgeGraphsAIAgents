export interface CytoscapeElement {
  data: {
    id?: string;
    label?: string;
    type?: string;
    source?: string;
    target?: string;
  };
}

export interface ExecutionStep {
  id: string;
  label: string;
  icon: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  duration_ms: number;
  details: string;
}

export interface ChatResponse {
  answer: string;
  seed_nodes: string[];
  traversed_nodes: string[];
  context_nodes: string[];
  execution_steps: ExecutionStep[];
}

export interface GenerateGraphResponse {
  elements: CytoscapeElement[];
  message?: string;
}

export interface SSEStepEvent {
  type: 'step';
  step_id: string;
  status: string;
  duration_ms: number;
  details: string;
}

export interface SSEResultEvent {
  type: 'result';
  answer: string;
  seed_nodes: string[];
  traversed_nodes: string[];
  context_nodes: string[];
}

export interface SSETokenEvent {
  type: 'token';
  text: string;
}

export interface SSETraversalSeedsEvent {
  type: 'traversal_seeds';
  seeds: string[];
}

export interface SSETraversalHopEvent {
  type: 'traversal_hop';
  hop: number;
  frontier: string[];
}

export interface SSEErrorEvent {
  type: 'error';
  message: string;
}

export type SSEEvent =
  | SSEStepEvent
  | SSEResultEvent
  | SSETokenEvent
  | SSETraversalSeedsEvent
  | SSETraversalHopEvent
  | SSEErrorEvent;

export async function generateGraph(
  text: string,
  files: File[],
  url?: string,
  mode: 'replace' | 'merge' = 'replace'
): Promise<GenerateGraphResponse> {
  const formData = new FormData();
  if (text) formData.append('text', text);
  if (url) formData.append('url', url);
  formData.append('mode', mode);
  files.forEach((file) => formData.append('files', file));

  const response = await fetch('/generate-graph', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to generate graph');
  }

  return response.json();
}

export async function chat(message: string): Promise<ChatResponse> {
  const response = await fetch('/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to get response');
  }

  return response.json();
}

export interface DuplicateCandidate {
  node_a: string;
  node_b: string;
  type_a: string;
  type_b: string;
  similarity: number;
}

export async function resolveEntities(threshold = 0.85): Promise<{ candidates: DuplicateCandidate[] }> {
  const response = await fetch(`/resolve-entities?threshold=${threshold}`);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to resolve entities');
  }
  return response.json();
}

export async function mergeEntities(
  pairs: { keep: string; remove: string }[]
): Promise<{ elements: CytoscapeElement[]; merged: number }> {
  const response = await fetch('/merge-entities', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pairs }),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to merge entities');
  }
  return response.json();
}

// --- Session Management API ---

export interface SessionInfo {
  name: string;
  created: number;
  size: number;
}

export async function listSessions(): Promise<{ sessions: SessionInfo[] }> {
  const response = await fetch('/sessions');
  if (!response.ok) throw new Error('Failed to list sessions');
  return response.json();
}

export async function saveSession(name: string): Promise<{ message: string; name: string }> {
  const response = await fetch('/sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to save session');
  }
  return response.json();
}

export async function loadSession(name: string): Promise<{ elements: CytoscapeElement[]; name: string }> {
  const response = await fetch(`/sessions/${encodeURIComponent(name)}`);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to load session');
  }
  return response.json();
}

export async function deleteSession(name: string): Promise<{ message: string }> {
  const response = await fetch(`/sessions/${encodeURIComponent(name)}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to delete session');
  }
  return response.json();
}

// --- Analytics API ---

export interface AnalyticsData {
  node_count: number;
  edge_count: number;
  top_degree: { node: string; score: number }[];
  top_betweenness: { node: string; score: number }[];
  top_pagerank: { node: string; score: number }[];
  communities: Record<string, number>;
  num_communities: number;
  avg_clustering: number;
  clustering: Record<string, number>;
  num_components: number;
  largest_component: number;
}

export async function fetchAnalytics(): Promise<AnalyticsData> {
  const response = await fetch('/analytics');
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to fetch analytics');
  }
  return response.json();
}

// --- Graph Editing API ---

export async function addNode(id: string, type = 'Entity'): Promise<{ elements: CytoscapeElement[] }> {
  const response = await fetch('/nodes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, type }),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to add node');
  }
  return response.json();
}

export async function updateNode(
  nodeId: string,
  updates: { label?: string; type?: string }
): Promise<{ elements: CytoscapeElement[] }> {
  const response = await fetch(`/nodes/${encodeURIComponent(nodeId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to update node');
  }
  return response.json();
}

export async function deleteNode(nodeId: string): Promise<{ elements: CytoscapeElement[] }> {
  const response = await fetch(`/nodes/${encodeURIComponent(nodeId)}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to delete node');
  }
  return response.json();
}

export async function addEdge(
  source: string,
  target: string,
  relation = 'related_to'
): Promise<{ elements: CytoscapeElement[] }> {
  const response = await fetch('/edges', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ source, target, relation }),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to add edge');
  }
  return response.json();
}

export async function deleteEdge(
  source: string,
  target: string
): Promise<{ elements: CytoscapeElement[] }> {
  const response = await fetch(`/edges?source=${encodeURIComponent(source)}&target=${encodeURIComponent(target)}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to delete edge');
  }
  return response.json();
}

export async function chatStream(
  message: string,
  onStep: (event: SSEStepEvent) => void,
  onResult: (event: SSEResultEvent) => void,
  onError: (event: SSEErrorEvent) => void,
  onToken?: (event: SSETokenEvent) => void,
  onTraversal?: (event: SSETraversalSeedsEvent | SSETraversalHopEvent) => void
): Promise<void> {
  const response = await fetch('/chat-stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to get response');
  }

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    const events = buffer.split('\n\n');
    buffer = events.pop()!;

    for (const event of events) {
      if (event.startsWith('data: ')) {
        const jsonStr = event.substring(6);
        try {
          const data: SSEEvent = JSON.parse(jsonStr);
          if (data.type === 'step') {
            onStep(data as SSEStepEvent);
          } else if (data.type === 'token') {
            onToken?.(data as SSETokenEvent);
          } else if (data.type === 'traversal_seeds' || data.type === 'traversal_hop') {
            onTraversal?.(data as SSETraversalSeedsEvent | SSETraversalHopEvent);
          } else if (data.type === 'result') {
            onResult(data as SSEResultEvent);
          } else if (data.type === 'error') {
            onError(data as SSEErrorEvent);
          }
        } catch {
          console.error('Failed to parse SSE data:', jsonStr);
        }
      }
    }
  }
}
