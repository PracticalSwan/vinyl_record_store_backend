import { forbidden, notFound } from "../lib/errors.js";
import { accountRepository } from "../repositories/accountRepository.js";

export async function deleteAccount(user, { repository = accountRepository } = {}) {
  if (user.seeded) throw forbidden("Seeded demonstration accounts cannot be deleted.");
  if (user.role !== "customer") throw forbidden("Administrator accounts cannot be deleted here.");
  if (!await repository.deleteCustomerAccount(user.publicId)) {
    throw notFound("The active account was not found.");
  }
  return { deleted: true };
}
