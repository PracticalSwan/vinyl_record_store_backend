import { setSessionCookie } from "@/lib/auth/cookie";
import { failure, success } from "@/lib/http";
import { assertMutationOrigin, readJsonBody } from "@/lib/request";
import { login } from "@/services/auth";
import { parseLoginInput } from "@/validation/auth";

export async function POST(request) {
  try {
    assertMutationOrigin(request);
    const result = await login(parseLoginInput(await readJsonBody(request)), request);
    return setSessionCookie(success({ user: result.user }), request, result.token);
  } catch (error) {
    const response = failure(error);
    if (error?.retryAfterSeconds) {
      response.headers.set("Retry-After", String(error.retryAfterSeconds));
    }
    return response;
  }
}
