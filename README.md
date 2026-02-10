# Knowledge Graphs AI Agents

A full-stack application that transforms unstructured data into interactive knowledge graphs and enables conversational Q&A over them using Retrieval-Augmented Generation (RAG). Built with **FastAPI**, **React**, **Google Vertex AI (Gemini 2.5 Flash)**, **NetworkX**, and **Cytoscape.js**.

---

## Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
  - [Backend Setup](#backend-setup)
  - [Frontend Setup](#frontend-setup)
- [Configuration](#configuration)
- [API Reference](#api-reference)
- [RAG Chat Pipeline](#rag-chat-pipeline)
- [Supported Input Formats](#supported-input-formats)
- [Session Management](#session-management)
- [Export Formats](#export-formats)

---

## Features

- **Knowledge Graph Generation** — Automatically extract entities and relationships from text, documents, or web pages using LLM-powered graph transformers.
- **Multi-Format Ingestion** — Supports plain text, PDF, DOCX, CSV file uploads, and URL scraping.
- **Interactive Graph Visualization** — Explore your knowledge graph with an interactive Cytoscape.js viewer featuring force-directed layouts (fCoSE).
- **RAG-Powered Chat** — Ask natural language questions over your graph with a multi-step retrieval pipeline that includes query reformulation, embedding-based search, beam-search graph traversal, and LLM answer generation.
- **Streaming Responses** — Real-time Server-Sent Events (SSE) stream pipeline steps, traversal hops, and token-by-token answer generation to the UI.
- **Entity Resolution** — Detect and merge duplicate entities based on embedding similarity.
- **Graph Editing** — Add, update, and delete nodes and edges directly from the UI.
- **Graph Analytics** — Compute centrality metrics (degree, betweenness, PageRank), community detection, clustering coefficients, and connected components.
- **Session Management** — Save, load, and delete named graph sessions persisted as JSON files.
- **Export** — Download your graph as JSON, GEXF, or CSV.
- **Conversation Memory** — Multi-turn chat with pronoun resolution and context-aware query reformulation.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend                             │
│          React 19 + TypeScript + Vite + Cytoscape.js        │
│                                                             │
│  LandingPage → Workspace                                    │
│    ├── LeftPanel (input, file upload, URL, sessions)        │
│    ├── GraphViewer (interactive Cytoscape visualization)     │
│    ├── ChatBot (streaming RAG Q&A)                          │
│    ├── ExecutionPipeline (step-by-step pipeline display)     │
│    ├── AnalyticsPanel (graph metrics & centrality)           │
│    ├── ResolutionPanel (entity deduplication)                │
│    ├── NodeDetailPanel (node inspection & editing)           │
│    └── ExportMenu (JSON, GEXF, CSV export)                  │
└──────────────────────┬──────────────────────────────────────┘
                       │  Vite dev proxy → localhost:8000
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                        Backend                              │
│                  FastAPI + Uvicorn                           │
│                                                             │
│  POST /generate-graph ─→ Parsers/Scrapers                   │
│           │                  ├── PDF  (PyMuPDF)             │
│           │                  ├── DOCX (python-docx)         │
│           │                  ├── CSV  (stdlib)              │
│           │                  ├── TXT  (plain text)          │
│           │                  └── URL  (BeautifulSoup)       │
│           ▼                                                 │
│  LLMGraphTransformer (LangChain + Gemini 2.5 Flash)        │
│           │                                                 │
│           ▼                                                 │
│  NetworkX MultiDiGraph ←→ GraphStore (in-memory)            │
│           │                     ├── node embeddings         │
│           │                     └── Cytoscape elements      │
│           ▼                                                 │
│  POST /chat-stream ─→ RAG Pipeline                          │
│    1. Query Reformulation (Gemini)                          │
│    2. Embedding Search (Vertex AI text-embedding-004)       │
│    3. Beam Search Graph Traversal                           │
│    4. Context Assembly                                      │
│    5. LLM Answer Generation (Gemini, streaming)             │
└─────────────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer          | Technology                                             |
| -------------- | ------------------------------------------------------ |
| **Frontend**   | React 19, TypeScript, Vite 7                           |
| **Graph UI**   | Cytoscape.js, cytoscape-fcose (force-directed layout)  |
| **Animations** | anime.js                                               |
| **Markdown**   | react-markdown, remark-gfm                             |
| **Backend**    | FastAPI, Uvicorn, Pydantic                             |
| **LLM**        | Google Vertex AI — Gemini 2.5 Flash                    |
| **Embeddings** | Vertex AI text-embedding-004                           |
| **Graph**      | NetworkX (MultiDiGraph)                                |
| **NLP**        | LangChain (LLMGraphTransformer, prompt templates)      |
| **Parsing**    | PyMuPDF (PDF), python-docx (DOCX), BeautifulSoup (URL) |
| **Storage**    | Local JSON files (sessions & conversation memory)      |

---

## Project Structure

```
KnowledgeGraphsAIAgents/
├── README.md
├── .gitignore
├── conversation_memory.example.json   # Example conversation memory format
│
├── backend/
│   ├── main.py                        # FastAPI application (primary backend)
│   ├── graph_creator.py               # LLM → NetworkX graph conversion
│   ├── parsers.py                     # Document parsers (PDF, DOCX, CSV, TXT)
│   ├── scrapers.py                    # URL scraping with BeautifulSoup
│   ├── pyproject.toml                 # Python project config & dependencies
│   ├── requirements.txt               # Pip-compatible dependency list
│   ├── uv.lock                        # uv lockfile
│   └── sessions/                      # Saved graph sessions (JSON)
│       └── *.json
│
├── frontend/
│   ├── package.json                   # Node.js dependencies & scripts
│   ├── vite.config.ts                 # Vite config with API proxy rules
│   ├── tsconfig.json                  # TypeScript configuration
│   ├── index.html                     # HTML entry point
│   ├── public/                        # Static assets
│   └── src/
│       ├── main.tsx                   # React entry point
│       ├── App.tsx                    # Root component (Landing → Workspace)
│       ├── api/
│       │   └── graphApi.ts            # API client & TypeScript interfaces
│       ├── components/
│       │   ├── LandingPage.tsx        # Animated landing page
│       │   ├── Workspace.tsx          # Main workspace layout
│       │   ├── LeftPanel.tsx          # Input panel (text, files, URL)
│       │   ├── RightPanel.tsx         # Side panel container
│       │   ├── GraphViewer.tsx        # Cytoscape graph renderer
│       │   ├── ChatBot.tsx            # Streaming chat interface
│       │   ├── ExecutionPipeline.tsx  # RAG pipeline step visualization
│       │   ├── SessionPanel.tsx       # Save/load/delete sessions
│       │   ├── ResolutionPanel.tsx    # Entity resolution UI
│       │   ├── AnalyticsPanel.tsx     # Graph analytics display
│       │   ├── NodeDetailPanel.tsx    # Node inspection & editing
│       │   ├── ExportMenu.tsx         # Graph export options
│       │   ├── GraphLegend.tsx        # Node type legend
│       │   └── GraphStats.tsx         # Graph statistics summary
│       ├── hooks/
│       │   └── useAnime.ts            # anime.js React hook
│       └── styles/
│           └── global.css             # Global styles
│
├── main.py                            # Root-level backend (lightweight version)
├── graph_creator.py                   # Root-level graph creator
├── index.html                         # Standalone HTML frontend (legacy)
├── pyproject.toml                     # Root Python project config
├── requirements.txt                   # Root dependency list
└── uv.lock                            # Root uv lockfile
```

> **Note:** The `backend/` directory contains the full-featured backend. The root-level `main.py` is a lighter variant that uses `sentence-transformers` for embeddings instead of Vertex AI and lacks entity resolution, graph editing, sessions, and analytics.

---

## Prerequisites

- **Python** >= 3.14
- **Node.js** >= 18 (with npm)
- **uv** — Fast Python package manager ([install guide](https://docs.astral.sh/uv/getting-started/installation/))
- **Google Cloud Service Account** — A JSON key file with access to Vertex AI APIs (Gemini and text-embedding-004)

---

## Getting Started

### Backend Setup

1. **Clone the repository:**

   ```bash
   git clone <repository-url>
   cd KnowledgeGraphsAIAgents
   ```

2. **Configure Google Cloud credentials:**

   Place your Google Cloud service account JSON key file in a known location and update the path in `backend/main.py` and `backend/graph_creator.py`:

   ```python
   os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = r"<path-to-your-service-account.json>"
   ```

   Alternatively, set the environment variable directly:

   ```bash
   export GOOGLE_APPLICATION_CREDENTIALS="/path/to/service_account.json"
   ```

3. **Create a `.env` file** in the project root (optional, loaded by `python-dotenv`):

   ```env
   GOOGLE_APPLICATION_CREDENTIALS=/path/to/service_account.json
   ```

4. **Install dependencies and run:**

   ```bash
   cd backend
   uv init
   uv sync
   uv run python main.py
   ```

   Or with pip:

   ```bash
   cd backend
   pip install -r requirements.txt
   python main.py
   ```

   The backend starts at **http://localhost:8000**.

### Frontend Setup

1. **Install dependencies:**

   ```bash
   cd frontend
   npm install
   ```

2. **Start the development server:**

   ```bash
   npm run dev
   ```

   The frontend starts at **http://localhost:5173** and proxies all API requests to the backend at `localhost:8000`.

3. **Build for production:**

   ```bash
   npm run build
   npm run preview
   ```

---

## Configuration

| Variable                         | Description                                    | Required |
| -------------------------------- | ---------------------------------------------- | -------- |
| `GOOGLE_APPLICATION_CREDENTIALS` | Path to Google Cloud service account JSON key   | Yes      |

The backend uses two Vertex AI models:

| Model                      | Purpose                                               |
| -------------------------- | ----------------------------------------------------- |
| `gemini-2.5-flash`         | Graph extraction, query reformulation, answer generation |
| `text-embedding-004`       | Node embeddings and query embedding for retrieval      |

---

## API Reference

### Graph Generation

| Method | Endpoint           | Description                                        |
| ------ | ------------------ | -------------------------------------------------- |
| POST   | `/generate-graph`  | Create a knowledge graph from text, files, or a URL |

**Parameters** (multipart form data):
- `text` (string, optional) — Raw text input
- `files` (file[], optional) — Upload TXT, PDF, DOCX, or CSV files
- `url` (string, optional) — URL to scrape
- `mode` (`replace` | `merge`) — Replace existing graph or merge into it

### Chat

| Method | Endpoint        | Description                                      |
| ------ | --------------- | ------------------------------------------------ |
| POST   | `/chat`         | Non-streaming chat response                      |
| POST   | `/chat-stream`  | Streaming SSE response with pipeline steps       |

**Request body:** `{ "message": "your question" }`

**SSE event types** (`/chat-stream`):
- `step` — Pipeline step status update (reformulation, embedding, traversal, generation)
- `token` — Individual token from the LLM response
- `traversal_seeds` — Initial seed nodes found via embedding similarity
- `traversal_hop` — Frontier nodes discovered at each hop
- `result` — Final complete answer with highlighted nodes
- `error` — Error message

### Entity Resolution

| Method | Endpoint             | Description                                   |
| ------ | -------------------- | --------------------------------------------- |
| GET    | `/resolve-entities`  | Find duplicate entity candidates (similarity >= threshold) |
| POST   | `/merge-entities`    | Merge specified entity pairs                  |

### Graph Editing

| Method | Endpoint              | Description          |
| ------ | --------------------- | -------------------- |
| POST   | `/nodes`              | Add a new node       |
| PATCH  | `/nodes/{node_id}`    | Update a node        |
| DELETE | `/nodes/{node_id}`    | Delete a node        |
| POST   | `/edges`              | Add a new edge       |
| DELETE | `/edges`              | Delete an edge       |

### Sessions

| Method | Endpoint              | Description            |
| ------ | --------------------- | ---------------------- |
| GET    | `/sessions`           | List all saved sessions |
| POST   | `/sessions`           | Save current graph as a session |
| GET    | `/sessions/{name}`    | Load a saved session   |
| DELETE | `/sessions/{name}`    | Delete a saved session |

### Analytics & Export

| Method | Endpoint      | Description                                                  |
| ------ | ------------- | ------------------------------------------------------------ |
| GET    | `/analytics`  | Graph metrics (degree, betweenness, PageRank, communities, clustering) |
| GET    | `/export`     | Export graph (format: `json`, `gexf`, or `csv`)              |

---

## RAG Chat Pipeline

When a user asks a question, the system executes a multi-step retrieval-augmented generation pipeline:

1. **Query Reformulation** — A lightweight Gemini call rewrites the user's message as a standalone question, resolving pronouns and incorporating conversation context (e.g., "Where does he work?" becomes "Where does Marcus Thorne work?").

2. **Query Embedding** — The reformulated query is embedded using Vertex AI `text-embedding-004`.

3. **Seed Node Search** — Cosine similarity is computed between the query embedding and all node embeddings. Nodes above the similarity threshold (~0.35-0.40) become seed nodes.

4. **Beam Search Traversal** — Starting from seed nodes, the algorithm expands outward through the graph (2-3 hops), scoring neighbors by relevance and keeping only the top candidates at each step.

5. **Context Assembly** — The selected subgraph (nodes + edges) is serialized into a text context string for the LLM.

6. **Answer Generation** — Gemini generates an answer grounded in the graph context, streamed token-by-token to the frontend.

7. **Node Highlighting** — Nodes mentioned in the answer are identified and highlighted in the graph visualization.

All steps stream progress updates to the UI via SSE, giving the user real-time visibility into the pipeline execution.

---

## Supported Input Formats

| Format | Extension | Parser         | Description                              |
| ------ | --------- | -------------- | ---------------------------------------- |
| Text   | `.txt`    | Built-in       | Plain UTF-8 text                         |
| PDF    | `.pdf`    | PyMuPDF        | Multi-page PDF text extraction           |
| Word   | `.docx`   | python-docx    | Paragraph extraction from DOCX files     |
| CSV    | `.csv`    | Python stdlib  | Row-by-row key-value text representation |
| URL    | —         | BeautifulSoup  | Scrapes main content, strips nav/ads     |

---

## Session Management

Graph sessions are persisted as JSON files in the `backend/sessions/` directory using NetworkX's `node_link_data` serialization. Each session captures the full graph structure, node types, and metadata.

- **Save** — Serialize the current in-memory graph to a named JSON file.
- **Load** — Deserialize a saved session, restoring the graph and recomputing embeddings.
- **Delete** — Remove a saved session file.

---

## Export Formats

| Format | Description                                              |
| ------ | -------------------------------------------------------- |
| JSON   | Cytoscape-compatible JSON with nodes and edges           |
| GEXF   | Graph Exchange XML Format (compatible with Gephi)        |
| CSV    | Flat edge list with source, target, and relation columns |

---

## License

This project is proprietary. All rights reserved.
