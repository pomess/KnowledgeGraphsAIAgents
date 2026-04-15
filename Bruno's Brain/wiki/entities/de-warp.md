---
type: entity
title: "de-warp"
aliases: ["dewarp", "de-warp.com"]
created: 2026-04-14
updated: 2026-04-14
sources: ["[[cv-bruno-v3]]"]
tags: [project, product, ai-agent]
confidence: high
---

# de-warp

Real-time AI voice agent built by [[bruno-manzano|Bruno Manzano]]. Active since January 2026. Available at de-warp.com.

## Architecture

- **Voice interface:** Gemini Live API for real-time voice interaction.
- **Agent framework:** LangChain Deep Agents.
- **Memory:** Persistent [[knowledge-graphs|knowledge graph]] memory using Supabase + pgvector.
- **Research:** Deep research engine with 5 parallel sub-agents.
- **Backend:** FastAPI.
- **Frontend:** React 19.
- **Latency:** <500 ms end-to-end.

## Significance

de-warp combines several concepts that appear throughout this wiki:

- **[[agentic-workflows]]** — autonomous multi-agent system with parallel sub-agents.
- **[[knowledge-graphs]]** — persistent graph memory rather than stateless [[retrieval-augmented-generation|RAG]].
- **[[knowledge-management]]** — the knowledge graph serves as a persistent, compounding knowledge store, echoing the [[llm-wiki-idea-file|LLM Wiki pattern]] at the application level.

The project represents Bruno's most ambitious personal build — a production system that integrates voice, agents, knowledge graphs, and real-time search into a single product.
