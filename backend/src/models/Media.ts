import mongoose, { Document, Schema, Model } from "mongoose";

export interface IMedia extends Document {
  ownerId: mongoose.Types.ObjectId | string;
  ownerType: "DOCTOR" | "ORGANIZATION";
  fileUrl: string;
  publicId?: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  category: "DOCTOR_PHOTO" | "CLINIC_LOGO" | "GALLERY" | "DOCUMENT" | "BUILDING_PHOTO";
  isAttached: boolean;
  attachedEntityId?: mongoose.Types.ObjectId | null;
  attachedEntityType?: "DOCTOR" | "ORGANIZATION" | null;
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
      enum: ["DOCTOR_PHOTO", "CLINIC_LOGO", "GALLERY", "DOCUMENT", "BUILDING_PHOTO"],
      required: true,
      index: true,
    },
    isAttached: {
      type: Boolean,
      default: false,
      index: true,
    },
    attachedEntityId: {
      type: Schema.Types.ObjectId,
      default: null,
      index: true,
    },
    attachedEntityType: {
      type: String,
      enum: ["DOCTOR", "ORGANIZATION", null],
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

MediaSchema.index({ ownerId: 1, category: 1 });

export const Media: Model<IMedia> =
  mongoose.models.Media || mongoose.model<IMedia>("Media", MediaSchema);
