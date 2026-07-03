import { setSessionCookie } from "@/lib/auth/cookie";
import { failure, success } from "@/lib/http";
import { assertMutationOrigin, readJsonBody } from "@/lib/request";
import { register } from "@/services/auth";
import { parseRegistrationInput } from "@/validation/auth";

export async function POST(request) {
  try {
    assertMutationOrigin(request);
    const result = await register(parseRegistrationInput(await readJsonBody(request)));
    return setSessionCookie(success({ user: result.user }), request, result.token);
  } catch (error) {
    return failure(error);
  }
}
