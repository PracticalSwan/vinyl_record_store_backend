import { randomUUID } from "node:crypto";
import { requireRole } from "@/lib/auth/requireSession";
import { failure, success } from "@/lib/http";
import { assertMutationOrigin, readJsonBody } from "@/lib/request";
import { productId } from "@/validation/catalog";
import { parseArtworkApplyInput } from "@/validation/admin";
import { applyArtwork } from "@/services/adminCatalog";

async function parameters(context) {
  const params = await context.params;
  return productId(params.id);
}

export async function PATCH(request, context) {
  try {
    assertMutationOrigin(request);
    const admin = await requireRole(request, "admin");
    const id = await parameters(context);
    const { releaseId, updatedAt } = parseArtworkApplyInput(await readJsonBody(request));
    return success(await applyArtwork(admin, id, { releaseId, updatedAt }, { requestId: randomUUID() }));
  } catch (error) {
    return failure(error);
  }
}
