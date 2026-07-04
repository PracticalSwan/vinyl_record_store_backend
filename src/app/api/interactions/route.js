import { getOptionalSession } from "@/lib/auth/requireSession";
import { assertInteractionCap } from "@/lib/interactionCap";
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
    assertInteractionCap({ user, events, request });
    return success(await ingestInteractions(user, events));
  } catch (error) {
    const response = failure(error);
    if (error?.retryAfterSeconds) {
      response.headers.set("Retry-After", String(error.retryAfterSeconds));
    }
    return response;
  }
}
