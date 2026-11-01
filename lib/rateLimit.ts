import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

let limiter: Ratelimit | null | undefined;

// Returns null (rate limiting simply skipped, not enforced) when Upstash
// isn't configured yet — lets local dev/testing work before that's set up.
// For the real deployment, UPSTASH_REDIS_REST_URL / _TOKEN must be set for
// this protection to actually be active.
export function getRateLimiter(): Ratelimit | null {
  if (limiter !== undefined) return limiter;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    limiter = null;
    return limiter;
  }

  limiter = new Ratelimit({
    redis: new Redis({ url, token }),
    // 60 requests/minute per key — generous for a single clinic's real
    // traffic, tight enough to blunt brute-forcing or scraping.
    limiter: Ratelimit.slidingWindow(60, '1 m'),
    analytics: false,
  });
  return limiter;
}

// A separate, tighter limiter for the enrollment endpoint specifically —
// it's the one route reachable with no device token at all, so it's the
// most attractive target for brute-forcing enrollment tokens.
let enrollLimiter: Ratelimit | null | undefined;

export function getEnrollRateLimiter(): Ratelimit | null {
  if (enrollLimiter !== undefined) return enrollLimiter;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    enrollLimiter = null;
    return enrollLimiter;
  }

  enrollLimiter = new Ratelimit({
    redis: new Redis({ url, token }),
    limiter: Ratelimit.slidingWindow(5, '1 m'),
    analytics: false,
  });
  return enrollLimiter;
}
