"""Title normalisation and fuzzy similarity for reference matching."""

import re
from difflib import SequenceMatcher


def normalize_title(title: str) -> str:
    """Lowercase, strip punctuation, and collapse whitespace.

    Examples:
        >>> normalize_title("Attention Is All You Need!")
        'attention is all you need'
        >>> normalize_title("  A   B  ")
        'a b'
    """
    title = title.lower()
    # Keep only alphanumeric characters and spaces
    title = re.sub(r"[^a-z0-9\s]", "", title)
    # Collapse multiple whitespace into a single space and strip
    title = re.sub(r"\s+", " ", title).strip()
    return title


def title_similarity(a: str, b: str) -> float:
    """Compare two titles using SequenceMatcher on normalised forms.

    Returns:
        A float between 0.0 (completely different) and 1.0 (identical).
    """
    norm_a = normalize_title(a)
    norm_b = normalize_title(b)

    if not norm_a or not norm_b:
        return 0.0

    return SequenceMatcher(None, norm_a, norm_b).ratio()
