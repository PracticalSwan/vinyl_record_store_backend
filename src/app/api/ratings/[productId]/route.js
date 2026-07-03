import { requireSession } from "@/lib/auth/requireSession";
import { failure, success } from "@/lib/http";
import { assertMutationOrigin, readJsonBody } from "@/lib/request";
import { removeRating, setRating } from "@/services/userState";
import { productId } from "@/validation/catalog";
import { parseRating } from "@/validation/writes";

async function parameters(context) {
  const params = await context.params;
  return productId(params.productId);
}

export async function PUT(request, context) {
  try {
    assertMutationOrigin(request);
    const user = await requireSession(request);
    const rating = parseRating(await readJsonBody(request));
    return success(await setRating(user, await parameters(context), rating));
  } catch (error) {
    return failure(error);
  }
}

export async function DELETE(request, context) {
  try {
    assertMutationOrigin(request);
    const user = await requireSession(request);
    return success(await removeRating(user, await parameters(context)));
  } catch (error) {
    return failure(error);
  }
}
