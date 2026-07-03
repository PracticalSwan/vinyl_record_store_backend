import { Cart } from "../models/Cart.js";
import { GuestMerge } from "../models/GuestMerge.js";
import { Interaction } from "../models/Interaction.js";
import { Rating } from "../models/Rating.js";
import { RecommendationLog } from "../models/RecommendationLog.js";
import { User } from "../models/User.js";
import { Wishlist } from "../models/Wishlist.js";
import { createMongoRunner } from "./repositorySupport.js";

export function createAccountRepository(
  {
    userModel = User,
    wishlistModel = Wishlist,
    cartModel = Cart,
    ratingModel = Rating,
    interactionModel = Interaction,
    recommendationLogModel = RecommendationLog,
    guestMergeModel = GuestMerge,
  } = {},
  connect,
) {
  const run = createMongoRunner(connect);
  return {
    deleteCustomerAccount: (userPublicId) => run(
      async (connection) => connection.transaction(async (session) => {
        const deleted = await userModel.deleteOne(
          { publicId: userPublicId, role: "customer" },
          { session },
        );
        if (deleted.deletedCount !== 1) return false;
        await wishlistModel.deleteMany({ userPublicId }, { session });
        await cartModel.deleteMany({ userPublicId }, { session });
        await ratingModel.deleteMany({ userPublicId }, { session });
        await interactionModel.deleteMany({ userPublicId }, { session });
        await recommendationLogModel.deleteMany(
          { subjectType: "user", subjectId: userPublicId },
          { session },
        );
        await guestMergeModel.deleteMany({ userPublicId }, { session });
        return true;
      }),
    ),
  };
}

export const accountRepository = createAccountRepository();
