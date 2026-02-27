"""Tests for BibTeX formatter helpers."""

from app.utils.bibtex_formatter import (
    _escape_bibtex,
    _looks_like_latex,
    build_bibtex_from_crossref_json,
)


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


# --- build_bibtex_from_crossref_json tests ---


def _crossref_item(**overrides) -> dict:
    """Helper to build a CrossRef work item dict."""
    item = {
        "title": ["Attention Is All You Need"],
        "DOI": "10.1234/test",
        "type": "journal-article",
        "author": [
            {"family": "Vaswani", "given": "Ashish"},
            {"family": "Shazeer", "given": "Noam"},
        ],
        "published": {"date-parts": [[2017]]},
        "container-title": ["Advances in Neural Information Processing Systems"],
        "volume": "30",
        "page": "5998-6008",
        "publisher": "Curran Associates",
    }
    item.update(overrides)
    return item


def test_build_from_crossref_json_journal_article():
    """Full journal article produces @article with all fields."""
    item = _crossref_item()
    bibtex = build_bibtex_from_crossref_json(item)
    assert bibtex is not None
    assert bibtex.startswith("@article{")
    assert "title = {Attention Is All You Need}" in bibtex
    assert "author = {Vaswani, Ashish and Shazeer, Noam}" in bibtex
    assert "year = {2017}" in bibtex
    assert "doi = {10.1234/test}" in bibtex
    assert "journal = {Advances in Neural Information Processing Systems}" in bibtex
    assert "volume = {30}" in bibtex
    assert "pages = {5998-6008}" in bibtex
    assert "publisher = {Curran Associates}" in bibtex


def test_build_from_crossref_json_proceedings():
    """Proceedings article uses @inproceedings with booktitle."""
    item = _crossref_item(type="proceedings-article")
    bibtex = build_bibtex_from_crossref_json(item)
    assert bibtex is not None
    assert bibtex.startswith("@inproceedings{")
    assert "booktitle = {Advances in Neural Information Processing Systems}" in bibtex


def test_build_from_crossref_json_book():
    """Book type uses @book with series."""
    item = _crossref_item(type="book")
    bibtex = build_bibtex_from_crossref_json(item)
    assert bibtex is not None
    assert bibtex.startswith("@book{")
    assert "series = {Advances in Neural Information Processing Systems}" in bibtex


def test_build_from_crossref_json_unknown_type():
    """Unknown CrossRef type defaults to @article."""
    item = _crossref_item(type="dataset")
    bibtex = build_bibtex_from_crossref_json(item)
    assert bibtex is not None
    assert bibtex.startswith("@article{")


def test_build_from_crossref_json_missing_title_returns_none():
    """Returns None when title list is empty."""
    item = _crossref_item(title=[])
    assert build_bibtex_from_crossref_json(item) is None

    item2 = _crossref_item()
    del item2["title"]
    assert build_bibtex_from_crossref_json(item2) is None


def test_build_from_crossref_json_minimal_fields():
    """Works with only title and DOI, no other fields."""
    item = {"title": ["Minimal Paper"], "DOI": "10.1234/min"}
    bibtex = build_bibtex_from_crossref_json(item)
    assert bibtex is not None
    assert "@article{" in bibtex
    assert "title = {Minimal Paper}" in bibtex
    assert "doi = {10.1234/min}" in bibtex


def test_build_from_crossref_json_org_author():
    """Institutional author formatted correctly."""
    item = _crossref_item(
        author=[{"name": "World Health Organization"}],
    )
    bibtex = build_bibtex_from_crossref_json(item)
    assert bibtex is not None
    assert "author = {World Health Organization}" in bibtex


def test_build_from_crossref_json_escapes_special_chars():
    """Special BibTeX characters are escaped in titles."""
    item = _crossref_item(
        title=["R&D Results: 100% Improvement in O(n) & More"],
    )
    bibtex = build_bibtex_from_crossref_json(item)
    assert bibtex is not None
    assert r"\&" in bibtex


def test_build_from_crossref_json_article_number_fallback():
    """Uses article-number when page is absent."""
    item = _crossref_item()
    del item["page"]
    item["article-number"] = "e12345"
    bibtex = build_bibtex_from_crossref_json(item)
    assert bibtex is not None
    assert "pages = {e12345}" in bibtex


def test_build_from_crossref_json_issue_field():
    """Issue field maps to BibTeX number."""
    item = _crossref_item()
    item["issue"] = "4"
    bibtex = build_bibtex_from_crossref_json(item)
    assert bibtex is not None
    assert "number = {4}" in bibtex
