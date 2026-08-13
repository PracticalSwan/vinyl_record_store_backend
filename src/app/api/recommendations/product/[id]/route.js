import { failure, success } from "@/lib/http";
import { trackingOptedOut } from "@/lib/trackingOptOut";
import { serveProductRecommendations } from "@/services/recommendations";
import { positiveInteger } from "@/validation/catalog";
import { parseInteractionSurface } from "@/validation/writes";

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const limit = positiveInteger(request.nextUrl.searchParams.get("limit"), 6, {
      name: "limit",
      max: 20,
    });
    return success(await serveProductRecommendations(id, limit, {
      surface: parseInteractionSurface(
        request.nextUrl.searchParams.get("surface"),
        "product-detail",
      ),
      trackingAllowed: !trackingOptedOut(request),
    }));
  } catch (error) {
    return failure(error);
  }
}
