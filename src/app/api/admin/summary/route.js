import { requireRole } from "@/lib/auth/requireSession";
import { failure, success } from "@/lib/http";
import { getAdminSummary } from "@/services/adminCatalog";

export async function GET(request) {
  try {
    await requireRole(request, "admin");
    return success(await getAdminSummary());
  } catch (error) {
    return failure(error);
  }
}
