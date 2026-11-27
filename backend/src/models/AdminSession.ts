import mongoose, { Document, Schema, Model } from "mongoose";
import { UserRole } from "@/types";

export type AdminSessionStatus = "ACTIVE" | "LOGGED_OUT" | "EXPIRED";
export type AdminLogoutReason = "MANUAL" | "INACTIVITY" | "SESSION_EXPIRED" | "REVOKED";

export interface IAdminSession extends Document {
  sessionId: string;
  userId: mongoose.Types.ObjectId;
  userEmail: string;
  userName?: string;
  userRole: UserRole;
  organizationId?: mongoose.Types.ObjectId | null;
  doctorId?: mongoose.Types.ObjectId | null;
  portalSlug?: string;
  ipAddress: string;
  userAgent?: string;
  browser: string;
  os: string;
  deviceType: "Desktop" | "Mobile" | "Tablet" | "Unknown";
  deviceLabel: string;
  loginAt: Date;
  lastActivityAt: Date;
  expiresAt: Date;
  status: AdminSessionStatus;
  logoutAt?: Date | null;
  logoutReason?: AdminLogoutReason | null;
  createdAt: Date;
  updatedAt: Date;
}

const AdminSessionSchema = new Schema<IAdminSession>(
  {
    sessionId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    userEmail: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    userName: {
      type: String,
      trim: true,
    },
    userRole: {
      type: String,
      enum: Object.values(UserRole),
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
    portalSlug: {
      type: String,
      trim: true,
    },
    ipAddress: {
      type: String,
      required: true,
      default: "Unknown",
    },
    userAgent: {
      type: String,
    },
    browser: {
      type: String,
      required: true,
      default: "Unknown Browser",
    },
    os: {
      type: String,
      required: true,
      default: "Unknown OS",
    },
    deviceType: {
      type: String,
      enum: ["Desktop", "Mobile", "Tablet", "Unknown"],
      default: "Unknown",
    },
    deviceLabel: {
      type: String,
      required: true,
      default: "Unknown Device",
    },
    loginAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    lastActivityAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ["ACTIVE", "LOGGED_OUT", "EXPIRED"],
      default: "ACTIVE",
      index: true,
    },
    logoutAt: {
      type: Date,
      default: null,
    },
    logoutReason: {
      type: String,
      enum: ["MANUAL", "INACTIVITY", "SESSION_EXPIRED", "REVOKED"],
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

AdminSessionSchema.index({ userId: 1, loginAt: -1 });
AdminSessionSchema.index({ organizationId: 1, userRole: 1, loginAt: -1 });
AdminSessionSchema.index({ doctorId: 1, loginAt: -1 });

// Automatically delete admin login/session logs from MongoDB after 30 days
AdminSessionSchema.index(
  { loginAt: 1 },
  { expireAfterSeconds: 30 * 24 * 60 * 60 }
);

export const AdminSession: Model<IAdminSession> =
  mongoose.models.AdminSession ||
  mongoose.model<IAdminSession>("AdminSession", AdminSessionSchema);
