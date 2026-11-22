import mongoose, { Schema, Model } from "mongoose";

export type GeminiFeature =
  | "PUBLIC_CHATBOT"
  | "CLINICAL_TRIAGE"
  | "ADMIN_ASSISTANT"
  | "AI_CONTENT_GEN"
  | "OTHER";

export type GeminiCallStatus = "SUCCESS" | "FAILED";

export interface IGeminiApiLog {
  feature: GeminiFeature;
  model: string;
  status: GeminiCallStatus;
  statusCode: number;
  latencyMs: number;
  promptTokens?: number;
  candidatesTokens?: number;
  totalTokens?: number;
  organizationId?: mongoose.Types.ObjectId | null;
  doctorId?: mongoose.Types.ObjectId | null;
  userId?: mongoose.Types.ObjectId | null;
  errorMessage?: string;
  errorCode?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const GeminiApiLogSchema = new Schema<IGeminiApiLog>(
  {
    feature: {
      type: String,
      enum: [
        "PUBLIC_CHATBOT",
        "CLINICAL_TRIAGE",
        "ADMIN_ASSISTANT",
        "AI_CONTENT_GEN",
        "OTHER",
      ],
      required: true,
      index: true,
    },
    model: {
      type: String,
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["SUCCESS", "FAILED"],
      required: true,
      index: true,
    },
    statusCode: {
      type: Number,
      default: 200,
    },
    latencyMs: {
      type: Number,
      required: true,
      min: 0,
    },
    promptTokens: {
      type: Number,
      default: 0,
    },
    candidatesTokens: {
      type: Number,
      default: 0,
    },
    totalTokens: {
      type: Number,
      default: 0,
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
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    errorMessage: {
      type: String,
      default: null,
    },
    errorCode: {
      type: String,
      default: null,
      index: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Compound and analytical indexes
GeminiApiLogSchema.index({ createdAt: -1 });
GeminiApiLogSchema.index({ status: 1, createdAt: -1 });
GeminiApiLogSchema.index({ feature: 1, createdAt: -1 });
GeminiApiLogSchema.index({ organizationId: 1, createdAt: -1 });
GeminiApiLogSchema.index({ doctorId: 1, createdAt: -1 });

// Automatic 90-day retention TTL index (7776000 seconds)
GeminiApiLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7776000 });

export const GeminiApiLog: Model<IGeminiApiLog> =
  mongoose.models.GeminiApiLog ||
  mongoose.model<IGeminiApiLog>("GeminiApiLog", GeminiApiLogSchema);
