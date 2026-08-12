export function trackingOptedOut(request) {
  return request?.headers?.get("x-tracking-enabled") === "false";
}
