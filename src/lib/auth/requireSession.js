import { forbidden, unauthenticated } from "../errors.js";
import { resolveSessionSubject } from "../../services/auth.js";
import { getAuthSecret, SESSION_COOKIE_NAME } from "./config.js";
import { readCookie, verifySessionToken } from "./session.js";

export async function getOptionalSession(request, options = {}) {
  const environment = options.environment || process.env;
  const token = readCookie(request, SESSION_COOKIE_NAME);
  if (!token) return null;

  getAuthSecret(environment);
  const payload = verifySessionToken(token, { environment, now: options.now });
  if (!payload) return null;
  return resolveSessionSubject(payload, options);
}

export async function requireSession(request, options = {}) {
  const user = await getOptionalSession(request, options);
  if (!user) throw unauthenticated();
  return user;
}

export async function requireRole(request, role, options = {}) {
  const user = await requireSession(request, options);
  if (user.role !== role) throw forbidden();
  return user;
}
