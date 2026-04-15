---
type: concept
title: "Memex"
aliases: ["the Memex", "Bush's Memex"]
created: 2026-04-10
updated: 2026-04-10
sources: ["[[llm-wiki-idea-file]]"]
tags: [concept, computer-science-history, knowledge-management, visionary]
confidence: medium
---

# Memex

A hypothetical personal knowledge device proposed by [[vannevar-bush|Vannevar Bush]] in his 1945 essay "As We May Think." The Memex was envisioned as a desk-sized machine where an individual could store all their books, records, and communications, and consult them with speed and flexibility via associative trails — user-created links between related documents.

## Core Properties

- **Personal and private.** Not a shared network; a curated, individual knowledge store.
- **Associative trails.** The user builds named trails connecting related items. The connections are as valuable as the documents themselves.
- **Actively curated.** The user is responsible for building and maintaining the trails.

## Connection to the LLM Wiki

The [[llm-wiki-idea-file]] identifies the LLM Wiki pattern as a modern realization of Bush's vision. The parallels:

| Memex | LLM Wiki |
|-------|----------|
| Personal document store | `raw/` — immutable source collection |
| Associative trails | `[[wikilinks]]` — cross-references between pages |
| Active curation by the user | Active maintenance by the LLM |

The critical difference: Bush couldn't solve the maintenance problem. Who builds and updates all the trails? In the LLM Wiki, the LLM handles this — the cost of maintenance is near zero.

## Open Questions

- Bush imagined the *user* building trails. Does something important get lost when the LLM builds them instead? Does the act of manual cross-referencing deepen understanding in a way that delegation does not?
