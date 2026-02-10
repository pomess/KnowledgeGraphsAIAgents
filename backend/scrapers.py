"""
Web scraping utilities for extracting text content from URLs.
"""
import requests
from bs4 import BeautifulSoup
from langchain_core.documents import Document


MAX_CONTENT_CHARS = 80_000  # ~20K tokens — keeps us well within LLM context limits


def scrape_url(url: str, max_chars: int = MAX_CONTENT_CHARS) -> Document:
    """
    Fetch a URL and extract its main text content.
    Strips navigation, headers, footers, scripts, and styles.
    Truncates to max_chars to avoid exceeding LLM token limits.
    """
    headers = {
        "User-Agent": "Mozilla/5.0 (compatible; GraphCreator/1.0; +https://github.com/graphcreator)"
    }

    response = requests.get(url, headers=headers, timeout=15)
    response.raise_for_status()

    soup = BeautifulSoup(response.text, "html.parser")

    # Remove non-content elements
    for tag in soup(["script", "style", "nav", "footer", "header", "aside", "form", "noscript", "iframe"]):
        tag.decompose()

    # Try to find the main content area
    main_content = (
        soup.find("main")
        or soup.find("article")
        or soup.find("div", {"role": "main"})
        or soup.find("div", {"id": "content"})
        or soup.find("div", {"id": "main-content"})
        or soup.find("div", {"class": "content"})
        or soup.body
    )

    if main_content is None:
        main_content = soup

    # Extract text
    text = main_content.get_text(separator="\n", strip=True)

    # Clean up excessive whitespace
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    clean_text = "\n".join(lines)

    # Truncate to stay within LLM context limits
    if len(clean_text) > max_chars:
        clean_text = clean_text[:max_chars] + "\n\n[Content truncated due to length]"

    # Get title
    title = soup.title.string.strip() if soup.title and soup.title.string else url

    return Document(
        page_content=clean_text,
        metadata={"source": url, "title": title}
    )
