import { getOptionalSession } from "@/lib/auth/requireSession";
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
    const user = await getOptionalSession(request);
    return success(await serveUserRecommendations(
      userId(routeParams.userId),
      limit,
      {
        user,
        anonymousId: parseAnonymousId(request.headers.get("x-anonymous-id")),
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
