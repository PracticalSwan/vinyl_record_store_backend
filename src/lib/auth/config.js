import { authUnavailable } from "../errors.js";

export const SESSION_COOKIE_NAME = "groovehaus_session";
export const SESSION_TTL_SECONDS = 8 * 60 * 60;

export function getAuthSecret(environment = process.env) {
  const secret = environment.AUTH_SECRET?.trim();
  if (!secret || secret.length < 32) throw authUnavailable();
  return secret;
}

function seededAccount(environment, kind, publicId, role) {
  const prefix = `AUTH_DEMO_${kind}`;
  const username = environment[`${prefix}_USERNAME`]?.trim();
  const passwordHash = environment[`${prefix}_PASSWORD_HASH`]?.trim();
  const passwordSalt = environment[`${prefix}_PASSWORD_SALT`]?.trim();
  const displayName = environment[`${prefix}_DISPLAY_NAME`]?.trim() || null;
  const configured = [username, passwordHash, passwordSalt].filter(Boolean).length;

  if (configured === 0) return null;
  if (configured !== 3) throw authUnavailable();

  const normalizedUsername = username.toLowerCase();
  if (!/^[a-z0-9_-]{3,64}$/.test(normalizedUsername)) throw authUnavailable();

  return {
    publicId,
    username,
    normalizedUsername,
    displayName,
    passwordHash,
    passwordSalt,
    role,
    active: true,
    sessionVersion: 0,
    preferences: {
      favoriteGenres: [],
      dislikedGenres: [],
      favoriteArtists: [],
      budget: { min: null, max: null },
      conditions: [],
      formats: [],
      completedAt: null,
      schemaVersion: 1,
    },
    seeded: true,
  };
}

export function getSeededAccounts(environment = process.env) {
  return [
    seededAccount(environment, "CUSTOMER", "demo-customer", "customer"),
    seededAccount(environment, "ADMIN", "demo-admin", "admin"),
  ].filter(Boolean);
}

export function isSecureCookie(request, environment = process.env) {
  return environment.AUTH_COOKIE_SECURE === "true"
    || environment.NODE_ENV === "production"
    || new URL(request.url).protocol === "https:";
}
