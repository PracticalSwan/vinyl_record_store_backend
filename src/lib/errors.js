export class ServiceError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.name = "ServiceError";
    this.code = code;
    this.status = status;
  }
}

export function invalid(message) {
  return new ServiceError("INVALID_INPUT", message, 400);
}

export function unauthenticated(message = "Authentication is required.") {
  return new ServiceError("UNAUTHENTICATED", message, 401);
}

export function forbidden(message = "You are not allowed to perform this action.") {
  return new ServiceError("FORBIDDEN", message, 403);
}

export function conflict(message) {
  return new ServiceError("CONFLICT", message, 409);
}

export function rateLimited(retryAfterSeconds) {
  const error = new ServiceError(
    "RATE_LIMITED",
    "Too many attempts. Please wait before trying again.",
    429,
  );
  error.retryAfterSeconds = retryAfterSeconds;
  return error;
}

export function authUnavailable() {
  return new ServiceError(
    "AUTH_UNAVAILABLE",
    "Authentication is not configured for this environment.",
    503,
  );
}

export function notFound(message) {
  return new ServiceError("NOT_FOUND", message, 404);
}

export function persistenceUnavailable() {
  return new ServiceError(
    "PERSISTENCE_UNAVAILABLE",
    "The selected catalog data source is unavailable.",
    503,
  );
}
