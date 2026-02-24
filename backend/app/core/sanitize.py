import html
import re


def sanitize_text(text: str, max_length: int = 5000) -> str:
    """Sanitize user text input: strip HTML tags, normalize whitespace, enforce max length."""
    if not text:
        return text
    # Strip leading/trailing whitespace
    text = text.strip()
    # Remove HTML tags (but keep the text content)
    text = re.sub(r'<[^>]+>', '', text)
    # Collapse multiple whitespace and re-strip
    text = re.sub(r'\s+', ' ', text).strip()
    # Enforce max length
    if len(text) > max_length:
        text = text[:max_length]
    return text
