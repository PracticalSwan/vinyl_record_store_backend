import { invalid } from "../lib/errors.js";
import { assertOnlyKeys } from "../lib/request.js";

export function normalizeUsername(value) {
  const username = String(value || "").trim();
  const normalizedUsername = username.toLowerCase();
  if (!/^[a-z0-9_-]{3,64}$/.test(normalizedUsername)) {
    throw invalid(
      "Username must be 3 to 64 characters and contain only letters, numbers, underscores, or hyphens.",
    );
  }
  return { username, normalizedUsername };
}

function password(value) {
  if (typeof value !== "string" || value.length < 10 || value.length > 128) {
    throw invalid("Password must be between 10 and 128 characters.");
  }
  return value;
}

export function parseLoginInput(body) {
  assertOnlyKeys(body, ["username", "password"]);
  const username = normalizeUsername(body.username);
  return { ...username, password: password(body.password) };
}

export function parseRegistrationInput(body) {
  assertOnlyKeys(body, ["username", "password", "displayName"]);
  const username = normalizeUsername(body.username);
  const displayName = body.displayName === undefined || body.displayName === null
    ? null
    : String(body.displayName).trim();
  if (displayName !== null && (displayName.length < 1 || displayName.length > 100)) {
    throw invalid("Display name must be between 1 and 100 characters.");
  }
  return { ...username, password: password(body.password), displayName };
}
