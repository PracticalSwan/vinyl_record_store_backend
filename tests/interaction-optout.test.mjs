import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { trackingOptedOut } from "../src/lib/trackingOptOut.js";

test("tracking opt-out recognizes only the exact false header value", () => {
  assert.equal(trackingOptedOut({ headers: new Headers({ "X-Tracking-Enabled": "false" }) }), true);
  assert.equal(trackingOptedOut({ headers: new Headers({ "X-Tracking-Enabled": "False" }) }), false);
  assert.equal(trackingOptedOut({ headers: new Headers({ "X-Tracking-Enabled": "true" }) }), false);
  assert.equal(trackingOptedOut({ headers: new Headers() }), false);
});

test("interaction route exits on opt-out before session, parsing, caps, or persistence", async () => {
  const source = await readFile(new URL(
    "../src/app/api/interactions/route.js",
    import.meta.url,
  ), "utf8");
  const origin = source.indexOf("assertMutationOrigin(request);");
  const optOut = source.indexOf("if (trackingOptedOut(request))");
  const session = source.indexOf("getOptionalSession(request)");
  const parse = source.indexOf("parseInteractionBatch(");
  const ingest = source.indexOf("ingestInteractions(");
  assert.ok(origin >= 0 && optOut > origin);
  assert.ok(session > optOut);
  assert.ok(parse > optOut);
  assert.ok(ingest > optOut);
});
