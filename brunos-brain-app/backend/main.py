from fastapi import FastAPI, UploadFile, File, Form, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from dotenv import load_dotenv
from pathlib import Path
import json
import os

load_dotenv()

from vault import VaultManager
from gemini_client import GeminiClient
from wiki_agent import WikiAgent


BRAIN_MARKERS = {"wiki", "AGENTS.md", "hot.md", "index.md"}

def _discover_brains() -> dict[str, str]:
    workspace = Path(__file__).resolve().parent.parent.parent
    brains: dict[str, str] = {}
    for entry in sorted(workspace.iterdir()):
        if not entry.is_dir() or entry.name.startswith("."):
            continue
        children = {c.name for c in entry.iterdir()} if entry.is_dir() else set()
        if children & BRAIN_MARKERS:
            brains[entry.name] = str(entry)
    return brains


class BrainRegistry:
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.brain_paths = _discover_brains()
        self._cache: dict[str, tuple[VaultManager, GeminiClient, WikiAgent]] = {}

    def refresh(self):
        self.brain_paths = _discover_brains()

    def list_brains(self) -> list[dict]:
        return [
            {"id": name, "name": name, "path": path}
            for name, path in self.brain_paths.items()
        ]

    def default_brain(self) -> str | None:
        if not self.brain_paths:
            return None
        return next(iter(self.brain_paths))

    def get(self, brain_name: str) -> tuple[VaultManager, GeminiClient, WikiAgent]:
        if brain_name not in self.brain_paths:
            raise HTTPException(status_code=404, detail=f"Brain '{brain_name}' not found")
        if brain_name not in self._cache:
            vault = VaultManager(self.brain_paths[brain_name])
            gemini = GeminiClient(
                api_key=self.api_key,
                vault=vault,
                brain_name=brain_name,
            )
            agent = WikiAgent(vault=vault, gemini=gemini)
            self._cache[brain_name] = (vault, gemini, agent)
        return self._cache[brain_name]


app = FastAPI(title="Knowledge Brains")
registry = BrainRegistry(api_key=os.getenv("GEMINI_API_KEY", ""))

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _resolve(brain: str | None) -> tuple[VaultManager, GeminiClient, WikiAgent]:
    name = brain or registry.default_brain()
    if not name:
        raise HTTPException(status_code=400, detail="No brains found")
    return registry.get(name)


class ChatRequest(BaseModel):
    message: str
    history: list[dict] = []
    brain: str | None = None


class IngestTextRequest(BaseModel):
    title: str
    content: str


class SolveRequest(BaseModel):
    issue: dict


# --- Brains ---

@app.get("/api/brains")
async def list_brains():
    registry.refresh()
    return {"brains": registry.list_brains(), "default": registry.default_brain()}


# --- Chat ---

@app.post("/api/chat")
async def chat(req: ChatRequest):
    vault, gemini, agent = _resolve(req.brain)

    async def stream():
        async for chunk in agent.query(req.message, req.history):
            yield f"data: {json.dumps(chunk)}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(stream(), media_type="text/event-stream")


# --- Ingest ---

@app.post("/api/ingest/text")
async def ingest_text(req: IngestTextRequest, brain: str | None = Query(None)):
    vault, gemini, agent = _resolve(brain)
    result = await agent.ingest_text(req.title, req.content)
    return result


@app.post("/api/ingest/file")
async def ingest_file(file: UploadFile = File(...), brain: str | None = Query(None)):
    vault, gemini, agent = _resolve(brain)
    content = (await file.read()).decode("utf-8")
    title = file.filename or "untitled"
    if title.endswith(".md"):
        title = title[:-3]
    result = await agent.ingest_text(title, content)
    return result


# --- Lint ---

@app.post("/api/lint")
async def lint(brain: str | None = Query(None)):
    vault, gemini, agent = _resolve(brain)
    result = await agent.lint()
    return result


@app.post("/api/lint/solve")
async def solve_issue(req: SolveRequest, brain: str | None = Query(None)):
    vault, gemini, agent = _resolve(brain)
    result = await agent.solve_issue(req.issue)
    return result


# --- Wiki browsing ---

@app.get("/api/wiki/hot")
async def get_hot(brain: str | None = Query(None)):
    vault, gemini, agent = _resolve(brain)
    content = vault.read_file("hot.md")
    return {"content": content}


@app.get("/api/wiki/pages")
async def list_pages(brain: str | None = Query(None)):
    vault, gemini, agent = _resolve(brain)
    pages = vault.list_pages()
    return {"pages": pages}


@app.get("/api/wiki/page/{path:path}")
async def get_page(path: str, brain: str | None = Query(None)):
    vault, gemini, agent = _resolve(brain)
    content = vault.read_file(path)
    if content is None:
        return {"error": "Page not found"}
    fm = vault.parse_frontmatter(content)
    return {"content": content, "frontmatter": fm}


@app.get("/api/wiki/graph")
async def get_graph(brain: str | None = Query(None)):
    vault, gemini, agent = _resolve(brain)
    graph = vault.get_graph()
    return graph


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
