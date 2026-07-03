import { clearSessionCookie } from "@/lib/auth/cookie";
import { failure, success } from "@/lib/http";
import { assertMutationOrigin } from "@/lib/request";

export async function POST(request) {
  try {
    assertMutationOrigin(request);
    return clearSessionCookie(success({ authenticated: false }), request);
  } catch (error) {
    return failure(error);
  }
}
