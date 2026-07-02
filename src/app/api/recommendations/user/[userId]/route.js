import { failure, success } from "@/lib/http";
import { recommendForUser } from "@/lib/recommender/contentBased";
import { positiveInteger, userId } from "@/validation/catalog";

export async function GET(request, { params }) {
  try {
    const routeParams = await params;
    const limit = positiveInteger(request.nextUrl.searchParams.get("limit"), 8, {
      name: "limit",
      max: 20,
    });
    return success(recommendForUser(userId(routeParams.userId), limit));
  } catch (error) {
    return failure(error);
  }
}
