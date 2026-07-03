import { connectMongoDB } from "../lib/db/mongodb.js";
import { persistenceUnavailable } from "../lib/errors.js";

export function createMongoRunner(connect = connectMongoDB) {
  return async (operation) => {
    try {
      await connect();
      return await operation();
    } catch (error) {
      if (error?.code === "PERSISTENCE_UNAVAILABLE") throw error;
      throw persistenceUnavailable();
    }
  };
}

export const toPlainObject = (document) => (
  typeof document?.toObject === "function" ? document.toObject() : document
);
