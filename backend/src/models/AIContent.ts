import mongoose, { Document, Schema, Model } from "mongoose";

export interface IAIContent extends Document {
  targetType: "DOCTOR_BIO" | "HOSPITAL_ABOUT" | "SERVICE_DESCRIPTION" | "FAQ";
  targetId: mongoose.Types.ObjectId;
  organizationId?: mongoose.Types.ObjectId | null;
  doctorId?: mongoose.Types.ObjectId | null;
  generatedPrompt: string;
  draftContent: string;
  approvedContent?: string;
  status: "DRAFT" | "APPROVED" | "REJECTED";
  reviewedBy?: mongoose.Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const AIContentSchema = new Schema<IAIContent>(
  {
    targetType: {
      type: String,
      enum: ["DOCTOR_BIO", "HOSPITAL_ABOUT", "SERVICE_DESCRIPTION", "FAQ"],
      required: true,
      index: true,
    },
    targetId: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      default: null,
      index: true,
    },
    doctorId: {
      type: Schema.Types.ObjectId,
      ref: "Doctor",
      default: null,
      index: true,
    },
    generatedPrompt: {
      type: String,
      required: true,
    },
    draftContent: {
      type: String,
      required: true,
    },
    approvedContent: {
      type: String,
    },
    status: {
      type: String,
      enum: ["DRAFT", "APPROVED", "REJECTED"],
      default: "DRAFT",
      index: true,
    },
    reviewedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

export const AIContent: Model<IAIContent> =
  mongoose.models.AIContent ||
  mongoose.model<IAIContent>("AIContent", AIContentSchema);
