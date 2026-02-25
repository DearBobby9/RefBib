"""Async token bucket rate limiter for API calls."""

import asyncio
import logging
import time

logger = logging.getLogger(__name__)


class TokenBucketRateLimiter:
    """Token bucket rate limiter using asyncio.

    Tokens are replenished at a fixed rate (tokens per second).
    Each ``acquire()`` call consumes one token, blocking if none are available.

    Args:
        rate: Tokens added per second.
        max_tokens: Maximum burst capacity. Defaults to ``max(1.0, rate)``
                    so acquires can progress even when ``0 < rate < 1``.
    """

    def __init__(self, rate: float, max_tokens: float | None = None) -> None:
        if rate <= 0:
            raise ValueError("rate must be greater than 0")
        self.rate = rate
        default_max_tokens = max(1.0, rate)
        self.max_tokens = max_tokens if max_tokens is not None else default_max_tokens
        if self.max_tokens <= 0:
            raise ValueError("max_tokens must be greater than 0")
        self._tokens = self.max_tokens
        self._last_refill = time.monotonic()
        self._lock = asyncio.Lock()

        logger.debug(
            "[RateLimiter] Initialized with rate=%.2f tokens/s, max_tokens=%.2f",
            self.rate,
            self.max_tokens,
        )

    def _refill(self) -> None:
        """Add tokens based on elapsed time since last refill."""
        now = time.monotonic()
        elapsed = now - self._last_refill
        self._tokens = min(self.max_tokens, self._tokens + elapsed * self.rate)
        self._last_refill = now

    async def acquire(self) -> None:
        """Wait until a token is available, then consume it."""
        while True:
            async with self._lock:
                self._refill()
                if self._tokens >= 1.0:
                    self._tokens -= 1.0
                    return
                # Calculate how long we need to wait for one token
                wait_time = (1.0 - self._tokens) / self.rate

            logger.debug(
                "[RateLimiter] No token available, waiting %.3fs", wait_time
            )
            await asyncio.sleep(wait_time)
