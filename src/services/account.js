import { forbidden, notFound } from "../lib/errors.js";
import { DEMO_USER_PUBLIC_IDS } from "../data/demoUsers.js";
import { accountRepository } from "../repositories/accountRepository.js";

export async function deleteAccount(user, { repository = accountRepository } = {}) {
  if (user.seeded) throw forbidden("Seeded demonstration accounts cannot be deleted.");
  if (user.role !== "customer") throw forbidden("Administrator accounts cannot be deleted here.");
  if (DEMO_USER_PUBLIC_IDS.includes(user.publicId)) {
    throw forbidden("Showcase accounts cannot be deleted.");
  }
  if (!await repository.deleteCustomerAccount(user.publicId)) {
    throw notFound("The active account was not found.");
  }
  return { deleted: true };
}
