import { requireSession } from "@/lib/auth/requireSession";
import { failure, success } from "@/lib/http";
import { assertMutationOrigin } from "@/lib/request";
import { addWishlist, removeWishlist } from "@/services/userState";
import { productId } from "@/validation/catalog";

async function parameters(context) {
  const params = await context.params;
  return productId(params.productId);
}

export async function PUT(request, context) {
  try {
    assertMutationOrigin(request);
    const user = await requireSession(request);
    return success(await addWishlist(user, await parameters(context)));
  } catch (error) {
    return failure(error);
  }
}

export async function DELETE(request, context) {
  try {
    assertMutationOrigin(request);
    const user = await requireSession(request);
    return success(await removeWishlist(user, await parameters(context)));
  } catch (error) {
    return failure(error);
  }
}
