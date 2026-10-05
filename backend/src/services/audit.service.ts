import mongoose from "mongoose";
import { AuditLog } from "@/models";
import { UserRole } from "@/types";

export interface LogAuditEventParams {
  userId?: string | null;
  userEmail?: string;
  userRole?: UserRole;
  action: string;
  entityType: string;
  entityId?: string;
  organizationId?: string | null;
  doctorId?: string | null;
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

export async function logAuditEvent(params: LogAuditEventParams): Promise<void> {
  // If not connected to MongoDB (e.g. unit testing with mocked DB), skip persistence
  if (mongoose.connection.readyState !== 1) {
    return;
  }

  try {
    const toObjectId = (val?: string | null) =>
      val && mongoose.isValidObjectId(val) ? new mongoose.Types.ObjectId(val) : null;

    await AuditLog.create({
      userId: toObjectId(params.userId),
      userEmail: params.userEmail,
      userRole: params.userRole,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      organizationId: toObjectId(params.organizationId),
      doctorId: toObjectId(params.doctorId),
      details: params.details,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      timestamp: new Date(),
    });
  } catch (error) {
    // Non-blocking log failure
    console.error("[AuditLog Error]: Failed to persist audit record", error);
  }
}
