import { forbidden, invalid } from "./errors.js";

export const DEFAULT_JSON_LIMIT_BYTES = 64 * 1024;

function configuredOrigin(environment = process.env) {
  return (environment.FRONTEND_ORIGIN || "http://localhost:5173").replace(/\/$/, "");
}

export function assertMutationOrigin(request, environment = process.env) {
  const origin = request.headers.get("origin")?.replace(/\/$/, "");
  if (!origin || origin !== configuredOrigin(environment)) {
    throw forbidden("The request origin is not allowed.");
  }
  return origin;
}

export async function readJsonBody(request, { maxBytes = DEFAULT_JSON_LIMIT_BYTES } = {}) {
  const contentType = request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase();
  if (contentType !== "application/json") {
    throw invalid("Content-Type must be application/json.");
  }

  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw invalid(`The JSON body must be ${maxBytes} bytes or fewer.`);
  }

  const text = await request.text();
  if (Buffer.byteLength(text, "utf8") > maxBytes) {
    throw invalid(`The JSON body must be ${maxBytes} bytes or fewer.`);
  }

  let value;
  try {
    value = JSON.parse(text);
  } catch {
    throw invalid("The request body must contain valid JSON.");
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw invalid("The request body must be a JSON object.");
  }
  return value;
}

export function assertOnlyKeys(value, allowedKeys, name = "Request body") {
  const allowed = new Set(allowedKeys);
  const unexpected = Object.keys(value).filter((key) => !allowed.has(key));
  if (unexpected.length) {
    throw invalid(`${name} contains unsupported fields: ${unexpected.join(", ")}.`);
  }
}
