import { v2 as cloudinary } from "cloudinary";
import { getEnv } from "@/config/env";
import { MediaAsset } from "@/types";

let cloudinaryConfigured = false;

function ensureCloudinaryConfig() {
  if (cloudinaryConfigured) return;

  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET, CLOUDINARY_URL } = getEnv();

  if (CLOUDINARY_URL) {
    cloudinary.config({ cloudinary_url: CLOUDINARY_URL });
    cloudinaryConfigured = true;
  } else if (CLOUDINARY_CLOUD_NAME && CLOUDINARY_API_KEY && CLOUDINARY_API_SECRET) {
    cloudinary.config({
      cloud_name: CLOUDINARY_CLOUD_NAME,
      api_key: CLOUDINARY_API_KEY,
      api_secret: CLOUDINARY_API_SECRET,
      secure: true,
    });
    cloudinaryConfigured = true;
  }
}

export interface UploadOptions {
  folder?: string;
  publicId?: string;
}

/**
 * Storage Service - handles uploading and deleting assets via Cloudinary or S3/R2
 */
export const storageService = {
  async uploadBuffer(buffer: Buffer, options: UploadOptions = {}): Promise<MediaAsset> {
    ensureCloudinaryConfig();

    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: options.folder || "doczeno",
          public_id: options.publicId,
          resource_type: "image",
        },
        (error, result) => {
          if (error || !result) {
            return reject(error || new Error("Failed to upload image to storage"));
          }
          resolve({
            url: result.secure_url,
            publicId: result.public_id,
            width: result.width,
            height: result.height,
            sizeBytes: result.bytes,
            mimeType: `${result.resource_type}/${result.format}`,
          });
        }
      );

      uploadStream.end(buffer);
    });
  },

  async deleteAsset(publicId: string): Promise<boolean> {
    ensureCloudinaryConfig();
    try {
      const result = await cloudinary.uploader.destroy(publicId);
      return result.result === "ok";
    } catch {
      return false;
    }
  },
};
