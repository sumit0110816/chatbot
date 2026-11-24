import time
from collections import defaultdict
from typing import Dict, List

from fastapi import HTTPException, Request, status


class SlidingWindowRateLimiter:
    def __init__(self, max_requests: int, window_seconds: int, detail: str):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self.detail = detail
        self._buckets: Dict[str, List[float]] = defaultdict(list)

    def __call__(self, request: Request) -> None:
        forwarded = request.headers.get("x-forwarded-for")
        client_ip = (
            forwarded.split(",")[0].strip()
            if forwarded
            else (request.client.host if request.client else "unknown")
        )
        now = time.time()
        cutoff = now - self.window_seconds

        timestamps = [ts for ts in self._buckets[client_ip] if ts > cutoff]
        if len(timestamps) >= self.max_requests:
            retry_after = max(1, int(timestamps[0] + self.window_seconds - now))
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=self.detail,
                headers={"Retry-After": str(retry_after)},
            )

        timestamps.append(now)
        self._buckets[client_ip] = timestamps


auth_rate_limiter = SlidingWindowRateLimiter(
    max_requests=25,
    window_seconds=60,
    detail="Too many authentication attempts. Please wait a minute before trying again.",
)

chat_rate_limiter = SlidingWindowRateLimiter(
    max_requests=40,
    window_seconds=60,
    detail="Message rate limit reached. Please wait a moment before sending more messages.",
)
