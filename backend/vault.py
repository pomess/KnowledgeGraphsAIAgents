import os
import re
import frontmatter


class VaultManager:
    def __init__(self, vault_path: str):
        self.vault_path = vault_path

    def _abs(self, rel_path: str) -> str:
        return os.path.join(self.vault_path, rel_path)

    def read_file(self, rel_path: str) -> str | None:
        path = self._abs(rel_path)
        if not os.path.isfile(path):
            return None
        with open(path, "r", encoding="utf-8") as f:
            return f.read()

    def write_file(self, rel_path: str, content: str) -> None:
        path = self._abs(rel_path)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            f.write(content)

    def file_exists(self, rel_path: str) -> bool:
        return os.path.isfile(self._abs(rel_path))

    def parse_frontmatter(self, content: str) -> dict:
        try:
            post = frontmatter.loads(content)
            return dict(post.metadata)
        except Exception:
            return {}

    def parse_wikilinks(self, content: str) -> list[str]:
        return re.findall(r"\[\[([^\]|]+)(?:\|[^\]]+)?\]\]", content)

    def list_pages(self) -> list[dict]:
        pages = []
        wiki_dir = self._abs("wiki")
        if not os.path.isdir(wiki_dir):
            return pages

        for root, _dirs, files in os.walk(wiki_dir):
            for fname in files:
                if not fname.endswith(".md") or fname.startswith("."):
                    continue
                rel = os.path.relpath(os.path.join(root, fname), self.vault_path)
                rel = rel.replace("\\", "/")
                content = self.read_file(rel)
                if content is None:
                    continue
                fm = self.parse_frontmatter(content)
                pages.append({
                    "path": rel,
                    "slug": fname.replace(".md", ""),
                    "title": fm.get("title", fname.replace(".md", "").replace("-", " ").title()),
                    "type": fm.get("type", "unknown"),
                    "tags": fm.get("tags", []),
                    "confidence": fm.get("confidence", ""),
                    "updated": str(fm.get("updated", "")),
                })
        return pages

    def list_raw_files(self) -> list[str]:
        raw_dir = self._abs("raw")
        if not os.path.isdir(raw_dir):
            return []
        result = []
        for root, _dirs, files in os.walk(raw_dir):
            for fname in files:
                if fname.startswith("."):
                    continue
                rel = os.path.relpath(os.path.join(root, fname), self.vault_path)
                result.append(rel.replace("\\", "/"))
        return result

    def get_graph(self) -> dict:
        nodes = []
        edges = []
        pages = self.list_pages()
        slug_set = {p["slug"] for p in pages}

        for page in pages:
            nodes.append({
                "id": page["slug"],
                "label": page["title"],
                "type": page["type"],
            })
            content = self.read_file(page["path"])
            if content is None:
                continue
            links = self.parse_wikilinks(content)
            for link in links:
                target = link.lower().replace(" ", "-")
                if "/" in target:
                    target = target.split("/")[-1]
                if target in slug_set and target != page["slug"]:
                    edges.append({"source": page["slug"], "target": target})

        return {"nodes": nodes, "edges": edges}
