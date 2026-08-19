import { failure, success } from "@/lib/http";
import { productDetailCacheHeaders } from "@/lib/catalogCachePolicy";
import { getProduct } from "@/services/catalog";

export async function GET(_request, { params }) {
  try {
    const { id } = await params;
    const response = success({ product: await getProduct(id) });
    for (const [name, value] of Object.entries(productDetailCacheHeaders())) {
      response.headers.set(name, value);
    }
    return response;
  } catch (error) {
    return failure(error);
  }
}
