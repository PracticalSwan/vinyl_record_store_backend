import { connectMongoDB } from "../lib/db/mongodb.js";
import { persistenceUnavailable, ServiceError } from "../lib/errors.js";

export function createMongoRunner(connect = connectMongoDB) {
  return async (operation) => {
    try {
      const connection = await connect();
      return await operation(connection);
    } catch (error) {
      if (error instanceof ServiceError) throw error;
      throw persistenceUnavailable();
    }
  };
}

export const toPlainObject = (document) => (
  typeof document?.toObject === "function" ? document.toObject() : document
);
