---
type: entity
title: "Obsidian"
aliases: ["Obsidian.md"]
created: 2026-04-10
updated: 2026-04-10
sources: ["[[llm-wiki-idea-file]]"]
tags: [tool, software, knowledge-management]
confidence: high
---

# Obsidian

A markdown-based note-taking application that stores notes as local files. Key features include wikilinks (`[[links]]`), graph view (visual map of connections between notes), and a rich plugin ecosystem.

## Role in the LLM Wiki

Obsidian serves as the **IDE** for the LLM Wiki pattern. Per the [[llm-wiki-idea-file]]:

> Obsidian is the IDE; the LLM is the programmer; the wiki is the codebase.

The LLM writes and edits markdown files; the user browses them in Obsidian, using graph view to see the wiki's structure and following wikilinks to navigate.

## Relevant Plugins

- **Dataview** — query page frontmatter to generate dynamic tables and lists
- **Marp** — render markdown-based slide decks
- **Web Clipper** — browser extension to convert web articles into markdown source files
- **Graph View** (core) — visual map of all pages and their connections; useful for spotting orphans and hubs

## Configuration for This Wiki

- Attachment folder path set to `raw/assets/` so downloaded images stay with raw sources.
- Wikilinks enabled (not markdown links) for internal linking.
- Shortest link format for cleaner wiki references.
