"""Shared test fixtures for the RefBib backend test suite."""

from pathlib import Path

import pytest

FIXTURES_DIR = Path(__file__).parent / "fixtures"


@pytest.fixture
def sample_grobid_xml() -> bytes:
    """Load the sample GROBID TEI XML fixture as bytes."""
    xml_path = FIXTURES_DIR / "sample_grobid_response.xml"
    return xml_path.read_bytes()
