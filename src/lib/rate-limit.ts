type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

export const consumeRateLimit = (
  namespace: string,
  key: string,
  limit: number,
  windowMs: number,
): boolean => {
  const now = Date.now();
  const bucketKey = `${namespace}:${key}`;
  const existing = buckets.get(bucketKey);
  if (!existing || existing.resetAt <= now) {
    buckets.set(bucketKey, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (existing.count >= limit) {
    return false;
  }
  existing.count += 1;
  return true;
};
