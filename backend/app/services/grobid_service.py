"""GROBID API client for parsing PDF references."""

import logging

import httpx

from app.config import settings

logger = logging.getLogger(__name__)


async def parse_pdf_references(
    client: httpx.AsyncClient,
    pdf_bytes: bytes,
    grobid_urls: list[str] | None = None,
) -> bytes:
    """Send a PDF to GROBID with auto-fallback across multiple instances.

    Args:
        client: Async HTTP client (from app.state.grobid_client).
        pdf_bytes: Raw bytes of the uploaded PDF file.
        grobid_urls: Ordered list of GROBID base URLs to try.
                     Defaults to [settings.grobid_url].

    Returns:
        Raw XML bytes from GROBID's processReferences endpoint.

    Raises:
        httpx.HTTPStatusError: If all GROBID instances return non-2xx status codes.
        RuntimeError: If no GROBID instances are available.
    """
    if not grobid_urls:
        grobid_urls = [settings.grobid_url]

    last_error: Exception | None = None
    for url_base in grobid_urls:
        url = f"{url_base}/api/processReferences"
        logger.info(
            "[GrobidService] Trying GROBID at %s, pdf size=%d bytes",
            url_base,
            len(pdf_bytes),
        )
        try:
            response = await client.post(
                url,
                files={"input": ("input.pdf", pdf_bytes, "application/pdf")},
                data={
                    "consolidateCitations": "1",
                    "includeRawCitations": "1",
                },
                timeout=60.0,
            )
            response.raise_for_status()
            logger.info(
                "[GrobidService] Success from %s, %d bytes XML",
                url_base,
                len(response.content),
            )
            return response.content
        except Exception as exc:
            logger.warning("[GrobidService] Failed at %s: %s", url_base, exc)
            last_error = exc

    raise last_error or RuntimeError("No GROBID instances available")
