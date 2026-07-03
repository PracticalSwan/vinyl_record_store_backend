import { requireSession } from "@/lib/auth/requireSession";
import { failure, success } from "@/lib/http";
import { assertMutationOrigin, readJsonBody } from "@/lib/request";
import { replacePreferences } from "@/services/userState";
import { parsePreferences } from "@/validation/writes";

export async function PATCH(request) {
  try {
    assertMutationOrigin(request);
    const user = await requireSession(request);
    const preferences = parsePreferences(await readJsonBody(request));
    return success({ user: await replacePreferences(user, preferences) });
  } catch (error) {
    return failure(error);
  }
}
