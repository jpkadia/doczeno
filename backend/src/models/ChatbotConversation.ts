import mongoose, { Document, Schema, Model } from "mongoose";

export interface IChatMessage {
  role: "user" | "model";
  content: string;
  timestamp: Date;
}

export interface IChatbotConversation extends Document {
  organizationId?: mongoose.Types.ObjectId | null;
  doctorId?: mongoose.Types.ObjectId | null;
  sessionId: string;
  messages: IChatMessage[];
  createdAt: Date;
  updatedAt: Date;
}

const ChatbotConversationSchema = new Schema<IChatbotConversation>(
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
    sessionId: {
      type: String,
      required: true,
      index: true,
    },
    messages: [
      {
        role: {
          type: String,
          enum: ["user", "model"],
          required: true,
        },
        content: {
          type: String,
          required: true,
        },
        timestamp: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

export const ChatbotConversation: Model<IChatbotConversation> =
  mongoose.models.ChatbotConversation ||
  mongoose.model<IChatbotConversation>(
    "ChatbotConversation",
    ChatbotConversationSchema
  );
