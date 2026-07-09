import { randomUUID } from "node:crypto";
import { requireRole } from "@/lib/auth/requireSession";
import { failure, success } from "@/lib/http";
import { assertMutationOrigin, readJsonBody } from "@/lib/request";
import { positiveInteger } from "@/validation/catalog";
import { parseAdminProductCreate } from "@/validation/admin";
import { createAdminProduct, listAdminProducts } from "@/services/adminCatalog";

export async function GET(request) {
  try {
    await requireRole(request, "admin");
    const url = new URL(request.url);
    const page = positiveInteger(url.searchParams.get("page"), 1, { name: "page", max: 100_000 });
    const limit = positiveInteger(url.searchParams.get("limit"), 20, { name: "limit", max: 100 });
    const includeDeleted = url.searchParams.get("includeDeleted") === "true";
    return success(await listAdminProducts({ page, limit, includeDeleted }));
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request) {
  try {
    assertMutationOrigin(request);
    const admin = await requireRole(request, "admin");
    const desired = parseAdminProductCreate(await readJsonBody(request));
    return success(await createAdminProduct(admin, desired, { requestId: randomUUID() }));
  } catch (error) {
    return failure(error);
  }
}
