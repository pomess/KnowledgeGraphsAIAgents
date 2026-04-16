import re
import json
from datetime import date
from typing import AsyncIterator

from vault import VaultManager
from gemini_client import GeminiClient


def _extract_json(raw: str) -> dict:
    """Robustly extract a JSON object from an LLM response that may contain
    markdown fences, preamble text, or trailing commentary."""
    text = raw.strip()

    # Strip markdown code fences (```json ... ``` or ``` ... ```)
    fence_match = re.search(r"```(?:json)?\s*\n?(.*?)```", text, re.DOTALL)
    if fence_match:
        text = fence_match.group(1).strip()

    # Try direct parse first
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # Find the outermost { ... } in the text
    start = text.find("{")
    if start == -1:
        raise json.JSONDecodeError("No JSON object found", text, 0)

    depth = 0
    in_string = False
    escape = False
    for i in range(start, len(text)):
        ch = text[i]
        if escape:
            escape = False
            continue
        if ch == "\\":
            escape = True
            continue
        if ch == '"':
            in_string = not in_string
            continue
        if in_string:
            continue
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                try:
                    return json.loads(text[start : i + 1])
                except json.JSONDecodeError:
                    break

    raise json.JSONDecodeError("Could not extract valid JSON object", text[:200], 0)


class WikiAgent:
    def __init__(self, vault: VaultManager, gemini: GeminiClient):
        self.vault = vault
        self.gemini = gemini
        self.brain_name = getattr(gemini, "brain_name", "Knowledge Base")

    def _gather_context(self, message: str) -> str:
        """Read index.md, then load pages that seem relevant to the query.
        hot.md is already in the system prompt — no need to duplicate it here."""
        index = self.vault.read_file("index.md") or ""
        context_parts = [f"# index.md\n{index}"]

        pages = self.vault.list_pages()
        msg_lower = message.lower()

        for page in pages:
            score = 0
            title_lower = (page.get("title") or "").lower()
            slug_lower = (page.get("slug") or "").lower()
            tags = [t.lower() for t in (page.get("tags") or [])]

            for word in msg_lower.split():
                if len(word) < 3:
                    continue
                if word in title_lower or word in slug_lower:
                    score += 3
                for tag in tags:
                    if word in tag:
                        score += 2

            if score >= 3:
                content = self.vault.read_file(page["path"])
                if content:
                    context_parts.append(
                        f"# {page['path']}\n{content[:4000]}"
                    )

        return "\n\n---\n\n".join(context_parts)

    async def query(self, message: str, history: list[dict]) -> AsyncIterator[str]:
        context = self._gather_context(message)
        async for chunk in self.gemini.stream(message, context=context, history=history):
            yield chunk

    async def ingest_text(self, title: str, content: str) -> dict:
        slug = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")
        raw_path = f"raw/{slug}.md"
        self.vault.write_file(raw_path, content)

        hot = self.vault.read_file("hot.md") or ""
        index = self.vault.read_file("index.md") or ""
        overview = self.vault.read_file("wiki/overview.md") or ""

        existing_pages = self.vault.list_pages()
        existing_list = "\n".join(
            f"- {p['path']} ({p['type']}): {p['title']}"
            for p in existing_pages
        )

        prompt = f"""You are the wiki agent for {self.brain_name}. A new source has been added to raw/{slug}.md.

CURRENT STATE:
- hot.md: {hot}
- index.md: {index}
- Existing pages:
{existing_list}

SOURCE TITLE: {title}
SOURCE CONTENT:
{content[:12000]}

YOUR TASK: Perform a full ingest per the AGENTS.md schema. Return a JSON object with this exact structure:
{{
  "source_summary": {{
    "path": "wiki/sources/{slug}.md",
    "content": "full markdown content with frontmatter for the source summary page"
  }},
  "new_pages": [
    {{
      "path": "wiki/concepts/example.md or wiki/entities/example.md",
      "content": "full markdown content with frontmatter"
    }}
  ],
  "updated_pages": [
    {{
      "path": "wiki/concepts/existing-page.md",
      "content": "full updated markdown content"
    }}
  ],
  "index_md": "full updated index.md content",
  "log_entry": "the log entry to append (## [date] ingest | Title ...)",
  "hot_md": "full updated hot.md content",
  "overview_md": "full updated wiki/overview.md content",
  "summary": "brief human-readable summary of what was done"
}}

Return ONLY valid JSON. No markdown fences. Today's date is {date.today().isoformat()}.
Create entity and concept pages for the most important entities and concepts in the source.
Update existing pages if the source adds information relevant to them.
Follow all AGENTS.md conventions for frontmatter, filenames, wikilinks, and writing style."""

        raw_response = await self.gemini.generate(prompt, json_mode=True)

        try:
            result = _extract_json(raw_response)
        except json.JSONDecodeError:
            return {
                "success": False,
                "error": "Failed to parse LLM response as JSON",
                "raw_response": raw_response[:2000],
            }

        pages_touched = []

        if "source_summary" in result:
            ss = result["source_summary"]
            self.vault.write_file(ss["path"], ss["content"])
            pages_touched.append(ss["path"])

        for page in result.get("new_pages", []):
            self.vault.write_file(page["path"], page["content"])
            pages_touched.append(page["path"])

        for page in result.get("updated_pages", []):
            self.vault.write_file(page["path"], page["content"])
            pages_touched.append(page["path"])

        if "index_md" in result:
            self.vault.write_file("index.md", result["index_md"])

        if "hot_md" in result:
            self.vault.write_file("hot.md", result["hot_md"])

        if "overview_md" in result:
            self.vault.write_file("wiki/overview.md", result["overview_md"])

        if "log_entry" in result:
            existing_log = self.vault.read_file("log.md") or "# Log\n"
            self.vault.write_file("log.md", existing_log + "\n" + result["log_entry"] + "\n")

        return {
            "success": True,
            "pages_touched": pages_touched,
            "summary": result.get("summary", f"Ingested: {title}"),
        }

    async def lint(self) -> dict:
        pages = self.vault.list_pages()
        index = self.vault.read_file("index.md") or ""
        hot = self.vault.read_file("hot.md") or ""

        all_pages_content = []
        all_links = set()
        all_slugs = {p["slug"] for p in pages}

        for page in pages:
            content = self.vault.read_file(page["path"])
            if content:
                all_pages_content.append(f"## {page['path']}\n{content[:2000]}")
                links = self.vault.parse_wikilinks(content)
                for link in links:
                    target = link.lower().replace(" ", "-")
                    if "/" in target:
                        target = target.split("/")[-1]
                    all_links.add(target)

        missing_pages = [l for l in all_links if l not in all_slugs and l not in ("index", "log")]

        orphans = []
        inbound = set()
        for page in pages:
            content = self.vault.read_file(page["path"])
            if content:
                for link in self.vault.parse_wikilinks(content):
                    target = link.lower().replace(" ", "-")
                    if "/" in target:
                        target = target.split("/")[-1]
                    inbound.add(target)
        for page in pages:
            if page["slug"] not in inbound and page["type"] != "overview":
                orphans.append(page["slug"])

        pages_summary = "\n".join(all_pages_content[:30])

        prompt = f"""You are the wiki agent for {self.brain_name}. Perform a lint check.

CURRENT STATE:
- hot.md: {hot}
- index.md: {index}
- Total pages: {len(pages)}
- Missing pages (linked but don't exist): {json.dumps(missing_pages[:20])}
- Orphan pages (no inbound links): {json.dumps(orphans[:20])}

PAGE CONTENTS (truncated):
{pages_summary[:8000]}

Check for:
1. Contradictions between pages
2. Stale content superseded by newer sources
3. Orphan pages with no inbound links
4. Missing pages (concepts/entities linked but no page exists)
5. Sparse pages that could be expanded
6. Missing cross-references
7. Index drift (pages that exist but aren't in index.md)
8. Data gaps

Return a JSON object:
{{
  "issues": [
    {{
      "type": "contradiction|stale|orphan|missing_page|sparse|missing_xref|index_drift|data_gap",
      "severity": "high|medium|low",
      "description": "what the issue is",
      "page": "affected page slug or path",
      "suggestion": "how to fix it"
    }}
  ],
  "summary": "brief overall health assessment",
  "stats": {{
    "total_pages": {len(pages)},
    "orphans": {len(orphans)},
    "missing_pages": {len(missing_pages)}
  }}
}}

Return ONLY valid JSON. No markdown fences."""

        raw_response = await self.gemini.generate(prompt, json_mode=True)

        try:
            result = _extract_json(raw_response)
        except json.JSONDecodeError:
            return {
                "issues": [],
                "summary": "Lint completed but failed to parse structured results.",
                "raw": raw_response[:2000],
                "stats": {
                    "total_pages": len(pages),
                    "orphans": len(orphans),
                    "missing_pages": len(missing_pages),
                },
            }

        return result

    async def solve_issue(self, issue: dict) -> dict:
        issue_type = issue.get("type", "unknown")
        page_slug = issue.get("page", "")
        description = issue.get("description", "")
        suggestion = issue.get("suggestion", "")
        severity = issue.get("severity", "medium")

        hot = self.vault.read_file("hot.md") or ""
        index = self.vault.read_file("index.md") or ""
        overview = self.vault.read_file("wiki/overview.md") or ""

        existing_pages = self.vault.list_pages()
        existing_list = "\n".join(
            f"- {p['path']} ({p['type']}): {p['title']}"
            for p in existing_pages
        )

        affected_content = ""
        slug_normalized = page_slug.lower().replace(" ", "-")
        if "/" in slug_normalized:
            slug_normalized = slug_normalized.split("/")[-1]
        for p in existing_pages:
            if p["slug"] == slug_normalized:
                affected_content = self.vault.read_file(p["path"]) or ""
                break

        related_contents = []
        for p in existing_pages:
            content = self.vault.read_file(p["path"])
            if content and f"[[{slug_normalized}" in content.lower():
                related_contents.append(f"## {p['path']}\n{content[:3000]}")
        related_context = "\n\n".join(related_contents[:5])

        prompt = f"""You are the wiki agent for {self.brain_name}. Fix the following lint issue.

ISSUE:
- Type: {issue_type}
- Severity: {severity}
- Page: {page_slug}
- Description: {description}
- Suggestion: {suggestion}

CURRENT STATE:
- hot.md: {hot}
- index.md: {index}
- Existing pages:
{existing_list}

{"AFFECTED PAGE CONTENT:" + chr(10) + affected_content[:4000] if affected_content else "The affected page does NOT exist yet — you need to create it."}

RELATED PAGES (pages that link to {page_slug}):
{related_context[:6000] if related_context else "No pages currently link to this slug."}

YOUR TASK: Fix this specific issue. Return a JSON object:
{{
  "new_pages": [
    {{
      "path": "wiki/concepts/slug.md or wiki/entities/slug.md",
      "content": "full markdown content with YAML frontmatter"
    }}
  ],
  "updated_pages": [
    {{
      "path": "wiki/concepts/existing-page.md",
      "content": "full updated markdown content"
    }}
  ],
  "index_md": "full updated index.md content",
  "log_entry": "## [{date.today().isoformat()}] maintain | Fix: short title\\nDescription of what was fixed.\\n\\nPages touched: [[page1]], [[page2]]",
  "hot_md": "full updated hot.md content",
  "summary": "brief human-readable summary of what was fixed"
}}

Rules:
- Only include keys for things you actually changed. If no new pages, omit "new_pages".
- For missing_page issues: create the page with proper frontmatter, content, and wikilinks. Determine if it's a concept or entity based on context.
- For sparse issues: expand the page with more content from existing sources.
- For missing_xref issues: add cross-references (wikilinks) to the relevant pages.
- For orphan issues: add inbound links from related pages.
- For index_drift issues: update index.md to include the missing page.
- For stale/contradiction issues: update the affected page to resolve the problem.
- Always update index.md if pages are created or significantly changed.
- Always update hot.md to reflect the operation.
- Always include a log_entry.
- Follow all AGENTS.md conventions for frontmatter, filenames, wikilinks, and writing style.
- Return ONLY valid JSON. No markdown fences. Today's date is {date.today().isoformat()}."""

        raw_response = await self.gemini.generate(prompt, json_mode=True)

        try:
            result = _extract_json(raw_response)
        except json.JSONDecodeError:
            return {
                "success": False,
                "error": "Failed to parse LLM response as JSON",
                "raw_response": raw_response[:2000],
            }

        pages_touched = []

        for page in result.get("new_pages", []):
            self.vault.write_file(page["path"], page["content"])
            pages_touched.append(page["path"])

        for page in result.get("updated_pages", []):
            self.vault.write_file(page["path"], page["content"])
            pages_touched.append(page["path"])

        if "index_md" in result:
            self.vault.write_file("index.md", result["index_md"])

        if "hot_md" in result:
            self.vault.write_file("hot.md", result["hot_md"])

        if "overview_md" in result:
            self.vault.write_file("wiki/overview.md", result["overview_md"])

        if "log_entry" in result:
            existing_log = self.vault.read_file("log.md") or "# Log\n"
            self.vault.write_file("log.md", existing_log + "\n" + result["log_entry"] + "\n")

        return {
            "success": True,
            "pages_touched": pages_touched,
            "summary": result.get("summary", f"Fixed: {description[:100]}"),
        }
