import { failure, success } from "@/lib/http";
import { getProduct } from "@/services/catalog";

export async function GET(_request, { params }) {
  try {
    const { id } = await params;
    return success({ product: getProduct(id) });
  } catch (error) {
    return failure(error);
  }
}
