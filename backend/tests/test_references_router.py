"""Tests for upload validation helpers in references router."""

from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from app.routers.references import _build_grobid_fallback_chain, _validate_pdf_content


def test_invalid_grobid_instance_id_is_rejected():
    with pytest.raises(HTTPException) as exc_info:
        _build_grobid_fallback_chain("not-allowed")
    assert exc_info.value.status_code == 400


def test_selected_grobid_instance_is_prioritized():
    chain = _build_grobid_fallback_chain("hf-crf")
    assert chain[0] == "https://kermitt2-grobid-crf.hf.space"


def test_pdf_content_type_and_magic_header_validation():
    valid_file = SimpleNamespace(content_type="application/pdf")
    _validate_pdf_content(valid_file, b"%PDF-1.7\nabc")

    invalid_type = SimpleNamespace(content_type="text/plain")
    with pytest.raises(HTTPException) as exc_info:
        _validate_pdf_content(invalid_type, b"%PDF-1.7\nabc")
    assert exc_info.value.status_code == 400

    invalid_pdf = SimpleNamespace(content_type="application/pdf")
    with pytest.raises(HTTPException) as exc_info:
        _validate_pdf_content(invalid_pdf, b"not-a-pdf")
    assert exc_info.value.status_code == 400
