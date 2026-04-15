---
type: concept
title: "Agentic Workflows"
aliases: ["agentic AI", "AI agents", "autonomous agents"]
created: 2026-04-14
updated: 2026-04-15
sources: ["[[cv-bruno-v3]]"]
tags: [ai, agents, architecture]
confidence: medium
---

# Agentic Workflows

Software architectures where AI models operate as autonomous agents — planning, using tools, making decisions, and executing multi-step tasks with minimal human intervention. Distinguished from simple prompt-response LLM usage by the presence of loops, tool use, memory, and goal-directed behavior.

## Core Characteristics

- **Autonomy** — the agent decides what steps to take, not just what to say.
- **Tool use** — agents call external APIs, databases, code interpreters, and other services.
- **Planning** — decomposing complex goals into subtasks.
- **Memory** — maintaining state across interactions (short-term working memory and long-term persistent stores).
- **Multi-agent coordination** — multiple specialized agents collaborating on a task (e.g., [[de-warp]]'s 5 parallel sub-agents).

## Relevance

[[bruno-manzano|Bruno Manzano]]'s current work at [[deloitte|Deloitte]] centers on building autonomous AI agents and transitioning proof-of-concepts to production-ready agentic workflows. His [[de-warp]] project is a concrete implementation: a multi-agent system with voice interface, [[knowledge-graphs|knowledge graph]] memory, and parallel research sub-agents.

## Connection to Other Concepts

- **[[intelligence-explosion]]** — the AI 2027 scenario depicts agentic AI systems that automate AI research itself, creating a compounding feedback loop. Agentic workflows are the operational mechanism through which [[artificial-general-intelligence|AGI]] and then [[artificial-superintelligence|ASI]] unfolds.
- **[[knowledge-graphs]]** — persistent graph memory is one approach to giving agents long-term context beyond stateless [[retrieval-augmented-generation|RAG]].
- **[[knowledge-management]]** — this wiki itself is an agentic workflow: an LLM agent that maintains a knowledge base through tool use (file operations), planning (ingest workflow), and memory (the wiki pages themselves).

## Open Questions

- What is the right boundary between agent autonomy and human oversight in production deployments?
- How do agentic workflows scale when the agent's knowledge graph grows very large?
- What are the alignment implications of increasingly autonomous agent systems (echoing [[ai-alignment]] concerns)?