export class ServiceError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.name = "ServiceError";
    this.code = code;
    this.status = status;
  }
}

export function invalid(message) {
  return new ServiceError("INVALID_REQUEST", message, 400);
}

export function notFound(message) {
  return new ServiceError("NOT_FOUND", message, 404);
}
