import mongoose, { Document, Schema, Model } from "mongoose";

export interface IMedia extends Document {
  ownerId: mongoose.Types.ObjectId | string;
  ownerType: "DOCTOR" | "ORGANIZATION";
  fileUrl: string;
  publicId?: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  category: "DOCTOR_PHOTO" | "CLINIC_LOGO" | "GALLERY" | "DOCUMENT";
  createdAt: Date;
  updatedAt: Date;
}

const MediaSchema = new Schema<IMedia>(
  {
    ownerId: {
      type: Schema.Types.Mixed,
      required: true,
      index: true,
    },
    ownerType: {
      type: String,
      enum: ["DOCTOR", "ORGANIZATION"],
      required: true,
      index: true,
    },
    fileUrl: {
      type: String,
      required: true,
    },
    publicId: {
      type: String,
    },
    fileName: {
      type: String,
      required: true,
    },
    mimeType: {
      type: String,
      required: true,
    },
    sizeBytes: {
      type: Number,
      required: true,
    },
    category: {
      type: String,
      enum: ["DOCTOR_PHOTO", "CLINIC_LOGO", "GALLERY", "DOCUMENT"],
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

MediaSchema.index({ ownerId: 1, category: 1 });

export const Media: Model<IMedia> =
  mongoose.models.Media || mongoose.model<IMedia>("Media", MediaSchema);
