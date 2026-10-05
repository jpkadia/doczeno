/**
 * Healthcare media storage rules & limits
 */

export const ALLOWED_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type AllowedImageMimeType = (typeof ALLOWED_IMAGE_MIME_TYPES)[number];

export const IMAGE_RULES = {
  INDEPENDENT_DOCTOR: {
    doctorPhoto: {
      maxSizeBytes: 3 * 1024 * 1024, // 3 MB
      allowedMimeTypes: ALLOWED_IMAGE_MIME_TYPES,
      maxFiles: 1,
    },
    clinicLogo: {
      maxSizeBytes: 2 * 1024 * 1024, // 2 MB
      allowedMimeTypes: ALLOWED_IMAGE_MIME_TYPES,
      maxFiles: 1,
    },
    clinicGallery: {
      maxSizeBytesPerImage: 3 * 1024 * 1024, // 3 MB per image
      maxFiles: 6,
      allowedMimeTypes: ALLOWED_IMAGE_MIME_TYPES,
    },
  },
  HOSPITAL_CLINIC: {
    hospitalLogo: {
      maxSizeBytes: 2 * 1024 * 1024, // 2 MB
      allowedMimeTypes: ALLOWED_IMAGE_MIME_TYPES,
      maxFiles: 1,
    },
    hospitalGallery: {
      maxSizeBytesPerImage: 3 * 1024 * 1024, // 3 MB per image
      maxFiles: 6,
      allowedMimeTypes: ALLOWED_IMAGE_MIME_TYPES,
    },
  },
  HOSPITAL_DOCTOR: {
    doctorPhoto: {
      maxSizeBytes: 3 * 1024 * 1024, // 3 MB
      allowedMimeTypes: ALLOWED_IMAGE_MIME_TYPES,
      maxFiles: 1,
    },
  },
} as const;

export function validateImageFile(
  file: { size: number; type: string; name?: string },
  rule: { maxSizeBytes: number; allowedMimeTypes: readonly string[] }
): { valid: boolean; error?: string } {
  if (!rule.allowedMimeTypes.includes(file.type)) {
    return {
      valid: false,
      error: `Unsupported image format (${file.type}). Allowed: .jpeg, .jpg, .png, .webp`,
    };
  }

  if (file.size > rule.maxSizeBytes) {
    const maxMb = (rule.maxSizeBytes / (1024 * 1024)).toFixed(0);
    return {
      valid: false,
      error: `File size exceeds the limit of ${maxMb} MB`,
    };
  }

  return { valid: true };
}
