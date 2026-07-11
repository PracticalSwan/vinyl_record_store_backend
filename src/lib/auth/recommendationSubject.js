import { forbidden } from "../errors.js";
import { getOptionalSession, requireSession } from "./requireSession.js";

const anonymousSubject = () => ({ kind: "anonymous" });

function customerSubject(user) {
  if (user.role !== "customer") {
    throw forbidden("Customer recommendations are not available for this account.");
  }
  return { kind: "registered", publicId: user.publicId };
}

export function legacyRecommendationSubject(requestedUserId) {
  return requestedUserId === "demo-user"
    ? { kind: "demo", responseUserId: "demo-user" }
    : { kind: "cold-start", responseUserId: requestedUserId };
}

export async function getOptionalRecommendationSubject(request, options = {}) {
  const user = await getOptionalSession(request, options);
  return user ? customerSubject(user) : anonymousSubject();
}

export async function requireRecommendationSubject(request, options = {}) {
  return customerSubject(await requireSession(request, options));
}
