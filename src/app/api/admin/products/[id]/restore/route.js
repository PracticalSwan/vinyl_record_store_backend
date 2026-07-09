import { randomUUID } from "node:crypto";
import { requireRole } from "@/lib/auth/requireSession";
import { failure, success } from "@/lib/http";
import { assertMutationOrigin } from "@/lib/request";
import { productId } from "@/validation/catalog";
import { restoreAdminProduct } from "@/services/adminCatalog";

export async function POST(request, context) {
  try {
    assertMutationOrigin(request);
    const admin = await requireRole(request, "admin");
    const params = await context.params;
    return success(await restoreAdminProduct(admin, productId(params.id), { requestId: randomUUID() }));
  } catch (error) {
    return failure(error);
  }
}
