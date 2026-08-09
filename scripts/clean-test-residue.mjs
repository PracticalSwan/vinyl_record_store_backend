// Removes automated-test residue from the Atlas `vinyl_record_store` database
// so evaluation and catalog inspection start from a clean state. Safe by
// design: dry-run by default; never touches either catalog collection, dataset
// lifecycle/evidence collections, or any non-test user. Intended to run after every E2E/auth-write run that exercised a
// MongoDB-mode backend, and any time accumulated test cruft needs clearing.
//
//   node --env-file-if-exists=.env.local scripts/clean-test-residue.mjs            # dry-run
//   node --env-file-if-exists=.env.local scripts/clean-test-residue.mjs --apply    # execute
//
// What this deletes:
//   - users whose username starts with `e2e_` (Playwright-registered test accounts)
//   - interactions, recommendationLogs, carts, wishlists, ratings, guestMerges
//     (these collections are retained as the existing full test-residue policy)
//   - feedback rows owned by the matched `e2e_` users only; durable feedback from
//     showcase or ordinary customers is never collection-wiped
// What this never deletes:
//   - vinylRecords, datasetProducts, datasetImports, historicalAmazonRatings,
//     counters, orders, and auditLogs
//   - showcase users (jazzlistener / rockcollector / soulseeker) and admin
import { connectMongoDB, disconnectMongoDB } from "../src/lib/db/mongodb.js";
import {
  TEST_CLEANUP_PROTECTED_COLLECTIONS as PROTECTED_COLLECTIONS,
  TEST_RESIDUE_COLLECTIONS as RESIDUE_COLLECTIONS,
  TEST_USER_SCOPED_RESIDUE_COLLECTIONS as USER_SCOPED_RESIDUE_COLLECTIONS,
  TEST_USER_FILTER,
} from "../src/lib/db/testResiduePolicy.js";

const apply = process.argv.includes("--apply");

// Customer-operational collections that currently hold only automated-test data. Each
// entry is wiped completely; vinylRecords and the admin/accounting collections
// are deliberately absent from this list.
// The executable policy lives in src/lib/db/testResiduePolicy.js so tests can
// prove dataset collections are outside the deletion set.

function exitSkipped(reason) {
  console.log(`[clean-test-residue] skipped: ${reason}`);
}

try {
  let connection;
  try {
    connection = await connectMongoDB();
  } catch (error) {
    // No Atlas configuration (e.g. CI, seed-only checkout) is an acceptable
    // no-op: there is nothing test-generated to remove in that case.
    exitSkipped(`Atlas unavailable (${error.message || error.name})`);
    process.exit(0);
  }
  const db = connection.db;

  const protectedBefore = {};
  for (const name of PROTECTED_COLLECTIONS) {
    protectedBefore[name] = await db.collection(name).countDocuments();
  }
  const testUsers = await db.collection("users")
    .find(TEST_USER_FILTER, { projection: { _id: 0, publicId: 1, username: 1 } })
    .toArray();
  const testUserCount = testUsers.length;
  const testUserPublicIds = testUsers
    .map((user) => user.publicId)
    .filter((publicId) => typeof publicId === "string" && publicId.length > 0);
  const keptUserCount = await db.collection("users").countDocuments({
    username: { $not: { $regex: "^e2e_" } },
  });
  const keptUsernames = await db
    .collection("users")
    .distinct("username", { username: { $not: { $regex: "^e2e_" } } });

  const residueCounts = {};
  for (const name of RESIDUE_COLLECTIONS) {
    residueCounts[name] = await db.collection(name).countDocuments();
  }
  const userScopedResidueCounts = {};
  const testOwnerFilter = { userPublicId: { $in: testUserPublicIds } };
  for (const name of USER_SCOPED_RESIDUE_COLLECTIONS) {
    userScopedResidueCounts[name] = testUserPublicIds.length
      ? await db.collection(name).countDocuments(testOwnerFilter)
      : 0;
  }

  const matchedUsernames = apply ? [] : testUsers.map((user) => user.username).filter(Boolean);

  console.log(`\n=== TEST-RESIDUE CLEANUP (${apply ? "APPLY" : "DRY-RUN"}) ===`);
  console.log(`users (^e2e_):          ${String(testUserCount).padStart(6)} to delete`);
  for (const name of RESIDUE_COLLECTIONS) {
    console.log(`${name.padEnd(22)} ${String(residueCounts[name]).padStart(6)} to delete`);
  }
  for (const name of USER_SCOPED_RESIDUE_COLLECTIONS) {
    console.log(`${`${name} (e2e users)`.padEnd(22)} ${String(userScopedResidueCounts[name]).padStart(6)} to delete`);
  }
  console.log(`\n--- will keep (untouched) ---`);
  for (const name of PROTECTED_COLLECTIONS) {
    console.log(`${name.padEnd(22)} ${String(protectedBefore[name]).padStart(6)}`);
  }
  console.log(`users (non-test):       ${String(keptUserCount).padStart(6)}  ${JSON.stringify(keptUsernames)}`);
  if (!apply && testUserCount > 0) {
    console.log(`\n--- test usernames matched (verify before --apply) ---`);
    for (const u of matchedUsernames.sort()) console.log(`  ${u}`);
  }

  if (!apply) {
    console.log("\nDry-run only. Re-run with --apply to execute.");
  } else {
    const deleted = {};
    for (const name of USER_SCOPED_RESIDUE_COLLECTIONS) {
      deleted[name] = testUserPublicIds.length
        ? (await db.collection(name).deleteMany(testOwnerFilter)).deletedCount
        : 0;
    }
    deleted.users = (await db.collection("users").deleteMany(TEST_USER_FILTER)).deletedCount;
    for (const name of RESIDUE_COLLECTIONS) {
      deleted[name] = (await db.collection(name).deleteMany({})).deletedCount;
    }

    // Post-condition assertions: protected collections unchanged and no test
    // users remain. Abort loudly if either is violated so a partial or
    // mis-targeted run can never look successful.
    const protectedAfter = {};
    for (const name of PROTECTED_COLLECTIONS) {
      protectedAfter[name] = await db.collection(name).countDocuments();
    }
    for (const name of PROTECTED_COLLECTIONS) {
      if (protectedAfter[name] !== protectedBefore[name]) {
        throw new Error(
          `SAFETY ABORT: ${name} changed ${protectedBefore[name]} -> ${protectedAfter[name]}`,
        );
      }
    }
    const testUsersRemaining = await db.collection("users").countDocuments(TEST_USER_FILTER);
    if (testUsersRemaining !== 0) {
      throw new Error(`SAFETY ABORT: ${testUsersRemaining} test users still present`);
    }
    for (const name of USER_SCOPED_RESIDUE_COLLECTIONS) {
      const remaining = testUserPublicIds.length
        ? await db.collection(name).countDocuments(testOwnerFilter)
        : 0;
      if (remaining !== 0) {
        throw new Error(`SAFETY ABORT: ${remaining} ${name} rows for deleted test users still present`);
      }
    }

    console.log(`\n=== APPLIED ===`);
    console.log(`deleted users (^e2e_):  ${deleted.users}`);
    for (const name of RESIDUE_COLLECTIONS) {
      console.log(`deleted ${name.padEnd(19)} ${deleted[name]}`);
    }
    for (const name of USER_SCOPED_RESIDUE_COLLECTIONS) {
      console.log(`deleted ${`${name} (e2e users)`.padEnd(19)} ${deleted[name]}`);
    }
    console.log(`\n--- post-state ---`);
    for (const name of PROTECTED_COLLECTIONS) {
      console.log(`${`${name}:`.padEnd(22)} ${protectedAfter[name]} (unchanged)`);
    }
    console.log(`users remaining:        ${await db.collection("users").countDocuments({})}`);
  }
} catch (error) {
  console.error(`[clean-test-residue] failed: ${error.message || error.name}`);
  process.exitCode = 1;
} finally {
  await disconnectMongoDB();
}
