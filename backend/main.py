import os
import sys
from dotenv import load_dotenv

load_dotenv()

import json
from typing import List, Optional
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from langchain_core.documents import Document

import numpy as np
from langchain_google_vertexai import ChatVertexAI, VertexAIEmbeddings
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.messages import SystemMessage, HumanMessage, AIMessage

# Set credentials path
os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = r"c:\Users\Bruno\Desktop\Deloitte Repositories\GOOGLE_CREDENTIALS\service_account.json"

# Add parent directory to path to import graph_creator
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from graph_creator import create_knowledge_graph, graph_to_cytoscape

# Initialize Embedding Model (Vertex AI text-embedding-004, uses GOOGLE_APPLICATION_CREDENTIALS)
_vertex_embeddings = VertexAIEmbeddings(model_name="text-embedding-004")

# Get the directory where main.py is located
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MEMORY_FILE = os.path.join(BASE_DIR, "conversation_memory.json")

# ============================
# Conversation Memory Manager
# ============================
class ConversationMemory:
    """Persists conversation history to a local JSON file."""
    
    def __init__(self, filepath: str, max_turns: int = 10):
        self.filepath = filepath
        self.max_turns = max_turns
        self.history = []  # List of {"role": "user"/"assistant", "content": "..."}
        self._load()
    
    def _load(self):
        """Load history from file if it exists."""
        if os.path.exists(self.filepath):
            try:
                with open(self.filepath, 'r') as f:
                    data = json.load(f)
                    self.history = data.get("history", [])
            except Exception as e:
                print(f"Warning: Could not load memory file: {e}")
                self.history = []
    
    def _save(self):
        """Persist history to file."""
        try:
            with open(self.filepath, 'w') as f:
                json.dump({"history": self.history}, f, indent=2)
        except Exception as e:
            print(f"Warning: Could not save memory file: {e}")
    
    def add_turn(self, role: str, content: str, entities: list[str] | None = None):
        """Add a message to history and persist."""
        entry: dict = {"role": role, "content": content}
        if entities:
            entry["entities"] = entities
        self.history.append(entry)
        # Keep only last N turns to avoid context bloat
        if len(self.history) > self.max_turns * 2:  # *2 because user+assistant per turn
            self.history = self.history[-(self.max_turns * 2):]
        self._save()
    
    def get_context_string(self) -> str:
        """Format history for the LLM reformulation prompt."""
        if not self.history:
            return ""
        lines = []
        for msg in self.history:
            prefix = "User" if msg["role"] == "user" else "Assistant"
            lines.append(f"{prefix}: {msg['content']}")
        return "\n".join(lines)
    
    def clear(self):
        """Clear history (e.g., when generating a new graph)."""
        self.history = []
        self._save()

# Initialize global memory
conversation_memory = ConversationMemory(MEMORY_FILE)

# ============================
# Query Reformulation (Lightweight LLM)
# ============================
def reformulate_query(current_message: str, conversation_context: str) -> str:
    """
    Uses a fast, lightweight LLM to rewrite the user's message as a 
    standalone question that includes necessary context from the conversation.
    """
    if not conversation_context:
        return current_message
    
    try:
        reformulator = ChatVertexAI(
            model_name="gemini-2.5-flash", 
            temperature=0,
        )
        
        system_prompt = """You are a query reformulation assistant. Your job is to rewrite the user's latest message as a standalone question that can be understood WITHOUT the conversation history.

Rules:
1. Replace pronouns (he, she, it, they, etc.) with the actual entities they refer to.
2. Include any relevant context from the conversation that is needed to understand the question.
3. Keep the reformulated query concise and focused.
4. Output ONLY the reformulated query, nothing else.

Example:
Conversation:
User: Who is Marcus Thorne?
Assistant: Marcus Thorne is the Chief Legal Officer at AstraGen.
User: Where does he work?

Reformulated query: Where does Marcus Thorne work?"""

        user_prompt = f"""Conversation history:
{conversation_context}

Latest user message: {current_message}

Reformulated query:"""

        messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=user_prompt)
        ]
        
        response = reformulator.invoke(messages)
        reformulated = response.content.strip()
        
        if not reformulated or len(reformulated) > 500:
            return current_message
            
        print(f"Query reformulated: '{current_message}' -> '{reformulated}'")
        return reformulated
        
    except Exception as e:
        print(f"Warning: Query reformulation failed: {e}. Using original query.")
        return current_message

# Global state to store the current graph and its embeddings
class GraphStore:
    def __init__(self):
        self.graph = None
        self.nodes = []
        self.node_embeddings = None
        self.elements = []

    def _compute_embeddings(self, G):
        """Compute and store node embeddings for the given graph."""
        self.nodes = list(G.nodes())
        if self.nodes:
            node_summaries = []
            for node in self.nodes:
                node_type = G.nodes[node].get('type', 'Entity')
                summary_parts = [f"{node}", f"is a {node_type}"]
                
                neighbors = list(G.neighbors(node))
                if neighbors:
                    rels = []
                    for neighbor in neighbors:
                        edge_data = G.get_edge_data(node, neighbor)
                        if edge_data:
                            for key in edge_data:
                                relation = edge_data[key].get('relation', 'related to')
                                rels.append(f"{relation} {neighbor}")
                    if rels:
                        summary_parts.append(f"and has relations: {', '.join(rels)}")
                
                full_summary = ". ".join(summary_parts)
                node_summaries.append(full_summary)

            self.node_embeddings = np.array(_vertex_embeddings.embed_documents(node_summaries))
        else:
            self.node_embeddings = None

    def update(self, G, elements):
        self.graph = G
        self.elements = elements
        if G:
            self._compute_embeddings(G)
        else:
            self.nodes = []
            self.node_embeddings = None

    def merge(self, new_G, graph_to_cytoscape_fn):
        """Merge a new graph into the existing one instead of replacing it."""
        import networkx as nx
        if self.graph is None:
            # No existing graph — just set it
            elements = graph_to_cytoscape_fn(new_G)
            self.update(new_G, elements)
            return elements

        # Compose: new nodes/edges are added, existing ones are preserved
        merged = nx.compose(self.graph, new_G)
        elements = graph_to_cytoscape_fn(merged)
        self.graph = merged
        self.elements = elements
        self._compute_embeddings(merged)
        return elements

graph_store = GraphStore()

app = FastAPI(title="Knowledge Graph Creator API")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class TextRequest(BaseModel):
    text: str

class ChatRequest(BaseModel):
    message: str

import asyncio
import graph_creator
from parsers import parse_file
from scrapers import scrape_url

@app.post("/generate-graph")
async def generate_graph(
    text: Optional[str] = Form(None),
    files: List[UploadFile] = File(None),
    url: Optional[str] = Form(None),
    mode: Optional[str] = Form("replace")
):
    documents = []
    
    if text:
        documents.append(Document(page_content=text, metadata={"source": "text_input"}))

    if url:
        try:
            doc = await asyncio.to_thread(scrape_url, url)
            documents.append(doc)
        except Exception as e:
            print(f"Error scraping URL {url}: {e}")
    
    if files:
        for file in files:
            content = await file.read()
            try:
                parsed_docs = parse_file(content, file.filename or "unknown.txt")
                documents.extend(parsed_docs)
            except Exception as e:
                print(f"Error reading file {file.filename}: {e}")
                continue

    if not documents:
        raise HTTPException(status_code=400, detail="No text or files provided.")

    # Safety net: truncate any oversized documents to avoid exceeding LLM context limits
    MAX_DOC_CHARS = 80_000
    for doc in documents:
        if len(doc.page_content) > MAX_DOC_CHARS:
            doc.page_content = doc.page_content[:MAX_DOC_CHARS] + "\n\n[Content truncated due to length]"

    try:
        G = await asyncio.to_thread(graph_creator.create_knowledge_graph, documents)
        if G is None or G.number_of_nodes() == 0:
            if mode != "merge":
                graph_store.update(None, [])
            return {"elements": graph_store.elements, "message": "No knowledge could be extracted."}
        
        if mode == "merge" and graph_store.graph is not None:
            # Merge new graph into existing
            elements = graph_store.merge(G, graph_creator.graph_to_cytoscape)
        else:
            # Replace mode (default)
            elements = graph_creator.graph_to_cytoscape(G)
            graph_store.update(G, elements)
            conversation_memory.clear()
        
        return {"elements": elements}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================
# Entity Resolution Endpoints
# ============================
@app.get("/resolve-entities")
async def resolve_entities(threshold: float = 0.85):
    """Find candidate duplicate entity pairs using embedding cosine similarity."""
    if not graph_store.graph or graph_store.node_embeddings is None:
        raise HTTPException(status_code=400, detail="No graph available.")

    nodes = graph_store.nodes
    embeddings = graph_store.node_embeddings

    # Compute pairwise cosine similarity
    norms = np.linalg.norm(embeddings, axis=1, keepdims=True)
    normalized = embeddings / (norms + 1e-8)
    similarity_matrix = np.dot(normalized, normalized.T)

    candidates = []
    for i in range(len(nodes)):
        for j in range(i + 1, len(nodes)):
            sim = float(similarity_matrix[i, j])
            if sim >= threshold:
                candidates.append({
                    "node_a": nodes[i],
                    "node_b": nodes[j],
                    "type_a": graph_store.graph.nodes[nodes[i]].get("type", "Entity"),
                    "type_b": graph_store.graph.nodes[nodes[j]].get("type", "Entity"),
                    "similarity": round(sim, 3)
                })

    candidates.sort(key=lambda c: c["similarity"], reverse=True)
    return {"candidates": candidates}


class MergeRequest(BaseModel):
    pairs: list  # List of {"keep": "NodeA", "remove": "NodeB"}


@app.post("/merge-entities")
async def merge_entities(request: MergeRequest):
    """Merge duplicate entities: redirect edges from 'remove' to 'keep', then delete 'remove'."""
    if not graph_store.graph:
        raise HTTPException(status_code=400, detail="No graph available.")

    G = graph_store.graph
    merged_count = 0

    for pair in request.pairs:
        keep = pair.get("keep")
        remove = pair.get("remove")
        if not keep or not remove or keep == remove:
            continue
        if remove not in G or keep not in G:
            continue

        # Redirect all edges from 'remove' to 'keep'
        for pred in list(G.predecessors(remove)):
            if pred == keep:
                continue
            edge_data = G.get_edge_data(pred, remove)
            if edge_data:
                for key in edge_data:
                    G.add_edge(pred, keep, **edge_data[key])

        for succ in list(G.neighbors(remove)):
            if succ == keep:
                continue
            edge_data = G.get_edge_data(remove, succ)
            if edge_data:
                for key in edge_data:
                    G.add_edge(keep, succ, **edge_data[key])

        G.remove_node(remove)
        merged_count += 1

    # Rebuild elements and embeddings
    elements = graph_creator.graph_to_cytoscape(G)
    graph_store.graph = G
    graph_store.elements = elements
    graph_store._compute_embeddings(G)

    return {"elements": elements, "merged": merged_count}


# ============================
# Graph Editing Endpoints
# ============================
class AddNodeRequest(BaseModel):
    id: str
    type: str = "Entity"

class UpdateNodeRequest(BaseModel):
    label: Optional[str] = None
    type: Optional[str] = None

class AddEdgeRequest(BaseModel):
    source: str
    target: str
    relation: str = "related_to"


def _rebuild_graph_store():
    """Rebuild elements and embeddings from the current graph."""
    elements = graph_creator.graph_to_cytoscape(graph_store.graph)
    graph_store.elements = elements
    graph_store._compute_embeddings(graph_store.graph)
    return elements


@app.post("/nodes")
async def add_node(request: AddNodeRequest):
    if not graph_store.graph:
        raise HTTPException(status_code=400, detail="No graph available.")
    if graph_store.graph.has_node(request.id):
        raise HTTPException(status_code=409, detail="Node already exists.")
    graph_store.graph.add_node(request.id, type=request.type)
    elements = _rebuild_graph_store()
    return {"elements": elements}


@app.patch("/nodes/{node_id}")
async def update_node(node_id: str, request: UpdateNodeRequest):
    if not graph_store.graph:
        raise HTTPException(status_code=400, detail="No graph available.")
    if not graph_store.graph.has_node(node_id):
        raise HTTPException(status_code=404, detail="Node not found.")
    if request.type is not None:
        graph_store.graph.nodes[node_id]["type"] = request.type
    # Label is derived from node ID in cytoscape, so renaming requires re-adding
    if request.label is not None and request.label != node_id:
        import networkx as nx
        G = graph_store.graph
        mapping = {node_id: request.label}
        nx.relabel_nodes(G, mapping, copy=False)
    elements = _rebuild_graph_store()
    return {"elements": elements}


@app.delete("/nodes/{node_id}")
async def delete_node(node_id: str):
    if not graph_store.graph:
        raise HTTPException(status_code=400, detail="No graph available.")
    if not graph_store.graph.has_node(node_id):
        raise HTTPException(status_code=404, detail="Node not found.")
    graph_store.graph.remove_node(node_id)
    elements = _rebuild_graph_store()
    return {"elements": elements}


@app.post("/edges")
async def add_edge(request: AddEdgeRequest):
    if not graph_store.graph:
        raise HTTPException(status_code=400, detail="No graph available.")
    if not graph_store.graph.has_node(request.source):
        raise HTTPException(status_code=404, detail=f"Source node '{request.source}' not found.")
    if not graph_store.graph.has_node(request.target):
        raise HTTPException(status_code=404, detail=f"Target node '{request.target}' not found.")
    graph_store.graph.add_edge(request.source, request.target, relation=request.relation)
    elements = _rebuild_graph_store()
    return {"elements": elements}


@app.delete("/edges")
async def delete_edge(source: str, target: str):
    if not graph_store.graph:
        raise HTTPException(status_code=400, detail="No graph available.")
    if graph_store.graph.has_edge(source, target):
        graph_store.graph.remove_edge(source, target)
    elements = _rebuild_graph_store()
    return {"elements": elements}


# ============================
# Session Management Endpoints
# ============================
import glob as glob_module

SESSIONS_DIR = os.path.join(os.path.dirname(__file__), "sessions")
os.makedirs(SESSIONS_DIR, exist_ok=True)


class SaveSessionRequest(BaseModel):
    name: str


@app.get("/sessions")
async def list_sessions():
    """List all saved sessions."""
    sessions = []
    for filepath in sorted(glob_module.glob(os.path.join(SESSIONS_DIR, "*.json"))):
        filename = os.path.basename(filepath)
        name = filename.rsplit(".", 1)[0]
        stat = os.stat(filepath)
        sessions.append({
            "name": name,
            "created": stat.st_mtime,
            "size": stat.st_size,
        })
    sessions.sort(key=lambda s: s["created"], reverse=True)
    return {"sessions": sessions}


@app.post("/sessions")
async def save_session(request: SaveSessionRequest):
    """Save the current graph as a named session."""
    if not graph_store.graph:
        raise HTTPException(status_code=400, detail="No graph to save.")

    import networkx as nx

    session_data = {
        "name": request.name,
        "graph": nx.node_link_data(graph_store.graph),
        "elements": graph_store.elements,
    }

    safe_name = "".join(c for c in request.name if c.isalnum() or c in (" ", "-", "_")).strip()
    filepath = os.path.join(SESSIONS_DIR, f"{safe_name}.json")

    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(session_data, f)

    return {"message": f"Session '{request.name}' saved.", "name": safe_name}


@app.get("/sessions/{name}")
async def load_session(name: str):
    """Load a saved session and restore it as the active graph."""
    import networkx as nx

    filepath = os.path.join(SESSIONS_DIR, f"{name}.json")
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Session not found.")

    with open(filepath, "r", encoding="utf-8") as f:
        session_data = json.load(f)

    G = nx.node_link_graph(session_data["graph"])
    elements = session_data.get("elements", [])

    graph_store.graph = G
    graph_store.elements = elements
    graph_store._compute_embeddings(G)

    return {"elements": elements, "name": session_data.get("name", name)}


@app.delete("/sessions/{name}")
async def delete_session(name: str):
    """Delete a saved session."""
    filepath = os.path.join(SESSIONS_DIR, f"{name}.json")
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Session not found.")
    os.remove(filepath)
    return {"message": f"Session '{name}' deleted."}


# ============================
# Analytics Endpoint
# ============================
@app.get("/analytics")
async def graph_analytics():
    """Compute graph analytics: centrality, communities, clustering."""
    if not graph_store.graph:
        raise HTTPException(status_code=400, detail="No graph available.")

    import networkx as nx

    G = graph_store.graph
    # Convert to undirected for some metrics
    G_undirected = G.to_undirected()

    # Degree centrality
    degree_centrality = nx.degree_centrality(G)
    top_degree = sorted(degree_centrality.items(), key=lambda x: x[1], reverse=True)[:10]

    # Betweenness centrality
    betweenness = nx.betweenness_centrality(G)
    top_betweenness = sorted(betweenness.items(), key=lambda x: x[1], reverse=True)[:10]

    # PageRank (only for directed graphs)
    try:
        pagerank = nx.pagerank(G, max_iter=100)
        top_pagerank = sorted(pagerank.items(), key=lambda x: x[1], reverse=True)[:10]
    except Exception:
        top_pagerank = []

    # Community detection (Louvain on undirected)
    try:
        communities = nx.community.louvain_communities(G_undirected)
        community_map = {}
        for i, comm in enumerate(communities):
            for node in comm:
                community_map[node] = i
        num_communities = len(communities)
    except Exception:
        community_map = {}
        num_communities = 0

    # Clustering coefficient (undirected)
    try:
        clustering = nx.clustering(G_undirected)
        avg_clustering = nx.average_clustering(G_undirected)
    except Exception:
        clustering = {}
        avg_clustering = 0.0

    # Connected components
    try:
        components = list(nx.connected_components(G_undirected))
        num_components = len(components)
        largest_component = max(len(c) for c in components) if components else 0
    except Exception:
        num_components = 0
        largest_component = 0

    return {
        "node_count": G.number_of_nodes(),
        "edge_count": G.number_of_edges(),
        "top_degree": [{"node": n, "score": round(s, 4)} for n, s in top_degree],
        "top_betweenness": [{"node": n, "score": round(s, 4)} for n, s in top_betweenness],
        "top_pagerank": [{"node": n, "score": round(s, 4)} for n, s in top_pagerank],
        "communities": community_map,
        "num_communities": num_communities,
        "avg_clustering": round(avg_clustering, 4),
        "clustering": {n: round(v, 4) for n, v in clustering.items()},
        "num_components": num_components,
        "largest_component": largest_component,
    }


# ============================
# Export Endpoints
# ============================
@app.get("/export")
async def export_graph(format: str = "json"):
    """Export the current graph in various formats."""
    import io
    from fastapi.responses import Response

    if not graph_store.graph:
        raise HTTPException(status_code=400, detail="No graph available.")

    if format == "json":
        return {"elements": graph_store.elements}

    elif format == "gexf":
        import networkx as nx
        buf = io.BytesIO()
        nx.write_gexf(graph_store.graph, buf)
        return Response(
            content=buf.getvalue(),
            media_type="application/xml",
            headers={"Content-Disposition": "attachment; filename=graph.gexf"}
        )

    elif format == "csv":
        # Return nodes and edges as CSV
        lines_nodes = ["id,label,type"]
        for node, data in graph_store.graph.nodes(data=True):
            node_type = data.get("type", "Entity")
            lines_nodes.append(f'"{node}","{node}","{node_type}"')

        lines_edges = ["source,target,relation"]
        for src, tgt, data in graph_store.graph.edges(data=True):
            rel = data.get("relation", "related_to")
            lines_edges.append(f'"{src}","{tgt}","{rel}"')

        csv_content = "# Nodes\n" + "\n".join(lines_nodes) + "\n\n# Edges\n" + "\n".join(lines_edges)
        return Response(
            content=csv_content,
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=graph.csv"}
        )

    else:
        raise HTTPException(status_code=400, detail=f"Unsupported format: {format}")


@app.post("/chat")
async def chat(request: ChatRequest):
    import time
    
    if not graph_store.graph:
        raise HTTPException(status_code=400, detail="Please generate a knowledge graph first.")

    execution_steps = []
    
    def add_step(step_id: str, label: str, icon: str):
        execution_steps.append({
            "id": step_id,
            "label": label,
            "icon": icon,
            "status": "pending",
            "duration_ms": 0,
            "details": ""
        })
        return len(execution_steps) - 1
    
    def complete_step(index: int, duration_ms: float, details: str = ""):
        execution_steps[index]["status"] = "completed"
        execution_steps[index]["duration_ms"] = round(duration_ms)
        execution_steps[index]["details"] = details

    try:
        print(f"\n{'='*60}")
        print(f"NEW CHAT REQUEST")
        print(f"{'='*60}")
        print(f"User message: \"{request.message}\"")
        
        step_reformulate = add_step("reformulation", "Reformulate", "reform")
        step_embed = add_step("embedding", "Embed Query", "embed")
        step_seed = add_step("seed_search", "Seed Search", "search")
        step_traverse = add_step("beam_search", "Graph Traverse", "traverse")
        step_context = add_step("context", "Build Context", "context")
        step_llm = add_step("llm", "Generate Answer", "llm")
        step_highlight = add_step("highlight", "Map Sources", "highlight")
        
        # 0. Reformulate query
        start_time = time.time()
        conversation_context = conversation_memory.get_context_string()
        
        if conversation_context:
            optimized_query = reformulate_query(request.message, conversation_context)
            complete_step(step_reformulate, (time.time() - start_time) * 1000, f"Context: {len(conversation_memory.history)} msgs")
        else:
            optimized_query = request.message
            complete_step(step_reformulate, (time.time() - start_time) * 1000, "No context needed")
        
        # 1. Embed query
        start_time = time.time()
        query_embedding = np.array(_vertex_embeddings.embed_query(optimized_query))
        complete_step(step_embed, (time.time() - start_time) * 1000, f"dim={len(query_embedding)}")
        
        # 2. Seed search — find top-k nodes by cosine similarity
        start_time = time.time()
        
        if graph_store.node_embeddings is not None:
            dot_product = np.dot(graph_store.node_embeddings, query_embedding)
            norms = np.linalg.norm(graph_store.node_embeddings, axis=1) * np.linalg.norm(query_embedding)
            similarities = dot_product / (norms + 1e-8)
            
            top_indices = np.where(similarities > 0.40)[0]
            top_indices = top_indices[np.argsort(similarities[top_indices])[::-1]]
            
            seed_nodes = [graph_store.nodes[i] for i in top_indices[:3]]
        else:
            seed_nodes = []
        complete_step(step_seed, (time.time() - start_time) * 1000, f"{len(seed_nodes)} seeds found")

        # 3. Beam search traversal — tightly expand from seeds
        start_time = time.time()
        MAX_HOPS = 2
        BEAM_WIDTH = 4
        MIN_RELEVANCE = 0.35
        
        visited = set(seed_nodes)
        frontier = set(seed_nodes)
        traversed_nodes: set[str] = set()  # nodes added via expansion (not seeds)
        hops_completed = 0

        for hop in range(MAX_HOPS):
            next_frontier = set()
            
            for node in frontier:
                if node not in graph_store.graph:
                    continue
                neighbors = set(graph_store.graph.neighbors(node))
                neighbors.update(graph_store.graph.predecessors(node))
                for neighbor in neighbors:
                    if neighbor not in visited:
                        visited.add(neighbor)
                        next_frontier.add(neighbor)
            
            if not next_frontier:
                break
                
            candidate_list = list(next_frontier)
            candidate_indices = [graph_store.nodes.index(n) for n in candidate_list if n in graph_store.nodes]
            if candidate_indices:
                candidate_embeddings = graph_store.node_embeddings[candidate_indices]
                dot_product = np.dot(candidate_embeddings, query_embedding)
                norms = np.linalg.norm(candidate_embeddings, axis=1) * np.linalg.norm(query_embedding)
                candidate_similarities = dot_product / (norms + 1e-8)
                
                scored_candidates = [
                    (candidate_list[i], candidate_similarities[i])
                    for i, idx in enumerate(candidate_indices)
                    if candidate_similarities[i] >= MIN_RELEVANCE
                ]
                scored_candidates.sort(key=lambda x: x[1], reverse=True)
                top_candidates = [n for n, s in scored_candidates[:BEAM_WIDTH]]
                traversed_nodes.update(top_candidates)
                frontier = set(top_candidates)
                hops_completed = hop + 1
            else:
                frontier = set()

        context_node_set = set(seed_nodes) | traversed_nodes
        context_nodes = list(context_node_set)
        complete_step(step_traverse, (time.time() - start_time) * 1000,
                      f"{hops_completed} hops, {len(traversed_nodes)} expanded, {len(context_nodes)} total")

        # 4. Build context — describe relationships of context nodes only
        start_time = time.time()
        context_parts = []

        for node in context_nodes:
            if node not in graph_store.graph:
                continue
            relations = []
            for neighbor in graph_store.graph.neighbors(node):
                edge_data = graph_store.graph.get_edge_data(node, neighbor)
                if edge_data:
                    for key in edge_data:
                        rel = edge_data[key].get('relation', 'related to')
                        relations.append(f"- {node} --[{rel}]--> {neighbor}")
            for pred in graph_store.graph.predecessors(node):
                edge_data = graph_store.graph.get_edge_data(pred, node)
                if edge_data:
                    for key in edge_data:
                        rel = edge_data[key].get('relation', 'related to')
                        relations.append(f"- {pred} --[{rel}]--> {node}")
            
            node_type = graph_store.graph.nodes[node].get('type', 'Entity')
            context_parts.append(
                f"Node: {node} (Type: {node_type})\nRelationships:\n"
                + ("\n".join(relations) if relations else "No direct relationships in graph.")
            )

        context = "\n\n".join(context_parts)
        complete_step(step_context, (time.time() - start_time) * 1000, f"{len(context)} chars")

        # 5. Generate response
        start_time = time.time()
        
        llm = ChatVertexAI(
            model_name="gemini-2.5-flash",
            temperature=0.3,
        )

        system_prompt = f"""You are a knowledgeable AI assistant that answers questions based on a Knowledge Graph.

The context below uses arrow notation: `A --[REL]--> B` means entity A has relationship REL directed toward entity B.
Convert relationship labels into natural language (e.g., WORKS_AT → "works at", HATES → "hates", FOUNDED_BY → "was founded by").

Your response style:
1. **Synthesize**: Combine all relevant facts into a concise, naturally flowing paragraph. Do NOT list facts one by one.
2. **Stay focused**: Keep the queried entity as the subject. Describe its type, attributes, and connections from its perspective.
3. **Be natural**: Write as if explaining to a colleague — clear, direct, and human-readable.
4. **Be concise**: Aim for 2-4 sentences. Only elaborate further if the graph contains rich detail.

If information is not available in the context, briefly acknowledge what is known and what is missing.

Knowledge Graph Context:
{context}
"""
        
        messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=request.message)
        ]
        
        response = llm.invoke(messages)
        answer = response.content
        complete_step(step_llm, (time.time() - start_time) * 1000, f"{len(answer)} chars")

        # 6. Categorise nodes for graph highlighting
        start_time = time.time()
        import re

        def is_valid_entity(node_id):
            if not node_id or not isinstance(node_id, str): return False
            low_id = node_id.lower()
            blacklist = ["text_input", "document", "source", "chunk", "unknown"]
            if any(b in low_id for b in blacklist): return False
            if not graph_store.graph.has_node(node_id): return False
            if graph_store.graph.nodes[node_id].get('type') == 'Document': return False
            return True

        valid_seeds = [n for n in seed_nodes if is_valid_entity(n)]
        valid_traversed = [n for n in traversed_nodes if is_valid_entity(n) and n not in set(seed_nodes)]
        valid_context = [n for n in context_nodes if is_valid_entity(n)]

        complete_step(step_highlight, (time.time() - start_time) * 1000,
                      f"{len(valid_seeds)} seeds, {len(valid_traversed)} traversed")

        # Save conversation — condense assistant answer to keep context lean
        conversation_memory.add_turn("user", request.message)
        condensed = answer[:300] + ("..." if len(answer) > 300 else "")
        conversation_memory.add_turn("assistant", condensed, entities=valid_seeds)

        return {
            "answer": answer,
            "seed_nodes": valid_seeds,
            "traversed_nodes": valid_traversed,
            "context_nodes": valid_context,
            "execution_steps": execution_steps
        }
        
    except Exception as e:
        print(f"\nCHAT ERROR: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/chat-stream")
async def chat_stream(request: ChatRequest):
    """SSE endpoint that streams execution steps in real-time."""
    import time
    import asyncio
    
    if not graph_store.graph:
        raise HTTPException(status_code=400, detail="Please generate a knowledge graph first.")

    async def generate_stream():
        import re
        
        def send_step(step_id: str, status: str, duration_ms: int = 0, details: str = ""):
            data = json.dumps({
                "type": "step",
                "step_id": step_id,
                "status": status,
                "duration_ms": duration_ms,
                "details": details
            })
            return f"data: {data}\n\n"
        
        try:
            # Step 1: Reformulation
            yield send_step("reformulation", "running")
            start_time = time.time()
            
            conversation_context = conversation_memory.get_context_string()
            if conversation_context:
                optimized_query = reformulate_query(request.message, conversation_context)
                details = f"Context: {len(conversation_memory.history)} msgs"
            else:
                optimized_query = request.message
                details = "No context needed"
            
            duration = round((time.time() - start_time) * 1000)
            yield send_step("reformulation", "completed", duration, details)
            
            # Step 2: Embedding
            yield send_step("embedding", "running")
            start_time = time.time()
            
            query_embedding = np.array(_vertex_embeddings.embed_query(optimized_query))
            
            duration = round((time.time() - start_time) * 1000)
            yield send_step("embedding", "completed", duration, f"dim={len(query_embedding)}")
            
            # Step 3: Seed Search — top-k by cosine similarity
            yield send_step("seed_search", "running")
            start_time = time.time()
            
            seed_nodes = []
            
            if graph_store.node_embeddings is not None:
                dot_product = np.dot(graph_store.node_embeddings, query_embedding)
                norms = np.linalg.norm(graph_store.node_embeddings, axis=1) * np.linalg.norm(query_embedding)
                similarities = dot_product / (norms + 1e-8)
                
                top_indices = np.where(similarities > 0.40)[0]
                top_indices = top_indices[np.argsort(similarities[top_indices])[::-1]]
                
                seed_nodes = [graph_store.nodes[i] for i in top_indices[:3]]
            
            duration = round((time.time() - start_time) * 1000)
            yield send_step("seed_search", "completed", duration, f"{len(seed_nodes)} seeds found")

            # Emit seed nodes for live traversal animation on frontend
            seeds_event = json.dumps({"type": "traversal_seeds", "seeds": seed_nodes})
            yield f"data: {seeds_event}\n\n"
            
            # Step 4: Graph Traversal — two-phase explore-then-score
            yield send_step("beam_search", "running")
            start_time = time.time()

            MAX_HOPS = 2
            MIN_RELEVANCE = 0.35

            # --- Phase 1: Full BFS expansion (no pruning) ---
            expanded_nodes: set[str] = set()
            hop_map: dict[str, int] = {}       # node -> hop distance from nearest seed
            frontier = set(seed_nodes)
            visited = set(seed_nodes)

            for hop in range(MAX_HOPS):
                next_frontier = set()
                for node in frontier:
                    if node not in graph_store.graph:
                        continue
                    neighbors = set(graph_store.graph.neighbors(node))
                    neighbors.update(graph_store.graph.predecessors(node))
                    for neighbor in neighbors:
                        if neighbor not in visited:
                            visited.add(neighbor)
                            next_frontier.add(neighbor)
                            hop_map[neighbor] = hop + 1

                if not next_frontier:
                    break
                expanded_nodes.update(next_frontier)
                frontier = next_frontier

                # Emit per-hop frontier for live traversal animation
                hop_event = json.dumps({
                    "type": "traversal_hop",
                    "hop": hop + 1,
                    "frontier": list(next_frontier)
                })
                yield f"data: {hop_event}\n\n"

            # --- Phase 2: Relevance scoring + bridge detection ---
            relevant_nodes: set[str] = set()

            if expanded_nodes and graph_store.node_embeddings is not None:
                exp_list = list(expanded_nodes)
                exp_indices = [graph_store.nodes.index(n) for n in exp_list if n in graph_store.nodes]
                if exp_indices:
                    exp_embeddings = graph_store.node_embeddings[exp_indices]
                    dot_product = np.dot(exp_embeddings, query_embedding)
                    norms = np.linalg.norm(exp_embeddings, axis=1) * np.linalg.norm(query_embedding)
                    exp_similarities = dot_product / (norms + 1e-8)

                    # Map node -> similarity for all expanded nodes
                    exp_nodes_with_idx = [exp_list[i] for i, idx in enumerate(exp_indices)]
                    for i, node in enumerate(exp_nodes_with_idx):
                        if exp_similarities[i] >= MIN_RELEVANCE:
                            relevant_nodes.add(node)

            # Always include direct neighbors of seeds — they're obviously relevant
            seed_neighbors: set[str] = set()
            for node in seed_nodes:
                if node in graph_store.graph:
                    seed_neighbors.update(graph_store.graph.neighbors(node))
                    seed_neighbors.update(graph_store.graph.predecessors(node))

            # Detect bridge nodes: connect 2+ context/seed nodes but aren't relevant themselves
            context_core = set(seed_nodes) | relevant_nodes | seed_neighbors
            bridge_nodes: set[str] = set()
            for node in expanded_nodes - context_core:
                if node not in graph_store.graph:
                    continue
                neighbors = set(graph_store.graph.neighbors(node))
                neighbors.update(graph_store.graph.predecessors(node))
                if len(neighbors & context_core) >= 2:
                    bridge_nodes.add(node)

            # Three tiers (invariant: Seeds ⊂ Context ⊂ Expanded):
            #   Seeds:    initial RAG hits (smallest)
            #   Context:  seeds + relevant + bridges (what the LLM uses)
            #   Expanded: full BFS neighborhood (largest, shows exploration scope)
            traversed_nodes = expanded_nodes | set(seed_nodes)
            context_nodes = list(context_core | bridge_nodes)

            hops_completed = min(MAX_HOPS, max(hop_map.values())) if hop_map else 0
            duration = round((time.time() - start_time) * 1000)
            yield send_step("beam_search", "completed", duration,
                            f"{hops_completed} hops, {len(expanded_nodes)} explored, "
                            f"{len(relevant_nodes)} relevant, {len(bridge_nodes)} bridges")
            
            # Step 5: Build Context — describe relationships of context nodes only
            yield send_step("context", "running")
            start_time = time.time()
            
            def _rel_to_natural(rel_label: str) -> str:
                """Convert UPPER_SNAKE_CASE relation to natural language."""
                return rel_label.lower().replace('_', ' ')

            context_parts = []

            for node in context_nodes:
                if node not in graph_store.graph:
                    continue
                sentences = []
                # Outgoing: node --[rel]--> neighbor  →  "verb neighbor"
                for neighbor in graph_store.graph.neighbors(node):
                    edge_data = graph_store.graph.get_edge_data(node, neighbor)
                    if edge_data:
                        for key in edge_data:
                            rel = edge_data[key].get('relation', 'related to')
                            sentences.append(f"  - {_rel_to_natural(rel)} {neighbor}")
                # Incoming: pred --[rel]--> node  →  "is verb by pred"
                for pred in graph_store.graph.predecessors(node):
                    edge_data = graph_store.graph.get_edge_data(pred, node)
                    if edge_data:
                        for key in edge_data:
                            rel = edge_data[key].get('relation', 'related to')
                            sentences.append(f"  - is {_rel_to_natural(rel)} by {pred}")
                
                node_type = graph_store.graph.nodes[node].get('type', 'Entity')
                body = "\n".join(sentences) if sentences else "  (no direct relationships)"
                context_parts.append(f"{node} ({node_type}):\n{body}")

            context = "\n\n".join(context_parts)
            
            duration = round((time.time() - start_time) * 1000)
            yield send_step("context", "completed", duration, f"{len(context)} chars")
            
            # Step 6: LLM Generation (streaming tokens)
            yield send_step("llm", "running")
            start_time = time.time()
            
            llm = ChatVertexAI(
                model_name="gemini-2.5-flash",
                temperature=0.3,
            )

            system_prompt = f"""You are a helpful assistant exploring a knowledge graph with the user.

Below is structured information extracted from the graph about entities relevant to the user's question. Use it to answer naturally — as you would explain something to a colleague. Be concise but thorough. If the graph doesn't contain enough information, say so honestly.

If the user is continuing a previous line of questioning, build on what was already discussed rather than repeating it.

Graph context:
{context}
"""
            
            messages = [SystemMessage(content=system_prompt)]

            # Include recent conversation history (last 3 turns = up to 6 items)
            for turn in conversation_memory.history[-6:]:
                if turn["role"] == "user":
                    messages.append(HumanMessage(content=turn["content"]))
                else:
                    messages.append(AIMessage(content=turn["content"]))

            messages.append(HumanMessage(content=request.message))
            
            # Stream tokens to frontend in real-time (async to avoid blocking the event loop)
            answer = ""
            async for chunk in llm.astream(messages):
                token = chunk.content if hasattr(chunk, 'content') else str(chunk)
                if token:
                    answer += token
                    token_data = json.dumps({"type": "token", "text": token})
                    yield f"data: {token_data}\n\n"
            
            duration = round((time.time() - start_time) * 1000)
            yield send_step("llm", "completed", duration, f"{len(answer)} chars")
            
            # Step 7: Categorise nodes for graph highlighting
            yield send_step("highlight", "running")
            start_time = time.time()

            def is_valid_entity(node_id):
                if not node_id or not isinstance(node_id, str): return False
                low_id = node_id.lower()
                blacklist = ["text_input", "document", "source", "chunk", "unknown"]
                if any(b in low_id for b in blacklist): return False
                if not graph_store.graph.has_node(node_id): return False
                if graph_store.graph.nodes[node_id].get('type') == 'Document': return False
                return True

            valid_seeds = [n for n in seed_nodes if is_valid_entity(n)]
            valid_traversed = [n for n in traversed_nodes if is_valid_entity(n)]
            valid_context = [n for n in context_nodes if is_valid_entity(n)]
            
            duration = round((time.time() - start_time) * 1000)
            yield send_step("highlight", "completed", duration,
                            f"{len(valid_seeds)} seeds, {len(valid_traversed)} expanded, {len(valid_context)} context")
            
            # Save to memory — condense assistant answer to keep context lean
            conversation_memory.add_turn("user", request.message)
            condensed = answer[:300] + ("..." if len(answer) > 300 else "")
            conversation_memory.add_turn("assistant", condensed, entities=valid_seeds)
            
            # Send final result with 3-tier node categories
            final_data = json.dumps({
                "type": "result",
                "answer": answer,
                "seed_nodes": valid_seeds,
                "traversed_nodes": valid_traversed,
                "context_nodes": valid_context
            })
            yield f"data: {final_data}\n\n"
            
        except Exception as e:
            error_data = json.dumps({
                "type": "error",
                "message": str(e)
            })
            yield f"data: {error_data}\n\n"

    return StreamingResponse(
        generate_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
