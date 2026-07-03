import { createHmac, timingSafeEqual } from "node:crypto";
import { getAuthSecret, SESSION_TTL_SECONDS } from "./config.js";

const TOKEN_VERSION = 1;

function signature(value, secret) {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

export function createSessionToken(user, {
  environment = process.env,
  now = Date.now(),
} = {}) {
  const issuedAt = Math.floor(now / 1000);
  const payload = {
    v: TOKEN_VERSION,
    sub: user.publicId,
    role: user.role,
    sv: user.sessionVersion || 0,
    iat: issuedAt,
    exp: issuedAt + SESSION_TTL_SECONDS,
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encoded}.${signature(encoded, getAuthSecret(environment))}`;
}

export function verifySessionToken(token, {
  environment = process.env,
  now = Date.now(),
} = {}) {
  if (typeof token !== "string" || token.length > 2_048) return null;
  const [encoded, receivedSignature, extra] = token.split(".");
  if (!encoded || !receivedSignature || extra) return null;

  const expectedSignature = signature(encoded, getAuthSecret(environment));
  const expected = Buffer.from(expectedSignature);
  const received = Buffer.from(receivedSignature);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null;

  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    const nowSeconds = Math.floor(now / 1000);
    if (
      payload.v !== TOKEN_VERSION
      || !/^[a-zA-Z0-9_-]{1,64}$/.test(payload.sub)
      || !["customer", "admin"].includes(payload.role)
      || !Number.isInteger(payload.sv)
      || !Number.isInteger(payload.iat)
      || !Number.isInteger(payload.exp)
      || payload.iat > nowSeconds + 60
      || payload.exp <= nowSeconds
      || payload.exp - payload.iat !== SESSION_TTL_SECONDS
    ) return null;
    return payload;
  } catch {
    return null;
  }
}

export function readCookie(request, name) {
  const header = request.headers.get("cookie") || "";
  for (const entry of header.split(";")) {
    const separator = entry.indexOf("=");
    if (separator < 0) continue;
    const key = entry.slice(0, separator).trim();
    if (key === name) {
      try {
        return decodeURIComponent(entry.slice(separator + 1).trim());
      } catch {
        return null;
      }
    }
  }
  return null;
}
