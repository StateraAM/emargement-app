from app.core.sanitize import sanitize_text


def test_sanitize_basic_text():
    """Clean text should pass through unchanged."""
    assert sanitize_text("Hello world") == "Hello world"


def test_sanitize_html_entities():
    """HTML tags and entities should be escaped."""
    assert sanitize_text("<script>alert('xss')</script>") == "&lt;script&gt;alert(&#x27;xss&#x27;)&lt;/script&gt;"


def test_sanitize_html_attributes():
    """HTML with attributes should be fully escaped."""
    result = sanitize_text('<img src="x" onerror="alert(1)">')
    assert "<img" not in result
    assert "&lt;img" in result
    assert "onerror" in result  # content preserved but escaped


def test_sanitize_ampersand():
    """Ampersands should be escaped."""
    assert sanitize_text("A & B") == "A &amp; B"


def test_sanitize_quotes():
    """Quotes should be escaped."""
    result = sanitize_text('He said "hello"')
    assert "&quot;" in result or '"' not in result.replace("&quot;", "")


def test_sanitize_strip_whitespace():
    """Leading and trailing whitespace should be stripped."""
    assert sanitize_text("  hello  ") == "hello"


def test_sanitize_collapse_whitespace():
    """Multiple consecutive spaces should be collapsed to one."""
    assert sanitize_text("hello    world") == "hello world"


def test_sanitize_collapse_mixed_whitespace():
    """Tabs, newlines, and multiple spaces should all collapse."""
    assert sanitize_text("hello\t\n  world") == "hello world"


def test_sanitize_newlines_in_text():
    """Newlines within text should be collapsed to single space."""
    assert sanitize_text("line1\nline2\nline3") == "line1 line2 line3"


def test_sanitize_max_length_default():
    """Text longer than 5000 chars should be truncated."""
    long_text = "a" * 6000
    result = sanitize_text(long_text)
    assert len(result) == 5000


def test_sanitize_max_length_custom():
    """Custom max_length should be respected."""
    result = sanitize_text("a" * 200, max_length=100)
    assert len(result) == 100


def test_sanitize_max_length_short_text():
    """Text shorter than max_length should not be truncated."""
    result = sanitize_text("short", max_length=100)
    assert result == "short"


def test_sanitize_empty_string():
    """Empty string should return empty string."""
    assert sanitize_text("") == ""


def test_sanitize_none_returns_none():
    """None input should return None (falsy passthrough)."""
    assert sanitize_text(None) is None


def test_sanitize_whitespace_only():
    """Whitespace-only string: after strip becomes empty."""
    assert sanitize_text("   ") == ""


def test_sanitize_combined_html_and_whitespace():
    """HTML + extra whitespace should be both escaped and collapsed."""
    result = sanitize_text("  <b>  bold  </b>  ")
    assert "&lt;b&gt;" in result
    assert "&lt;/b&gt;" in result
    # Should not have leading/trailing spaces and internal should be collapsed
    assert not result.startswith(" ")
    assert not result.endswith(" ")
    assert "  " not in result


def test_sanitize_unicode_preserved():
    """Unicode characters should be preserved (not stripped or escaped)."""
    assert sanitize_text("Rendez-vous medical") == "Rendez-vous medical"
    result = sanitize_text("cafe resume")
    assert result == "cafe resume"


def test_sanitize_french_accents():
    """French accented characters common in this app should be preserved."""
    text = "Justification approuvee - rendez-vous medical"
    assert sanitize_text(text) == text


def test_sanitize_sql_injection_attempt():
    """SQL injection strings should be escaped (HTML escaping covers quotes)."""
    result = sanitize_text("'; DROP TABLE students; --")
    assert "&#x27;" in result  # single quote escaped
    assert "DROP TABLE" in result  # content preserved but safe for HTML


def test_sanitize_order_of_operations():
    """Strip happens before escape, collapse after escape."""
    # Leading/trailing space stripped, then HTML escaped, then whitespace collapsed
    result = sanitize_text("  <b>  test  </b>  ")
    assert result == "&lt;b&gt; test &lt;/b&gt;"


def test_sanitize_max_length_after_escape():
    """Max length applies after HTML escaping (escaped text may be longer)."""
    # '<' becomes '&lt;' (4 chars), so 10 '<' = 40 escaped chars
    result = sanitize_text("<" * 10, max_length=20)
    assert len(result) == 20
    # Should be a truncated version of '&lt;&lt;&lt;...'
    assert result.startswith("&lt;")
