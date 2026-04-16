---
type: source
title: "LLM Wiki — Idea File"
aliases: ["LLM Wiki pattern", "the idea file"]
created: 2026-04-10
updated: 2026-04-10
sources: []
tags: [meta, knowledge-management, llm, pattern]
confidence: high
---

# LLM Wiki — Idea File

**Source:** `raw/llm-wiki-idea-file.md`
**Author:** Unknown (community pattern document)
**Type:** Idea file / design document

## Summary

A design pattern for building personal knowledge bases where an LLM acts as the sole writer and maintainer of a persistent, interlinked wiki. The core insight: instead of using [[retrieval-augmented-generation|RAG]] to re-derive answers from raw documents on every query, the LLM **compiles** knowledge incrementally into a structured wiki. The wiki is a persistent, compounding artifact — cross-references are pre-built, contradictions are pre-flagged, and synthesis reflects the full history of ingested sources.

## Key Claims

1. **RAG is stateless; wikis compound.** Traditional RAG re-discovers knowledge from scratch on every question. The LLM Wiki pattern compiles knowledge once and keeps it current. Each ingest makes the wiki richer.

2. **The LLM handles all bookkeeping.** Humans abandon wikis because maintenance burden grows faster than value. LLMs eliminate this cost — they don't get bored, don't forget cross-references, and can touch 15 files in one pass.

3. **Three-layer architecture.** The system has three layers: immutable raw sources, the LLM-maintained wiki, and a schema document that defines conventions and workflows.

4. **Three core operations.** Ingest (process new sources into the wiki), Query (answer questions from compiled knowledge), and Lint (health-check for contradictions, orphans, and gaps).

5. **The index replaces RAG at moderate scale.** A well-maintained `index.md` with one-line summaries per page lets the LLM find relevant pages without embedding infrastructure. Works up to ~100 sources and hundreds of pages.

6. **Answers should be filed back.** Valuable query results — comparisons, analyses, deep dives — should be saved as wiki pages so explorations compound alongside ingested sources.

## Architecture

The document defines three layers:

| Layer | Description | Mutability |
|-------|-------------|------------|
| **Raw sources** | Curated source documents (articles, papers, images, data) | Immutable — LLM reads only |
| **Wiki** | LLM-generated markdown pages (summaries, entities, concepts, analyses, overview) | LLM-owned — creates, updates, reorganizes |
| **Schema** | Configuration document defining structure, conventions, and workflows | Co-evolved by human and LLM |

## Use Cases Identified

- **Personal** — goals, health, psychology, self-improvement over time
- **Research** — deep topic exploration over weeks/months with evolving thesis
- **Reading a book** — companion wiki for characters, themes, plot threads (cf. [[tolkien-gateway|Tolkien Gateway]])
- **Business/team** — internal wiki fed by Slack, meetings, project docs, customer calls
- **General** — competitive analysis, due diligence, trip planning, course notes, hobby deep-dives

## Tools Mentioned

- [[obsidian|Obsidian]] — the IDE for browsing the wiki, with graph view, Dataview, and Marp plugins
- **Obsidian Web Clipper** — browser extension for converting articles to markdown
- **qmd** — local search engine for markdown with hybrid BM25/vector search and LLM re-ranking
- **Marp** — markdown-based slide deck format
- **Dataview** — Obsidian plugin for querying page frontmatter
- **Git** — version history and collaboration for the markdown repo

## Intellectual Lineage

The document traces the idea to [[vannevar-bush|Vannevar Bush]]'s [[memex|Memex]] (1945) — a personal, curated knowledge store with associative trails between documents. Bush envisioned something closer to this pattern than to what the web became: private, actively curated, with connections between documents as valuable as the documents themselves. The unsolved problem was maintenance; the LLM handles that.

## Connections

- This source is the **founding document** of this wiki. The wiki itself is an instantiation of the pattern described here.
- The [[retrieval-augmented-generation|RAG]] concept page should contrast the RAG approach with the LLM Wiki approach.
- [[vannevar-bush|Vannevar Bush]] and [[memex|Memex]] deserve entity/concept pages as intellectual ancestors.
- The emphasis on compounding knowledge connects to broader ideas in [[knowledge-management]].
