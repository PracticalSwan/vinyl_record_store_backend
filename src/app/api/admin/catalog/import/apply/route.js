import { randomUUID } from "node:crypto";
import { requireRole } from "@/lib/auth/requireSession";
import { failure, success } from "@/lib/http";
import { assertMutationOrigin, readJsonBody } from "@/lib/request";
import { parseImportApplyInput } from "@/validation/admin";
import { applyCatalogImportToken } from "@/services/adminCatalog";

export async function POST(request) {
  try {
    assertMutationOrigin(request);
    const admin = await requireRole(request, "admin");
    const input = parseImportApplyInput(await readJsonBody(request));
    return success(await applyCatalogImportToken(admin, input, { requestId: randomUUID() }));
  } catch (error) {
    return failure(error);
  }
}
