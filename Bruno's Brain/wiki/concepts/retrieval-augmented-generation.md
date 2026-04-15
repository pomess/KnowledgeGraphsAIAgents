---
type: concept
title: "Retrieval-Augmented Generation (RAG)"
aliases: ["RAG"]
created: 2026-04-10
updated: 2026-04-14
sources: ["[[llm-wiki-idea-file]]", "[[ai-2027]]", "[[cv-bruno-v3]]"]
tags: [llm, ai, information-retrieval]
confidence: medium
---

# Retrieval-Augmented Generation (RAG)

A technique where an LLM retrieves relevant document chunks at query time and generates an answer grounded in those chunks. The dominant paradigm for LLM-powered document Q&A as of 2024–2026.

## How It Works

1. Documents are split into chunks and embedded into a vector store.
2. At query time, the user's question is embedded and matched against stored chunks.
3. The most relevant chunks are passed to the LLM as context.
4. The LLM generates an answer grounded in the retrieved context.

## Strengths

- Simple to set up with existing tooling (LangChain, LlamaIndex, etc.).
- Works well for factoid retrieval from large document collections.
- No persistent state to maintain.

## Limitations (per [[llm-wiki-idea-file]])

- **Stateless.** The LLM re-discovers knowledge from scratch on every question. There is no accumulation.
- **No synthesis.** Subtle questions requiring synthesis across multiple documents force the LLM to find and piece together fragments every time.
- **No cross-referencing.** Connections between documents are not pre-built; they must be rediscovered per query.
- **No contradiction detection.** Conflicting claims across documents are not flagged proactively.

## Contrast with LLM Wiki

The [[llm-wiki-idea-file|LLM Wiki pattern]] is explicitly positioned as an alternative to RAG. Where RAG retrieves and re-derives, the LLM Wiki compiles and compounds. The wiki pre-builds the synthesis, cross-references, and contradiction flags that RAG must reconstruct on every query.

At moderate scale (~100 sources), the LLM Wiki avoids RAG infrastructure entirely by using a curated [[index]] as a lookup table.

## Connection to AI 2027

The [[ai-2027]] scenario implicitly demonstrates RAG's limitations at civilizational scale. When the scenario discusses AI systems that need to "search the Internet" or "scour the Internet to answer your question," these are essentially RAG-like retrieval patterns. But the scenario's most consequential knowledge work — building on prior research, synthesizing across domains, maintaining awareness of what's been tried — requires the kind of persistent, compiled knowledge that RAG cannot provide. This mirrors the core argument of the [[llm-wiki-idea-file]].

## Practitioner Perspective

[[bruno-manzano|Bruno Manzano]] holds a DeepLearning.AI certification in RAG and uses pgvector-based retrieval in his [[de-warp]] project. However, both of his active projects (de-warp and Knowledge Graph Powered AI Agents) push beyond pure RAG toward persistent [[knowledge-graphs|knowledge graph]] memory — suggesting that practitioners working at the frontier view RAG as a foundation to build on rather than a final architecture. This aligns with the LLM Wiki's position that stateless retrieval is insufficient for compounding knowledge.

## Open Questions

- At what scale does a pure index-based approach break down, requiring hybrid search (e.g., qmd)?
- Can RAG and the wiki pattern be combined — e.g., RAG over raw sources as a fallback when wiki pages are insufficient?
- What is the right interplay between vector similarity (RAG) and graph traversal ([[knowledge-graphs]]) for agent memory?
