import { Router, Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import { requireAuthenticatedUser } from "@/middleware/auth";
import { aiRateLimiter } from "@/middleware/ai-rate-limit";
import { aiContentService } from "@/services/ai-content.service";
import {
  aiGenerateRequestSchema,
  aiRegenerateRequestSchema,
  aiApproveRequestSchema,
  aiPublishRequestSchema,
  aiUpdateLiveContentSchema,
  AiTargetType,
} from "@/validations/ai";
import { Doctor, Organization } from "@/models";
import { UserRole } from "@/types";

export const aiRouter = Router();

/**
 * Access control middleware ensuring user can only manage AI content for their authorized entity
 */
async function requireAiTargetAccess(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const user = req.user;
  if (!user) {
    res.status(401).json({ success: false, error: "Authentication required", code: "UNAUTHORIZED" });
    return;
  }

  if (user.role === UserRole.SUPERADMIN) {
    const targetType = req.body?.targetType || req.params?.targetType;
    const targetId = req.body?.targetId || req.params?.targetId;
    if (targetId && !mongoose.Types.ObjectId.isValid(targetId)) {
      if (targetType === AiTargetType.HOSPITAL) {
        const org = await Organization.findOne({ slug: targetId.toLowerCase() });
        if (org) {
          if (req.params?.targetId) req.params.targetId = org._id.toString();
          if (req.body?.targetId) req.body.targetId = org._id.toString();
        }
      } else {
        const doc = await Doctor.findOne({ slug: targetId.toLowerCase() });
        if (doc) {
          if (req.params?.targetId) req.params.targetId = doc._id.toString();
          if (req.body?.targetId) req.body.targetId = doc._id.toString();
        }
      }
    }
    return next();
  }

  const targetType = req.body?.targetType || req.params?.targetType;
  const targetId = req.body?.targetId || req.params?.targetId;

  if (!targetType || !targetId) {
    res.status(400).json({ success: false, error: "targetType and targetId are required", code: "BAD_REQUEST" });
    return;
  }

  try {
    if (targetType === AiTargetType.HOSPITAL) {
      let org: any = null;
      if (mongoose.Types.ObjectId.isValid(targetId)) {
        org = await Organization.findById(targetId);
      }
      if (!org) {
        org = await Organization.findOne({ slug: targetId });
      }
      if (!org) {
        res.status(404).json({ success: false, error: "Organization not found", code: "NOT_FOUND" });
        return;
      }

      const realOrgId = org._id.toString();
      if (req.params?.targetId) req.params.targetId = realOrgId;
      if (req.body?.targetId) req.body.targetId = realOrgId;

      if (
        user.role !== UserRole.HOSPITAL_ADMIN ||
        !user.organizationId ||
        user.organizationId.toString() !== realOrgId
      ) {
        res.status(403).json({
          success: false,
          error: "Forbidden: You are not authorized to manage AI content for this organization",
          code: "FORBIDDEN",
        });
        return;
      }
      return next();
    }

    if (targetType === AiTargetType.ONLY_DOCTOR || targetType === AiTargetType.HOSPITAL_DOCTOR) {
      let doctor: any = null;
      if (mongoose.Types.ObjectId.isValid(targetId)) {
        doctor = await Doctor.findById(targetId);
      }
      if (!doctor) {
        doctor = await Doctor.findOne({ slug: targetId });
      }
      if (!doctor) {
        res.status(404).json({ success: false, error: "Doctor not found", code: "NOT_FOUND" });
        return;
      }

      const realDoctorId = doctor._id.toString();
      if (req.params?.targetId) req.params.targetId = realDoctorId;
      if (req.body?.targetId) req.body.targetId = realDoctorId;

      // Check if user is the doctor himself
      const isSelf =
        (user.doctorProfileId && user.doctorProfileId.toString() === realDoctorId) ||
        (doctor.userId && doctor.userId.toString() === user.userId);

      if (isSelf) {
        return next();
      }

      // Check if user is the hospital admin of the parent organization
      if (
        targetType === AiTargetType.HOSPITAL_DOCTOR &&
        user.role === UserRole.HOSPITAL_ADMIN &&
        user.organizationId &&
        doctor.organizationId &&
        doctor.organizationId.toString() === user.organizationId.toString()
      ) {
        return next();
      }

      res.status(403).json({
        success: false,
        error: "Forbidden: You do not have permission to manage AI content for this doctor",
        code: "FORBIDDEN",
      });
      return;
    }

    res.status(400).json({ success: false, error: `Invalid targetType: ${targetType}`, code: "BAD_REQUEST" });
  } catch (err: any) {
    next(err);
  }
}

/**
 * GET /api/v1/ai/content/:targetType/:targetId
 * Retrieves the current AI content state and version history
 */
aiRouter.get(
  "/content/:targetType/:targetId",
  requireAuthenticatedUser,
  requireAiTargetAccess,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const targetType = String(req.params.targetType);
      const targetId = String(req.params.targetId);
      const record = await aiContentService.getOrCreateRecord(targetType, targetId);
      res.status(200).json({
        success: true,
        data: record,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/v1/ai/content/generate
 * Initiates Gemini generation of full structured content draft
 */
aiRouter.post(
  "/content/generate",
  requireAuthenticatedUser,
  requireAiTargetAccess,
  aiRateLimiter,
  async (req: Request, res: Response, _next: NextFunction) => {
    try {
      const parsed = aiGenerateRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          success: false,
          error: parsed.error.issues.map((i) => i.message).join(", "),
          code: "VALIDATION_ERROR",
        });
        return;
      }

      const { targetType, targetId } = parsed.data;
      const record = await aiContentService.generateDraft(targetType, targetId, req.user);

      res.status(200).json({
        success: true,
        message: "AI draft generated successfully",
        data: record,
      });
    } catch (err: any) {
      res.status(err?.status || 500).json({
        success: false,
        error: err?.message || "Failed to generate AI draft",
        code: "AI_GENERATION_FAILED",
      });
    }
  }
);

/**
 * POST /api/v1/ai/content/regenerate
 * Regenerates an isolated section without overwriting other approved sections
 */
aiRouter.post(
  "/content/regenerate",
  requireAuthenticatedUser,
  requireAiTargetAccess,
  aiRateLimiter,
  async (req: Request, res: Response, _next: NextFunction) => {
    try {
      const parsed = aiRegenerateRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          success: false,
          error: parsed.error.issues.map((i) => i.message).join(", "),
          code: "VALIDATION_ERROR",
        });
        return;
      }

      const { targetType, targetId, section } = parsed.data;
      const record = await aiContentService.regenerateSection(
        targetType,
        targetId,
        section,
        req.user
      );

      res.status(200).json({
        success: true,
        message: `Section "${section}" regenerated successfully`,
        data: record,
      });
    } catch (err: any) {
      res.status(err?.status || 500).json({
        success: false,
        error: err?.message || "Failed to regenerate section",
        code: "AI_REGENERATION_FAILED",
      });
    }
  }
);

/**
 * POST /api/v1/ai/content/approve
 * Human review approval of draft content (with optional user edits)
 */
aiRouter.post(
  "/content/approve",
  requireAuthenticatedUser,
  requireAiTargetAccess,
  async (req: Request, res: Response, _next: NextFunction) => {
    try {
      const parsed = aiApproveRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          success: false,
          error: parsed.error.issues.map((i) => i.message).join(", "),
          code: "VALIDATION_ERROR",
        });
        return;
      }

      const { targetType, targetId, editedContent } = parsed.data;
      const record = await aiContentService.approveDraft(
        targetType,
        targetId,
        editedContent,
        req.user
      );

      res.status(200).json({
        success: true,
        message: "AI draft approved successfully by human reviewer",
        data: record,
      });
    } catch (err: any) {
      res.status(400).json({
        success: false,
        error: err?.message || "Failed to approve draft",
        code: "AI_APPROVAL_FAILED",
      });
    }
  }
);

/**
 * POST /api/v1/ai/content/publish
 * Publishes human-approved content to the public website
 */
aiRouter.post(
  "/content/publish",
  requireAuthenticatedUser,
  requireAiTargetAccess,
  async (req: Request, res: Response, _next: NextFunction) => {
    try {
      const parsed = aiPublishRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          success: false,
          error: parsed.error.issues.map((i) => i.message).join(", "),
          code: "VALIDATION_ERROR",
        });
        return;
      }

      const { targetType, targetId } = parsed.data;
      const record = await aiContentService.publishContent(targetType, targetId, req.user);

      res.status(200).json({
        success: true,
        message: "AI content published live to public website",
        data: record,
      });
    } catch (err: any) {
      res.status(400).json({
        success: false,
        error: err?.message || "Failed to publish content",
        code: "AI_PUBLISH_FAILED",
      });
    }
  }
);

/**
 * POST /api/v1/ai/content/update-live
 * Direct manual update of live website content (modifies live content directly)
 */
aiRouter.post(
  "/content/update-live",
  requireAuthenticatedUser,
  requireAiTargetAccess,
  async (req: Request, res: Response, _next: NextFunction) => {
    try {
      const parsed = aiUpdateLiveContentSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          success: false,
          error: parsed.error.issues.map((i) => i.message).join(", "),
          code: "VALIDATION_ERROR",
        });
        return;
      }

      const { targetType, targetId, content } = parsed.data;
      const record = await aiContentService.updateLiveContent(
        targetType,
        targetId,
        content,
        req.user
      );

      res.status(200).json({
        success: true,
        message: "Live website content updated successfully",
        data: record,
      });
    } catch (err: any) {
      res.status(400).json({
        success: false,
        error: err?.message || "Failed to update live website content",
        code: "AI_UPDATE_FAILED",
      });
    }
  }
);
