import { Counter } from "../models/Counter.js";
import { Order } from "../models/Order.js";
import { createMongoRunner, toPlainObject } from "./repositorySupport.js";

const clean = (document) => {
  const value = toPlainObject(document);
  if (!value) return null;
  const { _id, ...result } = value;
  return result;
};

export function createOrderRepository(
  { orderModel = Order, counterModel = Counter } = {},
  connect,
) {
  const run = createMongoRunner(connect);
  return {
    allocatePublicId: (counterName = "orders") => run(async () => {
      const counter = await counterModel.findOneAndUpdate(
        { _id: counterName },
        { $inc: { value: 1 } },
        { new: true, upsert: true },
      ).lean().exec();
      return counter.value;
    }),
    findByPublicId: (publicId) => run(async () => clean(
      await orderModel.findOne({ publicId }).lean().exec(),
    )),
    create: (data) => run(async () => clean(await orderModel.create(data))),
  };
}

export const orderRepository = createOrderRepository();
