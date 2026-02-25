import asyncio
from typing import Final

import httpx
from fastapi import APIRouter, HTTPException, Request

from app.config import GROBID_INSTANCES, settings

router = APIRouter()

_GROBID_INSTANCE_BY_ID = {instance["id"]: instance for instance in GROBID_INSTANCES}
_FAST_HEALTH_TIMEOUT_SECONDS: Final[float] = 6.0
_ACCURATE_HEALTH_TIMEOUT_SECONDS: Final[float] = 60.0
_ACCURATE_HEALTH_ATTEMPTS: Final[int] = 2
_HEALTH_RETRY_DELAY_SECONDS: Final[float] = 0.3
_HEALTH_RETRYABLE_STATUS_CODES: Final[set[int]] = {500, 502, 503, 504}


def _build_health_probe_pdf() -> bytes:
    """Build a small but valid PDF containing a References section."""
    stream = (
        b"BT\n"
        b"/F1 12 Tf\n"
        b"72 720 Td\n"
        b"(References) Tj\n"
        b"0 -20 Td\n"
        b"([1] Example, A. A test reference.) Tj\n"
        b"0 -16 Td\n"
        b"([2] Another, B. Yet another citation.) Tj\n"
        b"ET\n"
    )
    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] "
        b"/Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
        b"<< /Length " + str(len(stream)).encode() + b" >>\nstream\n" + stream + b"endstream",
    ]

    parts = [b"%PDF-1.4\n"]
    offsets = [0]
    for idx, obj in enumerate(objects, start=1):
        offsets.append(sum(len(part) for part in parts))
        parts.append(f"{idx} 0 obj\n".encode() + obj + b"\nendobj\n")

    xref_offset = sum(len(part) for part in parts)
    parts.append(f"xref\n0 {len(objects) + 1}\n".encode())
    parts.append(b"0000000000 65535 f \n")
    for offset in offsets[1:]:
        parts.append(f"{offset:010d} 00000 n \n".encode())
    parts.append(
        f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\n"
        f"startxref\n{xref_offset}\n%%EOF\n".encode()
    )
    return b"".join(parts)


_HEALTH_PROBE_PDF = _build_health_probe_pdf()


async def _check_grobid_instance(
    client: httpx.AsyncClient,
    url: str,
    *,
    timeout_seconds: float = _ACCURATE_HEALTH_TIMEOUT_SECONDS,
    attempts: int = _ACCURATE_HEALTH_ATTEMPTS,
) -> bool:
    """Check if a GROBID instance can actually run processReferences."""
    for attempt in range(attempts):
        try:
            parse_resp = await client.post(
                f"{url}/api/processReferences",
                files={"input": ("health-check.pdf", _HEALTH_PROBE_PDF, "application/pdf")},
                data={
                    # Match /api/extract settings to mirror real behavior.
                    "consolidateCitations": "1",
                    "includeRawCitations": "1",
                },
                timeout=timeout_seconds,
            )
            status = parse_resp.status_code
            if status == 404:
                return False
            if 200 <= status < 500:
                return True
            if status not in _HEALTH_RETRYABLE_STATUS_CODES:
                return False
        except (httpx.TimeoutException, httpx.RequestError):
            pass
        except Exception:
            return False

        if attempt < attempts - 1:
            await asyncio.sleep(_HEALTH_RETRY_DELAY_SECONDS)

    return False


@router.get("/health")
async def health_check(request: Request):
    client: httpx.AsyncClient = request.app.state.grobid_client

    # Concurrently check all GROBID instances
    checks = {
        inst["id"]: _check_grobid_instance(
            client,
            inst["url"],
            timeout_seconds=_FAST_HEALTH_TIMEOUT_SECONDS,
            attempts=1,
        )
        for inst in GROBID_INSTANCES
    }
    results = await asyncio.gather(*checks.values())
    grobid_status = dict(zip(checks.keys(), results))

    return {
        "status": "ok",
        "grobid_reachable": any(grobid_status.values()),
        "grobid_status": grobid_status,
        "version": "0.1.0",
    }


@router.get("/grobid-instances")
async def list_grobid_instances():
    """Return available GROBID instances."""
    default_id = next(
        (instance["id"] for instance in GROBID_INSTANCES if instance["url"] == settings.grobid_url),
        GROBID_INSTANCES[0]["id"] if GROBID_INSTANCES else None,
    )
    return {
        "instances": GROBID_INSTANCES,
        "default_id": default_id,
    }


@router.get("/grobid-instances/{instance_id}/health")
async def check_grobid_instance_health(instance_id: str, request: Request):
    """Proxy health check for a specific GROBID instance (avoids browser CORS)."""
    instance = _GROBID_INSTANCE_BY_ID.get(instance_id)
    if not instance:
        raise HTTPException(status_code=404, detail="Unknown GROBID instance ID.")

    client: httpx.AsyncClient = request.app.state.grobid_client
    reachable = await _check_grobid_instance(client, instance["url"])
    return {"id": instance_id, "reachable": reachable}
