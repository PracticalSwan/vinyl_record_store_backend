import { rateLimited } from "./errors.js";

// Defense-in-depth cap on interaction ingestion. Bounded batch size alone does
// not stop a single client from flooding the collection by varying eventId;
// this tracks total events accepted per identity per minute. Per-identity keys
// mean a careless or buggy client is throttled, while the accepted classroom
// limitation (an attacker rotating anonymousId/IP) is documented as residual.
const WINDOW_MS = 60_000;
const MAX_EVENTS = 120;
const buckets = globalThis.__vinylInteractionBuckets ?? new Map();
globalThis.__vinylInteractionBuckets = buckets;

function identityKey({ user, events, request }) {
  if (user?.publicId) return `user:${user.publicId}`;
  const anonymousId = events.find((event) => event?.anonymousId)?.anonymousId;
  if (anonymousId) return `anon:${anonymousId}`;
  const forwarded = request.headers.get("x-forwarded-for")?.split(",", 1)[0].trim();
  return `ip:${forwarded || "local"}`;
}

function liveBucket(key, now) {
  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    const next = { count: 0, resetAt: now + WINDOW_MS };
    buckets.set(key, next);
    return next;
  }
  return current;
}

export function assertInteractionCap({ user, events, request, now = Date.now() }) {
  const bucket = liveBucket(identityKey({ user, events, request }), now);
  if (bucket.count + events.length > MAX_EVENTS) {
    throw rateLimited(Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)));
  }
  bucket.count += events.length;
}

export function resetInteractionCapForTests() {
  buckets.clear();
}

export const INTERACTION_CAP_LIMIT = MAX_EVENTS;
