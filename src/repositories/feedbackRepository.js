import { Feedback } from "../models/Feedback.js";
import { createMongoRunner, toPlainObject } from "./repositorySupport.js";

const clean = (document) => {
  const value = toPlainObject(document);
  if (!value) return null;
  const { _id, ...result } = value;
  return result;
};

export function createFeedbackRepository(model = Feedback, connect) {
  const run = createMongoRunner(connect);
  return {
    findByUserAndProduct: (userPublicId, productPublicId) => run(async () => clean(
      await model.findOne({ userPublicId, productPublicId }).lean().exec(),
    )),
    listByUser: (userPublicId) => run(async () => (
      await model.find({ userPublicId }).sort({ productPublicId: 1 }).lean().exec()
    ).map(clean)),
    upsert: (userPublicId, productPublicId, kind) => run(async () => clean(
      await model.findOneAndUpdate(
        { userPublicId, productPublicId },
        { $set: { kind }, $setOnInsert: { schemaVersion: 1 } },
        { returnDocument: "after", runValidators: true, upsert: true, setDefaultsOnInsert: true },
      ).lean().exec(),
    )),
    remove: (userPublicId, productPublicId) => run(async () => clean(
      await model.findOneAndDelete({ userPublicId, productPublicId }).lean().exec(),
    )),
  };
}

export const feedbackRepository = createFeedbackRepository();
