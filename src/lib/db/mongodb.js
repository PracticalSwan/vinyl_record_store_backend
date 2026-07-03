import mongoose from "mongoose";

const CONNECTION_TIMEOUT_MS = 10_000;
const MAX_POOL_SIZE = 5;

const cache = globalThis.__vinylMongoCache ?? {
  connection: null,
  promise: null,
};

globalThis.__vinylMongoCache = cache;

export class MongoDBConfigurationError extends Error {
  constructor(message) {
    super(message);
    this.name = "MongoDBConfigurationError";
  }
}

export function getMongoDBConfig(environment = process.env) {
  const uri = environment.MONGODB_URI?.trim();
  const database = environment.MONGODB_DB_NAME?.trim();

  if (!uri) {
    throw new MongoDBConfigurationError("MONGODB_URI is not configured.");
  }
  if (!database) {
    throw new MongoDBConfigurationError("MONGODB_DB_NAME is not configured.");
  }

  return { uri, database };
}

export async function connectMongoDB() {
  const { uri, database } = getMongoDBConfig();

  if (cache.connection?.readyState === 1) {
    return cache.connection;
  }

  // Treat any non-connected state (disconnected/connecting/disconnecting) as a
  // stale cache. A connecting or disconnecting connection can resolve to one
  // that is already closing, so drop it and reconnect instead of awaiting it.
  if (cache.connection && cache.connection.readyState !== 1) {
    cache.connection = null;
    cache.promise = null;
  }

  if (!cache.promise) {
    cache.promise = mongoose
      .connect(uri, {
        appName: "vinyl-record-store-backend",
        bufferCommands: false,
        connectTimeoutMS: CONNECTION_TIMEOUT_MS,
        dbName: database,
        maxPoolSize: MAX_POOL_SIZE,
        serverSelectionTimeoutMS: CONNECTION_TIMEOUT_MS,
      })
      .then((instance) => instance.connection)
      .catch((error) => {
        cache.promise = null;
        throw error;
      });
  }

  cache.connection = await cache.promise;
  return cache.connection;
}

export async function pingMongoDB() {
  const connection = await connectMongoDB();
  const result = await connection.db.admin().ping();

  if (result.ok !== 1) {
    throw new Error("MongoDB ping did not return an OK result.");
  }

  return {
    status: "connected",
    database: connection.name,
    readyState: connection.readyState,
  };
}

export async function disconnectMongoDB() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }

  cache.connection = null;
  cache.promise = null;
}
