import { rateLimited } from "../errors.js";

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const buckets = globalThis.__vinylAuthRateLimits ?? new Map();
globalThis.__vinylAuthRateLimits = buckets;

function clientKey(request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",", 1)[0].trim();
  return forwarded || request.headers.get("x-real-ip")?.trim() || "local";
}

function keys(request, identifier) {
  return [`identifier:${identifier}`, `client:${clientKey(request)}`];
}

function liveBucket(key, now) {
  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    const next = { attempts: 0, resetAt: now + WINDOW_MS };
    buckets.set(key, next);
    return next;
  }
  return current;
}

export function assertLoginAllowed(request, identifier, now = Date.now()) {
  for (const key of keys(request, identifier)) {
    const bucket = liveBucket(key, now);
    if (bucket.attempts >= MAX_ATTEMPTS) {
      throw rateLimited(Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)));
    }
  }
}

export function recordLoginFailure(request, identifier, now = Date.now()) {
  for (const key of keys(request, identifier)) liveBucket(key, now).attempts += 1;
}

export function resetLoginFailures(request, identifier) {
  for (const key of keys(request, identifier)) buckets.delete(key);
}

export function resetRateLimitsForTests() {
  buckets.clear();
}
