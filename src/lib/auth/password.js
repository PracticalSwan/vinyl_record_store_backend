import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { invalid } from "../errors.js";

const scrypt = promisify(scryptCallback);
const PARAMETERS = { N: 16_384, r: 8, p: 1, keyLength: 64 };
const PREFIX = "scrypt";

function encodeHash(hash) {
  const { N, r, p, keyLength } = PARAMETERS;
  return `${PREFIX}$${N}$${r}$${p}$${keyLength}$${hash.toString("base64url")}`;
}

function decodeHash(encoded) {
  const [prefix, n, r, p, keyLength, value] = String(encoded || "").split("$");
  const parsed = {
    N: Number(n),
    r: Number(r),
    p: Number(p),
    keyLength: Number(keyLength),
  };
  if (
    prefix !== PREFIX
    || !value
    || !Object.values(parsed).every(Number.isInteger)
    || parsed.N < 2
    || parsed.N > 131_072
    || (parsed.N & (parsed.N - 1)) !== 0
    || parsed.r < 1
    || parsed.r > 32
    || parsed.p < 1
    || parsed.p > 16
    || parsed.keyLength < 32
    || parsed.keyLength > 128
  ) {
    return null;
  }
  try {
    const hash = Buffer.from(value, "base64url");
    return hash.length === parsed.keyLength ? { ...parsed, hash } : null;
  } catch {
    return null;
  }
}

export async function hashPassword(password, { salt = randomBytes(16).toString("base64url") } = {}) {
  if (typeof password !== "string" || password.length < 10 || password.length > 128) {
    throw invalid("Password must be between 10 and 128 characters.");
  }
  const { N, r, p, keyLength } = PARAMETERS;
  const derived = await scrypt(password, salt, keyLength, {
    N,
    r,
    p,
    maxmem: 64 * 1024 * 1024,
  });
  return { passwordHash: encodeHash(derived), passwordSalt: salt };
}

export async function verifyPassword(password, passwordHash, passwordSalt) {
  const decoded = decodeHash(passwordHash);
  if (!decoded || typeof password !== "string" || !passwordSalt) return false;
  try {
    const derived = await scrypt(password, passwordSalt, decoded.keyLength, {
      N: decoded.N,
      r: decoded.r,
      p: decoded.p,
      maxmem: 64 * 1024 * 1024,
    });
    return timingSafeEqual(decoded.hash, derived);
  } catch {
    return false;
  }
}

export const PASSWORD_HASH_PARAMETERS = Object.freeze({ ...PARAMETERS });
