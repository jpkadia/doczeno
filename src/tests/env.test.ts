import { describe, it, expect, vi, beforeEach } from "vitest";

describe("Environment Validation Module", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  it("validates successfully with required environment variables", async () => {
    process.env.MONGODB_URI = "mongodb://localhost:27017/doczeno_test";
    process.env.BETTER_AUTH_SECRET = "super-secret-key-that-is-at-least-16-chars";
    process.env.BETTER_AUTH_URL = "http://localhost:3000";

    const { getEnv } = await import("@/config/env");
    const parsed = getEnv();

    expect(parsed.MONGODB_URI).toBe("mongodb://localhost:27017/doczeno_test");
    expect(parsed.BETTER_AUTH_SECRET).toBe("super-secret-key-that-is-at-least-16-chars");
    expect(parsed.NODE_ENV).toBeDefined();
  });

  it("throws clear error when MONGODB_URI is missing", async () => {
    delete process.env.MONGODB_URI;
    process.env.BETTER_AUTH_SECRET = "super-secret-key-that-is-at-least-16-chars";

    const { getEnv } = await import("@/config/env");
    expect(() => getEnv()).toThrowError(/MONGODB_URI is required/);
  });

  it("throws clear error when BETTER_AUTH_SECRET is too short", async () => {
    process.env.MONGODB_URI = "mongodb://localhost:27017/doczeno_test";
    process.env.BETTER_AUTH_SECRET = "short";

    const { getEnv } = await import("@/config/env");
    expect(() => getEnv()).toThrowError(/BETTER_AUTH_SECRET must be at least 16 characters/);
  });
});
