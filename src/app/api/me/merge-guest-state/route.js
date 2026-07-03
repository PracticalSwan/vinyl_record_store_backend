import { requireSession } from "@/lib/auth/requireSession";
import { failure, success } from "@/lib/http";
import { assertMutationOrigin, readJsonBody } from "@/lib/request";
import { mergeGuestState } from "@/services/userState";
import { parseGuestMerge } from "@/validation/writes";

export async function POST(request) {
  try {
    assertMutationOrigin(request);
    const user = await requireSession(request);
    return success(await mergeGuestState(user, parseGuestMerge(await readJsonBody(request))));
  } catch (error) {
    return failure(error);
  }
}
