import { getOptionalSession } from "@/lib/auth/requireSession";
import {
  getOptionalRecommendationSubject,
  legacyRecommendationSubject,
} from "@/lib/auth/recommendationSubject";
import { personalizationIdentityStrictEnabled } from "@/lib/features";
import { failure, success } from "@/lib/http";
import { serveUserRecommendations } from "@/services/recommendations";
import { positiveInteger, userId } from "@/validation/catalog";
import { parseAnonymousId, parseInteractionSurface } from "@/validation/writes";

export async function GET(request, { params }) {
  try {
    const routeParams = await params;
    const limit = positiveInteger(request.nextUrl.searchParams.get("limit"), 8, {
      name: "limit",
      max: 20,
    });
    const requestedUserId = userId(routeParams.userId);
    // This legacy showcase route is not a private-profile endpoint. Only the
    // literal demo-user subject may select the synthetic demo profile.
    const actor = personalizationIdentityStrictEnabled()
      ? await getOptionalRecommendationSubject(request)
      : await getOptionalSession(request).then((user) => user
          ? { kind: "registered", publicId: user.publicId }
          : { kind: "anonymous" });
    return success(await serveUserRecommendations(
      legacyRecommendationSubject(requestedUserId),
      limit,
      {
        actor,
        anonymousId: actor.kind === "anonymous"
          ? parseAnonymousId(request.headers.get("x-anonymous-id"))
          : null,
        surface: parseInteractionSurface(
          request.nextUrl.searchParams.get("surface"),
          "recommendations",
        ),
        trackingAllowed: request.headers.get("x-tracking-enabled") !== "false",
      },
    ));
  } catch (error) {
    return failure(error);
  }
}
