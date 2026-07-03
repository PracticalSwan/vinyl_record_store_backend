import { failure, success } from "@/lib/http";
import { recommendForProduct } from "@/lib/recommender/contentBased";
import { positiveInteger } from "@/validation/catalog";

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const limit = positiveInteger(request.nextUrl.searchParams.get("limit"), 6, {
      name: "limit",
      max: 20,
    });
    return success(await recommendForProduct(id, limit));
  } catch (error) {
    return failure(error);
  }
}
