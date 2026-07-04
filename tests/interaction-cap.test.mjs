import test from "node:test";
import assert from "node:assert/strict";
import {
  assertInteractionCap,
  resetInteractionCapForTests,
  INTERACTION_CAP_LIMIT,
} from "../src/lib/interactionCap.js";

function request() {
  return new Request("http://localhost:3000/api/interactions", {
    headers: { origin: "http://localhost:5173" },
  });
}

const events = (count, anonymousId = "anon-1") => Array.from(
  { length: count },
  (_, index) => ({ anonymousId, eventId: `event-${index}` }),
);

test("interaction cap admits events up to the limit and blocks the rest", () => {
  resetInteractionCapForTests();
  const batches = Math.floor(INTERACTION_CAP_LIMIT / 50);
  for (let index = 0; index < batches; index += 1) {
    assertInteractionCap({ user: null, events: events(50), request: request() });
  }
  assert.throws(
    () => assertInteractionCap({ user: null, events: events(50), request: request() }),
    (error) => error.code === "RATE_LIMITED" && error.status === 429 && error.retryAfterSeconds >= 1,
  );
  resetInteractionCapForTests();
});

test("interaction cap keys separately by anonymousId and authenticated user", () => {
  resetInteractionCapForTests();
  assertInteractionCap({ user: { publicId: "user-1" }, events: events(50), request: request() });
  assertInteractionCap({ user: null, events: events(50, "anon-a"), request: request() });
  assertInteractionCap({ user: null, events: events(50, "anon-b"), request: request() });
  resetInteractionCapForTests();
});
