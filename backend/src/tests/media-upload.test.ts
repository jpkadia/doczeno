import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { createApp } from "@/app";
import {
  MediaService,
  verifyImageFileSignature,
} from "@/services/media.service";
import { Media } from "@/models";
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

describe("Media Upload & Binary Security Verification", () => {
  const app = createApp();

  // Standard valid binary signatures
  const validJpegBuffer = Buffer.concat([
    Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]),
    Buffer.alloc(100),
  ]);

  const validPngBuffer = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    Buffer.alloc(100),
  ]);

  const validWebpBuffer = Buffer.concat([
    Buffer.from("RIFF"),
    Buffer.from([0x24, 0x00, 0x00, 0x00]), // File size
    Buffer.from("WEBP"),
    Buffer.from("VP8 "),
    Buffer.alloc(100),
  ]);

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("Binary Magic Bytes Signature Verification", () => {
    it("identifies valid JPEG file header (FF D8 FF)", () => {
      const result = verifyImageFileSignature(validJpegBuffer);
      expect(result.valid).toBe(true);
      expect(result.detectedMime).toBe("image/jpeg");
    });

    it("identifies valid PNG file header (89 50 4E 47 0D 0A 1A 0A)", () => {
      const result = verifyImageFileSignature(validPngBuffer);
      expect(result.valid).toBe(true);
      expect(result.detectedMime).toBe("image/png");
    });

    it("identifies valid WebP file header (RIFF....WEBP)", () => {
      const result = verifyImageFileSignature(validWebpBuffer);
      expect(result.valid).toBe(true);
      expect(result.detectedMime).toBe("image/webp");
    });

    it("rejects spoofed text file disguised with .png or .jpg extension", () => {
      const spoofedTextBuffer = Buffer.from("<script>alert('malicious')</script>");
      const result = verifyImageFileSignature(spoofedTextBuffer);
      expect(result.valid).toBe(false);
      expect(result.detectedMime).toBeUndefined();
    });

    it("rejects Windows PE executable disguised as image", () => {
      const executableBuffer = Buffer.from("MZ\x90\x00\x03\x00\x00\x00\x04\x00\x00\x00");
      const result = verifyImageFileSignature(executableBuffer);
      expect(result.valid).toBe(false);
      expect(result.detectedMime).toBeUndefined();
    });

    it("rejects zero-length buffer", () => {
      const result = verifyImageFileSignature(Buffer.alloc(0));
      expect(result.valid).toBe(false);
    });
  });

  describe("File Size & Category Limit Enforcement", () => {
    it("rejects DOCTOR_PHOTO exceeding 3 MB limit", async () => {
      // 3.5 MB buffer
      const oversizedBuffer = Buffer.concat([
        Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
        Buffer.alloc(3.5 * 1024 * 1024),
      ]);

      await expect(
        MediaService.uploadMediaBuffer({
          buffer: oversizedBuffer,
          originalName: "large-photo.jpg",
          category: "DOCTOR_PHOTO",
          ownerId: "doc-1",
          ownerType: "DOCTOR",
        })
      ).rejects.toThrow("File exceeds the maximum allowed size of 3 MB");
    });

    it("rejects LOGO exceeding 2 MB limit", async () => {
      // 2.2 MB buffer
      const oversizedLogo = Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        Buffer.alloc(2.2 * 1024 * 1024),
      ]);

      await expect(
        MediaService.uploadMediaBuffer({
          buffer: oversizedLogo,
          originalName: "huge-logo.png",
          category: "LOGO",
          ownerId: "org-1",
          ownerType: "ORGANIZATION",
        })
      ).rejects.toThrow("File exceeds the maximum allowed size of 2 MB");
    });

    it("rejects spoofed file upload even if filename ends in .jpg", async () => {
      const fakeImage = Buffer.from("<html><body>Dangerous payload</body></html>");

      await expect(
        MediaService.uploadMediaBuffer({
          buffer: fakeImage,
          originalName: "innocent.jpg",
          category: "DOCTOR_PHOTO",
          ownerId: "doc-1",
          ownerType: "DOCTOR",
        })
      ).rejects.toThrow("Invalid image file signature");
    });

    it("enforces maximum 6 gallery photos limit per entity", async () => {
      vi.spyOn(Media, "countDocuments").mockResolvedValue(6 as any);

      await expect(
        MediaService.uploadMediaBuffer({
          buffer: validJpegBuffer,
          originalName: "gallery7.jpg",
          category: "GALLERY",
          ownerId: "org-clinic-1",
          ownerType: "ORGANIZATION",
        })
      ).rejects.toThrow("Maximum of 6 gallery photos reached for this entity");
    });

    it("successfully processes and records valid image within limits", async () => {
      vi.spyOn(Media, "countDocuments").mockResolvedValue(2 as any);
      vi.spyOn(Media, "create").mockResolvedValue({
        _id: "media-created-1",
        ownerId: "doc-1",
        fileUrl: "https://res.cloudinary.com/doczeno/image/upload/doczeno/doctor_photo/sample.jpg",
      } as any);

      const result = await MediaService.uploadMediaBuffer({
        buffer: validJpegBuffer,
        originalName: "dr-avatar.jpg",
        category: "DOCTOR_PHOTO",
        ownerId: "doc-1",
        ownerType: "DOCTOR",
      });

      expect(result.url).toBeDefined();
      expect(result.mimeType).toBe("image/jpeg");
      expect(Media.create).toHaveBeenCalledWith(
        expect.objectContaining({
          category: "DOCTOR_PHOTO",
          ownerId: "doc-1",
          mimeType: "image/jpeg",
        })
      );
    });
  });

  describe("Upload Authorization Token Generation", () => {
    it("generates HMAC authorization data for client-side direct upload", () => {
      const auth = MediaService.generateUploadAuthorization({
        category: "GALLERY",
        fileName: "clinic-reception.webp",
        fileSize: 2 * 1024 * 1024,
        mimeType: "image/webp",
        ownerId: "org-apollo",
      });

      expect(auth.uploadUrl).toBeDefined();
      expect(auth.fields).toBeDefined();
      expect(auth.fields["X-Upload-Token"]).toBeDefined();
      expect(auth.fields.public_id).toContain("doczeno/gallery/");
    });

    it("rejects token generation if file size exceeds category maximum", () => {
      expect(() =>
        MediaService.generateUploadAuthorization({
          category: "LOGO",
          fileName: "logo.png",
          fileSize: 3 * 1024 * 1024, // 3MB for 2MB limit
          mimeType: "image/png",
          ownerId: "org-apollo",
        })
      ).toThrow("exceeds the maximum allowed size");
    });

    it("rejects token generation for disallowed MIME types (e.g. PDF or SVG)", () => {
      expect(() =>
        MediaService.generateUploadAuthorization({
          category: "DOCTOR_PHOTO",
          fileName: "resume.pdf",
          fileSize: 50000,
          mimeType: "application/pdf",
          ownerId: "doc-1",
        })
      ).toThrow("Disallowed image format");
    });
  });

  describe("Media Deletion & Cross-Tenant Protection", () => {
    it("allows owner to delete their own media asset", async () => {
      const mockMediaRecord = {
        _id: "media-1",
        ownerId: "org-apollo",
        publicId: "doczeno/gallery/photo1",
      };
      vi.spyOn(Media, "findById").mockResolvedValue(mockMediaRecord as any);
      vi.spyOn(Media, "findByIdAndDelete").mockResolvedValue(mockMediaRecord as any);

      const actor = {
        userId: "usr-admin-1",
        email: "admin@apollo.com",
        role: UserRole.HOSPITAL_ADMIN,
        organizationId: "org-apollo",
      };

      const deleted = await MediaService.deleteMedia("media-1", actor);
      expect(deleted).toBe(true);
      expect(Media.findByIdAndDelete).toHaveBeenCalledWith("media-1");
    });

    it("blocks cross-tenant deletion attempt from another hospital admin", async () => {
      const mockMediaRecord = {
        _id: "media-1",
        ownerId: "org-apollo", // Belongs to Apollo
        publicId: "doczeno/gallery/photo1",
      };
      vi.spyOn(Media, "findById").mockResolvedValue(mockMediaRecord as any);

      // Care Clinic admin tries to delete Apollo's photo
      const foreignActor = {
        userId: "usr-admin-2",
        email: "admin@careclinic.com",
        role: UserRole.HOSPITAL_ADMIN,
        organizationId: "org-care-clinic",
      };

      await expect(
        MediaService.deleteMedia("media-1", foreignActor)
      ).rejects.toThrow("Unauthorized to delete this media asset");
    });

    it("allows SUPERADMIN to delete media across tenants", async () => {
      const mockMediaRecord = {
        _id: "media-1",
        ownerId: "org-apollo",
        publicId: "doczeno/gallery/photo1",
      };
      vi.spyOn(Media, "findById").mockResolvedValue(mockMediaRecord as any);
      vi.spyOn(Media, "findByIdAndDelete").mockResolvedValue(mockMediaRecord as any);

      const superadminActor = {
        userId: "usr-super",
        email: "superadmin@doczeno.com",
        role: UserRole.SUPERADMIN,
      };

      const deleted = await MediaService.deleteMedia("media-1", superadminActor);
      expect(deleted).toBe(true);
    });
  });

  describe("Media API HTTP Endpoints (Supertest)", () => {
    it("allows unauthenticated onboarding visitors to upload valid image file via multipart form", async () => {
      vi.spyOn(Media, "countDocuments").mockResolvedValue(0 as any);
      vi.spyOn(Media, "create").mockResolvedValue({
        _id: "media-onboarding-1",
        ownerId: "onboarding-temp-123",
        fileUrl: "https://res.cloudinary.com/doczeno/image/upload/sample.jpg",
      } as any);

      const res = await request(app)
        .post("/api/v1/media/upload")
        .attach("file", validJpegBuffer, "test.jpg");

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.asset.url).toBeDefined();
    });

    it("allows authenticated user to upload valid image file via multipart form", async () => {
      vi.spyOn(Media, "countDocuments").mockResolvedValue(0 as any);
      vi.spyOn(Media, "create").mockResolvedValue({
        _id: "media-http-1",
        ownerId: "doc-user-1",
        fileUrl: "https://res.cloudinary.com/doczeno/image/upload/sample.jpg",
      } as any);

      const token = AuthService.generateToken({
        _id: "doc-user-1",
        email: "doctor@clinic.com",
        role: UserRole.INDEPENDENT_DOCTOR,
        doctorProfileId: "doc-user-1",
      } as any);

      const res = await request(app)
        .post("/api/v1/media/upload")
        .set("Authorization", `Bearer ${token}`)
        .field("category", "DOCTOR_PHOTO")
        .field("ownerType", "DOCTOR")
        .field("ownerId", "doc-user-1")
        .attach("file", validJpegBuffer, "doctor.jpg");

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.asset.mimeType).toBe("image/jpeg");
    });

    it("rejects upload if no file is provided in multipart body", async () => {
      const token = AuthService.generateToken({
        _id: "doc-user-1",
        email: "doctor@clinic.com",
        role: UserRole.INDEPENDENT_DOCTOR,
      } as any);

      const res = await request(app)
        .post("/api/v1/media/upload")
        .set("Authorization", `Bearer ${token}`)
        .field("category", "DOCTOR_PHOTO");

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("FILE_MISSING");
    });
  });
});
