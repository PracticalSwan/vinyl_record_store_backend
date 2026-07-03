import { getOptionalSession } from "@/lib/auth/requireSession";
import { failure, success } from "@/lib/http";
import { assertMutationOrigin, readJsonBody } from "@/lib/request";
import { ingestInteractions } from "@/services/userState";
import { parseInteractionBatch } from "@/validation/writes";

export async function POST(request) {
  try {
    assertMutationOrigin(request);
    const user = await getOptionalSession(request);
    const events = parseInteractionBatch(await readJsonBody(request), {
      authenticated: Boolean(user),
    });
    return success(await ingestInteractions(user, events));
  } catch (error) {
    return failure(error);
  }
}
