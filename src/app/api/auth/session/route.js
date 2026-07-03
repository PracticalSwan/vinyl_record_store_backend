import { getOptionalSession } from "@/lib/auth/requireSession";
import { failure, success } from "@/lib/http";

export async function GET(request) {
  try {
    const user = await getOptionalSession(request);
    return success(user ? { authenticated: true, user } : { authenticated: false });
  } catch (error) {
    return failure(error);
  }
}
