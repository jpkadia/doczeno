import mongoose, { Document, Schema, Model } from "mongoose";

export interface IToolCallInfo {
  id: string;
  name: string;
  args: Record<string, any>;
}

export interface IChatMessage {
  role: "user" | "assistant" | "system" | "tool" | "model";
  content: string;
  toolCalls?: IToolCallInfo[];
  toolCallId?: string;
  timestamp: Date;
}

export interface IPendingAction {
  actionId: string;
  actionType?: string;
  toolName: string;
  args: Record<string, any>;
  prompt: string;
  targetDescription: string;
  expiresAt: Date;
}

export interface IAppointmentDraft {
  step: "COLLECTING" | "AWAITING_CONFIRMATION" | "BOOKED";
  patientName?: string;
  patientAge?: number;
  patientPhone?: string;
  patientEmail?: string;
  appointmentDate?: string;
  timeSlot?: string;
  notes?: string;
  doctorId?: string;
  doctorName?: string;
  organizationId?: string;
}

export interface IChatbotConversation extends Document {
  conversationType: "PUBLIC" | "ADMIN";
  organizationId?: mongoose.Types.ObjectId | null;
  doctorId?: mongoose.Types.ObjectId | null;
  websiteId?: mongoose.Types.ObjectId | null;
  userId?: mongoose.Types.ObjectId | null;
  sessionId: string;
  messages: IChatMessage[];
  pendingAction?: IPendingAction | null;
  appointmentDraft?: IAppointmentDraft | null;
  createdAt: Date;
  updatedAt: Date;
}

const ToolCallInfoSchema = new Schema<IToolCallInfo>(
  {
    id: { type: String, required: true },
    name: { type: String, required: true },
    args: { type: Schema.Types.Mixed, required: true },
  },
  { _id: false }
);

const ChatMessageSchema = new Schema<IChatMessage>(
  {
    role: {
      type: String,
      enum: ["user", "assistant", "system", "tool", "model"],
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
    toolCalls: {
      type: [ToolCallInfoSchema],
      default: undefined,
    },
    toolCallId: {
      type: String,
      default: undefined,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const PendingActionSchema = new Schema<IPendingAction>(
  {
    actionId: { type: String, required: true },
    actionType: { type: String, required: false },
    toolName: { type: String, required: true },
    args: { type: Schema.Types.Mixed, required: true },
    prompt: { type: String, required: true },
    targetDescription: { type: String, required: true },
    expiresAt: { type: Date, required: true },
  },
  { _id: false }
);

const AppointmentDraftSchema = new Schema<IAppointmentDraft>(
  {
    step: {
      type: String,
      enum: ["COLLECTING", "AWAITING_CONFIRMATION", "BOOKED"],
      default: "COLLECTING",
    },
    patientName: { type: String, trim: true },
    patientAge: { type: Number, min: 1, max: 120 },
    patientPhone: { type: String, trim: true },
    patientEmail: { type: String, trim: true },
    appointmentDate: { type: String, trim: true },
    timeSlot: { type: String, trim: true },
    notes: { type: String, trim: true },
    doctorId: { type: String },
    doctorName: { type: String },
    organizationId: { type: String },
  },
  { _id: false }
);

const ChatbotConversationSchema = new Schema<IChatbotConversation>(
  {
    conversationType: {
      type: String,
      enum: ["PUBLIC", "ADMIN"],
      default: "PUBLIC",
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
    websiteId: {
      type: Schema.Types.ObjectId,
      ref: "Website",
      default: null,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    sessionId: {
      type: String,
      required: true,
      index: true,
    },
    messages: {
      type: [ChatMessageSchema],
      default: [],
    },
    pendingAction: {
      type: PendingActionSchema,
      default: null,
    },
    appointmentDraft: {
      type: AppointmentDraftSchema,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for conversation history lookup, tenant filtering, and automatic 30-day cleanup
ChatbotConversationSchema.index({ sessionId: 1, conversationType: 1 });
ChatbotConversationSchema.index({ userId: 1, conversationType: 1 });
ChatbotConversationSchema.index({ doctorId: 1, conversationType: 1, updatedAt: -1 });
ChatbotConversationSchema.index({ organizationId: 1, conversationType: 1, updatedAt: -1 });

// Automatically expire and delete conversations 30 days after last update
ChatbotConversationSchema.index(
  { updatedAt: 1 },
  { expireAfterSeconds: 30 * 24 * 60 * 60 }
);

export const ChatbotConversation: Model<IChatbotConversation> =
  mongoose.models.ChatbotConversation ||
  mongoose.model<IChatbotConversation>(
    "ChatbotConversation",
    ChatbotConversationSchema
  );
