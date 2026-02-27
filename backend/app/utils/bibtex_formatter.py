"""Utilities for generating BibTeX citation keys and fallback entries."""

import re

from app.models.reference import ParsedReference

# Common short words to skip when picking a title keyword
_STOP_WORDS = frozenset({
    "a", "an", "the", "of", "in", "on", "at", "to", "for", "and", "or",
    "is", "are", "was", "were", "with", "by", "from", "as", "its", "it",
    "not", "but", "be", "been", "being", "that", "this", "which", "their",
    "our", "we", "do", "does", "did", "has", "have", "had", "can", "may",
    "will", "shall", "should", "could", "would", "about", "into", "over",
    "than", "then", "so", "no", "nor", "up", "out", "if", "how", "when",
    "where", "what", "who", "whom", "why", "each", "every", "all", "both",
    "few", "more", "most", "some", "any", "via", "using", "through",
})


def _extract_surname(author: str) -> str:
    """Extract the surname from an author string like 'Surname, F.' or 'First Last'.

    Returns a lowercased, alphanumeric-only surname.
    """
    author = author.strip()
    if "," in author:
        # Format: "Surname, FirstName" -> take part before the comma
        surname = author.split(",")[0].strip()
    else:
        # Format: "First Last" -> take the last token
        parts = author.split()
        surname = parts[-1] if parts else author

    # Keep only alphabetic characters
    surname = re.sub(r"[^a-z]", "", surname.lower())
    return surname


def _first_significant_word(title: str) -> str:
    """Return the first non-stop-word from the title, lowercased and alpha-only."""
    words = re.sub(r"[^a-z0-9\s]", "", title.lower()).split()
    for word in words:
        if word not in _STOP_WORDS and len(word) > 1:
            return word
    # If every word is a stop word, use the first word as fallback
    return words[0] if words else ""


def generate_citation_key(
    authors: list[str],
    year: int | None,
    title: str | None,
) -> str:
    """Generate a BibTeX citation key like ``vaswani2017attention``.

    Composition:
        <first_author_surname><year><first_significant_title_word>

    Falls back gracefully when parts are missing:
        - No author  -> ``unknown``
        - No year    -> omitted
        - No title   -> omitted

    Examples:
        >>> generate_citation_key(["Vaswani, A."], 2017, "Attention Is All You Need")
        'vaswani2017attention'
        >>> generate_citation_key([], None, None)
        'unknown'
    """
    # Author part
    if authors:
        surname = _extract_surname(authors[0])
        author_part = surname if surname else "unknown"
    else:
        author_part = "unknown"

    # Year part
    year_part = str(year) if year is not None else ""

    # Title part
    title_part = ""
    if title:
        title_part = _first_significant_word(title)

    key = f"{author_part}{year_part}{title_part}"
    return key if key else "unknown"


def _looks_like_latex(value: str) -> bool:
    """Detect if a string contains intentional LaTeX markup.

    Matches patterns like \\command, paired {braces}, or $math$.
    """
    # \command (e.g., \textbf, \emph)
    if re.search(r"\\[a-zA-Z]+", value):
        return True
    # Paired braces used for grouping (e.g., {BERT}, {COVID-19})
    if re.search(r"\{[^}]+\}", value):
        return True
    # Inline math (e.g., $O(n)$)
    if re.search(r"\$[^$]+\$", value):
        return True
    return False


def _escape_bibtex(value: str, *, latex_aware: bool = True) -> str:
    """Escape special characters in BibTeX field values.

    If *latex_aware* is True (default) and the value contains LaTeX markup
    (commands, braces, math), only escape characters that are BibTeX-special
    but not part of LaTeX structure (& % # _). Otherwise, perform full
    escaping of all special characters.

    Set *latex_aware=False* for fields like DOI that should never contain LaTeX.
    """
    if latex_aware and _looks_like_latex(value):
        # Minimal escaping: only BibTeX-special chars that aren't LaTeX structural
        latex_safe_replacements = {
            "&": r"\&",
            "%": r"\%",
            "#": r"\#",
            "_": r"\_",
        }
        return "".join(latex_safe_replacements.get(char, char) for char in value)

    # Full escaping for plain text values
    replacements = {
        "\\": r"\textbackslash{}",
        "{": r"\{",
        "}": r"\}",
        "^": r"\^{}",
        "~": r"\~{}",
        "&": r"\&",
        "%": r"\%",
        "#": r"\#",
        "$": r"\$",
        "_": r"\_",
    }
    return "".join(replacements.get(char, char) for char in value)


_CROSSREF_TYPE_MAP: dict[str, str] = {
    "journal-article": "article",
    "proceedings-article": "inproceedings",
    "book-chapter": "incollection",
    "book": "book",
    "edited-book": "book",
    "monograph": "book",
    "dissertation": "phdthesis",
    "report": "techreport",
    "posted-content": "misc",
}


def _extract_year_from_crossref(item: dict) -> int | None:
    """Extract publication year from CrossRef date fields (published → issued → created)."""
    for field in ("published", "issued", "created"):
        date_obj = item.get(field)
        if isinstance(date_obj, dict):
            parts = date_obj.get("date-parts")
            if isinstance(parts, list) and parts:
                first_part = parts[0]
                if isinstance(first_part, list) and first_part and first_part[0]:
                    try:
                        return int(first_part[0])
                    except (ValueError, TypeError):
                        continue
    return None



def build_bibtex_from_crossref_json(item: dict) -> str | None:
    """Build a BibTeX entry from a CrossRef API work item dict.

    Returns None if the item has no title.
    """
    titles = item.get("title", [])
    if not titles or not titles[0]:
        return None

    title = titles[0]
    crossref_type = item.get("type", "")
    entry_type = _CROSSREF_TYPE_MAP.get(crossref_type, "article")

    # Authors — single pass for both BibTeX field and citation key
    raw_authors = item.get("author", [])
    author_list: list[str] = []
    for a in raw_authors:
        if "family" in a:
            given = a.get("given", "")
            author_list.append(f"{a['family']}, {given}" if given else a["family"])
        elif "name" in a:
            author_list.append(a["name"])
    author_str = " and ".join(author_list) if author_list else None

    # Year
    year = _extract_year_from_crossref(item)

    # Citation key
    key = generate_citation_key(author_list, year, title)

    # Build fields
    fields: list[str] = []
    fields.append(f"  title = {{{_escape_bibtex(title)}}}")

    if author_str:
        fields.append(f"  author = {{{_escape_bibtex(author_str)}}}")

    if year is not None:
        fields.append(f"  year = {{{year}}}")

    doi = item.get("DOI")
    if doi:
        fields.append(f"  doi = {{{_escape_bibtex(doi, latex_aware=False)}}}")

    # Venue field depends on entry type
    container = item.get("container-title", [])
    venue = container[0] if container else None
    if venue:
        if entry_type == "article":
            fields.append(f"  journal = {{{_escape_bibtex(venue)}}}")
        elif entry_type in ("inproceedings", "incollection"):
            fields.append(f"  booktitle = {{{_escape_bibtex(venue)}}}")
        elif entry_type == "book":
            fields.append(f"  series = {{{_escape_bibtex(venue)}}}")
        else:
            fields.append(f"  journal = {{{_escape_bibtex(venue)}}}")

    volume = item.get("volume")
    if volume:
        fields.append(f"  volume = {{{_escape_bibtex(str(volume), latex_aware=False)}}}")

    issue = item.get("issue")
    if issue:
        fields.append(f"  number = {{{_escape_bibtex(str(issue), latex_aware=False)}}}")

    page = item.get("page")
    if page:
        fields.append(f"  pages = {{{_escape_bibtex(page, latex_aware=False)}}}")
    else:
        article_number = item.get("article-number")
        if article_number:
            fields.append(f"  pages = {{{_escape_bibtex(article_number, latex_aware=False)}}}")

    publisher = item.get("publisher")
    if publisher:
        fields.append(f"  publisher = {{{_escape_bibtex(publisher)}}}")

    fields_str = ",\n".join(fields)
    return f"@{entry_type}{{{key},\n{fields_str}\n}}"


def build_fallback_bibtex(ref: ParsedReference) -> str:
    """Build a ``@misc`` BibTeX entry from a ParsedReference.

    Used as a last resort when no API match is found.  Includes whichever
    fields are available: title, author, year, doi, note.

    Args:
        ref: The parsed reference from GROBID.

    Returns:
        A BibTeX string for the ``@misc`` entry.
    """
    key = generate_citation_key(ref.authors, ref.year, ref.title)

    fields: list[str] = []

    if ref.title:
        fields.append(f"  title = {{{_escape_bibtex(ref.title)}}}")

    if ref.authors:
        author_str = " and ".join(ref.authors)
        fields.append(f"  author = {{{_escape_bibtex(author_str)}}}")

    if ref.year is not None:
        fields.append(f"  year = {{{ref.year}}}")

    if ref.doi:
        fields.append(f"  doi = {{{_escape_bibtex(ref.doi, latex_aware=False)}}}")

    if ref.venue:
        fields.append(f"  howpublished = {{{_escape_bibtex(ref.venue)}}}")

    if ref.raw_citation:
        # Truncate very long raw citations for the note field
        raw = ref.raw_citation[:300]
        fields.append(f"  note = {{Parsed by GROBID: {_escape_bibtex(raw)}}}")

    fields_str = ",\n".join(fields)
    return f"@misc{{{key},\n{fields_str}\n}}"
