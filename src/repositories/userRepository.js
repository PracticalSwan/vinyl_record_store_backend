import { User } from "../models/User.js";
import { createMongoRunner, toPlainObject } from "./repositorySupport.js";

const publicUser = (document) => {
  const value = toPlainObject(document);
  if (!value) return null;
  const { _id, passwordHash, passwordSalt, ...user } = value;
  return user;
};

export function createUserRepository(model = User, connect) {
  const run = createMongoRunner(connect);
  return {
    findByPublicId: (publicId) => run(async () => publicUser(
      await model.findOne({ publicId, active: true }).lean().exec(),
    )),
    findByNormalizedUsername: (normalizedUsername) => run(async () => publicUser(
      await model.findOne({ normalizedUsername, active: true }).lean().exec(),
    )),
    create: (data) => run(async () => publicUser(await model.create(data))),
  };
}

export const userRepository = createUserRepository();
