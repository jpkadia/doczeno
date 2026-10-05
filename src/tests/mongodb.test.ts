import { describe, it, expect, vi, beforeEach } from "vitest";
import mongoose from "mongoose";

describe("MongoDB Connection Layer", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("caches the connection promise to prevent duplicate connections", async () => {
    process.env.MONGODB_URI = "mongodb://localhost:27017/doczeno_test";
    process.env.BETTER_AUTH_SECRET = "super-secret-key-that-is-at-least-16-chars";

    const mockMongoose = {
      connection: { readyState: 1 },
      disconnect: vi.fn(),
    } as unknown as typeof mongoose;

    const connectSpy = vi
      .spyOn(mongoose, "connect")
      .mockResolvedValue(mockMongoose);

    const { connectToDatabase, disconnectDatabase } = await import(
      "@/lib/db/mongodb"
    );

    // First call connects
    const conn1 = await connectToDatabase();
    expect(conn1).toBe(mockMongoose);
    expect(connectSpy).toHaveBeenCalledTimes(1);

    // Second call reuses cached connection without calling mongoose.connect again
    const conn2 = await connectToDatabase();
    expect(conn2).toBe(mockMongoose);
    expect(connectSpy).toHaveBeenCalledTimes(1);

    await disconnectDatabase();
  });

  it("checks database health status accurately", async () => {
    process.env.MONGODB_URI = "mongodb://localhost:27017/doczeno_test";
    process.env.BETTER_AUTH_SECRET = "super-secret-key-that-is-at-least-16-chars";

    const mockMongoose = {
      connection: { readyState: 1 },
      disconnect: vi.fn(),
    } as unknown as typeof mongoose;

    vi.spyOn(mongoose, "connect").mockResolvedValue(mockMongoose);

    const { checkDatabaseHealth } = await import("@/lib/db/mongodb");
    const isHealthy = await checkDatabaseHealth();
    expect(isHealthy).toBe(true);
  });
});
