"""Tests for the GROBID TEI XML parser."""

import pytest

from app.services.grobid_xml_parser import parse_tei_xml


class TestParseTeiXml:
    """Tests for parse_tei_xml with the sample GROBID fixture."""

    def test_parses_correct_number_of_references(self, sample_grobid_xml: bytes):
        refs = parse_tei_xml(sample_grobid_xml)
        assert len(refs) == 3

    def test_indices_are_one_based(self, sample_grobid_xml: bytes):
        refs = parse_tei_xml(sample_grobid_xml)
        assert refs[0].index == 1
        assert refs[1].index == 2
        assert refs[2].index == 3

    # --- Reference 1: Attention Is All You Need ---

    def test_ref1_title(self, sample_grobid_xml: bytes):
        refs = parse_tei_xml(sample_grobid_xml)
        assert refs[0].title == "Attention Is All You Need"

    def test_ref1_authors(self, sample_grobid_xml: bytes):
        refs = parse_tei_xml(sample_grobid_xml)
        authors = refs[0].authors
        assert len(authors) == 8
        assert authors[0] == "Vaswani, A."
        assert authors[1] == "Shazeer, N."
        assert authors[-1] == "Polosukhin, I."

    def test_ref1_year(self, sample_grobid_xml: bytes):
        refs = parse_tei_xml(sample_grobid_xml)
        assert refs[0].year == 2017

    def test_ref1_doi(self, sample_grobid_xml: bytes):
        refs = parse_tei_xml(sample_grobid_xml)
        assert refs[0].doi == "10.48550/arXiv.1706.03762"

    def test_ref1_venue(self, sample_grobid_xml: bytes):
        refs = parse_tei_xml(sample_grobid_xml)
        assert refs[0].venue == "Advances in Neural Information Processing Systems"

    def test_ref1_raw_citation(self, sample_grobid_xml: bytes):
        refs = parse_tei_xml(sample_grobid_xml)
        assert "Attention is all you need" in refs[0].raw_citation

    # --- Reference 2: BERT ---

    def test_ref2_title(self, sample_grobid_xml: bytes):
        refs = parse_tei_xml(sample_grobid_xml)
        assert refs[1].title == (
            "BERT: Pre-training of Deep Bidirectional Transformers "
            "for Language Understanding"
        )

    def test_ref2_authors(self, sample_grobid_xml: bytes):
        refs = parse_tei_xml(sample_grobid_xml)
        authors = refs[1].authors
        assert len(authors) == 4
        assert authors[0] == "Devlin, J."
        assert authors[1] == "Chang, M."
        assert authors[2] == "Lee, K."
        assert authors[3] == "Toutanova, K."

    def test_ref2_year(self, sample_grobid_xml: bytes):
        refs = parse_tei_xml(sample_grobid_xml)
        assert refs[1].year == 2019

    def test_ref2_doi(self, sample_grobid_xml: bytes):
        refs = parse_tei_xml(sample_grobid_xml)
        assert refs[1].doi == "10.18653/v1/N19-1423"

    def test_ref2_venue(self, sample_grobid_xml: bytes):
        refs = parse_tei_xml(sample_grobid_xml)
        venue = refs[1].venue
        assert venue is not None
        assert "North American Chapter" in venue

    def test_ref2_raw_citation(self, sample_grobid_xml: bytes):
        refs = parse_tei_xml(sample_grobid_xml)
        assert "BERT" in refs[1].raw_citation

    # --- Reference 3: Minimal data ---

    def test_ref3_title(self, sample_grobid_xml: bytes):
        refs = parse_tei_xml(sample_grobid_xml)
        assert refs[2].title == "A Simple Method for Commonsense Reasoning"

    def test_ref3_authors(self, sample_grobid_xml: bytes):
        refs = parse_tei_xml(sample_grobid_xml)
        authors = refs[2].authors
        assert len(authors) == 2
        assert authors[0] == "Trinh, T."
        assert authors[1] == "Le, Q."

    def test_ref3_year(self, sample_grobid_xml: bytes):
        refs = parse_tei_xml(sample_grobid_xml)
        assert refs[2].year == 2018

    def test_ref3_no_doi(self, sample_grobid_xml: bytes):
        refs = parse_tei_xml(sample_grobid_xml)
        assert refs[2].doi is None

    def test_ref3_no_venue(self, sample_grobid_xml: bytes):
        refs = parse_tei_xml(sample_grobid_xml)
        assert refs[2].venue is None

    def test_ref3_raw_citation(self, sample_grobid_xml: bytes):
        refs = parse_tei_xml(sample_grobid_xml)
        assert "commonsense reasoning" in refs[2].raw_citation.lower()


class TestParseTeiXmlEdgeCases:
    """Tests for edge cases and malformed input."""

    def test_empty_bytes_returns_empty_list(self):
        assert parse_tei_xml(b"") == []

    def test_whitespace_only_returns_empty_list(self):
        assert parse_tei_xml(b"   \n\t  ") == []

    def test_malformed_xml_returns_empty_list(self):
        assert parse_tei_xml(b"<not valid xml!!!") == []

    def test_valid_xml_no_biblstruct_returns_empty_list(self):
        xml = b'<?xml version="1.0"?><TEI xmlns="http://www.tei-c.org/ns/1.0"><text><body/></text></TEI>'
        assert parse_tei_xml(xml) == []

    def test_biblstruct_with_no_data(self):
        """A biblStruct with no child elements should still produce a ParsedReference."""
        xml = (
            b'<?xml version="1.0"?>'
            b'<TEI xmlns="http://www.tei-c.org/ns/1.0">'
            b"<text><back><div><listBibl>"
            b"<biblStruct/>"
            b"</listBibl></div></back></text></TEI>"
        )
        refs = parse_tei_xml(xml)
        assert len(refs) == 1
        assert refs[0].index == 1
        assert refs[0].title is None
        assert refs[0].authors == []
        assert refs[0].year is None
        assert refs[0].doi is None
        assert refs[0].venue is None
        assert refs[0].raw_citation == ""

    def test_title_with_nested_elements_is_not_truncated(self):
        xml = (
            b'<?xml version="1.0"?>'
            b'<TEI xmlns="http://www.tei-c.org/ns/1.0">'
            b"<text><back><div><listBibl>"
            b"<biblStruct>"
            b"<analytic><title level='a'>A <hi>Simple</hi> Method</title></analytic>"
            b"</biblStruct>"
            b"</listBibl></div></back></text></TEI>"
        )
        refs = parse_tei_xml(xml)
        assert len(refs) == 1
        assert refs[0].title == "A Simple Method"
