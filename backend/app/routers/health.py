import asyncio

import httpx
from fastapi import APIRouter, HTTPException, Request

from app.config import GROBID_INSTANCES, settings

router = APIRouter()

_GROBID_INSTANCE_BY_ID = {instance["id"]: instance for instance in GROBID_INSTANCES}


async def _check_grobid_instance(
    client: httpx.AsyncClient, url: str
) -> bool:
    """Check if a single GROBID instance is reachable."""
    try:
        resp = await client.get(f"{url}/api/isalive", timeout=5.0)
        return resp.status_code == 200
    except Exception:
        return False


@router.get("/health")
async def health_check(request: Request):
    client: httpx.AsyncClient = request.app.state.grobid_client

    # Concurrently check all GROBID instances
    checks = {
        inst["id"]: _check_grobid_instance(client, inst["url"])
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
