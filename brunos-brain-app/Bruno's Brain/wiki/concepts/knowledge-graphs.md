---
type: concept
title: "Knowledge Graphs"
aliases: ["KG", "knowledge graph"]
created: 2026-04-14
updated: 2026-04-14
sources: ["[[cv-bruno-v3]]"]
tags: [ai, data-structures, knowledge-representation]
confidence: medium
---

# Knowledge Graphs

Structured representations of knowledge as networks of entities (nodes) and relationships (edges). Unlike flat documents or vector stores, knowledge graphs preserve the explicit connections between concepts, enabling relationship-aware reasoning and traversal.

## Core Properties

- **Entities and relationships** — knowledge is stored as triples (subject → predicate → object) or richer property graph structures.
- **Schema flexibility** — can represent heterogeneous knowledge domains in a single graph.
- **Traversal** — enables multi-hop reasoning: "What companies has [[bruno-manzano|Bruno]] worked at?" → "What did he build there?" → "What technologies did those projects use?"
- **Composability** — new knowledge integrates by adding nodes and edges rather than rewriting documents.

## Relevance to This Wiki

Knowledge graphs are a central theme across [[bruno-manzano|Bruno Manzano]]'s work:

- **[[de-warp]]** — uses persistent knowledge graph memory (Supabase/pgvector) to give an AI voice agent long-term, structured context.
- **Knowledge Graph Powered AI Agents** — Bruno's open-source project (github.com/pomess/KnowledgeGraphsAIAgents) for transforming unstructured data into interactive knowledge graphs. The repository that hosts this wiki.
- **Certifications** — "Knowledge Graphs for AI Agents: API Discovery" from DeepLearning.AI.
- **This wiki itself** — Bruno's Brain is, in a sense, a knowledge graph maintained in markdown: entities, concepts, and sources connected by [[wikilinks]].

## Contrast with Other Approaches

| Approach | Structure | Relationships | Maintenance |
|----------|-----------|--------------|------------|
| Flat documents | Unstructured | Implicit | Manual |
| Vector stores / [[retrieval-augmented-generation\|RAG]] | Embedded chunks | Similarity-based | Low |
| **Knowledge graphs** | Explicit entities + edges | Named, typed | Moderate to high |
| **LLM Wiki** ([[llm-wiki-idea-file]]) | Markdown pages + wikilinks | Named, LLM-maintained | LLM-automated |

The LLM Wiki pattern can be seen as a knowledge graph where pages are nodes, wikilinks are edges, and the LLM handles graph maintenance.

## Connection to AI 2027

The [[ai-2027]] scenario does not discuss knowledge graphs explicitly, but the intelligence systems it describes — AI researchers that build on prior work, maintain awareness of what's been tried, and synthesize across domains — implicitly require knowledge graph-like structures. Stateless retrieval cannot support the kind of compounding, relational reasoning depicted in the scenario.

## Open Questions

- What is the right interplay between vector similarity search and graph traversal for agent memory?
- Can knowledge graphs be automatically constructed from unstructured text with sufficient accuracy? (Bruno's KG project addresses this.)
- How does graph-structured memory scale compared to [[retrieval-augmented-generation|RAG]] for very large knowledge bases?
