import networkx as nx
from typing import List, Dict, Any
from langchain_core.documents import Document
from langchain_experimental.graph_transformers import LLMGraphTransformer
from langchain_google_vertexai import ChatVertexAI
import os

# Set credentials path
os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = r"c:\Users\Bruno\Desktop\Deloitte Repositories\GOOGLE_CREDENTIALS\service_account.json"

# Module-level LLM client (created once, reused across requests)
_llm = ChatVertexAI(
    model_name="gemini-2.5-flash",
    temperature=0,
)

def create_knowledge_graph(documents: List[Document]) -> nx.DiGraph:
    """
    Converts a list of documents into a NetworkX graph using an LLM.
    """
    if not documents:
        return nx.DiGraph()

    # Reuse the module-level LLM client
    llm_transformer = LLMGraphTransformer(llm=_llm)

    # Convert documents to graph documents
    graph_documents = llm_transformer.convert_to_graph_documents(documents)

    # Create NetworkX graph
    G = nx.MultiDiGraph()

    for doc in graph_documents:
        for node in doc.nodes:
            G.add_node(node.id, type=node.type)
        
        for edge in doc.relationships:
            G.add_edge(edge.source.id, edge.target.id, relation=edge.type)

    return G

def graph_to_cytoscape(G: nx.DiGraph) -> List[Dict[str, Any]]:
    """
    Converts a NetworkX graph to Cytoscape JSON format.
    """
    elements = []

    if G is None:
        return elements

    # Add nodes
    for node, data in G.nodes(data=True):
        elements.append({
            "data": {
                "id": node,
                "label": node,
                "type": data.get("type", "Entity")
            }
        })

    # Add edges
    for source, target, data in G.edges(data=True):
        elements.append({
            "data": {
                "source": source,
                "target": target,
                "label": data.get("relation", "related_to")
            }
        })

    return elements
