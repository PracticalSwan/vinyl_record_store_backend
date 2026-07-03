import { requireSession } from "@/lib/auth/requireSession";
import { failure, success } from "@/lib/http";
import { readWishlist } from "@/services/userState";

export async function GET(request) {
  try {
    return success(await readWishlist(await requireSession(request)));
  } catch (error) {
    return failure(error);
  }
}
