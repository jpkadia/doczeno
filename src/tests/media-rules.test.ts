import { describe, it, expect } from "vitest";
import { IMAGE_RULES, validateImageFile } from "@/lib/storage/rules";

describe("Media Storage Rules & Limits", () => {
  describe("Doctor Photo Validation", () => {
    const photoRule = IMAGE_RULES.INDEPENDENT_DOCTOR.doctorPhoto;

    it("accepts valid JPEG within 3 MB", () => {
      const result = validateImageFile(
        { size: 2 * 1024 * 1024, type: "image/jpeg" },
        photoRule
      );
      expect(result.valid).toBe(true);
    });

    it("accepts valid WebP within 3 MB", () => {
      const result = validateImageFile(
        { size: 500 * 1024, type: "image/webp" },
        photoRule
      );
      expect(result.valid).toBe(true);
    });

    it("rejects photo exceeding 3 MB limit", () => {
      const result = validateImageFile(
        { size: 3.5 * 1024 * 1024, type: "image/jpeg" },
        photoRule
      );
      expect(result.valid).toBe(false);
      expect(result.error).toContain("exceeds the limit of 3 MB");
    });

    it("rejects unsupported file type (e.g. svg or gif)", () => {
      const result = validateImageFile(
        { size: 500 * 1024, type: "image/gif" },
        photoRule
      );
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Unsupported image format");
    });
  });

  describe("Clinic / Hospital Logo Validation", () => {
    const logoRule = IMAGE_RULES.HOSPITAL_CLINIC.hospitalLogo;

    it("accepts valid PNG within 2 MB", () => {
      const result = validateImageFile(
        { size: 1.5 * 1024 * 1024, type: "image/png" },
        logoRule
      );
      expect(result.valid).toBe(true);
    });

    it("rejects logo exceeding 2 MB limit", () => {
      const result = validateImageFile(
        { size: 2.1 * 1024 * 1024, type: "image/png" },
        logoRule
      );
      expect(result.valid).toBe(false);
      expect(result.error).toContain("exceeds the limit of 2 MB");
    });
  });

  describe("Gallery Count Validation", () => {
    it("enforces maximum 6 images for clinic gallery", () => {
      const galleryRule = IMAGE_RULES.HOSPITAL_CLINIC.hospitalGallery;
      expect(galleryRule.maxFiles).toBe(6);
      expect(galleryRule.maxSizeBytesPerImage).toBe(3 * 1024 * 1024);
    });
  });
});
