import { requireRole } from "@/lib/auth/requireSession";
import { failure, success } from "@/lib/http";
import { assertMutationOrigin } from "@/lib/request";
import { productId } from "@/validation/catalog";
import { previewArtwork } from "@/services/adminCatalog";

export async function POST(request, context) {
  try {
    assertMutationOrigin(request);
    const admin = await requireRole(request, "admin");
    const params = await context.params;
    return success(await previewArtwork(admin, productId(params.id)));
  } catch (error) {
    return failure(error);
  }
}
