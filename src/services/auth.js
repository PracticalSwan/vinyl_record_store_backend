import { randomUUID } from "node:crypto";
import { authUnavailable, forbidden, unauthenticated } from "../lib/errors.js";
import { getAuthSecret, getSeededAccounts } from "../lib/auth/config.js";
import { hashPassword, verifyPassword } from "../lib/auth/password.js";
import { createSessionToken } from "../lib/auth/session.js";
import {
  assertLoginAllowed,
  recordLoginFailure,
  resetLoginFailures,
} from "../lib/auth/rateLimit.js";
import { userRepository } from "../repositories/userRepository.js";

const GENERIC_LOGIN_MESSAGE = "The username or password is incorrect.";

export function toSafeUser(user) {
  const preferences = user.preferences || {};
  return {
    publicId: user.publicId,
    username: user.username,
    displayName: user.displayName || null,
    role: user.role,
    onboardingComplete: Boolean(preferences.completedAt),
    preferences,
    seeded: Boolean(user.seeded),
  };
}

async function findLoginAccount(normalizedUsername, {
  environment,
  repository,
}) {
  const seeded = getSeededAccounts(environment)
    .find((account) => account.normalizedUsername === normalizedUsername);
  let persisted = null;
  try {
    persisted = await repository.findForAuthentication(normalizedUsername);
  } catch (error) {
    if (error?.code === "PERSISTENCE_UNAVAILABLE") return seeded || null;
    throw error;
  }
  return seeded || persisted;
}

export async function login(body, request, {
  environment = process.env,
  repository = userRepository,
} = {}) {
  getAuthSecret(environment);
  const identifier = body.normalizedUsername;
  assertLoginAllowed(request, identifier);

  const account = await findLoginAccount(identifier, { environment, repository });
  let valid = false;
  if (account) {
    valid = await verifyPassword(body.password, account.passwordHash, account.passwordSalt);
  } else {
    await hashPassword(body.password, { salt: "groovehaus-missing-account" });
  }
  if (!valid) {
    recordLoginFailure(request, identifier);
    throw unauthenticated(GENERIC_LOGIN_MESSAGE);
  }

  resetLoginFailures(request, identifier);
  return {
    user: toSafeUser(account),
    token: createSessionToken(account, { environment }),
  };
}

export async function register(body, {
  environment = process.env,
  repository = userRepository,
} = {}) {
  getAuthSecret(environment);
  const existingSeed = getSeededAccounts(environment)
    .some((account) => account.normalizedUsername === body.normalizedUsername);
  if (existingSeed) throw forbidden("That username is reserved.");

  const passwordFields = await hashPassword(body.password);
  const user = await repository.create({
    publicId: `user-${randomUUID()}`,
    username: body.username,
    normalizedUsername: body.normalizedUsername,
    displayName: body.displayName,
    ...passwordFields,
    role: "customer",
    active: true,
    sessionVersion: 0,
  });
  if (!user) throw authUnavailable();

  return {
    user: toSafeUser(user),
    token: createSessionToken(user, { environment }),
  };
}

export async function resolveSessionSubject(payload, {
  environment = process.env,
  repository = userRepository,
} = {}) {
  const seeded = getSeededAccounts(environment)
    .find((account) => account.publicId === payload.sub);
  let user = seeded;
  if (seeded) {
    try {
      const persistedProfile = await repository.findByPublicId(payload.sub);
      if (persistedProfile) {
        user = { ...seeded, preferences: persistedProfile.preferences };
      }
    } catch (error) {
      if (error?.code !== "PERSISTENCE_UNAVAILABLE") throw error;
    }
  } else {
    user = await repository.findByPublicId(payload.sub);
  }
  if (
    !user
    || !user.active
    || user.role !== payload.role
    || (user.sessionVersion || 0) !== payload.sv
  ) return null;
  return toSafeUser(user);
}
