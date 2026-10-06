import mongoose, { Document, Schema, Model } from "mongoose";

export type KnowledgeSourceType =
  | "DOCTOR_PROFILE"
  | "HOSPITAL_PROFILE"
  | "SERVICE"
  | "DEPARTMENT"
  | "FAQ"
  | "PAGE_CONTENT"
  | "CUSTOM";

export type KnowledgeVisibility = "PUBLIC" | "PRIVATE_ADMIN";

export interface IChatbotKnowledge extends Document {
  organizationId?: mongoose.Types.ObjectId | null;
  doctorId?: mongoose.Types.ObjectId | null;
  websiteId?: mongoose.Types.ObjectId | null;
  sourceType: KnowledgeSourceType;
  sourceId?: string | null;
  visibility: KnowledgeVisibility;
  title: string;
  chunkText: string;
  category: string;
  embedding?: number[];
  version: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ChatbotKnowledgeSchema = new Schema<IChatbotKnowledge>(
  {
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
    websiteId: {
      type: Schema.Types.ObjectId,
      ref: "Website",
      default: null,
      index: true,
    },
    sourceType: {
      type: String,
      enum: [
        "DOCTOR_PROFILE",
        "HOSPITAL_PROFILE",
        "SERVICE",
        "DEPARTMENT",
        "FAQ",
        "PAGE_CONTENT",
        "CUSTOM",
      ],
      default: "PAGE_CONTENT",
      index: true,
    },
    sourceId: {
      type: String,
      default: null,
      index: true,
    },
    visibility: {
      type: String,
      enum: ["PUBLIC", "PRIVATE_ADMIN"],
      default: "PUBLIC",
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    chunkText: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      required: true,
      default: "General",
      trim: true,
    },
    embedding: {
      type: [Number],
      default: undefined,
    },
    version: {
      type: Number,
      default: 1,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for strict tenant pre-filtered retrieval
ChatbotKnowledgeSchema.index({ websiteId: 1, visibility: 1, isActive: 1 });
ChatbotKnowledgeSchema.index({ organizationId: 1, visibility: 1, isActive: 1 });
ChatbotKnowledgeSchema.index({ doctorId: 1, visibility: 1, isActive: 1 });
ChatbotKnowledgeSchema.index({ organizationId: 1, doctorId: 1, visibility: 1, isActive: 1 });

// Text search index for localized keyword/semantic retrieval
ChatbotKnowledgeSchema.index({ title: "text", chunkText: "text" });

export const ChatbotKnowledge: Model<IChatbotKnowledge> =
  mongoose.models.ChatbotKnowledge ||
  mongoose.model<IChatbotKnowledge>("ChatbotKnowledge", ChatbotKnowledgeSchema);
