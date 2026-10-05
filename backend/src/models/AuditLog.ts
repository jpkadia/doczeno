import mongoose, { Document, Schema, Model } from "mongoose";
import { UserRole } from "@/types";

export interface IAuditLog extends Document {
  userId?: mongoose.Types.ObjectId | null;
  userEmail?: string;
  userRole?: UserRole;
  action: string;
  entityType: string;
  entityId?: string;
  organizationId?: mongoose.Types.ObjectId | null;
  doctorId?: mongoose.Types.ObjectId | null;
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date;
}

const AuditLogSchema = new Schema<IAuditLog>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    userEmail: {
      type: String,
      trim: true,
    },
    userRole: {
      type: String,
      enum: Object.values(UserRole),
    },
    action: {
      type: String,
      required: true,
      index: true,
    },
    entityType: {
      type: String,
      required: true,
      index: true,
    },
    entityId: {
      type: String,
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
    details: {
      type: Schema.Types.Mixed,
    },
    ipAddress: {
      type: String,
    },
    userAgent: {
      type: String,
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: false,
  }
);

AuditLogSchema.index({ organizationId: 1, timestamp: -1 });
AuditLogSchema.index({ userId: 1, timestamp: -1 });

export const AuditLog: Model<IAuditLog> =
  mongoose.models.AuditLog || mongoose.model<IAuditLog>("AuditLog", AuditLogSchema);
