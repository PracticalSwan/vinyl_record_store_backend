import process from "node:process";
import { disconnectMongoDB } from "../src/lib/db/mongodb.js";
import { userRepository } from "../src/repositories/userRepository.js";
import { normalizeUsername } from "../src/validation/auth.js";

const usernameIndex = process.argv.indexOf("--username");
const supplied = usernameIndex >= 0 ? process.argv[usernameIndex + 1] : null;
if (!supplied) throw new Error("Usage: npm run auth:promote -- --username <username> [--apply]");

const { normalizedUsername } = normalizeUsername(supplied);
const current = await userRepository.findByNormalizedUsername(normalizedUsername);
if (!current) throw new Error("The active user was not found.");

if (!process.argv.includes("--apply")) {
  console.log(JSON.stringify({ dryRun: true, publicId: current.publicId, currentRole: current.role }));
  await disconnectMongoDB();
  process.exit(0);
}

const updated = await userRepository.setRole(normalizedUsername, "admin");
console.log(JSON.stringify({ dryRun: false, publicId: updated.publicId, role: updated.role }));
await disconnectMongoDB();
