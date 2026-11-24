import type { NextFunction, Request, Response } from 'express';

interface Bucket {
  timestamps: number[];
}

export function createRateLimiter(options: {
  windowMs: number;
  maxRequests: number;
  message?: string;
}) {
  const buckets = new Map<string, Bucket>();

  return (req: Request, res: Response, next: NextFunction): void => {
    const ip =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.socket.remoteAddress ||
      'unknown';
    const now = Date.now();
    const cutoff = now - options.windowMs;

    let bucket = buckets.get(ip);
    if (!bucket) {
      bucket = { timestamps: [] };
      buckets.set(ip, bucket);
    }

    bucket.timestamps = bucket.timestamps.filter((ts) => ts > cutoff);

    if (bucket.timestamps.length >= options.maxRequests) {
      const retryAfterSec = Math.ceil((bucket.timestamps[0] + options.windowMs - now) / 1000);
      res.setHeader('Retry-After', String(Math.max(1, retryAfterSec)));
      res.status(429).json({
        detail: options.message || 'Too many requests. Please slow down and try again shortly.',
      });
      return;
    }

    bucket.timestamps.push(now);

    // Prevent unbounded memory growth
    if (buckets.size > 5000) {
      for (const [key, b] of buckets.entries()) {
        if (b.timestamps.every((ts) => ts <= cutoff)) {
          buckets.delete(key);
        }
      }
    }

    next();
  };
}
