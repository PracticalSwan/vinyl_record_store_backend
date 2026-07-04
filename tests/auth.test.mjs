import test from "node:test";
import assert from "node:assert/strict";
import { hashPassword, verifyPassword } from "../src/lib/auth/password.js";
import { createSessionToken, verifySessionToken } from "../src/lib/auth/session.js";
import { clearSessionCookie } from "../src/lib/auth/cookie.js";
import { getOptionalSession, requireRole, requireSession } from "../src/lib/auth/requireSession.js";
import { login, register } from "../src/services/auth.js";
import { parseLoginInput, parseRegistrationInput } from "../src/validation/auth.js";
import { assertMutationOrigin, readJsonBody } from "../src/lib/request.js";

const secret = "test-auth-secret-with-at-least-thirty-two-characters";
const origin = "http://localhost:5173";

function request({ cookie } = {}) {
  const headers = new Headers({ origin });
  if (cookie) headers.set("cookie", cookie);
  return new Request("http://localhost:3000/api/test", { headers });
}

function stubCookieResponse() {
  const store = new Map();
  return {
    cookies: {
      set(options) { store.set(options.name, options); },
      get(name) { return store.get(name); },
    },
  };
}

test("scrypt password hashes verify without exposing the password", async () => {
  const value = await hashPassword("correct horse battery staple");
  assert.match(value.passwordHash, /^scrypt\$/);
  assert.equal(await verifyPassword("correct horse battery staple", value.passwordHash, value.passwordSalt), true);
  assert.equal(await verifyPassword("wrong password value", value.passwordHash, value.passwordSalt), false);
  assert.equal(value.passwordHash.includes("correct horse"), false);
});

test("weak scrypt hashes are rejected at verification time", async () => {
  const weakHash = `scrypt$2$1$1$32$${"00".repeat(32)}`;
  assert.equal(await verifyPassword("anything", weakHash, "salt"), false);
});

test("session tokens reject tampering and expiration", () => {
  const environment = { AUTH_SECRET: secret };
  const user = { publicId: "demo-customer", role: "customer" };
  const token = createSessionToken(user, { environment, now: 1_000_000 });
  assert.equal(verifySessionToken(token, { environment, now: 1_000_000 }).sub, "demo-customer");
  assert.equal(verifySessionToken(`${token}x`, { environment, now: 1_000_000 }), null);
  assert.equal(verifySessionToken(token, { environment, now: 1_000_000 + (8 * 60 * 60 * 1000) }), null);
});

test("seeded login succeeds and returns the generic error on a bad password", async () => {
  const passwordFields = await hashPassword("classroom customer password");
  const environment = {
    AUTH_SECRET: secret,
    AUTH_DEMO_CUSTOMER_USERNAME: "listener",
    AUTH_DEMO_CUSTOMER_PASSWORD_HASH: passwordFields.passwordHash,
    AUTH_DEMO_CUSTOMER_PASSWORD_SALT: passwordFields.passwordSalt,
  };
  let repositoryLookups = 0;
  const repository = {
    findForAuthentication: async () => {
      repositoryLookups += 1;
      return null;
    },
  };
  const valid = parseLoginInput({ username: "Listener", password: "classroom customer password" });
  const result = await login(valid, { environment, repository });
  assert.equal(result.user.publicId, "demo-customer");
  assert.equal(result.user.role, "customer");
  assert.equal(repositoryLookups, 1);

  const invalid = parseLoginInput({ username: "listener", password: "incorrect password" });
  await assert.rejects(
    () => login(invalid, { environment, repository }),
    (error) => error.code === "UNAUTHENTICATED" && error.message === "The username or password is incorrect.",
  );
});

test("unknown usernames run a dummy hash and return the generic login error", async () => {
  let dummyHashed = false;
  const environment = { AUTH_SECRET: secret };
  const repository = { findForAuthentication: async () => null };
  const spyHash = async () => {
    dummyHashed = true;
    return { passwordHash: "scrypt$16384$8$1$64$dummy", passwordSalt: "dummy" };
  };
  const invalid = parseLoginInput({ username: "ghost", password: "no-such-account" });
  await assert.rejects(
    () => login(invalid, { environment, repository, hashPassword: spyHash }),
    (error) => error.code === "UNAUTHENTICATED" && error.message === "The username or password is incorrect.",
  );
  assert.equal(dummyHashed, true);
});

test("registration creates only a customer, rejects role injection, and skips hashing for taken usernames", async () => {
  let created;
  const repository = {
    findByNormalizedUsername: async () => null,
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

  const taken = {
    findByNormalizedUsername: async () => ({ publicId: "user-existing", normalizedUsername: "new_listener" }),
  };
  await assert.rejects(
    () => register(body, { environment, repository: taken }),
    (error) => error.code === "CONFLICT",
  );
});

test("session resolution rejects missing, disabled, and changed-role tokens", async () => {
  const environment = { AUTH_SECRET: secret };
  const active = {
    publicId: "user-1",
    username: "listener",
    displayName: null,
    role: "customer",
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

test("logout clears the session cookie with an expired maxAge", () => {
  const response = stubCookieResponse();
  clearSessionCookie(response, request());
  const cookie = response.cookies.get("groovehaus_session");
  assert.equal(cookie.value, "");
  assert.equal(cookie.maxAge, 0);
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
