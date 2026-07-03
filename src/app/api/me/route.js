import { requireSession } from "@/lib/auth/requireSession";
import { clearSessionCookie } from "@/lib/auth/cookie";
import { failure, success } from "@/lib/http";
import { assertMutationOrigin } from "@/lib/request";
import { deleteAccount } from "@/services/account";
import { profile } from "@/services/userState";

export async function GET(request) {
  try {
    return success({ user: profile(await requireSession(request)) });
  } catch (error) {
    return failure(error);
  }
}

export async function DELETE(request) {
  try {
    assertMutationOrigin(request);
    const result = await deleteAccount(await requireSession(request));
    return clearSessionCookie(success(result), request);
  } catch (error) {
    return failure(error);
  }
}
