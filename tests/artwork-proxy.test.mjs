import test from "node:test";
import assert from "node:assert/strict";
import { ArtworkProxyError, createArtworkImageProxy } from "../src/lib/external/artworkImageProxy.js";
import { createArtworkResponse } from "../src/services/artworkImage.js";

const PNG_BYTES = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function imageResponse({ status = 200, contentType = "image/jpeg", body = PNG_BYTES, url = "https://coverartarchive.org/release/x/cover-500.jpg" }) {
  return {
    ok: status >= 200 && status < 300,
    status,
    url,
    headers: new Map([["content-type", contentType]]),
    body: null,
    arrayBuffer: async () => body,
  };
}

function makeProxy({ fetchImpl, cache } = {}) {
  const calls = [];
  const wrapped = async (url, options) => {
    calls.push(String(url));
    return fetchImpl(url, options);
  };
  const proxy = createArtworkImageProxy({
    fetchImpl: wrapped,
    cache: cache ?? { get: async () => null, set: async () => {} },
    userAgent: "GroovehausTest/1.0 (test@example.com)",
  });
  return { proxy, calls };
}

const CAA_URL = "https://coverartarchive.org/release/abc/cover-500.jpg";

test("artwork proxy fetches an approved Cover Art Archive image and caches its bytes", async () => {
  let stored;
  const { proxy, calls } = makeProxy({
    fetchImpl: async () => imageResponse({ contentType: "image/jpeg; charset=binary" }),
    cache: {
      get: async () => null,
      set: async (_key, value) => { stored = value; },
    },
  });
  const result = await proxy.fetchImage(CAA_URL);
  assert.equal(result.contentType, "image/jpeg");
  assert.deepEqual(result.body, PNG_BYTES);
  assert.equal(calls.length, 1);
  assert.equal(stored.contentType, "image/jpeg");
  assert.deepEqual(stored.body, PNG_BYTES);
});

test("artwork proxy serves a cache hit without calling upstream", async () => {
  const { proxy, calls } = makeProxy({
    fetchImpl: async () => { throw new Error("upstream should not be called"); },
    cache: { get: async () => ({ contentType: "image/png", body: PNG_BYTES }), set: async () => {} },
  });
  const result = await proxy.fetchImage(CAA_URL);
  assert.equal(result.contentType, "image/png");
  assert.deepEqual(result.body, PNG_BYTES);
  assert.equal(calls.length, 0);
});

test("artwork proxy rejects any non-Cover-Art-Archive host (SSRF boundary)", async () => {
  const { proxy } = makeProxy({ fetchImpl: async () => imageResponse({}) });
  await assert.rejects(() => proxy.fetchImage("https://evil.example/cover.jpg"), (error) => {
    assert.equal(error instanceof ArtworkProxyError, true);
    assert.equal(error.code, "ARTWORK_HOST_NOT_ALLOWED");
    assert.equal(error.status, 400);
    return true;
  });
  await assert.rejects(() => proxy.fetchImage("http://169.254.169.254/latest/meta-data"), (error) => {
    assert.equal(error.code, "ARTWORK_HOST_NOT_ALLOWED");
    return true;
  });
  await assert.rejects(() => proxy.fetchImage("not a url at all"), (error) => {
    assert.equal(error.code, "ARTWORK_URL_INVALID");
    return true;
  });
});

test("artwork proxy rejects a redirect that leaves the trusted host family", async () => {
  const { proxy } = makeProxy({
    fetchImpl: async () => imageResponse({ url: "https://internal.corp/leak.jpg" }),
  });
  await assert.rejects(() => proxy.fetchImage(CAA_URL), (error) => {
    assert.equal(error.code, "ARTWORK_HOST_NOT_ALLOWED");
    assert.equal(error.status, 502);
    return true;
  });
});

test("artwork proxy accepts a redirect that lands on the trusted Internet Archive family", async () => {
  const { proxy } = makeProxy({
    fetchImpl: async () => imageResponse({ url: "https://archive.org/services/img/abc/cover-500.jpg" }),
  });
  const result = await proxy.fetchImage(CAA_URL);
  assert.equal(result.contentType, "image/jpeg");
  assert.deepEqual(result.body, PNG_BYTES);
});

test("artwork proxy rejects an unparseable resolved redirect url", async () => {
  const { proxy } = makeProxy({
    fetchImpl: async () => imageResponse({ url: "not a url" }),
  });
  await assert.rejects(() => proxy.fetchImage(CAA_URL), (error) => {
    assert.equal(error.code, "ARTWORK_HOST_NOT_ALLOWED");
    return true;
  });
});

test("artwork proxy maps a 404 upstream to ARTWORK_NOT_FOUND", async () => {
  const { proxy } = makeProxy({ fetchImpl: async () => imageResponse({ status: 404 }) });
  await assert.rejects(() => proxy.fetchImage("https://coverartarchive.org/release/abc/missing.jpg"), (error) => {
    assert.equal(error.code, "ARTWORK_NOT_FOUND");
    assert.equal(error.status, 404);
    return true;
  });
});

test("artwork proxy rejects a non-image content type", async () => {
  const { proxy } = makeProxy({
    fetchImpl: async () => ({ ok: true, status: 200, url: "https://coverartarchive.org/x", headers: new Map([["content-type", "text/html"]]), body: null, arrayBuffer: async () => PNG_BYTES }),
  });
  await assert.rejects(() => proxy.fetchImage("https://coverartarchive.org/release/abc/cover.jpg"), (error) => {
    assert.equal(error.code, "ARTWORK_UPSTREAM_ERROR");
    return true;
  });
});

test("artwork proxy caps oversized streamed responses", async () => {
  const huge = Buffer.alloc(7 * 1024 * 1024, 0xff);
  const { proxy } = makeProxy({
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      url: "https://coverartarchive.org/x",
      headers: new Map([["content-type", "image/jpeg"]]),
      body: { getReader: () => ({ read: async () => ({ value: huge, done: false }) }) },
    }),
  });
  await assert.rejects(() => proxy.fetchImage("https://coverartarchive.org/release/abc/cover.jpg"), (error) => {
    assert.equal(error.code, "ARTWORK_TOO_LARGE");
    assert.equal(error.status, 502);
    return true;
  });
});

test("artwork proxy maps an upstream timeout to ARTWORK_UPSTREAM_TIMEOUT", async () => {
  const timeout = new Error("timed out");
  timeout.name = "TimeoutError";
  const { proxy } = makeProxy({ fetchImpl: async () => { throw timeout; } });
  await assert.rejects(() => proxy.fetchImage("https://coverartarchive.org/release/abc/cover.jpg"), (error) => {
    assert.equal(error.code, "ARTWORK_UPSTREAM_TIMEOUT");
    assert.equal(error.status, 504);
    return true;
  });
});

test("artwork proxy maps a timeout during body streaming to ARTWORK_UPSTREAM_TIMEOUT", async () => {
  const timeout = new Error("timed out");
  timeout.name = "TimeoutError";
  const { proxy } = makeProxy({
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      url: "https://coverartarchive.org/x",
      headers: new Map([["content-type", "image/jpeg"]]),
      body: { getReader: () => ({ read: async () => { throw timeout; } }) },
    }),
  });
  await assert.rejects(() => proxy.fetchImage("https://coverartarchive.org/release/abc/cover.jpg"), (error) => {
    assert.equal(error.code, "ARTWORK_UPSTREAM_TIMEOUT");
    assert.equal(error.status, 504);
    return true;
  });
});

test("artwork proxy maps a body-stream network error to ARTWORK_UPSTREAM_UNREACHABLE", async () => {
  const { proxy } = makeProxy({
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      url: "https://coverartarchive.org/x",
      headers: new Map([["content-type", "image/jpeg"]]),
      body: { getReader: () => ({ read: async () => { throw new Error("socket hang up"); } }) },
    }),
  });
  await assert.rejects(() => proxy.fetchImage("https://coverartarchive.org/release/abc/cover.jpg"), (error) => {
    assert.equal(error.code, "ARTWORK_UPSTREAM_UNREACHABLE");
    assert.equal(error.status, 502);
    return true;
  });
});

test("createArtworkResponse streams the image with safe caching headers on success", async () => {
  const { proxy } = makeProxy({ fetchImpl: async () => imageResponse({}) });
  const result = await createArtworkResponse(CAA_URL, { proxy });
  assert.equal(result.ok, true);
  assert.equal(result.status, 200);
  assert.equal(result.headers["Content-Type"], "image/jpeg");
  assert.match(result.headers["Cache-Control"], /immutable/);
  assert.equal(result.headers["X-Content-Type-Options"], "nosniff");
  assert.deepEqual(result.body, PNG_BYTES);
});

test("createArtworkResponse rejects a missing url and a disallowed host", async () => {
  const missing = await createArtworkResponse(null);
  assert.equal(missing.ok, false);
  assert.equal(missing.status, 400);
  assert.equal(missing.code, "ARTWORK_URL_INVALID");

  const { proxy } = makeProxy({ fetchImpl: async () => imageResponse({}) });
  const hostile = await createArtworkResponse("https://evil.example/cover.jpg", { proxy });
  assert.equal(hostile.ok, false);
  assert.equal(hostile.status, 400);
  assert.equal(hostile.code, "ARTWORK_HOST_NOT_ALLOWED");
});

test("createArtworkResponse surfaces an upstream 404 as a 404", async () => {
  const { proxy } = makeProxy({ fetchImpl: async () => imageResponse({ status: 404 }) });
  const result = await createArtworkResponse("https://coverartarchive.org/release/abc/missing.jpg", { proxy });
  assert.equal(result.ok, false);
  assert.equal(result.status, 404);
  assert.equal(result.code, "ARTWORK_NOT_FOUND");
});
