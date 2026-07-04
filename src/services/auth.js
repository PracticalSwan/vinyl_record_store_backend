import { randomUUID } from "node:crypto";
import { authUnavailable, conflict, forbidden, unauthenticated } from "../lib/errors.js";
import { getAuthSecret, getSeededAccounts } from "../lib/auth/config.js";
import { hashPassword, verifyPassword } from "../lib/auth/password.js";
import { createSessionToken } from "../lib/auth/session.js";
import { userRepository } from "../repositories/userRepository.js";
import { DEMO_USER_USERNAMES } from "../data/demoUsers.js";

const GENERIC_LOGIN_MESSAGE = "The username or password is incorrect.";
const MISSING_ACCOUNT_SALT = "groovehaus-missing-account";

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

export async function login(body, {
  environment = process.env,
  repository = userRepository,
  hashPassword: hp = hashPassword,
  verifyPassword: vp = verifyPassword,
} = {}) {
  getAuthSecret(environment);
  const identifier = body.normalizedUsername;

  const account = await findLoginAccount(identifier, { environment, repository });
  let valid = false;
  if (account) {
    valid = await vp(body.password, account.passwordHash, account.passwordSalt);
  } else {
    // Dummy hash keeps the response time for unknown usernames close to the
    // bad-password path so login cannot be used to enumerate accounts.
    await hp(body.password, { salt: MISSING_ACCOUNT_SALT });
  }
  if (!valid) throw unauthenticated(GENERIC_LOGIN_MESSAGE);

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
  if (DEMO_USER_USERNAMES.includes(body.normalizedUsername)) {
    throw forbidden("That username is reserved.");
  }

  // Cheap existence check before the expensive scrypt hash to avoid spending
  // CPU on usernames that are already taken. repository.create still enforces
  // the unique index for any race that lands between this check and the insert.
  const existing = await repository.findByNormalizedUsername(body.normalizedUsername);
  if (existing) throw conflict("That username is already registered.");

  const passwordFields = await hashPassword(body.password);
  const user = await repository.create({
    publicId: `user-${randomUUID()}`,
    username: body.username,
    normalizedUsername: body.normalizedUsername,
    displayName: body.displayName,
    ...passwordFields,
    role: "customer",
    active: true,
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
  // Seeded (env-backed) accounts resolve from configuration alone and never
  // touch the database, so demo login works even in seed-catalog mode.
  const seeded = getSeededAccounts(environment)
    .find((account) => account.publicId === payload.sub);
  const user = seeded ?? await repository.findByPublicId(payload.sub);
  if (!user || !user.active || user.role !== payload.role) return null;
  return toSafeUser(user);
}
