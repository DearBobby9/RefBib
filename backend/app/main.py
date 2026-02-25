from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import auth, health, references
from app.utils.rate_limiter import TokenBucketRateLimiter


def _build_allowed_origins() -> list[str]:
    origins = [settings.frontend_url]
    if settings.app_env.lower() != "production":
        for origin in ("http://localhost:3000", "http://localhost:3001"):
            if origin not in origins:
                origins.append(origin)
    return origins


@asynccontextmanager
async def lifespan(app: FastAPI):
    timeout = httpx.Timeout(60.0, connect=10.0)
    limits = httpx.Limits(max_connections=50, max_keepalive_connections=20)

    app.state.http_client = httpx.AsyncClient(
        timeout=timeout,
        limits=limits,
    )
    app.state.grobid_client = httpx.AsyncClient(
        timeout=timeout,
        limits=limits,
        verify=settings.grobid_verify_ssl,
    )
    app.state.crossref_rate_limiter = TokenBucketRateLimiter(settings.crossref_rps)
    app.state.semantic_scholar_rate_limiter = TokenBucketRateLimiter(
        settings.semantic_scholar_rps
    )
    app.state.dblp_rate_limiter = TokenBucketRateLimiter(settings.dblp_rps)
    yield
    await app.state.http_client.aclose()
    await app.state.grobid_client.aclose()


app = FastAPI(
    title="RefBib API",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_build_allowed_origins(),
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api")
app.include_router(health.router, prefix="/api")
app.include_router(references.router, prefix="/api")
