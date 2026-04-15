const BASE = "/api";

function brainParam(brain?: string): string {
  return brain ? `?brain=${encodeURIComponent(brain)}` : "";
}

export interface BrainInfo {
  id: string;
  name: string;
  path: string;
}

export async function fetchBrains(): Promise<{
  brains: BrainInfo[];
  default: string | null;
}> {
  const res = await fetch(`${BASE}/brains`);
  return res.json();
}

export async function fetchHot(brain?: string): Promise<{ content: string }> {
  const res = await fetch(`${BASE}/wiki/hot${brainParam(brain)}`);
  return res.json();
}

export async function fetchPages(brain?: string): Promise<{
  pages: Array<{
    path: string;
    slug: string;
    title: string;
    type: string;
    tags: string[];
    confidence: string;
    updated: string;
  }>;
}> {
  const res = await fetch(`${BASE}/wiki/pages${brainParam(brain)}`);
  return res.json();
}

export async function fetchPage(
  path: string,
  brain?: string
): Promise<{ content: string; frontmatter: Record<string, unknown> }> {
  const res = await fetch(
    `${BASE}/wiki/page/${encodeURIComponent(path)}${brainParam(brain)}`
  );
  return res.json();
}

export async function fetchGraph(brain?: string): Promise<{
  nodes: Array<{ id: string; label: string; type: string }>;
  edges: Array<{ source: string; target: string }>;
}> {
  const res = await fetch(`${BASE}/wiki/graph${brainParam(brain)}`);
  return res.json();
}

export async function ingestText(
  title: string,
  content: string,
  brain?: string
): Promise<{
  success: boolean;
  pages_touched?: string[];
  summary?: string;
  error?: string;
}> {
  const res = await fetch(`${BASE}/ingest/text${brainParam(brain)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, content }),
  });
  return res.json();
}

export async function ingestFile(
  file: File,
  brain?: string
): Promise<{
  success: boolean;
  pages_touched?: string[];
  summary?: string;
  error?: string;
}> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${BASE}/ingest/file${brainParam(brain)}`, {
    method: "POST",
    body: form,
  });
  return res.json();
}

export async function runLint(brain?: string): Promise<{
  issues: Array<{
    type: string;
    severity: string;
    description: string;
    page: string;
    suggestion: string;
  }>;
  summary: string;
  stats: { total_pages: number; orphans: number; missing_pages: number };
}> {
  const res = await fetch(`${BASE}/lint${brainParam(brain)}`, {
    method: "POST",
  });
  return res.json();
}

export async function solveLintIssue(
  issue: {
    type: string;
    severity: string;
    description: string;
    page: string;
    suggestion: string;
  },
  brain?: string
): Promise<{
  success: boolean;
  pages_touched?: string[];
  summary?: string;
  error?: string;
}> {
  const res = await fetch(`${BASE}/lint/solve${brainParam(brain)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ issue }),
  });
  return res.json();
}
