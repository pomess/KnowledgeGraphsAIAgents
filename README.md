# Obsidian Knowledge Graphs

LLM-maintained personal knowledge bases stored as Obsidian vaults, with a React + FastAPI web app for chat, wiki browsing, source ingestion, and lint with auto-solve.

**Stack:** React + Vite (frontend), FastAPI (backend), Gemini 2.5 Flash (LLM)

## Repository Structure

```
├── backend/              FastAPI server
├── frontend/             React + Vite UI
├── knowledge-vaults/     Obsidian vaults (auto-discovered)
│   ├── Bruno's Brain/
│   └── Deloitte's Brain/
├── docs/
└── .gitignore
```

## Setup

### Backend

```bash
cd backend
pip install -r requirements.txt
```

Copy `.env.example` to `.env` and set your Gemini API key:

```
GEMINI_API_KEY=your-key-here
```

Brain vaults are auto-discovered from the `knowledge-vaults/` folder.

Start the server:

```bash
python main.py
```

Backend runs on `http://localhost:8000`.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs on `http://localhost:5173` with API proxy to the backend.

## Features

- **Chat** -- query the wiki with streaming responses via SSE
- **Wiki Browser** -- browse all wiki pages with rendered markdown and clickable wikilinks
- **Ingest** -- paste text or upload markdown files to trigger full wiki ingestion
- **Lint** -- run health checks on the wiki (orphans, contradictions, missing pages)

## Architecture

The app reads and writes directly to the Obsidian vault on disk. The `AGENTS.md` schema file is used as the Gemini system instruction for all operations. The `hot.md` file serves as a fast context cache.

## License

Proprietary. All rights reserved.
