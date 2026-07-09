import { randomBytes } from "node:crypto";
import { invalid } from "../errors.js";

// BFP-07 catalog import applies a preview exactly once. The token binds the
// validated+enriched rows the administrator reviewed so apply cannot be replayed
// or used after expiry. The store is process-local: it suits the single-process
// classroom server and matches the existing CLI-driven import boundary. A
// serverless deployment would need to move this to a shared store.
const DEFAULT_TTL_MS = 15 * 60 * 1000;
const TOKEN_BYTES = 32;

const store = new Map();

export function createPreviewToken(payload, { now = Date.now, ttlMs = DEFAULT_TTL_MS } = {}) {
  const token = randomBytes(TOKEN_BYTES).toString("base64url");
  store.set(token, { payload, expiresAt: now() + ttlMs });
  return token;
}

export function consumePreviewToken(token, { now = Date.now } = {}) {
  const entry = store.get(token);
  if (!entry) {
    throw invalid("The preview token is invalid or unknown.");
  }
  if (now() > entry.expiresAt) {
    store.delete(token);
    throw invalid("The preview token has expired.");
  }
  // One-time use: delete before returning so the token can never be reapplied.
  // A replay resolves to "unknown" (INVALID_INPUT) above, which the test suite
  // asserts; replay is fully blocked either way.
  store.delete(token);
  return entry.payload;
}

export function peekPreviewToken(token, { now = Date.now } = {}) {
  const entry = store.get(token);
  if (!entry || now() > entry.expiresAt) return null;
  return entry.payload;
}

// Test-only helper; not exported through any route.
export function __clearPreviewTokens() {
  store.clear();
}
