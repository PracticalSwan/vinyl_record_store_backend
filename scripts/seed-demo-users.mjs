import { connectMongoDB, disconnectMongoDB } from "../src/lib/db/mongodb.js";
import { User } from "../src/models/User.js";
import { hashPassword } from "../src/lib/auth/password.js";
import { DEMO_USERS } from "../src/data/demoUsers.js";

const apply = process.argv.includes("--apply");

// Mirror the User model preference defaults so creates and updates land on the
// same clean profile. Mongoose defaults apply on create but not on update, so
// the seed sets them explicitly. Preferences stay empty for now (see
// demoUsers.js and FUTURE_IMPLEMENTATION_PLAN).
const emptyPreferences = () => ({
  favoriteGenres: [],
  dislikedGenres: [],
  favoriteArtists: [],
  budget: { min: null, max: null },
  conditions: [],
  formats: [],
  completedAt: null,
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
    if (!existing) return { username: user.username, publicId: user.publicId, action: "create" };
    if (existing.publicId !== user.publicId) {
      return {
        username: user.username,
        publicId: user.publicId,
        action: "skip",
        reason: "username is held by a different account",
        heldBy: existing.publicId,
      };
    }
    return { username: user.username, publicId: user.publicId, action: "update" };
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
    await User.createIndexes();
    const now = new Date();
    const operations = [];
    for (const [index, user] of DEMO_USERS.entries()) {
      const normalizedUsername = user.username.toLowerCase();
      const decision = plan[index];
      if (decision.action === "skip") continue;
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
              preferences: emptyPreferences(),
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
                preferences: emptyPreferences(),
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
        });
      } finally {
        await session.endSession();
      }
    }
    console.log(JSON.stringify({ status: "applied", inserted, modified }));
  }
} catch (error) {
  console.error(`Demo user seed failed: ${error.name || "Error"}`);
  process.exitCode = 1;
} finally {
  await disconnectMongoDB();
}
