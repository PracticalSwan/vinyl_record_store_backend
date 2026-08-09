import test from "node:test";
import assert from "node:assert/strict";
import nextConfig from "../next.config.mjs";

test("API routes expose the configured frontend CORS origin", async () => {
  const rules = await nextConfig.headers();
  const apiRule = rules.find((rule) => rule.source === "/api/:path*");
  const origin = apiRule.headers.find((header) => header.key === "Access-Control-Allow-Origin");

  assert.equal(
    origin.value,
    (process.env.FRONTEND_ORIGIN || "http://localhost:5173").replace(/\/$/, ""),
  );
  assert.equal(
    apiRule.headers.find((header) => header.key === "Access-Control-Allow-Credentials").value,
    "true",
  );
  assert.equal(
    apiRule.headers.find((header) => header.key === "Access-Control-Allow-Methods").value,
    "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  );
});

test("API routes normalize a trailing slash on FRONTEND_ORIGIN", async () => {
  const previousOrigin = process.env.FRONTEND_ORIGIN;
  process.env.FRONTEND_ORIGIN = "http://localhost:5173/";
  try {
    const { default: config } = await import(`../next.config.mjs?cors-slash=${Date.now()}`);
    const rules = await config.headers();
    const apiRule = rules.find((rule) => rule.source === "/api/:path*");
    const origin = apiRule.headers.find((header) => header.key === "Access-Control-Allow-Origin");
    assert.equal(origin.value, "http://localhost:5173");
  } finally {
    if (previousOrigin === undefined) delete process.env.FRONTEND_ORIGIN;
    else process.env.FRONTEND_ORIGIN = previousOrigin;
  }
});
