"""Site-level password gate endpoints."""

import hmac
import logging

from fastapi import APIRouter
from pydantic import BaseModel

from app.config import settings

logger = logging.getLogger(__name__)

router = APIRouter()


class PasswordRequest(BaseModel):
    password: str


@router.get("/auth/status")
async def auth_status():
    """Check whether password protection is enabled."""
    return {"required": bool(settings.site_password)}


@router.post("/verify-password")
async def verify_password(body: PasswordRequest):
    """Verify the site password."""
    if not settings.site_password:
        return {"valid": True, "required": False}

    valid = hmac.compare_digest(body.password, settings.site_password)
    if not valid:
        logger.info("[Auth] Failed password attempt")
    return {"valid": valid, "required": True}
