"""POST /api/extract — upload PDF and get BibTeX references."""

import logging
import time
from typing import Optional

from fastapi import APIRouter, Form, HTTPException, Request, UploadFile

from app.config import GROBID_INSTANCES, settings
from app.models.api import ExtractResponse
from app.models.reference import MatchStatus
from app.services.bibtex_assembler import BibTeXAssembler
from app.services.grobid_service import parse_pdf_references
from app.services.grobid_xml_parser import parse_tei_xml

logger = logging.getLogger(__name__)

router = APIRouter()

MAX_FILE_SIZE = 50 * 1024 * 1024  # 50 MB
READ_CHUNK_SIZE = 1024 * 1024  # 1 MB
_ALLOWED_CONTENT_TYPES = {"application/pdf", "application/x-pdf"}
_GROBID_INSTANCE_BY_ID = {instance["id"]: instance for instance in GROBID_INSTANCES}


async def _read_upload_limited(file: UploadFile, max_file_size: int) -> bytes:
    chunks: list[bytes] = []
    total_size = 0

    while True:
        chunk = await file.read(READ_CHUNK_SIZE)
        if not chunk:
            break

        total_size += len(chunk)
        if total_size > max_file_size:
            raise HTTPException(status_code=400, detail="File exceeds 50MB limit.")

        chunks.append(chunk)

    if total_size == 0:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    return b"".join(chunks)


def _validate_pdf_content(file: UploadFile, pdf_bytes: bytes) -> None:
    # Layer 1 (advisory): content_type is client-supplied and may be missing or
    # spoofed.  We reject obvious mismatches but skip the check when the header
    # is absent — the magic-byte check below is the authoritative validation.
    if file.content_type and file.content_type not in _ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=400,
            detail="Uploaded file content type is not PDF.",
        )

    # Layer 2 (authoritative): verify the PDF magic bytes in the file content.
    # Some generators prepend whitespace/BOM before the header.
    if not pdf_bytes[:1024].lstrip().startswith(b"%PDF-"):
        raise HTTPException(status_code=400, detail="Uploaded file is not a valid PDF.")


def _build_grobid_fallback_chain(selected_instance_id: str | None) -> list[str]:
    grobid_urls: list[str] = []

    if selected_instance_id:
        selected = _GROBID_INSTANCE_BY_ID.get(selected_instance_id)
        if not selected:
            raise HTTPException(status_code=400, detail="Invalid GROBID instance.")
        grobid_urls.append(selected["url"])
    elif settings.grobid_url:
        grobid_urls.append(settings.grobid_url)

    for instance in GROBID_INSTANCES:
        if instance["url"] not in grobid_urls:
            grobid_urls.append(instance["url"])

    return grobid_urls


@router.post("/extract", response_model=ExtractResponse)
async def extract_references(
    request: Request,
    file: UploadFile,
    grobid_instance_id: Optional[str] = Form(None),
):
    # Validate file type
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted.")

    # Read and validate size in chunks to avoid loading arbitrarily large files.
    pdf_bytes = await _read_upload_limited(file, MAX_FILE_SIZE)
    _validate_pdf_content(file, pdf_bytes)

    logger.info("[Extract] Processing PDF: %s (%d bytes)", file.filename, len(pdf_bytes))
    start = time.monotonic()

    client = request.app.state.http_client
    grobid_client = request.app.state.grobid_client

    grobid_urls = _build_grobid_fallback_chain(grobid_instance_id)

    logger.info("[Extract] GROBID fallback chain: %s", grobid_urls)

    # Step 1: GROBID parsing
    try:
        xml_bytes = await parse_pdf_references(grobid_client, pdf_bytes, grobid_urls)
    except Exception as exc:
        logger.error("[Extract] GROBID parsing failed: %s", exc)
        raise HTTPException(
            status_code=502,
            detail="Failed to parse PDF with GROBID. The service may be temporarily unavailable.",
        )

    # Step 2: Parse TEI XML
    parsed_refs = parse_tei_xml(xml_bytes)
    if not parsed_refs:
        raise HTTPException(
            status_code=422,
            detail="No references found in the PDF. The file may not contain a standard reference section.",
        )

    logger.info("[Extract] Parsed %d references from GROBID", len(parsed_refs))

    # Step 3: Resolve BibTeX
    assembler = BibTeXAssembler(
        client,
        request.app.state.crossref_rate_limiter,
        request.app.state.semantic_scholar_rate_limiter,
        request.app.state.dblp_rate_limiter,
    )
    resolved = await assembler.resolve_all(parsed_refs)

    elapsed = time.monotonic() - start

    matched = sum(1 for r in resolved if r.match_status == MatchStatus.MATCHED)
    fuzzy = sum(1 for r in resolved if r.match_status == MatchStatus.FUZZY)
    unmatched = sum(1 for r in resolved if r.match_status == MatchStatus.UNMATCHED)

    logger.info(
        "[Extract] Done in %.1fs: %d total, %d matched, %d fuzzy, %d unmatched",
        elapsed, len(resolved), matched, fuzzy, unmatched,
    )

    return ExtractResponse(
        references=resolved,
        total_count=len(resolved),
        matched_count=matched,
        fuzzy_count=fuzzy,
        unmatched_count=unmatched,
        processing_time_seconds=round(elapsed, 2),
    )
