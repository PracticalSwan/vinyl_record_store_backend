import test from "node:test";
import assert from "node:assert/strict";
import { trackingOptedOut } from "../src/lib/trackingOptOut.js";

test("tracking opt-out recognizes only the exact false header value", () => {
  assert.equal(trackingOptedOut({ headers: new Headers({ "X-Tracking-Enabled": "false" }) }), true);
  assert.equal(trackingOptedOut({ headers: new Headers({ "X-Tracking-Enabled": "False" }) }), false);
  assert.equal(trackingOptedOut({ headers: new Headers({ "X-Tracking-Enabled": "true" }) }), false);
  assert.equal(trackingOptedOut({ headers: new Headers() }), false);
});
