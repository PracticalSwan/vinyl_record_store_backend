import { User } from "../models/User.js";
import { conflict } from "../lib/errors.js";
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
    findForAuthentication: (normalizedUsername) => run(async () => {
      const query = model.findOne({ normalizedUsername, active: true });
      const document = await query.select("+passwordHash +passwordSalt").lean().exec();
      return toPlainObject(document);
    }),
    create: (data) => run(async () => {
      try {
        return publicUser(await model.create(data));
      } catch (error) {
        if (error?.code === 11000) throw conflict("That username is already registered.");
        throw error;
      }
    }),
    updatePreferences: (publicId, preferences) => run(async () => publicUser(
      await model.findOneAndUpdate(
        { publicId, active: true },
        { $set: { preferences } },
        { returnDocument: "after", runValidators: true },
      ).lean().exec(),
    )),
  };
}

export const userRepository = createUserRepository();
