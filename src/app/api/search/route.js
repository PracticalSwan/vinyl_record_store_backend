import { failure, success } from "@/lib/http";
import { listProducts } from "@/services/catalog";

export function GET(request) {
  try {
    const result = listProducts(request.nextUrl.searchParams);
    return success(
      { items: result.items },
      {
        ...result.meta,
        query: request.nextUrl.searchParams.get("q")?.trim() || "",
      },
    );
  } catch (error) {
    return failure(error);
  }
}
