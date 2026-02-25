"""Tests for rate limiter edge cases."""

import asyncio

import pytest

from app.utils.rate_limiter import TokenBucketRateLimiter


def test_rate_must_be_positive():
    with pytest.raises(ValueError):
        TokenBucketRateLimiter(0.0)
    with pytest.raises(ValueError):
        TokenBucketRateLimiter(-1.0)


def test_max_tokens_must_be_positive():
    with pytest.raises(ValueError):
        TokenBucketRateLimiter(1.0, max_tokens=0.0)


def test_rate_below_one_allows_acquire_immediately():
    limiter = TokenBucketRateLimiter(0.5)
    asyncio.run(asyncio.wait_for(limiter.acquire(), timeout=0.1))
