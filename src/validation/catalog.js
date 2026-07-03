import { invalid } from "../lib/errors.js";

const MAX_USER_ID_LENGTH = 64;
const MAX_FILTER_VALUES = 20;

export function positiveInteger(value, fallback, { name, max = 100 } = {}) {
  if (value === null || value === undefined || value === "") return fallback;
  if (!/^\d+$/.test(String(value))) throw invalid(`${name} must be a positive integer.`);

  const parsed = Number(value);
  if (parsed < 1 || parsed > max) {
    throw invalid(`${name} must be between 1 and ${max}.`);
  }
  return parsed;
}

export function optionalNumber(value, name) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw invalid(`${name} must be a non-negative number.`);
  }
  return parsed;
}

export function boundedLiteral(value, { name, maxLength }) {
  const normalized = String(value || "").trim();
  if (normalized.length > maxLength) {
    throw invalid(`${name} must be ${maxLength} characters or fewer.`);
  }
  return normalized;
}

export function repeatedControlledValues(searchParams, name, allowedValues) {
  const values = searchParams
    .getAll(name)
    .map((value) => String(value).trim())
    .filter(Boolean);

  if (values.length > MAX_FILTER_VALUES) {
    throw invalid(`${name} may contain at most ${MAX_FILTER_VALUES} values.`);
  }

  const canonicalValues = new Map(
    allowedValues.map((value) => [value.toLowerCase(), value]),
  );
  const normalized = values.map((value) => canonicalValues.get(value.toLowerCase()));
  if (normalized.some((value) => !value)) {
    throw invalid(`${name} contains an unsupported value.`);
  }

  return [...new Set(normalized)];
}

export function productId(value) {
  return positiveInteger(value, null, { name: "Product ID", max: 1_000_000 });
}

export function userId(value) {
  const normalized = String(value || "").trim();
  if (!normalized || normalized.length > MAX_USER_ID_LENGTH || !/^[a-zA-Z0-9_-]+$/.test(normalized)) {
    throw invalid("User ID must contain only letters, numbers, underscores, or hyphens.");
  }
  return normalized;
}
