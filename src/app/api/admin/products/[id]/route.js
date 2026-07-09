import { randomUUID } from "node:crypto";
import { requireRole } from "@/lib/auth/requireSession";
import { invalid } from "@/lib/errors";
import { failure, success } from "@/lib/http";
import { assertMutationOrigin, readJsonBody } from "@/lib/request";
import { productId } from "@/validation/catalog";
import { parseAdminProductUpdate } from "@/validation/admin";
import {
  deleteAdminProduct,
  getAdminProduct,
  updateAdminProduct,
} from "@/services/adminCatalog";

async function parameters(context) {
  const params = await context.params;
  return productId(params.id);
}

export async function GET(request, context) {
  try {
    await requireRole(request, "admin");
    return success(await getAdminProduct(await parameters(context)));
  } catch (error) {
    return failure(error);
  }
}

export async function PATCH(request, context) {
  try {
    assertMutationOrigin(request);
    const admin = await requireRole(request, "admin");
    const id = await parameters(context);
    const { updatedAt, patch } = parseAdminProductUpdate(await readJsonBody(request));
    return success(await updateAdminProduct(admin, id, { updatedAt, patch }, { requestId: randomUUID() }));
  } catch (error) {
    return failure(error);
  }
}

export async function DELETE(request, context) {
  try {
    assertMutationOrigin(request);
    const admin = await requireRole(request, "admin");
    const id = await parameters(context);
    const url = new URL(request.url);
    const updatedAt = url.searchParams.get("updatedAt");
    if (!updatedAt) {
      return failure(invalid("updatedAt query parameter is required."));
    }
    return success(await deleteAdminProduct(admin, id, updatedAt, { requestId: randomUUID() }));
  } catch (error) {
    return failure(error);
  }
}
