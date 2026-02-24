from app.core.sanitize import sanitize_text


def test_sanitize_basic_text():
    """Clean text should pass through unchanged."""
    assert sanitize_text("Hello world") == "Hello world"


def test_sanitize_html_tags_stripped():
    """HTML tags should be stripped, text content preserved."""
    assert sanitize_text("<script>alert('xss')</script>") == "alert('xss')"


def test_sanitize_html_attributes():
    """HTML with attributes should be fully stripped."""
    result = sanitize_text('<img src="x" onerror="alert(1)">')
    assert "<img" not in result
    assert "onerror" not in result


def test_sanitize_ampersand_preserved():
    """Ampersands should be preserved (React handles display escaping)."""
    assert sanitize_text("A & B") == "A & B"


def test_sanitize_quotes_preserved():
    """Quotes and apostrophes should be preserved."""
    assert sanitize_text("He said \"hello\"") == 'He said "hello"'
    assert sanitize_text("c'est bon") == "c'est bon"


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
    """HTML + extra whitespace should have tags stripped and whitespace collapsed."""
    result = sanitize_text("  <b>  bold  </b>  ")
    assert "<b>" not in result
    assert "bold" in result
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
    """SQL injection strings pass through (parameterized queries handle safety)."""
    result = sanitize_text("'; DROP TABLE students; --")
    assert "'" in result  # apostrophe preserved
    assert "DROP TABLE" in result  # content preserved


def test_sanitize_order_of_operations():
    """Strip happens before tag removal, collapse after."""
    result = sanitize_text("  <b>  test  </b>  ")
    assert result == "test"


def test_sanitize_max_length_after_strip():
    """Max length applies after tag stripping."""
    result = sanitize_text("<b>" * 10 + "hello", max_length=5)
    assert result == "hello"
