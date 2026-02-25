"""Tests for BibTeX formatter helpers."""

from app.utils.bibtex_formatter import _escape_bibtex, _looks_like_latex


def test_escape_bibtex_plain_text_full_escaping():
    """Plain text without LaTeX gets fully escaped."""
    value = r"\{}^~&%#$_"
    escaped = _escape_bibtex(value)
    assert escaped == r"\textbackslash{}\{\}\^{}\~{}\&\%\#\$\_"


def test_escape_bibtex_preserves_latex_commands():
    """LaTeX commands like \\textbf should be preserved."""
    value = r"\textbf{BERT}: Pre-training & Fine-tuning"
    escaped = _escape_bibtex(value)
    assert r"\textbf{BERT}" in escaped
    assert r"\&" in escaped


def test_escape_bibtex_preserves_braced_acronyms():
    """Braced acronyms like {BERT} should be preserved."""
    value = "Pre-training of {BERT} for Language Understanding"
    escaped = _escape_bibtex(value)
    assert "{BERT}" in escaped


def test_escape_bibtex_preserves_inline_math():
    """Inline math like $O(n)$ should be preserved."""
    value = "An $O(n \\log n)$ Algorithm for Something"
    escaped = _escape_bibtex(value)
    assert "$O(n \\log n)$" in escaped


def test_escape_bibtex_latex_only_escapes_bibtex_specials():
    """When LaTeX is detected, only & % # _ are escaped."""
    value = "{COVID-19} Impact: 100% & More"
    escaped = _escape_bibtex(value)
    assert "{COVID-19}" in escaped
    assert r"\%" in escaped
    assert r"\&" in escaped


def test_looks_like_latex_detects_commands():
    assert _looks_like_latex(r"\textbf{bold}") is True
    assert _looks_like_latex(r"\emph{italic}") is True


def test_looks_like_latex_detects_braces():
    assert _looks_like_latex("{BERT} is great") is True


def test_looks_like_latex_detects_math():
    assert _looks_like_latex("$O(n)$ complexity") is True


def test_looks_like_latex_plain_text():
    assert _looks_like_latex("A plain title without latex") is False
