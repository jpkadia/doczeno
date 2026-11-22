import mongoose, { Document, Schema, Model } from "mongoose";

export interface IAIContentHistory {
  version: number;
  status: string;
  content: Record<string, any>;
  sectionRegenerated?: string;
  actorId?: mongoose.Types.ObjectId | null;
  actorRole?: string;
  action: "GENERATE" | "REGENERATE_SECTION" | "MANUAL_EDIT" | "APPROVE" | "PUBLISH";
  createdAt: Date;
}

export interface IAIContent extends Document {
  targetType: "ONLY_DOCTOR" | "HOSPITAL" | "HOSPITAL_DOCTOR" | "DOCTOR_BIO" | "HOSPITAL_ABOUT" | "SERVICE_DESCRIPTION" | "FAQ";
  targetId: mongoose.Types.ObjectId;
  organizationId?: mongoose.Types.ObjectId | null;
  doctorId?: mongoose.Types.ObjectId | null;
  status: "NOT_GENERATED" | "GENERATING" | "DRAFT" | "APPROVED" | "PUBLISHED" | "FAILED";
  version: number;
  draftContent?: Record<string, any> | null;
  approvedContent?: Record<string, any> | null;
  publishedContent?: Record<string, any> | null;
  generatedPrompt?: string;
  lastError?: string | null;
  reviewedBy?: mongoose.Types.ObjectId | null;
  publishedBy?: mongoose.Types.ObjectId | null;
  history: IAIContentHistory[];
  createdAt: Date;
  updatedAt: Date;
}

const AIContentHistorySchema = new Schema<IAIContentHistory>(
  {
    version: { type: Number, required: true },
    status: { type: String, required: true },
    content: { type: Schema.Types.Mixed, required: true },
    sectionRegenerated: { type: String, default: null },
    actorId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    actorRole: { type: String, default: null },
    action: {
      type: String,
      enum: ["GENERATE", "REGENERATE_SECTION", "MANUAL_EDIT", "APPROVE", "PUBLISH"],
      required: true,
    },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const AIContentSchema = new Schema<IAIContent>(
  {
    targetType: {
      type: String,
      enum: [
        "ONLY_DOCTOR",
        "HOSPITAL",
        "HOSPITAL_DOCTOR",
        "DOCTOR_BIO",
        "HOSPITAL_ABOUT",
        "SERVICE_DESCRIPTION",
        "FAQ",
      ],
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
    status: {
      type: String,
      enum: ["NOT_GENERATED", "GENERATING", "DRAFT", "APPROVED", "PUBLISHED", "FAILED"],
      default: "NOT_GENERATED",
      index: true,
    },
    version: {
      type: Number,
      default: 0,
    },
    draftContent: {
      type: Schema.Types.Mixed,
      default: null,
    },
    approvedContent: {
      type: Schema.Types.Mixed,
      default: null,
    },
    publishedContent: {
      type: Schema.Types.Mixed,
      default: null,
    },
    generatedPrompt: {
      type: String,
      default: "",
    },
    lastError: {
      type: String,
      default: null,
    },
    reviewedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    publishedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    history: {
      type: [AIContentHistorySchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for querying unique target records
AIContentSchema.index({ targetType: 1, targetId: 1 }, { unique: true });

export const AIContent: Model<IAIContent> =
  mongoose.models.AIContent ||
  mongoose.model<IAIContent>("AIContent", AIContentSchema);
