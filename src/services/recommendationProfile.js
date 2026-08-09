import { notFound } from "../lib/errors.js";
import { buildRecommendationProfile } from "../lib/recommender/recommendationProfile.js";
import { feedbackRepository } from "../repositories/feedbackRepository.js";
import { userRepository } from "../repositories/userRepository.js";
import { userStateRepository } from "../repositories/userStateRepository.js";

export async function buildUserRecommendationProfile(subject, {
  trackingAllowed = false,
  feedbackAllowed = false,
  users = userRepository,
  state = userStateRepository,
  feedback = feedbackRepository,
} = {}) {
  if (!subject || subject.kind !== "registered" || !subject.publicId) {
    throw new TypeError("A registered recommendation subject is required.");
  }
  const user = await users.findByPublicId(subject.publicId);
  if (!user) throw notFound("The active account was not found.");
  const [wishlist, cart, ratings] = await Promise.all([
    state.getWishlist(subject.publicId),
    state.getCart(subject.publicId),
    state.listRatings(subject.publicId),
  ]);
  const [storedFeedback, interactions] = await Promise.all([
    feedbackAllowed ? feedback.listByUser(subject.publicId) : [],
    trackingAllowed ? state.listRecentInteractions(subject.publicId, 500) : [],
  ]);
  return buildRecommendationProfile({
    subject,
    preferences: user.preferences,
    ratings,
    wishlist: wishlist?.productPublicIds || [],
    cart: cart?.items || [],
    feedback: storedFeedback,
    interactions,
  });
}
