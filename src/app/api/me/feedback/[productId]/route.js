import { requireSession } from "@/lib/auth/requireSession";
import { notFound } from "@/lib/errors";
import {
  personalizationNegativeFeedbackEnabled,
  personalizationProfileDomainEnabled,
} from "@/lib/features";
import { failure, success } from "@/lib/http";
import { assertMutationOrigin, readJsonBody } from "@/lib/request";
import { deleteFeedback, putFeedback } from "@/services/feedback";
import { productId } from "@/validation/catalog";
import { parseFeedback } from "@/validation/writes";

function enabled() {
  return personalizationProfileDomainEnabled() && personalizationNegativeFeedbackEnabled();
}

async function parameters(context) {
  const params = await context.params;
  return productId(params.productId);
}

export async function PUT(request, context) {
  try {
    if (!enabled()) throw notFound("Negative feedback is not enabled.");
    assertMutationOrigin(request);
    const user = await requireSession(request);
    const { kind } = parseFeedback(await readJsonBody(request));
    return success(await putFeedback(user, await parameters(context), kind));
  } catch (error) {
    return failure(error);
  }
}

export async function DELETE(request, context) {
  try {
    if (!enabled()) throw notFound("Negative feedback is not enabled.");
    assertMutationOrigin(request);
    const user = await requireSession(request);
    return success(await deleteFeedback(user, await parameters(context)));
  } catch (error) {
    return failure(error);
  }
}
