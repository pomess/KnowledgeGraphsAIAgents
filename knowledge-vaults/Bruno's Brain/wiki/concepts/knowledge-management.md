---
type: concept
title: "Knowledge Management"
aliases: ["KM", "personal knowledge management", "PKM"]
created: 2026-04-10
updated: 2026-04-14
sources: ["[[llm-wiki-idea-file]]", "[[ai-2027]]", "[[cv-bruno-v3]]"]
tags: [concept, meta, productivity]
confidence: medium
---

# Knowledge Management

The practice of organizing, maintaining, and retrieving knowledge over time. In the personal context (PKM), it encompasses note-taking systems, wikis, zettelkasten, read-it-later tools, and knowledge bases.

## The Core Problem

Knowledge management systems tend to fail because **maintenance burden grows faster than value**. The more notes you take, the harder it becomes to keep them organized, cross-referenced, and current. Most people eventually abandon their systems.

## Approaches

| Approach | Maintenance Model | Compounding? |
|----------|------------------|-------------|
| Flat notes (Apple Notes, Google Docs) | Manual, minimal structure | No |
| Zettelkasten (Obsidian, Roam) | Manual, high-effort linking | Somewhat — but maintenance burden grows |
| RAG (NotebookLM, ChatGPT uploads) | None — stateless retrieval | No — re-derives on every query |
| **LLM Wiki** | LLM-automated | **Yes — near-zero maintenance cost** |

## The LLM Wiki Contribution

Per the [[llm-wiki-idea-file]], the LLM Wiki pattern solves the core PKM failure mode by **offloading all maintenance to the LLM**. The human curates sources and asks questions; the LLM does the summarizing, cross-referencing, filing, and bookkeeping. The wiki compounds because maintenance is free.

This positions the LLM Wiki as potentially the first PKM system that actually scales — the value grows with every source while the human cost stays constant.

## Related Concepts

- [[memex]] — the earliest vision of personal knowledge management (1945)
- [[retrieval-augmented-generation]] — the dominant but stateless alternative
- [[vannevar-bush]] — the originator of personal knowledge store concepts

## AI-Accelerated Knowledge Work

The [[ai-2027]] scenario depicts knowledge management at civilizational scale — AI systems that produce research faster than humans can review it, where "most of the humans at OpenBrain can't usefully contribute anymore." This raises a profound question: if AI generates knowledge faster than humans can absorb it, who is the knowledge *for*? The LLM Wiki pattern offers one answer: the wiki becomes the shared substrate between human and AI, a persistent artifact that both can read and build on.

## The Wiki Owner's Approach

[[bruno-manzano|Bruno Manzano]]'s own trajectory illustrates the knowledge management problem and its emerging solutions. His two active projects — [[de-warp]] (persistent knowledge graph memory for an AI voice agent) and Knowledge Graph Powered AI Agents (turning unstructured data into interactive [[knowledge-graphs|knowledge graphs]]) — both attack the maintenance problem from the [[knowledge-graphs|graph]] side. This wiki itself represents a third approach: the [[llm-wiki-idea-file|LLM Wiki pattern]], where an LLM agent handles the maintenance burden. Together, these projects suggest that the frontier of knowledge management is converging on AI-maintained, graph-structured, compounding systems.

## Open Questions

- Does the LLM Wiki pattern work equally well for all PKM use cases, or does it favor some (research, reading) over others (journaling, creative work)?
- What is the right level of human involvement? Fully automated ingest vs. interactive, guided ingest?
- If AI systems begin producing knowledge faster than humans can review it (as depicted in [[ai-2027]]), how should personal knowledge systems adapt?
- How do the three approaches — LLM Wiki, knowledge graph memory, and RAG — best combine in practice?
