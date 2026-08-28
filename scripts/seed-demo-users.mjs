import { connectMongoDB, disconnectMongoDB } from "../src/lib/db/mongodb.js";
import { Cart } from "../src/models/Cart.js";
import { Feedback } from "../src/models/Feedback.js";
import { Rating } from "../src/models/Rating.js";
import { User } from "../src/models/User.js";
import { Wishlist } from "../src/models/Wishlist.js";
import { hashPassword } from "../src/lib/auth/password.js";
import { DEMO_USERS } from "../src/data/demoUsers.js";

const apply = process.argv.includes("--apply");

// Mirror the User model defaults around the small canonical classroom profile.
// Mongoose defaults apply on create but not on update, so the seed writes the
// complete preference object explicitly.
const canonicalPreferences = (user, completedAt) => ({
  favoriteGenres: [...user.personalization.preferences.favoriteGenres],
  dislikedGenres: [],
  favoriteArtists: [...user.personalization.preferences.favoriteArtists],
  budget: { min: null, max: null },
  conditions: [],
  formats: [...user.personalization.preferences.formats],
  completedAt,
  schemaVersion: 1,
});

try {
  const connection = await connectMongoDB();
  const usernames = DEMO_USERS.map((user) => user.username.toLowerCase());
  // Classification only needs publicId and normalizedUsername (both selected by
  // default), so there is no need to fetch the password fields here.
  const existingDocs = await User.find({ normalizedUsername: { $in: usernames } }).lean();
  const existingByUser = new Map(existingDocs.map((doc) => [doc.normalizedUsername, doc]));

  // Classify each demo account. A username held by an account with a DIFFERENT
  // publicId is skipped, never clobbered, so this seed can never take over or
  // destroy a real customer's account that happened to claim the name first.
  const plan = DEMO_USERS.map((user) => {
    const normalizedUsername = user.username.toLowerCase();
    const existing = existingByUser.get(normalizedUsername);
    const state = {
      role: user.personalization.role,
      ratings: user.personalization.ratings.length,
      wishlist: user.personalization.wishlist.length,
      cart: 0,
    };
    if (!existing) {
      return { username: user.username, publicId: user.publicId, action: "create", state };
    }
    if (existing.publicId !== user.publicId) {
      return {
        username: user.username,
        publicId: user.publicId,
        action: "skip",
        reason: "username is held by a different account",
        heldBy: existing.publicId,
      };
    }
    return { username: user.username, publicId: user.publicId, action: "update", state };
  });
  const summary = {
    mode: apply ? "apply" : "dry-run",
    total: plan.length,
    creates: plan.filter((p) => p.action === "create").length,
    updates: plan.filter((p) => p.action === "update").length,
    skipped: plan.filter((p) => p.action === "skip").length,
  };
  const skipped = plan.filter((p) => p.action === "skip");
  console.log(JSON.stringify({ ...summary, plan, skipped }, null, 2));

  if (summary.skipped > 0) {
    // Surface a username collision loudly; the operator should resolve it
    // before the showcase accounts can be (re)seeded.
    process.exitCode = 1;
  }

  if (apply && summary.skipped < plan.length) {
    await Promise.all([
      User.createIndexes(),
      Wishlist.createIndexes(),
      Cart.createIndexes(),
      Rating.createIndexes(),
      Feedback.createIndexes(),
    ]);
    const now = new Date();
    const operations = [];
    const seededUsers = [];
    for (const [index, user] of DEMO_USERS.entries()) {
      const normalizedUsername = user.username.toLowerCase();
      const decision = plan[index];
      if (decision.action === "skip") continue;
      seededUsers.push(user);
      const { passwordHash, passwordSalt } = await hashPassword(user.password);
      if (decision.action === "create") {
        // bulkWrite bypasses Mongoose timestamp middleware, so set both fields
        // explicitly to match normally registered users.
        operations.push({
          insertOne: {
            document: {
              publicId: user.publicId,
              username: user.username,
              normalizedUsername,
              displayName: user.displayName,
              passwordHash,
              passwordSalt,
              role: "customer",
              active: true,
              preferences: canonicalPreferences(user, now),
              createdAt: now,
              updatedAt: now,
            },
          },
        });
      } else {
        // Update only a doc that already carries this demo publicId, so a
        // last-millisecond ownership change cannot be overwritten.
        operations.push({
          updateOne: {
            filter: { normalizedUsername, publicId: user.publicId },
            update: {
              $set: {
                username: user.username,
                displayName: user.displayName,
                passwordHash,
                passwordSalt,
                role: "customer",
                active: true,
                preferences: canonicalPreferences(user, now),
                updatedAt: now,
              },
            },
          },
        });
      }
    }
    let inserted = 0;
    let modified = 0;
    if (operations.length > 0) {
      const session = await connection.startSession();
      try {
        await session.withTransaction(async () => {
          const result = await User.bulkWrite(operations, { ordered: true, session });
          inserted = result.insertedCount;
          modified = result.modifiedCount;
          const seededPublicIds = seededUsers.map((user) => user.publicId);
          await Wishlist.bulkWrite(seededUsers.map((user) => ({
            updateOne: {
              filter: { userPublicId: user.publicId },
              update: {
                $set: {
                  productPublicIds: user.personalization.wishlist
                    .map((signal) => signal.productPublicId)
                    .sort((a, b) => a - b),
                  updatedAt: now,
                },
                $setOnInsert: { createdAt: now },
              },
              upsert: true,
            },
          })), { ordered: true, session, timestamps: false });
          await Cart.bulkWrite(seededUsers.map((user) => ({
            updateOne: {
              filter: { userPublicId: user.publicId },
              update: {
                $set: { items: [], updatedAt: now },
                $setOnInsert: { createdAt: now },
              },
              upsert: true,
            },
          })), { ordered: true, session, timestamps: false });
          await Rating.deleteMany({ userPublicId: { $in: seededPublicIds } }, { session });
          await Rating.insertMany(seededUsers.flatMap((user) => (
            user.personalization.ratings.map((signal) => ({
              userPublicId: user.publicId,
              productPublicId: signal.productPublicId,
              rating: signal.rating,
              createdAt: now,
              updatedAt: now,
            }))
          )), { ordered: true, session });
          await Feedback.deleteMany({ userPublicId: { $in: seededPublicIds } }, { session });
        });
      } finally {
        await session.endSession();
      }
    }
    console.log(JSON.stringify({
      status: "applied",
      inserted,
      modified,
      seededProfiles: seededUsers.length,
      seededRatings: seededUsers.reduce((count, user) => count + user.personalization.ratings.length, 0),
      seededWishlistItems: seededUsers.reduce((count, user) => count + user.personalization.wishlist.length, 0),
    }));
  }
} catch (error) {
  console.error(`Demo user seed failed: ${error.name || "Error"}`);
  process.exitCode = 1;
} finally {
  await disconnectMongoDB();
}
