# Bruno's Brain Web App

A full-stack web application for managing the Bruno's Brain LLM Wiki knowledge base.

**Stack:** React + Vite (frontend), FastAPI (backend), Gemini 2.5 Flash (LLM)

## Setup

### 1. Backend

```bash
cd backend
pip install -r requirements.txt
```

Edit `.env` and set your Gemini API key:

```
GEMINI_API_KEY=your-key-here
```

Brain vaults (e.g. `Bruno's Brain/`, `Deloitte's Brain/`) are auto-discovered as sibling folders of `backend/`.

Start the server:

```bash
python main.py
```

Backend runs on `http://localhost:8000`.

### 2. Frontend

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
