// Removes automated-test residue from the Atlas `vinyl_record_store` database
// so evaluation and catalog inspection start from a clean state. Safe by
// design: dry-run by default; never touches `vinylRecords` (the catalog) or any
// non-test user. Intended to run after every E2E/auth-write run that exercised a
// MongoDB-mode backend, and any time accumulated test cruft needs clearing.
//
//   node --env-file-if-exists=.env.local scripts/clean-test-residue.mjs            # dry-run
//   node --env-file-if-exists=.env.local scripts/clean-test-residue.mjs --apply    # execute
//
// What this deletes:
//   - users whose username starts with `e2e_` (Playwright-registered test accounts)
//   - interactions, recommendationLogs, carts, wishlists, ratings, guestMerges
//     (every document in these collections is currently test-generated; account
//     deletion already cleans per-user data, and this also removes anonymous
//     traffic and orphans from failed or aborted test runs)
// What this never deletes:
//   - vinylRecords (the 116-title catalog), counters, orders, auditLogs
//   - showcase users (jazzlistener / rockcollector / soulseeker) and admin
import { connectMongoDB, disconnectMongoDB } from "../src/lib/db/mongodb.js";

const apply = process.argv.includes("--apply");

// Customer-operational collections that currently hold only automated-test data. Each
// entry is wiped completely; vinylRecords and the admin/accounting collections
// are deliberately absent from this list.
const RESIDUE_COLLECTIONS = [
  "interactions",
  "recommendationLogs",
  "carts",
  "wishlists",
  "ratings",
  "guestMerges",
];
// Collections that must be left untouched. Asserted unchanged after --apply.
const PROTECTED_COLLECTIONS = ["vinylRecords", "counters", "orders", "auditLogs"];
const TEST_USER_FILTER = { username: { $regex: "^e2e_", $options: "" } };

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
  const testUserCount = await db.collection("users").countDocuments(TEST_USER_FILTER);
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

  const matchedUsernames = apply
    ? []
    : await db.collection("users").distinct("username", TEST_USER_FILTER);

  console.log(`\n=== TEST-RESIDUE CLEANUP (${apply ? "APPLY" : "DRY-RUN"}) ===`);
  console.log(`users (^e2e_):          ${String(testUserCount).padStart(6)} to delete`);
  for (const name of RESIDUE_COLLECTIONS) {
    console.log(`${name.padEnd(22)} ${String(residueCounts[name]).padStart(6)} to delete`);
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

    console.log(`\n=== APPLIED ===`);
    console.log(`deleted users (^e2e_):  ${deleted.users}`);
    for (const name of RESIDUE_COLLECTIONS) {
      console.log(`deleted ${name.padEnd(19)} ${deleted[name]}`);
    }
    console.log(`\n--- post-state ---`);
    console.log(`vinylRecords:           ${protectedAfter.vinylRecords} (unchanged)`);
    console.log(`users remaining:        ${await db.collection("users").countDocuments({})}`);
  }
} catch (error) {
  console.error(`[clean-test-residue] failed: ${error.message || error.name}`);
  process.exitCode = 1;
} finally {
  await disconnectMongoDB();
}
