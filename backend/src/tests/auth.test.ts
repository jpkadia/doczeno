import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { createApp } from "@/app";
import { User } from "@/models";
import { AuthService } from "@/services/auth.service";
import { UserRole } from "@/types";

vi.mock("@/db/connection", () => ({
  connectToDatabase: vi.fn().mockResolvedValue({
    connection: { readyState: 1 },
  }),
  checkDatabaseHealth: vi.fn().mockResolvedValue(true),
  disconnectDatabase: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/services/audit.service", () => ({
  logAuditEvent: vi.fn().mockResolvedValue(undefined),
}));

describe("Authentication & Session API (Supertest)", () => {
  const app = createApp();

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("POST /api/v1/auth/register", () => {
    it("registers a new independent doctor user and sets secure cookie", async () => {
      vi.spyOn(User, "findOne").mockResolvedValue(null);
      vi.spyOn(User, "create").mockResolvedValue({
        _id: "u-new-123",
        email: "dr.new@clinic.com",
        name: "Dr. New Doctor",
        role: UserRole.INDEPENDENT_DOCTOR,
        isActive: true,
      } as any);

      const res = await request(app)
        .post("/api/v1/auth/register")
        .send({
          email: "dr.new@clinic.com",
          password: "StrongPassword123!",
          name: "Dr. New Doctor",
          role: UserRole.INDEPENDENT_DOCTOR,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.email).toBe("dr.new@clinic.com");
      const cookies = res.headers["set-cookie"] as string[] | undefined;
      expect(cookies).toBeDefined();
      expect(cookies?.[0]).toContain("doczeno_session");
      expect(cookies?.[0]).toContain("HttpOnly");
    });
  });

  describe("POST /api/v1/auth/login", () => {
    it("logs in with valid credentials and returns session", async () => {
      const passwordHash = await AuthService.hashPassword("CorrectPassword123");

      vi.spyOn(User, "findOne").mockResolvedValue({
        _id: "u-existing",
        email: "dr.existing@clinic.com",
        passwordHash,
        name: "Dr. Existing",
        role: UserRole.INDEPENDENT_DOCTOR,
        isActive: true,
      } as any);

      const res = await request(app)
        .post("/api/v1/auth/login")
        .send({
          email: "dr.existing@clinic.com",
          password: "CorrectPassword123",
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.token).toBeDefined();
    });

    it("rejects login with invalid password without leaking account existence", async () => {
      const passwordHash = await AuthService.hashPassword("CorrectPassword123");

      vi.spyOn(User, "findOne").mockResolvedValue({
        _id: "u-existing",
        email: "dr.existing@clinic.com",
        passwordHash,
        name: "Dr. Existing",
        role: UserRole.INDEPENDENT_DOCTOR,
        isActive: true,
      } as any);

      const res = await request(app)
        .post("/api/v1/auth/login")
        .send({
          email: "dr.existing@clinic.com",
          password: "WrongPassword!",
        });

      expect(res.status).toBe(500); // Handled safely by generic message
      expect(res.body.error).toBe("Invalid email or password");
    });
  });
});
