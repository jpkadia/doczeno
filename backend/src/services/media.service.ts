import crypto from "crypto";
import path from "path";
import fs from "fs";
import mongoose from "mongoose";
import { Media, IMedia, Doctor, Organization } from "@/models";
import { getEnv } from "@/config/env";
import { MediaAsset, AuthUserPayload } from "@/types";
import { v2 as cloudinary } from "cloudinary";

export type MediaCategory = "DOCTOR_PHOTO" | "CLINIC_LOGO" | "LOGO" | "GALLERY" | "DOCUMENT" | "BUILDING_PHOTO";

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
  BUILDING_PHOTO: {
    maxSizeBytes: 5 * 1024 * 1024, // 5 MB
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

  const cloudName = env.CLOUDINARY_CLOUD_NAME || "dinj82leu";
  const apiKey = env.CLOUDINARY_API_KEY;
  const apiSecret = env.CLOUDINARY_API_SECRET;

  if (cloudName && apiKey && apiSecret) {
    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
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
    const finalFilename = `${safeBase}_${uniqueId}${ext}`;
    const safePublicId = `doczeno/${params.category.toLowerCase()}/${safeBase}_${uniqueId}`;

    ensureStorageConfig();

    let uploadResult: {
      secure_url: string;
      public_id: string;
      bytes: number;
      width?: number;
      height?: number;
    } | null = null;

    if (process.env.NODE_ENV === "test") {
      uploadResult = {
        secure_url: `https://res.cloudinary.com/doczeno/image/upload/${safePublicId}${ext}`,
        public_id: safePublicId,
        bytes: params.buffer.length,
        width: 800,
        height: 600,
      };
    } else {
      uploadResult = await new Promise<{
        secure_url: string;
        public_id: string;
        bytes: number;
        width?: number;
        height?: number;
      }>((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            public_id: safePublicId,
            resource_type: "image",
            format: detectedMime.split("/")[1],
          },
          (error, result) => {
            if (error || !result) {
              const msg = error?.message || "Storage upload failed";
              if (msg.includes('actions=["create"]')) {
                return reject(
                  new Error(
                    "Cloudinary upload rejected: Missing 'create' permission on Cloudinary API Key. Please enable write/create permission in Cloudinary Console (Settings > Access Keys)."
                  )
                );
              }
              return reject(error || new Error("Cloudinary upload failed"));
            }
            resolve(result);
          }
        );
        stream.end(params.buffer);
      });
    }

    if (!uploadResult) {
      throw new Error("Failed to upload image to Cloudinary storage");
    }

    // Register in MongoDB Media collection
    await Media.create({
      ownerId: params.ownerId,
      ownerType: params.ownerType,
      fileUrl: uploadResult.secure_url,
      publicId: uploadResult.public_id,
      fileName: finalFilename,
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
      if (record.publicId.startsWith("local/")) {
        const localPath = path.resolve(
          process.cwd(),
          "uploads",
          record.category.toLowerCase(),
          path.basename(record.fileName)
        );
        if (fs.existsSync(localPath)) {
          try {
            fs.unlinkSync(localPath);
          } catch {
            // Ignore error
          }
        }
      } else {
        ensureStorageConfig();
        try {
          await cloudinary.uploader.destroy(record.publicId);
        } catch {
          // Continue DB deletion even if remote storage destroy warns
        }
      }
    }

    if (record.publicId) {
      const cleanPublicId = record.publicId;
      await Doctor.updateMany(
        { $or: [{ "doctorPhoto.publicId": cleanPublicId }, { "clinicLogo.publicId": cleanPublicId }] },
        { $unset: { doctorPhoto: 1, clinicLogo: 1 } }
      );
      await Doctor.updateMany(
        { "clinicPhotos.publicId": cleanPublicId },
        { $pull: { clinicPhotos: { publicId: cleanPublicId } } }
      );
      await Organization.updateMany(
        { "logo.publicId": cleanPublicId },
        { $unset: { logo: 1 } }
      );
      await Organization.updateMany(
        { "galleryPhotos.publicId": cleanPublicId },
        { $pull: { galleryPhotos: { publicId: cleanPublicId } } }
      );
    }

    await Media.findByIdAndDelete(mediaId);
    return true;
  }

  /**
   * Permanently destroys an asset in Cloudinary by publicId
   */
  static async destroyCloudinaryAsset(publicId: string): Promise<boolean> {
    if (!publicId || process.env.NODE_ENV === "test") return true;
    ensureStorageConfig();
    try {
      await cloudinary.uploader.destroy(publicId);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Permanently deletes all media assets in Cloudinary and DB for a set of ownerIds and direct publicIds
   */
  static async purgeAllTenantMedia(
    ownerIds: (string | mongoose.Types.ObjectId)[],
    additionalPublicIds: string[] = []
  ): Promise<number> {
    const validOwnerIds = ownerIds.filter(Boolean).map((id) => id.toString());
    const mediaRecords = await Media.find({
      $or: [
        { ownerId: { $in: validOwnerIds } },
        { publicId: { $in: additionalPublicIds.filter(Boolean) } },
      ],
    });

    const publicIdsToDestroy = new Set<string>();
    for (const rec of mediaRecords) {
      if (rec.publicId) publicIdsToDestroy.add(rec.publicId);
    }
    for (const pid of additionalPublicIds) {
      if (pid) publicIdsToDestroy.add(pid);
    }

    // Destroy on Cloudinary or local disk
    for (const pid of publicIdsToDestroy) {
      if (pid.startsWith("local/")) {
        const localPath = path.resolve(
          process.cwd(),
          "uploads",
          path.basename(pid)
        );
        if (fs.existsSync(localPath)) {
          try {
            fs.unlinkSync(localPath);
          } catch {
            // Ignore error
          }
        }
      } else {
        await this.destroyCloudinaryAsset(pid);
      }
    }

    // Delete DB records
    const res = await Media.deleteMany({
      $or: [
        { ownerId: { $in: validOwnerIds } },
        { publicId: { $in: Array.from(publicIdsToDestroy) } },
      ],
    });

    return res.deletedCount || 0;
  }

  /**
   * Deletes an unattached draft asset or user-owned asset by publicId and removes all references from DB
   */
  static async deleteAssetByPublicId(
    publicId: string,
    actor?: AuthUserPayload,
    assetUrl?: string,
    options?: { skipEntityUnset?: boolean }
  ): Promise<boolean> {
    if (!publicId && !assetUrl) return false;
    const cleanPublicId = typeof publicId === "string" ? publicId.trim() : "";
    const cleanUrl = typeof assetUrl === "string" ? assetUrl.trim() : "";

    let record = null;
    if (cleanPublicId) {
      record = await Media.findOne({ publicId: cleanPublicId });
    }
    if (!record && cleanUrl) {
      record = await Media.findOne({ fileUrl: cleanUrl });
    }

    // If attached to an active entity and actor is provided, enforce permission
    if (record && record.isAttached && actor) {
      if (
        actor.role !== "SUPERADMIN" &&
        record.ownerId?.toString() !== actor.organizationId &&
        record.ownerId?.toString() !== actor.doctorProfileId &&
        record.ownerId?.toString() !== actor.userId
      ) {
        throw new Error("Unauthorized to delete this attached media asset");
      }
    }

    // Destroy on Cloudinary if publicId exists
    const targetPublicId = cleanPublicId || record?.publicId;
    if (targetPublicId) {
      await this.destroyCloudinaryAsset(targetPublicId);
    }

    // Delete record from Media collection if exists
    if (record) {
      await Media.findByIdAndDelete(record._id);
    }

    // If skipEntityUnset is true (e.g. when replacing a photo), do NOT unset the entity fields!
    if (options?.skipEntityUnset) {
      return true;
    }

    // Clean up references in Doctor collection
    const doctorMatch: any[] = [];
    if (cleanPublicId) {
      doctorMatch.push({ "doctorPhoto.publicId": cleanPublicId });
      doctorMatch.push({ "clinicLogo.publicId": cleanPublicId });
    }
    if (cleanUrl) {
      doctorMatch.push({ "doctorPhoto.url": cleanUrl });
      doctorMatch.push({ "clinicLogo.url": cleanUrl });
    }
    if (doctorMatch.length > 0) {
      await Doctor.updateMany(
        { $or: doctorMatch },
        {
          $unset: {
            doctorPhoto: 1,
            clinicLogo: 1,
          },
        }
      );
    }

    if (cleanPublicId) {
      await Doctor.updateMany(
        { "clinicPhotos.publicId": cleanPublicId },
        { $pull: { clinicPhotos: { publicId: cleanPublicId } } }
      );
    }
    if (cleanUrl) {
      await Doctor.updateMany(
        { "clinicPhotos.url": cleanUrl },
        { $pull: { clinicPhotos: { url: cleanUrl } } }
      );
    }

    // Clean up references in Organization collection
    const orgMatch: any[] = [];
    if (cleanPublicId) {
      orgMatch.push({ "logo.publicId": cleanPublicId });
    }
    if (cleanUrl) {
      orgMatch.push({ "logo.url": cleanUrl });
    }
    if (orgMatch.length > 0) {
      await Organization.updateMany(
        { $or: orgMatch },
        {
          $unset: { logo: 1 },
        }
      );
    }

    if (cleanPublicId) {
      await Organization.updateMany(
        { "galleryPhotos.publicId": cleanPublicId },
        { $pull: { galleryPhotos: { publicId: cleanPublicId } } }
      );
    }
    if (cleanUrl) {
      await Organization.updateMany(
        { "galleryPhotos.url": cleanUrl },
        { $pull: { galleryPhotos: { url: cleanUrl } } }
      );
    }

    return true;
  }

  /**
   * Marks uploaded media assets as permanently attached when a Doctor/Hospital website is successfully created
   */
  static async markMediaAsAttached(
    assets: Array<MediaAsset | undefined | null>,
    entityId: string | any,
    entityType: "DOCTOR" | "ORGANIZATION"
  ): Promise<void> {
    const publicIds = assets
      .map((a) => a?.publicId)
      .filter((p): p is string => Boolean(p && typeof p === "string" && p.trim()));

    if (publicIds.length === 0) return;

    await Media.updateMany(
      { publicId: { $in: publicIds } },
      {
        $set: {
          isAttached: true,
          attachedEntityId: entityId,
          attachedEntityType: entityType,
          ownerId: entityId.toString(),
        },
      }
    );
  }

  /**
   * Automated cleanup of orphaned (unattached) media assets older than hoursThreshold
   * Removes dangling files from Cloudinary and purges MongoDB records
   */
  static async cleanupOrphanedMedia(hoursThreshold: number = 24): Promise<{ deletedCount: number; errors: string[] }> {
    const thresholdDate = new Date(Date.now() - hoursThreshold * 60 * 60 * 1000);
    const orphaned = await Media.find({
      isAttached: false,
      createdAt: { $lt: thresholdDate },
    });

    let deletedCount = 0;
    const errors: string[] = [];

    for (const item of orphaned) {
      try {
        if (item.publicId) {
          await this.destroyCloudinaryAsset(item.publicId);
        }
        await Media.findByIdAndDelete(item._id);
        deletedCount++;
      } catch (err: any) {
        errors.push(`Failed to purge ${item.publicId || item._id}: ${err?.message}`);
      }
    }

    return { deletedCount, errors };
  }
}
