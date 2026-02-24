import html
import re


def sanitize_text(text: str, max_length: int = 5000) -> str:
    """Sanitize user text input: escape HTML, strip whitespace, enforce max length."""
    if not text:
        return text
    # Strip leading/trailing whitespace
    text = text.strip()
    # Escape HTML entities
    text = html.escape(text)
    # Collapse multiple whitespace
    text = re.sub(r'\s+', ' ', text)
    # Enforce max length
    if len(text) > max_length:
        text = text[:max_length]
    return text
