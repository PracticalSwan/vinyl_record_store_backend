import { randomUUID } from "node:crypto";
import { requireRole } from "@/lib/auth/requireSession";
import { failure, success } from "@/lib/http";
import { assertMutationOrigin, readJsonBody } from "@/lib/request";
import { parseImportPreviewInput } from "@/validation/admin";
import { previewCatalogImport } from "@/services/adminCatalog";

const MAX_IMPORT_BYTES = 2_000_000;

export async function POST(request) {
  try {
    assertMutationOrigin(request);
    const admin = await requireRole(request, "admin");
    const input = parseImportPreviewInput(await readJsonBody(request, { maxBytes: MAX_IMPORT_BYTES }));
    return success(await previewCatalogImport(admin, input, { requestId: randomUUID() }));
  } catch (error) {
    return failure(error);
  }
}
