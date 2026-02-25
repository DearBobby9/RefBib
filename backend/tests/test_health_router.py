"""Tests for GROBID instance health probes."""

from types import SimpleNamespace
from unittest.mock import AsyncMock

import httpx
import pytest

from app.routers.health import _check_grobid_instance


@pytest.mark.asyncio
async def test_check_grobid_instance_returns_true_when_parse_endpoint_responds():
    client = AsyncMock()
    client.post.return_value = SimpleNamespace(status_code=200)

    ok = await _check_grobid_instance(client, "https://example.com")

    assert ok is True


@pytest.mark.asyncio
async def test_check_grobid_instance_treats_non_5xx_as_reachable():
    client = AsyncMock()
    client.post.return_value = SimpleNamespace(status_code=422)

    ok = await _check_grobid_instance(client, "https://example.com")

    assert ok is True


@pytest.mark.asyncio
async def test_check_grobid_instance_retries_on_503_then_succeeds():
    client = AsyncMock()
    client.post.side_effect = [
        SimpleNamespace(status_code=503),
        SimpleNamespace(status_code=200),
    ]

    ok = await _check_grobid_instance(
        client,
        "https://example.com",
        timeout_seconds=1.0,
        attempts=2,
    )

    assert ok is True
    assert client.post.call_count == 2


@pytest.mark.asyncio
async def test_check_grobid_instance_returns_false_when_all_attempts_fail():
    client = AsyncMock()
    client.post.return_value = SimpleNamespace(status_code=503)

    ok = await _check_grobid_instance(
        client,
        "https://example.com",
        timeout_seconds=1.0,
        attempts=2,
    )

    assert ok is False
    assert client.post.call_count == 2


@pytest.mark.asyncio
async def test_check_grobid_instance_retries_on_timeout():
    client = AsyncMock()
    client.post.side_effect = [
        httpx.ReadTimeout("timeout"),
        SimpleNamespace(status_code=200),
    ]

    ok = await _check_grobid_instance(
        client,
        "https://example.com",
        timeout_seconds=1.0,
        attempts=2,
    )

    assert ok is True
    assert client.post.call_count == 2
