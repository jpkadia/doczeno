import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { createApp } from "@/app";
import { UserRole } from "@/types";
import { Organization, Doctor } from "@/models";

// Mock database connection for in-process fast HTTP tests
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

const AUTH_SECRET = "doczeno-secure-default-auth-secret-key-32chars";

function generateTestToken(payload: {
  userId: string;
  email: string;
  role: UserRole;
  organizationId?: string | null;
  doctorProfileId?: string | null;
}): string {
  return jwt.sign(payload, AUTH_SECRET, { expiresIn: "1h" });
}

describe("Backend Tenant Isolation & Permission Matrix (Supertest)", () => {
  const app = createApp();

  const orgApolloId = new mongoose.Types.ObjectId().toString();
  const orgMaxId = new mongoose.Types.ObjectId().toString();

  const docRajivId = new mongoose.Types.ObjectId().toString();
  const docNehaId = new mongoose.Types.ObjectId().toString();
  const docParthId = new mongoose.Types.ObjectId().toString();

  const superadminToken = generateTestToken({
    userId: "u-sa",
    email: "superadmin@doczeno.com",
    role: UserRole.SUPERADMIN,
  });

  const apolloAdminToken = generateTestToken({
    userId: "u-apollo-admin",
    email: "admin@apollo.com",
    role: UserRole.HOSPITAL_ADMIN,
    organizationId: orgApolloId,
  });

  const maxAdminToken = generateTestToken({
    userId: "u-max-admin",
    email: "admin@max.com",
    role: UserRole.HOSPITAL_ADMIN,
    organizationId: orgMaxId,
  });

  const drRajivToken = generateTestToken({
    userId: "u-rajiv",
    email: "dr.rajiv@apollo.com",
    role: UserRole.HOSPITAL_DOCTOR,
    organizationId: orgApolloId,
    doctorProfileId: docRajivId,
  });

  const drParthToken = generateTestToken({
    userId: "u-parth",
    email: "dr.parth@clinic.com",
    role: UserRole.INDEPENDENT_DOCTOR,
    doctorProfileId: docParthId,
  });

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("Hospital Admin Isolation", () => {
    it("Apollo admin CANNOT update Max Hospital (403 Forbidden)", async () => {
      const res = await request(app)
        .put(`/api/v1/organizations/${orgMaxId}`)
        .set("Authorization", `Bearer ${apolloAdminToken}`)
        .send({ name: "Hacked Hospital Name" });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("TENANT_ACCESS_DENIED");
      expect(res.body.error).toContain("Forbidden");
    });

    it("Apollo admin CAN update Apollo Hospital (200 OK)", async () => {
      vi.spyOn(Organization, "findByIdAndUpdate").mockResolvedValue({
        _id: orgApolloId,
        name: "Apollo Multispecialty Updated",
      } as any);

      const res = await request(app)
        .put(`/api/v1/organizations/${orgApolloId}`)
        .set("Authorization", `Bearer ${apolloAdminToken}`)
        .send({ name: "Apollo Multispecialty Updated" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("Apollo admin CANNOT modify a doctor belonging to Max Hospital (403 Forbidden)", async () => {
      // Mock Doctor lookup showing doctor belongs to orgMaxId
      vi.spyOn(Doctor, "findById").mockResolvedValue({
        _id: "doc-max-physician",
        organizationId: orgMaxId,
      } as any);

      const res = await request(app)
        .put(`/api/v1/doctors/doc-max-physician`)
        .set("Authorization", `Bearer ${apolloAdminToken}`)
        .send({ doctorName: "Attempted Update" });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("DOCTOR_ACCESS_DENIED");
    });

    it("Max admin CAN update Max Hospital, but CANNOT update Apollo (bidirectional tenant isolation)", async () => {
      vi.spyOn(Organization, "findByIdAndUpdate").mockResolvedValue({
        _id: orgMaxId,
        name: "Max Healthcare Center",
      } as any);

      const maxOwnRes = await request(app)
        .put(`/api/v1/organizations/${orgMaxId}`)
        .set("Authorization", `Bearer ${maxAdminToken}`)
        .send({ name: "Max Healthcare Center" });

      expect(maxOwnRes.status).toBe(200);

      const maxCrossRes = await request(app)
        .put(`/api/v1/organizations/${orgApolloId}`)
        .set("Authorization", `Bearer ${maxAdminToken}`)
        .send({ name: "Cross Tenant Attack" });

      expect(maxCrossRes.status).toBe(403);
      expect(maxCrossRes.body.code).toBe("TENANT_ACCESS_DENIED");
    });
  });

  describe("Hospital Doctor Isolation & Inheritance Protection", () => {
    it("Dr. Rajiv CANNOT modify Dr. Neha's doctor profile (403 Forbidden)", async () => {
      const res = await request(app)
        .put(`/api/v1/doctors/${docNehaId}`)
        .set("Authorization", `Bearer ${drRajivToken}`)
        .send({ doctorName: "Tampered Name" });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("DOCTOR_ACCESS_DENIED");
    });

    it("Hospital Doctor Dr. Rajiv CANNOT modify hospital-owned address or city (403 Forbidden)", async () => {
      const res = await request(app)
        .put(`/api/v1/doctors/${docRajivId}`)
        .set("Authorization", `Bearer ${drRajivToken}`)
        .send({
          address: "New Hospital Address",
          city: "Mumbai",
        });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("INHERITED_FIELD_MUTATION_FORBIDDEN");
      expect(res.body.violations).toContain("address");
      expect(res.body.violations).toContain("city");
    });

    it("Hospital Doctor Dr. Rajiv CANNOT modify hospital theme or favicon (403 Forbidden)", async () => {
      const res = await request(app)
        .put(`/api/v1/doctors/${docRajivId}`)
        .set("Authorization", `Bearer ${drRajivToken}`)
        .send({
          selectedTheme: "dark-cyberpunk",
          faviconUrl: "https://evil.com/favicon.ico",
        });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("INHERITED_FIELD_MUTATION_FORBIDDEN");
      expect(res.body.violations).toContain("selectedTheme");
      expect(res.body.violations).toContain("faviconUrl");
    });

    it("Hospital Doctor Dr. Rajiv CAN update their own specialization and degree (200 OK)", async () => {
      vi.spyOn(Doctor, "findByIdAndUpdate").mockResolvedValue({
        _id: docRajivId,
        doctorName: "Dr. Rajiv Shah",
        specialization: "Interventional Cardiology",
        degree: "MBBS, MD, DM",
      } as any);

      const res = await request(app)
        .put(`/api/v1/doctors/${docRajivId}`)
        .set("Authorization", `Bearer ${drRajivToken}`)
        .send({
          specialization: "Interventional Cardiology",
          degree: "MBBS, MD, DM",
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe("Independent Doctor Isolation", () => {
    it("Independent Doctor CANNOT manage or mutate hospital organization data (403 Forbidden)", async () => {
      const res = await request(app)
        .put(`/api/v1/organizations/${orgApolloId}`)
        .set("Authorization", `Bearer ${drParthToken}`)
        .send({ name: "Independent Doctor Tamper" });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("TENANT_ACCESS_DENIED");
    });
  });

  describe("Superadmin Platform Privileges", () => {
    it("Superadmin CAN update any organization (200 OK)", async () => {
      vi.spyOn(Organization, "findByIdAndUpdate").mockResolvedValue({
        _id: orgApolloId,
        name: "Superadmin Updated Org",
      } as any);

      const res = await request(app)
        .put(`/api/v1/organizations/${orgApolloId}`)
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({ name: "Superadmin Updated Org" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("Superadmin CAN update any doctor (200 OK)", async () => {
      vi.spyOn(Doctor, "findByIdAndUpdate").mockResolvedValue({
        _id: docRajivId,
        doctorName: "Superadmin Verified Rajiv",
      } as any);

      const res = await request(app)
        .put(`/api/v1/doctors/${docRajivId}`)
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({ doctorName: "Superadmin Verified Rajiv" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });
});
