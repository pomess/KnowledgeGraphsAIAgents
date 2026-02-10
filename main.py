import os
import sys
from dotenv import load_dotenv

load_dotenv()

import json
from typing import List, Optional
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, StreamingResponse
from pydantic import BaseModel
from langchain_core.documents import Document

import numpy as np
from sentence_transformers import SentenceTransformer
from langchain_google_vertexai import ChatVertexAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.messages import SystemMessage, HumanMessage

# Set credentials path
os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = r"c:\Users\Bruno\Desktop\Deloitte Repositories\GOOGLE_CREDENTIALS\service_account.json"

# Add parent directory to path to import graph_creator
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from graph_creator import create_knowledge_graph, graph_to_cytoscape

# Initialize Embedding Model
embedding_model = SentenceTransformer('all-MiniLM-L6-v2')

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
    
    def add_turn(self, role: str, content: str):
        """Add a message to history and persist."""
        self.history.append({"role": role, "content": content})
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
        # No history, just return the original message
        return current_message
    
    try:
        # Use Gemini 2.0 for reformulation
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
        
        # Sanity check: if the reformulation is empty or way too long, use original
        if not reformulated or len(reformulated) > 500:
            return current_message
            
        print(f"🔄 Query reformulated: '{current_message}' → '{reformulated}'")
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

    def update(self, G, elements):
        self.graph = G
        self.elements = elements
        if G:
            self.nodes = list(G.nodes())
            if self.nodes:
                # Generate rich summaries for embedding
                node_summaries = []
                for node in self.nodes:
                    # Base info
                    node_type = G.nodes[node].get('type', 'Entity')
                    summary_parts = [f"{node}", f"is a {node_type}"]
                    
                    # Add outgoing relationships to content
                    # This gives the embedding model context about what the node connects to
                    neighbors = list(G.neighbors(node))
                    if neighbors:
                        rels = []
                        for neighbor in neighbors:
                            edge_data = G.get_edge_data(node, neighbor)
                            # Handle MultiDiGraph data structure (dict of edges)
                            if edge_data:
                                for key in edge_data:
                                    relation = edge_data[key].get('relation', 'related to')
                                    rels.append(f"{relation} {neighbor}")
                        if rels:
                            summary_parts.append(f"and has relations: {', '.join(rels)}")
                    
                    # Join into a single string for embedding
                    full_summary = ". ".join(summary_parts)
                    node_summaries.append(full_summary)

                # Embed the summaries instead of just names
                self.node_embeddings = embedding_model.encode(node_summaries)
            else:
                self.node_embeddings = None
        else:
            self.nodes = []
            self.node_embeddings = None

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

# Mount static files
app.mount("/static", StaticFiles(directory=BASE_DIR), name="static")

class TextRequest(BaseModel):
    text: str

class ChatRequest(BaseModel):
    message: str

@app.get("/", response_class=HTMLResponse)
async def read_index():
    index_path = os.path.join(BASE_DIR, "index.html")
    with open(index_path, "r", encoding="utf-8") as f:
        return HTMLResponse(content=f.read())

import importlib
import graph_creator

@app.post("/generate-graph")
async def generate_graph(
    text: Optional[str] = Form(None),
    files: List[UploadFile] = File(None)
):
    # Hot-reload the graph_creator module to pick up changes
    importlib.reload(graph_creator)
    
    documents = []
    
    # Process text input
    if text:
        documents.append(Document(page_content=text, metadata={"source": "text_input"}))
    
    # Process uploaded files
    if files:
        for file in files:
            content = await file.read()
            try:
                # Assuming text files for now
                text_content = content.decode("utf-8")
                documents.append(Document(page_content=text_content, metadata={"source": file.filename}))
            except Exception as e:
                print(f"Error reading file {file.filename}: {e}")
                continue

    if not documents:
        raise HTTPException(status_code=400, detail="No text or files provided.")

    try:
        # Generate the graph using the reloaded module
        G = graph_creator.create_knowledge_graph(documents)
        if G is None or G.number_of_nodes() == 0:
            graph_store.update(None, [])
            return {"elements": [], "message": "No knowledge could be extracted."}
        
        # Convert to Cytoscape format
        elements = graph_creator.graph_to_cytoscape(G)
        
        # Update global graph store
        graph_store.update(G, elements)
        
        # Clear conversation memory for new graph session
        conversation_memory.clear()
        
        return {"elements": elements}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/chat")
async def chat(request: ChatRequest):
    import time
    
    if not graph_store.graph:
        raise HTTPException(status_code=400, detail="Please generate a knowledge graph first.")

    # Execution steps tracking for visualization
    execution_steps = []
    
    def add_step(step_id: str, label: str, icon: str):
        """Add a new step and return its index."""
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
        """Mark a step as completed."""
        execution_steps[index]["status"] = "completed"
        execution_steps[index]["duration_ms"] = round(duration_ms)
        execution_steps[index]["details"] = details

    try:
        print(f"\n{'='*60}")
        print(f"💬 NEW CHAT REQUEST")
        print(f"{'='*60}")
        print(f"📝 User message: \"{request.message}\"")
        
        # Define all pipeline steps upfront
        step_reformulate = add_step("reformulation", "Reformulate", "🔄")
        step_embed = add_step("embedding", "Embed Query", "🔢")
        step_seed = add_step("seed_search", "Seed Search", "🔍")
        step_traverse = add_step("beam_search", "Graph Traverse", "🌐")
        step_context = add_step("context", "Build Context", "📋")
        step_llm = add_step("llm", "Generate Answer", "🤖")
        step_highlight = add_step("highlight", "Map Sources", "🎯")
        
        # 0. Get conversation context and reformulate query
        start_time = time.time()
        conversation_context = conversation_memory.get_context_string()
        
        if conversation_context:
            print(f"\n[STEP 0] 🧠 Optimizing query for RAG (multi-turn context detected)...")
            print(f"         📜 Conversation history: {len(conversation_memory.history)} messages")
            optimized_query = reformulate_query(request.message, conversation_context)
            print(f"         ✅ Optimized query: \"{optimized_query}\"")
            complete_step(step_reformulate, (time.time() - start_time) * 1000, f"Context: {len(conversation_memory.history)} msgs")
        else:
            print(f"\n[STEP 0] ℹ️  First message in session, no reformulation needed.")
            optimized_query = request.message
            complete_step(step_reformulate, (time.time() - start_time) * 1000, "No context needed")
        
        # 1. Embed the REFORMULATED query (not the raw message)
        start_time = time.time()
        print(f"\n[STEP 1] 🔢 Embedding query...")
        print(f"         📊 Query: \"{optimized_query}\"")
        query_embedding = embedding_model.encode([optimized_query])[0]
        print(f"         ✅ Embedding generated (dim={len(query_embedding)})")
        complete_step(step_embed, (time.time() - start_time) * 1000, f"dim={len(query_embedding)}")
        
        # 2. Similarity search (Initial Seeds)
        start_time = time.time()
        print(f"\n[STEP 2] 🔍 Comparing with KG embeddings...")
        print(f"         📈 Total nodes in graph: {len(graph_store.nodes)}")
        
        if graph_store.node_embeddings is not None:
            dot_product = np.dot(graph_store.node_embeddings, query_embedding)
            norms = np.linalg.norm(graph_store.node_embeddings, axis=1) * np.linalg.norm(query_embedding)
            similarities = dot_product / (norms + 1e-8)
            
            top_indices = np.where(similarities > 0.35)[0]
            top_indices = top_indices[np.argsort(similarities[top_indices])[::-1]]
            
            seed_nodes = [graph_store.nodes[i] for i in top_indices[:5]]
            highlight_candidates = [graph_store.nodes[i] for i in top_indices if similarities[i] > 0.5]
            if not highlight_candidates and len(top_indices) > 0:
                highlight_candidates = [graph_store.nodes[top_indices[0]]]
            
            print(f"         🌱 Seed nodes found: {len(seed_nodes)}")
            for i, node in enumerate(seed_nodes[:5]):
                idx = graph_store.nodes.index(node)
                print(f"            {i+1}. {node} (sim={similarities[idx]:.3f})")
        else:
            seed_nodes = []
            highlight_candidates = []
            print(f"         ⚠️  No embeddings available!")
        complete_step(step_seed, (time.time() - start_time) * 1000, f"{len(seed_nodes)} seeds found")

        # 3. Beam Search with Relevance Re-scoring (Multi-Hop Traversal)
        start_time = time.time()
        print(f"\n[STEP 3] 🌐 Beam Search traversal (multi-hop)...")
        MAX_HOPS = 3
        BEAM_WIDTH = 15
        MIN_RELEVANCE = 0.15
        
        visited = set(seed_nodes)
        frontier = set(seed_nodes)
        all_context_nodes = set(seed_nodes)
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
                print(f"         Hop {hop+1}: No new nodes to explore. Stopping.")
                break
                
            candidate_list = list(next_frontier)
            if candidate_list:
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
                    
                    print(f"         Hop {hop+1}: Expanded {len(candidate_list)} nodes → Kept {len(top_candidates)} (relevance ≥ {MIN_RELEVANCE})")
                    
                    all_context_nodes.update(top_candidates)
                    frontier = set(top_candidates)
                    hops_completed = hop + 1
                else:
                    frontier = set()
            else:
                frontier = set()

        for seed in seed_nodes:
            if seed in graph_store.graph:
                direct_neighbors = set(graph_store.graph.neighbors(seed))
                direct_neighbors.update(graph_store.graph.predecessors(seed))
                all_context_nodes.update(direct_neighbors)
                print(f"         ➕ Added {len(direct_neighbors)} direct neighbors of '{seed}'")

        context_nodes = list(all_context_nodes)
        print(f"         ✅ Total context nodes retrieved: {len(context_nodes)}")
        complete_step(step_traverse, (time.time() - start_time) * 1000, f"{hops_completed} hops, {len(context_nodes)} nodes")

        # 4. Build context from the collected nodes
        start_time = time.time()
        print(f"\n[STEP 4] 📋 Building context for LLM...")
        context_parts = []
        full_context_nodes = set(context_nodes)

        for node in context_nodes:
            if node not in graph_store.graph:
                continue
            neighbors = list(graph_store.graph.neighbors(node))
            relations = []
            for neighbor in neighbors:
                full_context_nodes.add(neighbor)
                edge_data = graph_store.graph.get_edge_data(node, neighbor)
                if edge_data:
                    for key in edge_data:
                        rel = edge_data[key].get('relation', 'related to')
                        relations.append(f"- {node} is {rel} {neighbor}")
            
            predecessors = list(graph_store.graph.predecessors(node))
            for pred in predecessors:
                full_context_nodes.add(pred)
                edge_data = graph_store.graph.get_edge_data(pred, node)
                if edge_data:
                    for key in edge_data:
                        rel = edge_data[key].get('relation', 'related to')
                        relations.append(f"- {pred} is {rel} {node}")
            
            node_type = graph_store.graph.nodes[node].get('type', 'Entity')
            context_parts.append(f"Node: {node} (Type: {node_type})\nRelationships:\n" + ("\n".join(relations) if relations else "No direct relationships in graph."))

        context = "\n\n".join(context_parts)
        print(f"         📄 Context length: {len(context)} chars ({len(context_parts)} node summaries)")
        complete_step(step_context, (time.time() - start_time) * 1000, f"{len(context)} chars")

        # 5. Generate response using Vertex AI
        start_time = time.time()
        print(f"\n[STEP 5] 🤖 Generating response (LLM call)...")
        print(f"         🏷️  Model: gemini-2.5-flash")
        
        llm = ChatVertexAI(
            model_name="gemini-2.5-flash",
            temperature=0.3,
        )

        system_prompt = f"""You are a knowledgeable AI assistant that provides **detailed and comprehensive answers** based on a Knowledge Graph.

Your response style:
1. **Be thorough**: Explain entities fully, including their relationships, roles, and connections to other entities.
2. **Provide context**: Don't just state facts - explain what they mean and how entities relate to each other.
3. **Use all available information**: Include details about related entities, dates, organizations, locations, and any other relevant data from the graph.
4. **Structure your response**: Use paragraphs for readability. For complex topics, consider using bullet points or numbered lists.
5. **Be informative**: If an entity is connected to patents, legal matters, organizations, or events, explain these connections.

If information is not available in the context, acknowledge what you DO know and what is missing.

Knowledge Graph Context:
{context}
"""
        
        messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=request.message)
        ]
        
        response = llm.invoke(messages)
        answer = response.content
        print(f"         ✅ Response generated ({len(answer)} chars)")
        complete_step(step_llm, (time.time() - start_time) * 1000, f"{len(answer)} chars")

        # 6. Cross-check which highlight candidates are actually in the answer
        start_time = time.time()
        print(f"\n[STEP 6] 🎯 Identifying nodes mentioned in response...")
        final_highlights = []
        import re
        for node in highlight_candidates:
            if re.search(re.escape(node), answer, re.IGNORECASE):
                final_highlights.append(node)
        
        if not final_highlights:
             for node in graph_store.nodes:
                 if re.search(rf"\b{re.escape(node)}\b", answer, re.IGNORECASE):
                     final_highlights.append(node)
                     if len(final_highlights) >= 5: break

        # 7. Prepare response
        def is_valid_entity(node_id):
            if not node_id or not isinstance(node_id, str): return False
            low_id = node_id.lower()
            blacklist = ["text_input", "document", "source", "chunk", "unknown"]
            if any(b in low_id for b in blacklist): return False
            if not graph_store.graph.has_node(node_id): return False
            if graph_store.graph.nodes[node_id].get('type') == 'Document': return False
            return True

        final_source_nodes = [n for n in full_context_nodes if is_valid_entity(n)]
        final_highlight_nodes = [n for n in final_highlights if is_valid_entity(n)]
        
        if not final_source_nodes and final_highlight_nodes:
            final_source_nodes = final_highlight_nodes

        print(f"         🟢 Explored nodes (for highlighting): {len(final_source_nodes)}")
        print(f"         🔵 Source nodes (mentioned in answer): {len(final_highlight_nodes)}")
        complete_step(step_highlight, (time.time() - start_time) * 1000, f"{len(final_highlight_nodes)} sources")

        # 8. Save conversation to memory
        print(f"\n[STEP 7] 💾 Saving to conversation memory...")
        conversation_memory.add_turn("user", request.message)
        conversation_memory.add_turn("assistant", answer)
        print(f"         ✅ Memory updated ({len(conversation_memory.history)} total messages)")
        
        print(f"\n{'='*60}")
        print(f"✅ CHAT REQUEST COMPLETE")
        print(f"{'='*60}\n")

        return {
            "answer": answer,
            "highlight_nodes": final_highlight_nodes[:10],
            "source_nodes": final_source_nodes[:25],
            "execution_steps": execution_steps
        }
        
    except Exception as e:
        print(f"\n❌ CHAT ERROR: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/chat-stream")
async def chat_stream(request: ChatRequest):
    """SSE endpoint that streams execution steps in real-time."""
    import time
    import asyncio
    
    if not graph_store.graph:
        raise HTTPException(status_code=400, detail="Please generate a knowledge graph first.")

    async def generate_stream():
        """Generator that yields SSE events for each step."""
        import re
        
        def send_step(step_id: str, status: str, duration_ms: int = 0, details: str = ""):
            """Format and return an SSE event."""
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
            
            query_embedding = embedding_model.encode([optimized_query])[0]
            
            duration = round((time.time() - start_time) * 1000)
            yield send_step("embedding", "completed", duration, f"dim={len(query_embedding)}")
            
            # Step 3: Seed Search
            yield send_step("seed_search", "running")
            start_time = time.time()
            
            seed_nodes = []
            highlight_candidates = []
            
            if graph_store.node_embeddings is not None:
                dot_product = np.dot(graph_store.node_embeddings, query_embedding)
                norms = np.linalg.norm(graph_store.node_embeddings, axis=1) * np.linalg.norm(query_embedding)
                similarities = dot_product / (norms + 1e-8)
                
                top_indices = np.where(similarities > 0.35)[0]
                top_indices = top_indices[np.argsort(similarities[top_indices])[::-1]]
                
                seed_nodes = [graph_store.nodes[i] for i in top_indices[:5]]
                highlight_candidates = [graph_store.nodes[i] for i in top_indices if similarities[i] > 0.5]
                if not highlight_candidates and len(top_indices) > 0:
                    highlight_candidates = [graph_store.nodes[top_indices[0]]]
            
            duration = round((time.time() - start_time) * 1000)
            yield send_step("seed_search", "completed", duration, f"{len(seed_nodes)} seeds found")
            
            # Step 4: Beam Search Traversal
            yield send_step("beam_search", "running")
            start_time = time.time()
            
            MAX_HOPS = 3
            BEAM_WIDTH = 15
            MIN_RELEVANCE = 0.15
            
            visited = set(seed_nodes)
            frontier = set(seed_nodes)
            all_context_nodes = set(seed_nodes)
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
                if candidate_list:
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
                        all_context_nodes.update(top_candidates)
                        frontier = set(top_candidates)
                        hops_completed = hop + 1
                    else:
                        frontier = set()
                else:
                    frontier = set()

            for seed in seed_nodes:
                if seed in graph_store.graph:
                    direct_neighbors = set(graph_store.graph.neighbors(seed))
                    direct_neighbors.update(graph_store.graph.predecessors(seed))
                    all_context_nodes.update(direct_neighbors)

            context_nodes = list(all_context_nodes)
            
            duration = round((time.time() - start_time) * 1000)
            yield send_step("beam_search", "completed", duration, f"{hops_completed} hops, {len(context_nodes)} nodes")
            
            # Step 5: Build Context
            yield send_step("context", "running")
            start_time = time.time()
            
            context_parts = []
            full_context_nodes = set(context_nodes)

            for node in context_nodes:
                if node not in graph_store.graph:
                    continue
                neighbors = list(graph_store.graph.neighbors(node))
                relations = []
                for neighbor in neighbors:
                    full_context_nodes.add(neighbor)
                    edge_data = graph_store.graph.get_edge_data(node, neighbor)
                    if edge_data:
                        for key in edge_data:
                            rel = edge_data[key].get('relation', 'related to')
                            relations.append(f"- {node} is {rel} {neighbor}")
                
                predecessors = list(graph_store.graph.predecessors(node))
                for pred in predecessors:
                    full_context_nodes.add(pred)
                    edge_data = graph_store.graph.get_edge_data(pred, node)
                    if edge_data:
                        for key in edge_data:
                            rel = edge_data[key].get('relation', 'related to')
                            relations.append(f"- {pred} is {rel} {node}")
                
                node_type = graph_store.graph.nodes[node].get('type', 'Entity')
                context_parts.append(f"Node: {node} (Type: {node_type})\nRelationships:\n" + ("\n".join(relations) if relations else "No direct relationships in graph."))

            context = "\n\n".join(context_parts)
            
            duration = round((time.time() - start_time) * 1000)
            yield send_step("context", "completed", duration, f"{len(context)} chars")
            
            # Step 6: LLM Generation
            yield send_step("llm", "running")
            start_time = time.time()
            
            llm = ChatVertexAI(
                model_name="gemini-2.5-flash",
                temperature=0.3,
            )

            system_prompt = f"""You are a knowledgeable AI assistant that provides **detailed and comprehensive answers** based on a Knowledge Graph.

Your response style:
1. **Be thorough**: Explain entities fully, including their relationships, roles, and connections to other entities.
2. **Provide context**: Don't just state facts - explain what they mean and how entities relate to each other.
3. **Use all available information**: Include details about related entities, dates, organizations, locations, and any other relevant data from the graph.
4. **Structure your response**: Use paragraphs for readability. For complex topics, consider using bullet points or numbered lists.
5. **Be informative**: If an entity is connected to patents, legal matters, organizations, or events, explain these connections.

If information is not available in the context, acknowledge what you DO know and what is missing.

Knowledge Graph Context:
{context}
"""
            
            messages = [
                SystemMessage(content=system_prompt),
                HumanMessage(content=request.message)
            ]
            
            response = llm.invoke(messages)
            answer = response.content
            
            duration = round((time.time() - start_time) * 1000)
            yield send_step("llm", "completed", duration, f"{len(answer)} chars")
            
            # Step 7: Map Sources
            yield send_step("highlight", "running")
            start_time = time.time()
            
            final_highlights = []
            for node in highlight_candidates:
                if re.search(re.escape(node), answer, re.IGNORECASE):
                    final_highlights.append(node)
            
            if not final_highlights:
                for node in graph_store.nodes:
                    if re.search(rf"\b{re.escape(node)}\b", answer, re.IGNORECASE):
                        final_highlights.append(node)
                        if len(final_highlights) >= 5: break

            def is_valid_entity(node_id):
                if not node_id or not isinstance(node_id, str): return False
                low_id = node_id.lower()
                blacklist = ["text_input", "document", "source", "chunk", "unknown"]
                if any(b in low_id for b in blacklist): return False
                if not graph_store.graph.has_node(node_id): return False
                if graph_store.graph.nodes[node_id].get('type') == 'Document': return False
                return True

            final_source_nodes = [n for n in full_context_nodes if is_valid_entity(n)]
            final_highlight_nodes = [n for n in final_highlights if is_valid_entity(n)]
            
            if not final_source_nodes and final_highlight_nodes:
                final_source_nodes = final_highlight_nodes
            
            duration = round((time.time() - start_time) * 1000)
            yield send_step("highlight", "completed", duration, f"{len(final_highlight_nodes)} sources")
            
            # Save to memory
            conversation_memory.add_turn("user", request.message)
            conversation_memory.add_turn("assistant", answer)
            
            # Send final result
            final_data = json.dumps({
                "type": "result",
                "answer": answer,
                "highlight_nodes": final_highlight_nodes[:10],
                "source_nodes": final_source_nodes[:25]
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
