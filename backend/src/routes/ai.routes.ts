import { Router, Request, Response, NextFunction } from "express";
import { requireAuthenticatedUser } from "@/middleware/auth";
import { aiRateLimiter } from "@/middleware/ai-rate-limit";
import { aiContentService } from "@/services/ai-content.service";
import {
  aiGenerateRequestSchema,
  aiRegenerateRequestSchema,
  aiApproveRequestSchema,
  aiPublishRequestSchema,
  AiTargetType,
} from "@/validations/ai";
import { Doctor } from "@/models";
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
      if (
        user.role !== UserRole.HOSPITAL_ADMIN ||
        !user.organizationId ||
        user.organizationId.toString() !== targetId.toString()
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

    if (targetType === AiTargetType.INDEPENDENT_DOCTOR || targetType === AiTargetType.HOSPITAL_DOCTOR) {
      const doctor = await Doctor.findById(targetId);
      if (!doctor) {
        res.status(404).json({ success: false, error: "Doctor not found", code: "NOT_FOUND" });
        return;
      }

      // Check if user is the doctor himself
      const isSelf =
        (user.doctorProfileId && user.doctorProfileId.toString() === targetId.toString()) ||
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
