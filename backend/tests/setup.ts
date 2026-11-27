import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { beforeAll, afterAll } from "vitest";

let mongoServer: MongoMemoryServer;

// Configure isolated test environment BEFORE importing application modules
process.env.NODE_ENV = "test";
process.env.MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/doczeno-vitest-placeholder";
process.env.AUTH_SECRET = "doczeno-vitest-integration-secret-32chars";
process.env.FRONTEND_URL = "http://localhost:3000";
process.env.GEMINI_API_KEY = "";

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  process.env.MONGODB_URI = uri;

  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(uri);
  }
});

afterAll(async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  if (mongoServer) {
    await mongoServer.stop();
  }
});

export async function clearTestDatabase(): Promise<void> {
  const collections = mongoose.connection.collections;
  for (const key of Object.keys(collections)) {
    const col = collections[key];
    if (col) {
      await col.deleteMany({});
    }
  }
}
