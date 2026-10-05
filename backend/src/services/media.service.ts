import crypto from "crypto";
import path from "path";
import { Media, IMedia } from "@/models";
import { getEnv } from "@/config/env";
import { MediaAsset, AuthUserPayload } from "@/types";
import { v2 as cloudinary } from "cloudinary";

export type MediaCategory = "DOCTOR_PHOTO" | "CLINIC_LOGO" | "LOGO" | "GALLERY" | "DOCUMENT";

export const CATEGORY_LIMITS: Record<MediaCategory, { maxSizeBytes: number; allowedMimes: string[] }> = {
  DOCTOR_PHOTO: {
    maxSizeBytes: 3 * 1024 * 1024, // 3 MB
    allowedMimes: ["image/jpeg", "image/png", "image/webp"],
  },
  CLINIC_LOGO: {
    maxSizeBytes: 2 * 1024 * 1024, // 2 MB
    allowedMimes: ["image/jpeg", "image/png", "image/webp"],
  },
  LOGO: {
    maxSizeBytes: 2 * 1024 * 1024, // 2 MB
    allowedMimes: ["image/jpeg", "image/png", "image/webp"],
  },
  GALLERY: {
    maxSizeBytes: 3 * 1024 * 1024, // 3 MB
    allowedMimes: ["image/jpeg", "image/png", "image/webp"],
  },
  DOCUMENT: {
    maxSizeBytes: 5 * 1024 * 1024, // 5 MB
    allowedMimes: ["application/pdf", "image/jpeg", "image/png"],
  },
};

/**
 * Validates actual binary magic bytes / file signatures to prevent extension spoofing
 */
export function verifyImageFileSignature(buffer: Buffer): { valid: boolean; detectedMime?: string } {
  if (buffer.length < 12) {
    return { valid: false };
  }

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { valid: true, detectedMime: "image/jpeg" };
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return { valid: true, detectedMime: "image/png" };
  }

  // WebP: RIFF (52 49 46 46) ... WEBP (57 45 42 50)
  if (
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return { valid: true, detectedMime: "image/webp" };
  }

  return { valid: false };
}

let cloudinaryConfigured = false;
function ensureStorageConfig(): void {
  if (cloudinaryConfigured) return;
  const env = getEnv();

  if (env.CLOUDINARY_URL) {
    cloudinary.config({ cloudinary_url: env.CLOUDINARY_URL });
    cloudinaryConfigured = true;
  } else if (env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET) {
    cloudinary.config({
      cloud_name: env.CLOUDINARY_CLOUD_NAME,
      api_key: env.CLOUDINARY_API_KEY,
      api_secret: env.CLOUDINARY_API_SECRET,
      secure: true,
    });
    cloudinaryConfigured = true;
  }
}

export class MediaService {
  /**
   * Generates secure upload authorization for presigned direct upload flow
   */
  static generateUploadAuthorization(params: {
    category: MediaCategory;
    fileName: string;
    fileSize: number;
    mimeType: string;
    ownerId: string;
  }): {
    uploadToken: string;
    uploadUrl: string;
    fields: Record<string, string>;
    targetCategory: MediaCategory;
    expiresAt: number;
    maxSizeBytes: number;
  } {
    const limits = CATEGORY_LIMITS[params.category];
    if (!limits) {
      throw new Error(`Invalid media category: ${params.category}`);
    }
    if (!limits.allowedMimes.includes(params.mimeType)) {
      throw new Error(`Disallowed image format: Unsupported MIME type: ${params.mimeType}`);
    }
    if (params.fileSize > limits.maxSizeBytes) {
      const maxMb = (limits.maxSizeBytes / (1024 * 1024)).toFixed(0);
      throw new Error(`File size ${params.fileSize} bytes exceeds the maximum allowed size of ${maxMb} MB`);
    }

    const expiresAt = Date.now() + 15 * 60 * 1000; // 15 mins
    const secret = getEnv().AUTH_SECRET;
    const dataToSign = `${params.ownerId}:${params.category}:${params.fileName}:${expiresAt}`;
    const signature = crypto.createHmac("sha256", secret).update(dataToSign).digest("hex");
    const uploadToken = Buffer.from(JSON.stringify({ signature, expiresAt, ...params })).toString("base64");
    const cloudName = getEnv().CLOUDINARY_CLOUD_NAME || "doczeno";
    const uploadUrl = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;

    return {
      uploadToken,
      uploadUrl,
      fields: {
        "X-Upload-Token": uploadToken,
        public_id: `doczeno/${params.category.toLowerCase()}/${path.basename(params.fileName, path.extname(params.fileName))}`,
      },
      targetCategory: params.category,
      expiresAt,
      maxSizeBytes: limits.maxSizeBytes,
    };
  }

  /**
   * Processes buffer upload with binary signature verification and storage upload
   */
  static async uploadMediaBuffer(params: {
    buffer: Buffer;
    originalName: string;
    category: MediaCategory;
    ownerId: string;
    ownerType: "DOCTOR" | "ORGANIZATION";
    altText?: string;
  }): Promise<MediaAsset> {
    const limits = CATEGORY_LIMITS[params.category];

    // Check size limit
    if (params.buffer.length > limits.maxSizeBytes) {
      const maxMb = (limits.maxSizeBytes / (1024 * 1024)).toFixed(0);
      throw new Error(`File exceeds the maximum allowed size of ${maxMb} MB`);
    }

    // Binary file signature check (prevent extension spoofing)
    const signatureResult = verifyImageFileSignature(params.buffer);
    if (!signatureResult.valid || !signatureResult.detectedMime) {
      throw new Error("Invalid image file signature. Only real JPEG, PNG, and WebP files are accepted.");
    }

    const detectedMime = signatureResult.detectedMime;

    if (!limits.allowedMimes.includes(detectedMime)) {
      throw new Error(`Disallowed image format (${detectedMime})`);
    }

    // Gallery count limit verification
    if (params.category === "GALLERY") {
      const existingCount = await Media.countDocuments({
        ownerId: params.ownerId,
        category: "GALLERY",
      });
      if (existingCount >= 6) {
        throw new Error("Maximum of 6 gallery photos reached for this entity");
      }
    }

    // Normalize filename
    const ext = path.extname(params.originalName) || `.${detectedMime.split("/")[1]}`;
    const safeBase = path.basename(params.originalName, ext).replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 40);
    const uniqueId = crypto.randomBytes(6).toString("hex");
    const safePublicId = `doczeno/${params.category.toLowerCase()}/${safeBase}_${uniqueId}`;

    ensureStorageConfig();

    // Upload buffer to Cloudinary/Storage
    const uploadResult = await new Promise<{
      secure_url: string;
      public_id: string;
      bytes: number;
      width?: number;
      height?: number;
    }>((resolve, reject) => {
      // In test environment, mock storage response
      if (process.env.NODE_ENV === "test") {
        return resolve({
          secure_url: `https://res.cloudinary.com/doczeno/image/upload/${safePublicId}${ext}`,
          public_id: safePublicId,
          bytes: params.buffer.length,
          width: 800,
          height: 600,
        });
      }

      const stream = cloudinary.uploader.upload_stream(
        {
          public_id: safePublicId,
          resource_type: "image",
          format: detectedMime.split("/")[1],
        },
        (error, result) => {
          if (error || !result) {
            return reject(error || new Error("Storage upload failed"));
          }
          resolve(result);
        }
      );
      stream.end(params.buffer);
    });

    // Register in MongoDB Media collection
    await Media.create({
      ownerId: params.ownerId,
      ownerType: params.ownerType,
      fileUrl: uploadResult.secure_url,
      publicId: uploadResult.public_id,
      fileName: `${safeBase}${ext}`,
      mimeType: detectedMime,
      sizeBytes: uploadResult.bytes,
      category: params.category,
    });

    return {
      url: uploadResult.secure_url,
      publicId: uploadResult.public_id,
      sizeBytes: uploadResult.bytes,
      mimeType: detectedMime,
      width: uploadResult.width,
      height: uploadResult.height,
      altText: params.altText,
    };
  }

  static async listOwnerMedia(ownerId: string): Promise<IMedia[]> {
    return Media.find({ ownerId }).sort({ createdAt: -1 });
  }

  static async deleteMedia(mediaId: string, actor: AuthUserPayload): Promise<boolean> {
    const record = await Media.findById(mediaId);
    if (!record) return false;

    // Check ownership
    if (
      actor.role !== "SUPERADMIN" &&
      record.ownerId.toString() !== actor.organizationId &&
      record.ownerId.toString() !== actor.doctorProfileId &&
      record.ownerId.toString() !== actor.userId
    ) {
      throw new Error("Unauthorized to delete this media asset");
    }

    if (process.env.NODE_ENV !== "test" && record.publicId) {
      ensureStorageConfig();
      try {
        await cloudinary.uploader.destroy(record.publicId);
      } catch {
        // Continue DB deletion even if remote storage destroy warns
      }
    }

    await Media.findByIdAndDelete(mediaId);
    return true;
  }
}
