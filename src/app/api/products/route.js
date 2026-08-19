import { failure, success } from "@/lib/http";
import { catalogCacheHeaders } from "@/lib/catalogCachePolicy";
import { listProducts } from "@/services/catalog";

export async function GET(request) {
  try {
    const result = await listProducts(request.nextUrl.searchParams);
    const response = success({ items: result.items }, result.meta);
    for (const [name, value] of Object.entries(catalogCacheHeaders())) {
      response.headers.set(name, value);
    }
    return response;
  } catch (error) {
    return failure(error);
  }
}
