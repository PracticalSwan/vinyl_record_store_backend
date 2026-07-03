import { failure, success } from "@/lib/http";
import { listProducts } from "@/services/catalog";

export async function GET(request) {
  try {
    const result = await listProducts(request.nextUrl.searchParams);
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
