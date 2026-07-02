import test from "node:test";
import assert from "node:assert/strict";
import nextConfig from "../next.config.mjs";

test("API routes expose the configured frontend CORS origin", async () => {
  const rules = await nextConfig.headers();
  const apiRule = rules.find((rule) => rule.source === "/api/:path*");
  const origin = apiRule.headers.find((header) => header.key === "Access-Control-Allow-Origin");

  assert.equal(origin.value, process.env.FRONTEND_ORIGIN || "http://localhost:5173");
});
