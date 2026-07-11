import { getOptionalRecommendationSubject } from "@/lib/auth/recommendationSubject";
import { notFound } from "@/lib/errors";
import { personalizationMeEndpointEnabled } from "@/lib/features";
import { failure, success } from "@/lib/http";
import { serveUserRecommendations } from "@/services/recommendations";
import { positiveInteger } from "@/validation/catalog";
import { parseAnonymousId, parseInteractionSurface } from "@/validation/writes";

export async function GET(request) {
  try {
    if (!personalizationMeEndpointEnabled()) {
      throw notFound("The session-owned recommendation endpoint is not enabled.");
    }
    const limit = positiveInteger(request.nextUrl.searchParams.get("limit"), 12, {
      name: "limit",
      max: 20,
    });
    const subject = await getOptionalRecommendationSubject(request);
    return success(await serveUserRecommendations(subject, limit, {
      actor: subject,
      anonymousId: subject.kind === "anonymous"
        ? parseAnonymousId(request.headers.get("x-anonymous-id"))
        : null,
      surface: parseInteractionSurface(
        request.nextUrl.searchParams.get("surface"),
        "recommendations",
      ),
      trackingAllowed: request.headers.get("x-tracking-enabled") !== "false",
    }));
  } catch (error) {
    return failure(error);
  }
}
