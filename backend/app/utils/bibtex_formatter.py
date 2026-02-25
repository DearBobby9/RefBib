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


def _escape_bibtex(value: str) -> str:
    """Escape special characters in BibTeX field values.

    If the value contains LaTeX markup (commands, braces, math), only escape
    characters that are BibTeX-special but not part of LaTeX structure
    (& % # _). Otherwise, perform full escaping of all special characters.
    """
    if _looks_like_latex(value):
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
        fields.append(f"  doi = {{{_escape_bibtex(ref.doi)}}}")

    if ref.venue:
        fields.append(f"  howpublished = {{{_escape_bibtex(ref.venue)}}}")

    if ref.raw_citation:
        # Truncate very long raw citations for the note field
        raw = ref.raw_citation[:300]
        fields.append(f"  note = {{Parsed by GROBID: {_escape_bibtex(raw)}}}")

    fields_str = ",\n".join(fields)
    return f"@misc{{{key},\n{fields_str}\n}}"
