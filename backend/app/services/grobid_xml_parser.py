"""Parser for GROBID TEI XML output to extract structured references."""

import logging
import re
from typing import Optional

from lxml import etree

from app.models.reference import ParsedReference

logger = logging.getLogger(__name__)

TEI_NS = "http://www.tei-c.org/ns/1.0"
NS = {"tei": TEI_NS}


def _element_text(element: etree._Element | None) -> Optional[str]:
    if element is None:
        return None
    text = "".join(element.itertext()).strip()
    return text or None


def parse_tei_xml(xml_bytes: bytes) -> list[ParsedReference]:
    """Parse GROBID TEI XML and extract structured references.

    Args:
        xml_bytes: Raw XML bytes returned by GROBID processReferences.

    Returns:
        List of ParsedReference objects with 1-based indices.
        Returns an empty list if the XML is empty or malformed.
    """
    if not xml_bytes or not xml_bytes.strip():
        logger.warning("[GrobidXmlParser] Received empty XML bytes")
        return []

    try:
        parser = etree.XMLParser(resolve_entities=False, no_network=True)
        root = etree.fromstring(xml_bytes, parser=parser)
    except etree.XMLSyntaxError as exc:
        logger.error("[GrobidXmlParser] Failed to parse XML: %s", exc)
        return []

    # Only look for biblStruct elements inside <listBibl> to avoid picking up
    # the empty <biblStruct> in the TEI header's <sourceDesc>.
    bibl_structs = root.findall(f".//{{{TEI_NS}}}listBibl/{{{TEI_NS}}}biblStruct")
    if not bibl_structs:
        # Fallback: search anywhere (handles non-standard GROBID output)
        bibl_structs = root.findall(f".//{{{TEI_NS}}}biblStruct")
    logger.info(
        "[GrobidXmlParser] Found %d <biblStruct> elements", len(bibl_structs)
    )

    references: list[ParsedReference] = []
    for idx, bibl in enumerate(bibl_structs, start=1):
        title = _extract_title(bibl)
        authors = _extract_authors(bibl)
        year = _extract_year(bibl)
        doi = _extract_doi(bibl)
        venue = _extract_venue(bibl, title)
        raw_citation = _extract_raw_citation(bibl)

        ref = ParsedReference(
            index=idx,
            raw_citation=raw_citation,
            title=title,
            authors=authors,
            year=year,
            doi=doi,
            venue=venue,
        )
        references.append(ref)

        logger.debug(
            "[GrobidXmlParser] Ref #%d: title=%r, authors=%d, year=%s, doi=%s",
            idx,
            title,
            len(authors),
            year,
            doi,
        )

    return references


def _extract_title(bibl: etree._Element) -> Optional[str]:
    """Extract the best title from a biblStruct element.

    Prefers article-level title (<title level="a">) over monograph-level
    (<title level="m">).
    """
    # Try article title first
    title_el = bibl.find(f".//{{{TEI_NS}}}title[@level='a']")
    title_text = _element_text(title_el)
    if title_text:
        return title_text

    # Fall back to monograph title
    title_el = bibl.find(f".//{{{TEI_NS}}}title[@level='m']")
    title_text = _element_text(title_el)
    if title_text:
        return title_text

    return None


def _extract_authors(bibl: etree._Element) -> list[str]:
    """Extract authors as list of 'Surname, F.' strings."""
    authors: list[str] = []
    for author_el in bibl.findall(f".//{{{TEI_NS}}}author"):
        pers_name = author_el.find(f"{{{TEI_NS}}}persName")
        if pers_name is None:
            continue

        surname_el = pers_name.find(f"{{{TEI_NS}}}surname")
        forename_el = pers_name.find(f"{{{TEI_NS}}}forename")

        surname = surname_el.text.strip() if surname_el is not None and surname_el.text else None
        forename = forename_el.text.strip() if forename_el is not None and forename_el.text else None

        if surname and forename:
            # Use first initial
            initial = forename[0].upper() + "."
            authors.append(f"{surname}, {initial}")
        elif surname:
            authors.append(surname)

    return authors


def _extract_year(bibl: etree._Element) -> Optional[int]:
    """Extract the publication year from a date element's @when attribute."""
    date_el = bibl.find(f".//{{{TEI_NS}}}date[@when]")
    if date_el is None:
        return None

    when = date_el.get("when", "")
    match = re.match(r"(\d{4})", when)
    if match:
        return int(match.group(1))

    return None


def _extract_doi(bibl: etree._Element) -> Optional[str]:
    """Extract DOI from <idno type='DOI'>."""
    idno_el = bibl.find(f".//{{{TEI_NS}}}idno[@type='DOI']")
    return _element_text(idno_el)


def _extract_venue(bibl: etree._Element, article_title: Optional[str]) -> Optional[str]:
    """Extract publication venue (journal or conference).

    Uses <title level='j'> for journals. Falls back to <title level='m'>
    only if it was NOT already used as the article title.
    """
    # Journal title
    journal_el = bibl.find(f".//{{{TEI_NS}}}title[@level='j']")
    journal_text = _element_text(journal_el)
    if journal_text:
        return journal_text

    # Monograph/meeting title (only if not already used as the main title)
    mono_el = bibl.find(f".//{{{TEI_NS}}}title[@level='m']")
    mono_text = _element_text(mono_el)
    if mono_text:
        if mono_text != article_title:
            return mono_text

    return None


def _extract_raw_citation(bibl: etree._Element) -> str:
    """Extract the raw citation string from <note type='raw_reference'>."""
    note_el = bibl.find(f".//{{{TEI_NS}}}note[@type='raw_reference']")
    return _element_text(note_el) or ""
