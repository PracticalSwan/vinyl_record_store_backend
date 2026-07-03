import { requireSession } from "@/lib/auth/requireSession";
import { failure, success } from "@/lib/http";
import { assertMutationOrigin, readJsonBody } from "@/lib/request";
import { removeCart, setCart } from "@/services/userState";
import { productId } from "@/validation/catalog";
import { parseQuantity } from "@/validation/writes";

async function parameters(context) {
  const params = await context.params;
  return productId(params.productId);
}

export async function PUT(request, context) {
  try {
    assertMutationOrigin(request);
    const user = await requireSession(request);
    const quantity = parseQuantity(await readJsonBody(request));
    return success(await setCart(user, await parameters(context), quantity));
  } catch (error) {
    return failure(error);
  }
}

export async function DELETE(request, context) {
  try {
    assertMutationOrigin(request);
    const user = await requireSession(request);
    return success(await removeCart(user, await parameters(context)));
  } catch (error) {
    return failure(error);
  }
}
