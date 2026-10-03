// Basic in-memory rate limiter.
// Good enough to blunt burst/spam attacks. Note: in a multi-instance
// deployment each instance has its own memory — this is not a substitute
// for a real distributed limiter (Redis, etc.), but it stops most naive
// spam scripts with zero infra.

const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

export function checkRateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const entry = rateLimitMap.get(key);

  if (!entry || entry.resetTime < now) {
    rateLimitMap.set(key, { count: 1, resetTime: now + windowMs });
    return { success: true };
  }

  if (entry.count >= limit) {
    return { success: false };
  }

  entry.count += 1;
  return { success: true };
}
