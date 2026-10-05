import mongoose, { Document, Schema, Model } from "mongoose";

export interface IChatbotKnowledge extends Document {
  organizationId?: mongoose.Types.ObjectId | null;
  doctorId?: mongoose.Types.ObjectId | null;
  question: string;
  answer: string;
  category: string;
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
    question: {
      type: String,
      required: true,
      trim: true,
    },
    answer: {
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
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

ChatbotKnowledgeSchema.index({ organizationId: 1, isActive: 1 });
ChatbotKnowledgeSchema.index({ question: "text", answer: "text" });

export const ChatbotKnowledge: Model<IChatbotKnowledge> =
  mongoose.models.ChatbotKnowledge ||
  mongoose.model<IChatbotKnowledge>("ChatbotKnowledge", ChatbotKnowledgeSchema);
