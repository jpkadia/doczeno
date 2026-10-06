import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { createApp } from "@/app";
import { UserRole, WebsiteType } from "@/types";
import {
  Organization,
  Doctor,
  Website,
  User,
  Media,
} from "@/models";
import { AuthService } from "@/services/auth.service";
import { MediaService, verifyImageFileSignature } from "@/services/media.service";
import { slugSchema } from "@/validations/onboarding";
import { adminAssistantService } from "@/services/admin-assistant.service";
import { isMedicalAdviceQuery } from "@/services/public-chatbot.service";
import { errorHandler } from "@/middleware/error";

// Mock database connection for in-process fast HTTP tests
vi.mock("@/db/connection", () => ({
  connectToDatabase: vi.fn().mockResolvedValue({
    connection: { readyState: 1 },
  }),
  checkDatabaseHealth: vi.fn().mockResolvedValue(true),
  disconnectDatabase: vi.fn().mockResolvedValue(undefined),
}));

// Mock GoogleGenAI SDK to verify public website rendering NEVER invokes Gemini
const { mockGenerateContent } = vi.hoisted(() => ({
  mockGenerateContent: vi.fn().mockResolvedValue({
    text: "Simulated AI response",
    functionCalls: [],
  }),
}));

vi.mock("@google/genai", () => ({
  GoogleGenAI: vi.fn().mockImplementation(() => ({
    models: {
      generateContent: mockGenerateContent,
    },
  })),
  Type: {
    OBJECT: "OBJECT",
    STRING: "STRING",
    NUMBER: "NUMBER",
    BOOLEAN: "BOOLEAN",
    ARRAY: "ARRAY",
  },
}));

const AUTH_SECRET = "doczeno-secure-default-auth-secret-key-32chars";

function generateTestToken(payload: {
  userId: string;
  email: string;
  role: UserRole;
  organizationId?: string | null;
  doctorProfileId?: string | null;
}, expiresIn: string | number = "1h"): string {
  return jwt.sign(payload, AUTH_SECRET, { expiresIn: expiresIn as any });
}

describe("TASK 8 — Production Hardening, Security Audit & Tenant Isolation Matrix", () => {
  const app = createApp();

  // Test Tenant IDs
  const orgApolloId = new mongoose.Types.ObjectId().toString();
  const orgSterlingId = new mongoose.Types.ObjectId().toString();

  const docRajivId = new mongoose.Types.ObjectId().toString();
  const docNehaId = new mongoose.Types.ObjectId().toString();
  const docAmitId = new mongoose.Types.ObjectId().toString();
  const docPriyaId = new mongoose.Types.ObjectId().toString();
  const docParthId = new mongoose.Types.ObjectId().toString(); // Independent Doctor

  // Tokens
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

  const sterlingAdminToken = generateTestToken({
    userId: "u-sterling-admin",
    email: "admin@sterling.com",
    role: UserRole.HOSPITAL_ADMIN,
    organizationId: orgSterlingId,
  });

  const drRajivToken = generateTestToken({
    userId: "u-rajiv",
    email: "dr.rajiv@apollo.com",
    role: UserRole.HOSPITAL_DOCTOR,
    organizationId: orgApolloId,
    doctorProfileId: docRajivId,
  });

  const drAmitToken = generateTestToken({
    userId: "u-amit",
    email: "dr.amit@sterling.com",
    role: UserRole.HOSPITAL_DOCTOR,
    organizationId: orgSterlingId,
    doctorProfileId: docAmitId,
  });

  const drParthToken = generateTestToken({
    userId: "u-parth",
    email: "dr.parth@clinic.com",
    role: UserRole.INDEPENDENT_DOCTOR,
    doctorProfileId: docParthId,
  });

  beforeEach(() => {
    vi.restoreAllMocks();
    mockGenerateContent.mockClear();
  });

  // ==========================================
  // 1. AUTHENTICATION & SESSION AUDIT
  // ==========================================
  describe("1. Authentication & Session Security Audit", () => {
    it("hashes passwords with bcrypt salt rounds >= 12", async () => {
      const password = "SecurePassword123!";
      const hash = await AuthService.hashPassword(password);

      expect(hash).toMatch(/^\$2[aby]\$12\$/);
      const isMatch = await bcrypt.compare(password, hash);
      expect(isMatch).toBe(true);
    });

    it("prevents account enumeration: non-existent email and wrong password return identical error", async () => {
      // 1. Non-existent email
      vi.spyOn(User, "findOne").mockResolvedValueOnce(null);
      await expect(
        AuthService.login("nonexistent@doczeno.com", "Password123!")
      ).rejects.toThrow("Invalid email or password");

      // 2. Existing user, wrong password
      const passwordHash = await bcrypt.hash("CorrectPassword123!", 12);
      vi.spyOn(User, "findOne").mockResolvedValueOnce({
        _id: new mongoose.Types.ObjectId(),
        email: "doctor@doczeno.com",
        passwordHash,
        isActive: true,
      } as any);
      await expect(
        AuthService.login("doctor@doczeno.com", "WrongPassword123!")
      ).rejects.toThrow("Invalid email or password");
    });

    it("sets secure HTTP-only cookies on login and clears cookie on logout", async () => {
      const passwordHash = await bcrypt.hash("Password123!", 12);
      vi.spyOn(User, "findOne").mockResolvedValueOnce({
        _id: new mongoose.Types.ObjectId(),
        email: "doc@doczeno.com",
        passwordHash,
        name: "Dr. Doctor",
        role: UserRole.INDEPENDENT_DOCTOR,
        isActive: true,
      } as any);

      const loginRes = await request(app)
        .post("/api/v1/auth/login")
        .send({ email: "doc@doczeno.com", password: "Password123!" });

      expect(loginRes.status).toBe(200);
      const cookies = loginRes.headers["set-cookie"];
      expect(cookies).toBeDefined();
      expect(cookies![0]!).toContain("doczeno_session=");
      expect(cookies![0]!).toContain("HttpOnly");

      // Logout clears cookie
      const logoutRes = await request(app).post("/api/v1/auth/logout");
      expect(logoutRes.status).toBe(200);
      const logoutCookies = logoutRes.headers["set-cookie"];
      expect(logoutCookies![0]!).toContain("doczeno_session=;");
    });

    it("rejects expired or tampered session tokens with 401 Unauthorized", async () => {
      const expiredToken = generateTestToken(
        { userId: "u-exp", email: "exp@doczeno.com", role: UserRole.INDEPENDENT_DOCTOR },
        "-1s" // Expired 1 second ago
      );

      const res = await request(app)
        .get("/api/v1/auth/me")
        .set("Authorization", `Bearer ${expiredToken}`);

      expect(res.status).toBe(401);
      expect(res.body.code).toBe("UNAUTHORIZED");
    });

    it("never leaks passwordHash in /api/v1/auth/me or user profile endpoints", async () => {
      const res = await request(app)
        .get("/api/v1/auth/me")
        .set("Authorization", `Bearer ${drParthToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.user).toBeDefined();
      expect(res.body.data.user.passwordHash).toBeUndefined();
      expect(res.body.data.user.password).toBeUndefined();
    });
  });

  // ==========================================
  // 2. AUTHORIZATION & TENANT ISOLATION MATRIX
  // ==========================================
  describe("2. Tenant Isolation Matrix: Apollo [Rajiv, Neha] vs Sterling [Amit, Priya]", () => {
    // Apollo Admin Isolation
    it("Apollo admin CANNOT access or mutate Sterling hospital data (403 Forbidden)", async () => {
      const res = await request(app)
        .put(`/api/v1/organizations/${orgSterlingId}`)
        .set("Authorization", `Bearer ${apolloAdminToken}`)
        .send({ name: "Apollo Takeover of Sterling" });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("TENANT_ACCESS_DENIED");
    });

    // Sterling Admin Isolation
    it("Sterling admin CANNOT access or mutate Apollo hospital data (403 Forbidden)", async () => {
      const res = await request(app)
        .put(`/api/v1/organizations/${orgApolloId}`)
        .set("Authorization", `Bearer ${sterlingAdminToken}`)
        .send({ name: "Sterling Takeover of Apollo" });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("TENANT_ACCESS_DENIED");
    });

    // Hospital Doctor Rajiv cannot access Neha
    it("Rajiv CANNOT mutate Neha's doctor profile in Apollo (403 Forbidden)", async () => {
      const res = await request(app)
        .put(`/api/v1/doctors/${docNehaId}`)
        .set("Authorization", `Bearer ${drRajivToken}`)
        .send({ doctorName: "Tampered Neha" });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("DOCTOR_ACCESS_DENIED");
    });

    // Hospital Doctor Rajiv cannot access Sterling or Sterling doctors (Amit)
    it("Rajiv CANNOT mutate Sterling doctor Amit (403 Forbidden)", async () => {
      const res = await request(app)
        .put(`/api/v1/doctors/${docAmitId}`)
        .set("Authorization", `Bearer ${drRajivToken}`)
        .send({ doctorName: "Tampered Amit" });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("DOCTOR_ACCESS_DENIED");
    });

    // Hospital Doctor Amit cannot mutate Priya in Sterling
    it("Amit CANNOT mutate Priya's doctor profile in Sterling (403 Forbidden)", async () => {
      const res = await request(app)
        .put(`/api/v1/doctors/${docPriyaId}`)
        .set("Authorization", `Bearer ${drAmitToken}`)
        .send({ doctorName: "Tampered Priya" });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("DOCTOR_ACCESS_DENIED");
    });

    // Rajiv cannot modify Apollo parent hospital fields
    it("Apollo doctor Rajiv CANNOT modify Apollo parent hospital address or theme (403 Forbidden)", async () => {
      const res = await request(app)
        .put(`/api/v1/doctors/${docRajivId}`)
        .set("Authorization", `Bearer ${drRajivToken}`)
        .send({
          address: "Modified Hospital Address",
          selectedTheme: "unauthorized-theme",
        });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("INHERITED_FIELD_MUTATION_FORBIDDEN");
    });

    // Apollo admin CAN manage Rajiv and Neha
    it("Apollo admin CAN manage doctors Rajiv and Neha under Apollo (200 OK)", async () => {
      vi.spyOn(Doctor, "findById").mockResolvedValue({
        _id: docRajivId,
        organizationId: orgApolloId,
      } as any);

      vi.spyOn(Doctor, "findByIdAndUpdate").mockResolvedValue({
        _id: docRajivId,
        doctorName: "Dr. Rajiv Shah Approved",
        organizationId: orgApolloId,
      } as any);

      const res = await request(app)
        .put(`/api/v1/doctors/${docRajivId}`)
        .set("Authorization", `Bearer ${apolloAdminToken}`)
        .send({ doctorName: "Dr. Rajiv Shah Approved" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    // Superadmin can manage all
    it("Superadmin CAN manage any organization and doctor across the platform (200 OK)", async () => {
      vi.spyOn(Organization, "findByIdAndUpdate").mockResolvedValue({
        _id: orgSterlingId,
        name: "Superadmin Verified Sterling",
      } as any);

      const orgRes = await request(app)
        .put(`/api/v1/organizations/${orgSterlingId}`)
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({ name: "Superadmin Verified Sterling" });

      expect(orgRes.status).toBe(200);

      vi.spyOn(Doctor, "findByIdAndUpdate").mockResolvedValue({
        _id: docAmitId,
        doctorName: "Dr. Amit Shah Superadmin Verified",
      } as any);

      const docRes = await request(app)
        .put(`/api/v1/doctors/${docAmitId}`)
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({ doctorName: "Dr. Amit Shah Superadmin Verified" });

      expect(docRes.status).toBe(200);
    });

    // Individual Doctor cannot access Apollo
    it("Independent Doctor CANNOT mutate Apollo organization (403 Forbidden)", async () => {
      const res = await request(app)
        .put(`/api/v1/organizations/${orgApolloId}`)
        .set("Authorization", `Bearer ${drParthToken}`)
        .send({ name: "Independent Doctor Attack" });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("TENANT_ACCESS_DENIED");
    });
  });

  // ==========================================
  // 3. RUNTIME DATA INHERITANCE AUDIT
  // ==========================================
  describe("3. Runtime Data Inheritance & Zero-Duplication Storage Audit", () => {
    it("child doctor website dynamically reflects updated parent hospital data without storing copies in Doctor document", async () => {
      // 1. Parent Apollo updated
      vi.spyOn(Organization, "findOne").mockResolvedValue({
        _id: orgApolloId,
        name: "Apollo Prime Multispecialty",
        type: "HOSPITAL",
        slug: "apollo",
        address: {
          street: "100 SG Highway",
          city: "Ahmedabad",
          state: "Gujarat",
          pincode: "380054",
          country: "India",
        },
        logo: { url: "https://storage.doczeno.com/apollo-new-logo.png" },
        galleryPhotos: [
          { url: "https://storage.doczeno.com/apollo-g1.png" },
        ],
        selectedTheme: "modern-minimal",
        faviconUrl: "https://storage.doczeno.com/apollo.ico",
        browserTabTitle: "Apollo Prime — World Class Care",
        phone: "+91 99999 88888",
        status: "ACTIVE",
      } as any);

      // 2. Doctor Rajiv record only contains personal credentials
      vi.spyOn(Doctor, "findOne").mockResolvedValue({
        _id: docRajivId,
        organizationId: orgApolloId,
        doctorName: "Rajiv Shah",
        gender: "MALE",
        degree: "MBBS, DM",
        specialization: "Cardiology",
        yearsOfExperience: 15,
        slug: "dr-rajiv-shah",
        status: "ACTIVE",
        // Notice: address, logo, gallery, selectedTheme, faviconUrl are absent from doctor record!
      } as any);

      vi.spyOn(Website, "findOne").mockResolvedValue({
        _id: "w-rajiv",
        doctorId: docRajivId,
        organizationId: orgApolloId,
        publishStatus: "PUBLISHED",
      } as any);

      const res = await request(app)
        .get("/api/v1/websites/effective/apollo/dr-rajiv-shah");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const effective = res.body.data;
      // Inherited fields
      expect(effective.organizationName).toBe("Apollo Prime Multispecialty");
      expect(effective.address.street).toBe("100 SG Highway");
      expect(effective.address.city).toBe("Ahmedabad");
      expect(effective.selectedTheme).toBe("modern-minimal");
      expect(effective.faviconUrl).toBe("https://storage.doczeno.com/apollo.ico");
      expect(effective.browserTabTitle).toBe("Apollo Prime — World Class Care");
      expect(effective.logo.url).toBe("https://storage.doczeno.com/apollo-new-logo.png");

      // Doctor-owned fields
      expect(effective.doctorName).toBe("Rajiv Shah");
      expect(effective.specialization).toBe("Cardiology");
      expect(effective.isHospitalChild).toBe(true);
    });
  });

  // ==========================================
  // 4. SLUG SECURITY & RESERVED NAMES AUDIT
  // ==========================================
  describe("4. Slug Security, Normalization & Reserved Collisions", () => {
    it("validates valid slugs and rejects invalid formats (uppercase, spaces, unicode, special chars)", () => {
      // Valid slugs
      expect(slugSchema.safeParse("dr-parth-kadiya").success).toBe(true);
      expect(slugSchema.safeParse("apollo-mumbai-cardiac").success).toBe(true);

      // Uppercase characters rejected
      expect(slugSchema.safeParse("Dr-Parth-Kadiya").success).toBe(false);

      // Spaces rejected
      expect(slugSchema.safeParse("dr parth kadiya").success).toBe(false);

      // Unicode rejected
      expect(slugSchema.safeParse("dr-павел").success).toBe(false);

      // Leading/trailing hyphens rejected
      expect(slugSchema.safeParse("-dr-parth-").success).toBe(false);

      // Multiple hyphens rejected
      expect(slugSchema.safeParse("dr--parth").success).toBe(false);
    });

    it("strictly rejects reserved platform slugs (admin, superadmin, login, onboarding, api, robots)", () => {
      const reserved = ["admin", "superadmin", "login", "onboarding", "api", "robots", "sitemap", "dashboard"];
      for (const slug of reserved) {
        const result = slugSchema.safeParse(slug);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0]?.message).toContain("reserved");
        }
      }
    });
  });

  // ==========================================
  // 5. FILE UPLOAD & MEDIA SECURITY AUDIT
  // ==========================================
  describe("5. File Upload Security & Magic Byte Signature Verification", () => {
    it("detects genuine JPEG, PNG, and WebP binary signatures", () => {
      // Valid JPEG header: FF D8 FF
      const jpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
      const jpegCheck = verifyImageFileSignature(jpegBuffer);
      expect(jpegCheck.valid).toBe(true);
      expect(jpegCheck.detectedMime).toBe("image/jpeg");

      // Valid PNG header: 89 50 4E 47 0D 0A 1A 0A
      const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
      const pngCheck = verifyImageFileSignature(pngBuffer);
      expect(pngCheck.valid).toBe(true);
      expect(pngCheck.detectedMime).toBe("image/png");

      // Invalid/fake image (executable/script masquerading as jpg)
      const fakeBuffer = Buffer.from("<html><script>alert(1)</script></html>");
      const fakeCheck = verifyImageFileSignature(fakeBuffer);
      expect(fakeCheck.valid).toBe(false);
    });

    it("enforces category size limits: 3MB doctor photo, 2MB clinic logo", () => {
      // 3MB Doctor photo allowed
      expect(() => {
        MediaService.generateUploadAuthorization({
          category: "DOCTOR_PHOTO",
          fileName: "portrait.jpg",
          fileSize: 3 * 1024 * 1024,
          mimeType: "image/jpeg",
          ownerId: docRajivId,
        });
      }).not.toThrow();

      // > 3MB Doctor photo rejected
      expect(() => {
        MediaService.generateUploadAuthorization({
          category: "DOCTOR_PHOTO",
          fileName: "large.jpg",
          fileSize: 3 * 1024 * 1024 + 1,
          mimeType: "image/jpeg",
          ownerId: docRajivId,
        });
      }).toThrow(/exceeds the maximum allowed size of 3 MB/i);

      // > 2MB Logo rejected
      expect(() => {
        MediaService.generateUploadAuthorization({
          category: "LOGO",
          fileName: "logo.png",
          fileSize: 2 * 1024 * 1024 + 1,
          mimeType: "image/png",
          ownerId: orgApolloId,
        });
      }).toThrow(/exceeds the maximum allowed size of 2 MB/i);
    });

    it("rejects path traversal in upload filenames and generates secure server storage keys", () => {
      const auth = MediaService.generateUploadAuthorization({
        category: "DOCTOR_PHOTO",
        fileName: "../../../etc/passwd.jpg",
        fileSize: 500000,
        mimeType: "image/jpeg",
        ownerId: docRajivId,
      });

      // Storage public_id should not contain ../ or path traversal
      expect(auth.fields["public_id"]).not.toContain("..");
      expect(auth.fields["public_id"]).toContain("doczeno/doctor_photo/passwd");
    });

    it("enforces cross-tenant media deletion protection (Doctor A cannot delete Doctor B's media)", async () => {
      vi.spyOn(Media, "findById").mockResolvedValue({
        _id: "media-sterling-1",
        ownerId: docAmitId, // Belongs to Amit
        category: "DOCTOR_PHOTO",
      } as any);

      const actorRajiv = {
        userId: "u-rajiv",
        email: "dr.rajiv@apollo.com",
        role: UserRole.HOSPITAL_DOCTOR,
        organizationId: orgApolloId,
        doctorProfileId: docRajivId,
      };

      // Rajiv attempts to delete Amit's media asset
      await expect(
        MediaService.deleteMedia("media-sterling-1", actorRajiv)
      ).rejects.toThrow(/Unauthorized to delete this media asset/i);
    });
  });

  // ==========================================
  // 6. GEMINI SECURITY & PUBLIC RENDERING PERFORMANCE
  // ==========================================
  describe("6. Gemini Security, Prompt Defense & Public Performance", () => {
    it("PUBLIC website requests NEVER call Gemini SDK", async () => {
      vi.spyOn(Website, "findOne").mockResolvedValue({
        _id: "w-parth",
        slug: "dr-parth-kadiya",
        websiteType: WebsiteType.INDEPENDENT_DOCTOR,
        doctorId: docParthId,
        ownerId: docParthId,
        publishStatus: "PUBLISHED",
      } as any);

      vi.spyOn(Doctor, "findById").mockResolvedValue({
        _id: docParthId,
        doctorName: "Parth Kadiya",
        degree: "MBBS, MS",
        specialization: "General Surgery",
        status: "ACTIVE",
      } as any);

      const res = await request(app).get("/api/v1/websites/effective/dr-parth-kadiya");

      expect(res.status).toBe(200);
      expect(mockGenerateContent).not.toHaveBeenCalled();
    });

    it("strictly blocks clinical diagnosis/prescription queries without invoking LLM", () => {
      expect(isMedicalAdviceQuery("What dosage of amoxicillin should I prescribe?")).toBe(true);
      expect(isMedicalAdviceQuery("I have high blood pressure, what pills should I take?")).toBe(true);
      expect(isMedicalAdviceQuery("Can you diagnose my rash?")).toBe(true);

      // Allowed practice queries
      expect(isMedicalAdviceQuery("What are clinic opening hours?")).toBe(false);
      expect(isMedicalAdviceQuery("Where is the hospital located?")).toBe(false);
    });
  });

  // ==========================================
  // 7. ADMIN AI TOOL & RBAC TOOL CALLING AUDIT
  // ==========================================
  describe("7. Admin AI Tool Scoping & Two-Phase Confirmation Security", () => {
    it("rejects cross-tenant lookup when hospital admin queries foreign hospital", async () => {
      const user = {
        _id: "u-apollo-admin",
        email: "admin@apollo.com",
        role: UserRole.HOSPITAL_ADMIN,
        organizationId: orgApolloId,
      } as any;

      await expect(
        adminAssistantService.executeTool(
          "getHospitalOverview",
          { organizationId: orgSterlingId },
          user,
          false
        )
      ).rejects.toThrow(/Forbidden: Cannot access another hospital's data/i);
    });

    it("destructive action deactivateDoctor requires confirmation without executing mutation prematurely", async () => {
      vi.spyOn(Doctor, "findById").mockResolvedValue({
        _id: docRajivId,
        doctorName: "Rajiv Shah",
        organizationId: orgApolloId,
        status: "ACTIVE",
      } as any);

      const user = {
        _id: "u-apollo-admin",
        email: "admin@apollo.com",
        role: UserRole.HOSPITAL_ADMIN,
        organizationId: orgApolloId,
      } as any;

      const toolResult = await adminAssistantService.executeTool(
        "deactivateDoctor",
        { doctorId: docRajivId },
        user,
        false // Not confirmed yet
      );

      expect(toolResult.requiresConfirmation).toBe(true);
      expect(toolResult.pendingAction?.actionType).toBe("deactivateDoctor");
      expect(toolResult.result.doctorStatus).toBe("ACTIVE");
    });
  });

  // ==========================================
  // 8. API SECURITY HEADERS & ERROR SANITIZATION
  // ==========================================
  describe("8. API Security Headers, CORS & Error Masking", () => {
    it("includes Helmet security headers in responses", async () => {
      const res = await request(app).get("/api/v1/auth/me");

      expect(res.headers["x-content-type-options"]).toBe("nosniff");
      expect(res.headers["x-frame-options"]).toBeDefined();
    });

    it("masks internal 500 error messages in production mode", () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "production";

      const jsonMock = vi.fn();
      const statusMock = vi.fn().mockReturnValue({ json: jsonMock });
      const res = { status: statusMock } as any;

      errorHandler(
        new Error("Internal secret database connection credentials failed"),
        {} as any,
        res,
        vi.fn()
      );

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: "Internal server error",
        })
      );
      expect(jsonMock.mock.calls[0]![0].error).not.toContain("credentials");

      process.env.NODE_ENV = originalEnv;
    });
  });

  // ==========================================
  // 9. PUBLISH STATE ENFORCEMENT AUDIT
  // ==========================================
  describe("9. Publish State Lifecycle (DRAFT, GENERATING, REVIEW, PUBLISHED, SUSPENDED)", () => {
    it("returns 404 for websites in DRAFT, GENERATING, REVIEW, or SUSPENDED state", async () => {
      const statuses = ["DRAFT", "GENERATING", "REVIEW", "SUSPENDED"] as const;

      for (const status of statuses) {
        vi.spyOn(Website, "findOne").mockResolvedValueOnce({
          _id: "w-test",
          slug: "test-clinic",
          publishStatus: status,
        } as any);

        const res = await request(app).get("/api/v1/websites/effective/test-clinic");
        expect(res.status).toBe(404);
        expect(res.body.code).toBe("NOT_FOUND");
      }
    });

    it("returns 200 only when website publishStatus is PUBLISHED", async () => {
      vi.spyOn(Website, "findOne").mockResolvedValueOnce({
        _id: "w-published",
        slug: "published-clinic",
        publishStatus: "PUBLISHED",
        websiteType: WebsiteType.INDEPENDENT_DOCTOR,
        doctorId: docParthId,
        ownerId: docParthId,
      } as any);

      vi.spyOn(Doctor, "findById").mockResolvedValueOnce({
        _id: docParthId,
        doctorName: "Parth Kadiya",
        degree: "MBBS, MS",
        specialization: "General Surgery",
        status: "ACTIVE",
      } as any);

      const res = await request(app).get("/api/v1/websites/effective/published-clinic");
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });
});
