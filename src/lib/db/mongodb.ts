import mongoose from "mongoose";
import { getEnv } from "@/config/env";

declare global {
  var mongooseCache: {
    conn: typeof mongoose | null;
    promise: Promise<typeof mongoose> | null;
  } | undefined;
}

let cached = global.mongooseCache;

if (!cached) {
  cached = global.mongooseCache = { conn: null, promise: null };
}

/**
 * Connect to MongoDB with connection caching to avoid connection explosion across serverless/HMR requests
 */
export async function connectToDatabase(): Promise<typeof mongoose> {
  if (cached?.conn) {
    return cached.conn;
  }

  if (!cached?.promise) {
    const { MONGODB_URI } = getEnv();

    const opts: mongoose.ConnectOptions = {
      bufferCommands: false,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    };

    cached!.promise = mongoose.connect(MONGODB_URI, opts).then((m) => {
      return m;
    });
  }

  try {
    cached!.conn = await cached!.promise;
  } catch (error) {
    cached!.promise = null;
    throw error;
  }

  return cached!.conn;
}

/**
 * Verify MongoDB connection health
 */
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    const conn = await connectToDatabase();
    return conn.connection.readyState === 1;
  } catch {
    return false;
  }
}

/**
 * Disconnect from MongoDB (useful for test teardown)
 */
export async function disconnectDatabase(): Promise<void> {
  if (cached?.conn) {
    await cached.conn.disconnect();
    cached.conn = null;
    cached.promise = null;
  }
}
