import test from "node:test";
import assert from "node:assert/strict";
import { hashPassword, verifyPassword } from "../src/lib/auth/password.js";
import { createSessionToken, verifySessionToken } from "../src/lib/auth/session.js";
import { getOptionalSession, requireRole, requireSession } from "../src/lib/auth/requireSession.js";
import { resetRateLimitsForTests } from "../src/lib/auth/rateLimit.js";
import { login, register } from "../src/services/auth.js";
import { parseLoginInput, parseRegistrationInput } from "../src/validation/auth.js";
import { assertMutationOrigin, readJsonBody } from "../src/lib/request.js";

const secret = "test-auth-secret-with-at-least-thirty-two-characters";
const origin = "http://localhost:5173";

function request({ cookie, client = "127.0.0.1" } = {}) {
  const headers = new Headers({ origin, "x-forwarded-for": client });
  if (cookie) headers.set("cookie", cookie);
  return new Request("http://localhost:3000/api/test", { headers });
}

test("scrypt password hashes verify without exposing the password", async () => {
  const value = await hashPassword("correct horse battery staple");
  assert.match(value.passwordHash, /^scrypt\$/);
  assert.equal(await verifyPassword("correct horse battery staple", value.passwordHash, value.passwordSalt), true);
  assert.equal(await verifyPassword("wrong password value", value.passwordHash, value.passwordSalt), false);
  assert.equal(value.passwordHash.includes("correct horse"), false);
});

test("session tokens reject tampering and expiration", () => {
  const environment = { AUTH_SECRET: secret };
  const user = { publicId: "demo-customer", role: "customer", sessionVersion: 2 };
  const token = createSessionToken(user, { environment, now: 1_000_000 });
  assert.equal(verifySessionToken(token, { environment, now: 1_000_000 }).sub, "demo-customer");
  assert.equal(verifySessionToken(`${token}x`, { environment, now: 1_000_000 }), null);
  assert.equal(verifySessionToken(token, { environment, now: 1_000_000 + (8 * 60 * 60 * 1000) }), null);
});

test("seeded login uses one generic failure and enforces rate limits", async () => {
  resetRateLimitsForTests();
  const password = await hashPassword("classroom customer password");
  const environment = {
    AUTH_SECRET: secret,
    AUTH_DEMO_CUSTOMER_USERNAME: "listener",
    AUTH_DEMO_CUSTOMER_PASSWORD_HASH: password.passwordHash,
    AUTH_DEMO_CUSTOMER_PASSWORD_SALT: password.passwordSalt,
  };
  let repositoryLookups = 0;
  const repository = {
    findForAuthentication: async () => {
      repositoryLookups += 1;
      return null;
    },
  };
  const valid = parseLoginInput({ username: "Listener", password: "classroom customer password" });
  const result = await login(valid, request(), { environment, repository });
  assert.equal(result.user.publicId, "demo-customer");
  assert.equal(result.user.role, "customer");
  assert.equal(repositoryLookups, 1);

  const invalid = parseLoginInput({ username: "listener", password: "incorrect password" });
  for (let attempt = 0; attempt < 5; attempt += 1) {
    await assert.rejects(
      () => login(invalid, request({ client: "10.0.0.2" }), { environment, repository }),
      (error) => error.code === "UNAUTHENTICATED" && error.message === "The username or password is incorrect.",
    );
  }
  await assert.rejects(
    () => login(invalid, request({ client: "10.0.0.2" }), { environment, repository }),
    (error) => error.code === "RATE_LIMITED" && error.status === 429,
  );
});

test("registration creates only a customer and rejects role injection", async () => {
  let created;
  const repository = {
    create: async (value) => {
      created = value;
      return { ...value, preferences: {} };
    },
  };
  const environment = { AUTH_SECRET: secret };
  const body = parseRegistrationInput({
    username: "new_listener",
    password: "registered password value",
    displayName: "New Listener",
  });
  const result = await register(body, { environment, repository });
  assert.equal(created.role, "customer");
  assert.equal(created.passwordHash.includes("registered password value"), false);
  assert.equal(result.user.role, "customer");
  assert.throws(
    () => parseRegistrationInput({ ...body, role: "admin" }),
    /unsupported fields/,
  );
});

test("session resolution rejects missing, disabled, changed-role, and customer admin access", async () => {
  const environment = { AUTH_SECRET: secret };
  const active = {
    publicId: "user-1",
    username: "listener",
    displayName: null,
    role: "customer",
    sessionVersion: 0,
    active: true,
    preferences: {},
  };
  const token = createSessionToken(active, { environment });
  const cookie = `groovehaus_session=${encodeURIComponent(token)}`;
  const repository = { findByPublicId: async () => active };
  assert.equal((await requireSession(request({ cookie }), { environment, repository })).publicId, "user-1");
  await assert.rejects(
    () => requireRole(request({ cookie }), "admin", { environment, repository }),
    (error) => error.code === "FORBIDDEN",
  );
  assert.equal(await getOptionalSession(request(), { environment, repository }), null);
  assert.equal(await getOptionalSession(request({ cookie: "groovehaus_session=broken" }), { environment, repository }), null);
  assert.equal(await getOptionalSession(request({ cookie: "groovehaus_session=%" }), { environment, repository }), null);
  assert.equal(
    await getOptionalSession(request({ cookie }), {
      environment,
      repository: { findByPublicId: async () => ({ ...active, active: false }) },
    }),
    null,
  );
});

test("mutation requests require the exact configured origin and bounded JSON", async () => {
  const environment = { FRONTEND_ORIGIN: origin };
  assert.equal(assertMutationOrigin(request(), environment), origin);
  assert.throws(
    () => assertMutationOrigin(new Request("http://localhost/api"), environment),
    (error) => error.code === "FORBIDDEN",
  );
  assert.throws(
    () => assertMutationOrigin(new Request("http://localhost/api", {
      headers: { origin: "https://attacker.example" },
    }), environment),
    (error) => error.code === "FORBIDDEN",
  );

  const jsonRequest = new Request("http://localhost/api", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ quantity: 2 }),
  });
  assert.deepEqual(await readJsonBody(jsonRequest), { quantity: 2 });
  await assert.rejects(
    () => readJsonBody(new Request("http://localhost/api", {
      method: "POST",
      headers: { "content-type": "text/plain" },
      body: "{}",
    })),
    (error) => error.code === "INVALID_INPUT",
  );
});
