import { Router, Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import { Organization, Doctor, Website, User, Appointment, AIContent, Review, PlatformConfig, ChatbotConversation } from "@/models";
import { requireAuthenticatedUser } from "@/middleware/auth";
import { requireRole } from "@/middleware/rbac";
import { UserRole } from "@/types";
import { logAuditEvent } from "@/services/audit.service";
import { PlatformConfigService } from "@/services/platform-config.service";
import { GeminiLoggerService } from "@/services/gemini-logger.service";
import { MediaService } from "@/services/media.service";
import { StaticExportService } from "@/services/static-export.service";
import { CustomDomainService, MAX_CUSTOM_DOMAINS, buildDnsInstructions } from "@/services/custom-domain.service";

export const superadminRouter = Router();

// Enforce authentication and SUPERADMIN role across all routes
superadminRouter.use(requireAuthenticatedUser);
superadminRouter.use(requireRole([UserRole.SUPERADMIN]));

/**
 * GET /api/v1/superadmin/stats
 * Platform-wide aggregation metrics for the Superadmin Dashboard
 */
superadminRouter.get("/stats", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const [
      totalOrganizations,
      totalDoctors,
      totalWebsites,
      activeWebsitesCount,
      deactiveWebsitesCount,
      totalUsers,
      totalAppointments,
      pendingAppointments,
      platformConfig,
    ] = await Promise.all([
      Organization.countDocuments(),
      Doctor.countDocuments(),
      Website.countDocuments(),
      Website.countDocuments({ publishStatus: "PUBLISHED" }),
      Website.countDocuments({ publishStatus: { $ne: "PUBLISHED" } }),
      User.countDocuments({ role: { $ne: UserRole.SUPERADMIN } }),
      Appointment.countDocuments(),
      Appointment.countDocuments({ status: "PENDING" }),
      PlatformConfig.findOne().catch(() => null),
    ]);

    res.status(200).json({
      success: true,
      data: {
        totalOrganizations,
        totalDoctors,
        totalWebsites,
        activeWebsitesCount,
        deactiveWebsitesCount,
        totalUsers,
        totalAppointments,
        pendingAppointments,
        deletedDoctorsCount: platformConfig?.deletedDoctorsCount || 0,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/superadmin/organizations
 * Search, filter, and paginate organizations
 */
superadminRouter.get("/organizations", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { search, type, status, page = "1", limit = "20" } = req.query;
    const filter: Record<string, unknown> = {};

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { slug: { $regex: search, $options: "i" } },
        { "address.city": { $regex: search, $options: "i" } },
      ];
    }
    if (type) filter.type = type;
    if (status) filter.status = status;

    const pageNum = Math.max(1, parseInt(page as string, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string, 10)));
    const skip = (pageNum - 1) * limitNum;

    const [organizations, total] = await Promise.all([
      Organization.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limitNum),
      Organization.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      data: {
        organizations,
        total,
        page: pageNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/v1/superadmin/organizations/:id/status
 * Activate or Deactivate organization with cascading dependency handling
 */
superadminRouter.patch("/organizations/:id/status", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status } = req.body;
    if (!["ACTIVE", "INACTIVE", "SUSPENDED"].includes(status)) {
      res.status(400).json({
        success: false,
        error: "Invalid status. Must be ACTIVE, INACTIVE, or SUSPENDED",
        code: "INVALID_STATUS",
      });
      return;
    }

    let org: any = null;
    const paramId = String(req.params.id || "");
    if (mongoose.Types.ObjectId.isValid(paramId)) {
      org = await Organization.findById(paramId);
    }
    if (!org) {
      org = await Organization.findOne({ slug: paramId.toLowerCase() });
    }
    if (!org) {
      res.status(404).json({ success: false, error: "Organization not found", code: "NOT_FOUND" });
      return;
    }

    const isActivating = status === "ACTIVE";
    org.status = status;
    await org.save();

    // Cascading effect: sync Hospital website, all connected approved Doctors, and their Websites
    if (!isActivating) {
      await Promise.all([
        Doctor.updateMany(
          { organizationId: org._id },
          { $set: { status: "INACTIVE", deactivatedByRole: "SUPERADMIN" } }
        ),
        Website.updateMany(
          { $or: [{ organizationId: org._id }, { ownerId: org._id }] },
          { $set: { publishStatus: "SUSPENDED", deactivatedByRole: "SUPERADMIN" } }
        ),
      ]);
    } else {
      const approvedDocs = await Doctor.find({
        organizationId: org._id,
        approvalStatus: { $nin: ["PENDING", "REJECTED"] },
      })
        .select("_id")
        .lean();
      const approvedDocIds = approvedDocs.map((d) => d._id);

      await Promise.all([
        Doctor.updateMany(
          { _id: { $in: approvedDocIds } },
          { $set: { status: "ACTIVE", deactivatedByRole: null } }
        ),
        Website.updateMany(
          {
            $or: [
              { organizationId: org._id, websiteType: "HOSPITAL_CLINIC" },
              { ownerId: org._id, websiteType: "HOSPITAL_CLINIC" },
              ...(approvedDocIds.length > 0 ? [{ doctorId: { $in: approvedDocIds } }] : []),
            ],
          },
          { $set: { publishStatus: "PUBLISHED", deactivatedByRole: null } }
        ),
      ]);
    }

    await logAuditEvent({
      userId: req.user!.userId,
      userEmail: req.user!.email,
      userRole: req.user!.role,
      action: "ORGANIZATION_STATUS_CHANGED",
      entityType: "Organization",
      entityId: org._id.toString(),
      organizationId: org._id.toString(),
      details: { newStatus: status, organizationName: org.name },
    });

    res.status(200).json({
      success: true,
      message: `Organization status updated to ${status}`,
      data: { organization: org },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/v1/superadmin/organizations/:id/chatbot-settings
 * Update website and admin chatbot enable/disable toggles
 */
superadminRouter.patch("/organizations/:id/chatbot-settings", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { isWebsiteChatbotEnabled, isAdminChatbotEnabled, isChatbotBookingEnabled } = req.body;
    let org: any = null;
    const paramId = String(req.params.id || "");
    if (mongoose.Types.ObjectId.isValid(paramId)) {
      org = await Organization.findById(paramId);
    }
    if (!org) {
      org = await Organization.findOne({ slug: paramId.toLowerCase() });
    }
    if (!org) {
      res.status(404).json({ success: false, error: "Organization not found", code: "NOT_FOUND" });
      return;
    }

    if (typeof isWebsiteChatbotEnabled === "boolean") {
      org.isWebsiteChatbotEnabled = isWebsiteChatbotEnabled;
    }
    if (typeof isAdminChatbotEnabled === "boolean") {
      org.isAdminChatbotEnabled = isAdminChatbotEnabled;
    }
    if (typeof isChatbotBookingEnabled === "boolean") {
      org.isChatbotBookingEnabled = isChatbotBookingEnabled;
    }
    await org.save();

    await logAuditEvent({
      userId: req.user!.userId,
      userEmail: req.user!.email,
      userRole: req.user!.role,
      action: "ORGANIZATION_CHATBOT_SETTINGS_CHANGED",
      entityType: "Organization",
      entityId: org._id.toString(),
      organizationId: org._id.toString(),
      details: {
        isWebsiteChatbotEnabled: org.isWebsiteChatbotEnabled,
        isAdminChatbotEnabled: org.isAdminChatbotEnabled,
        isChatbotBookingEnabled: org.isChatbotBookingEnabled,
        organizationName: org.name,
      },
    });

    res.status(200).json({
      success: true,
      message: "Organization chatbot settings updated successfully",
      data: {
        id: org._id,
        isWebsiteChatbotEnabled: org.isWebsiteChatbotEnabled,
        isAdminChatbotEnabled: org.isAdminChatbotEnabled,
        isChatbotBookingEnabled: org.isChatbotBookingEnabled,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/v1/superadmin/organizations/:id/ai-regenerate-settings
 * Enable or disable AI Content Regeneration for a hospital AND cascade to its affiliated doctors.
 */
superadminRouter.patch("/organizations/:id/ai-regenerate-settings", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { isAiRegenerateEnabled } = req.body;
    if (typeof isAiRegenerateEnabled !== "boolean") {
      res.status(400).json({
        success: false,
        error: "isAiRegenerateEnabled must be a boolean",
        code: "INVALID_INPUT",
      });
      return;
    }

    let org: any = null;
    const paramId = String(req.params.id || "");
    if (mongoose.Types.ObjectId.isValid(paramId)) {
      org = await Organization.findById(paramId);
    }
    if (!org) {
      org = await Organization.findOne({ slug: paramId.toLowerCase() });
    }
    if (!org) {
      res.status(404).json({ success: false, error: "Organization not found", code: "NOT_FOUND" });
      return;
    }

    org.isAiRegenerateEnabled = isAiRegenerateEnabled;
    await org.save();

    // Cascade to all affiliated doctors in this hospital so hospital + all doctors toggle together
    await Doctor.updateMany(
      { organizationId: org._id },
      { $set: { isAiRegenerateEnabled } }
    );

    await logAuditEvent({
      userId: req.user!.userId,
      userEmail: req.user!.email,
      userRole: req.user!.role,
      action: "ORGANIZATION_AI_REGENERATE_CHANGED",
      entityType: "Organization",
      entityId: org._id.toString(),
      organizationId: org._id.toString(),
      details: {
        isAiRegenerateEnabled,
        organizationName: org.name,
        cascadedToDoctors: true,
      },
    });

    res.status(200).json({
      success: true,
      message: `AI Content Regeneration ${isAiRegenerateEnabled ? "enabled" : "disabled"} for ${org.name} and its affiliated doctors.`,
      data: {
        id: org._id,
        isAiRegenerateEnabled: org.isAiRegenerateEnabled,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/v1/superadmin/organizations/:id/doctor-onboarding-visibility
 * Hide or unhide a hospital/clinic from the Hospital-Affiliated Doctor onboarding form
 */
superadminRouter.patch("/organizations/:id/doctor-onboarding-visibility", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { isVisibleInDoctorOnboarding } = req.body;
    if (typeof isVisibleInDoctorOnboarding !== "boolean") {
      res.status(400).json({
        success: false,
        error: "isVisibleInDoctorOnboarding must be a boolean",
        code: "INVALID_INPUT",
      });
      return;
    }

    let org: any = null;
    const paramId = String(req.params.id || "");
    if (mongoose.Types.ObjectId.isValid(paramId)) {
      org = await Organization.findById(paramId);
    }
    if (!org) {
      org = await Organization.findOne({ slug: paramId.toLowerCase() });
    }
    if (!org) {
      res.status(404).json({ success: false, error: "Organization not found", code: "NOT_FOUND" });
      return;
    }

    org.isVisibleInDoctorOnboarding = isVisibleInDoctorOnboarding;
    await org.save();

    await logAuditEvent({
      userId: req.user!.userId,
      userEmail: req.user!.email,
      userRole: req.user!.role,
      action: "ORGANIZATION_DOCTOR_ONBOARDING_VISIBILITY_CHANGED",
      entityType: "Organization",
      entityId: org._id.toString(),
      organizationId: org._id.toString(),
      details: {
        isVisibleInDoctorOnboarding: org.isVisibleInDoctorOnboarding,
        organizationName: org.name,
      },
    });

    res.status(200).json({
      success: true,
      message: `Organization ${isVisibleInDoctorOnboarding ? "shown in" : "hidden from"} Hospital Doctor onboarding form.`,
      data: {
        id: org._id,
        isVisibleInDoctorOnboarding: org.isVisibleInDoctorOnboarding,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/v1/superadmin/organizations/:id
 * Content updates are strictly disabled for superadmin
 */
superadminRouter.put("/organizations/:id", async (_req: Request, res: Response) => {
  res.status(403).json({
    success: false,
    error: "Superadmin is restricted from updating practice content. Only practice owners can update their website content.",
    code: "CONTENT_UPDATE_RESTRICTED",
  });
});

/**
 * DELETE /api/v1/superadmin/organizations/:id
 * Permanent deletion of organization and cascading cleanup by superadmin with media purge
 */
superadminRouter.delete("/organizations/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    let org: any = null;
    const paramId = String(req.params.id || "");
    if (mongoose.Types.ObjectId.isValid(paramId)) {
      org = await Organization.findById(paramId);
    }
    if (!org) {
      org = await Organization.findOne({ slug: paramId.toLowerCase() });
    }
    if (!org) {
      res.status(404).json({ success: false, error: "Organization not found", code: "NOT_FOUND" });
      return;
    }

    const orgId = org._id;
    const ownerIds: (mongoose.Types.ObjectId | string)[] = [orgId];
    const additionalPublicIds: string[] = [];

    if (org.logo?.publicId) additionalPublicIds.push(org.logo.publicId);
    if (Array.isArray(org.galleryPhotos)) {
      org.galleryPhotos.forEach((p: any) => {
        if (p?.publicId) additionalPublicIds.push(p.publicId);
      });
    }

    const hospitalDoctors = await Doctor.find({ organizationId: orgId });
    for (const hd of hospitalDoctors) {
      ownerIds.push(hd._id);
      if (hd.doctorPhoto?.publicId) additionalPublicIds.push(hd.doctorPhoto.publicId);
      if (hd.userId) {
        ownerIds.push(hd.userId.toString());
        await User.findByIdAndDelete(hd.userId);
      }
    }

    // Permanently purge all tenant media from Cloudinary, local storage, and DB
    await MediaService.purgeAllTenantMedia(ownerIds, additionalPublicIds);

    // Permanently clean up all affiliated assets
    await Doctor.deleteMany({ organizationId: orgId });
    // Release any custom domains from Vercel Project before deleting DB records
    const orgWebsites = await Website.find({
      $or: [{ organizationId: orgId }, { ownerId: orgId }],
      customDomain: { $exists: true, $nin: [null, ""] },
    });
    for (const w of orgWebsites) {
      await CustomDomainService.removeCustomDomain(w).catch(() => {});
    }

    await User.deleteMany({ organizationId: orgId });
    await Website.deleteMany({ $or: [{ organizationId: orgId }, { ownerId: orgId }] });
    await AIContent.deleteMany({ $or: [{ organizationId: orgId }, { targetId: orgId }] });
    await Review.deleteMany({ organizationId: orgId });
    await Appointment.deleteMany({ organizationId: orgId });
    await ChatbotConversation.deleteMany({
      $or: [
        { organizationId: orgId },
        { "scope.organizationId": orgId },
      ],
    });
    await Organization.findByIdAndDelete(orgId);

    // Increment deleted count in PlatformConfig
    await PlatformConfig.findOneAndUpdate(
      {},
      { $inc: { deletedDoctorsCount: hospitalDoctors.length || 1 } },
      { upsert: true }
    );

    await logAuditEvent({
      userId: req.user!.userId,
      userEmail: req.user!.email,
      userRole: req.user!.role,
      action: "ORGANIZATION_PERMANENTLY_DELETED",
      entityType: "Organization",
      entityId: orgId.toString(),
      organizationId: orgId.toString(),
      details: { organizationName: org.name },
    });

    res.status(200).json({
      success: true,
      message: "Organization and all affiliated doctors, media files, and websites permanently deleted.",
      data: { organizationId: orgId },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/superadmin/doctors
 * Search, filter, and paginate doctors platform-wide
 */
superadminRouter.get("/doctors", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { search, specialization, status, affiliation, page = "1", limit = "20" } = req.query;
    const filter: Record<string, unknown> = {};

    if (search) {
      filter.$or = [
        { doctorName: { $regex: search, $options: "i" } },
        { slug: { $regex: search, $options: "i" } },
        { specialization: { $regex: search, $options: "i" } },
      ];
    }
    if (specialization) filter.specialization = specialization;
    if (status) filter.status = status;
    if (affiliation === "HOSPITAL") filter.organizationId = { $ne: null };
    if (affiliation === "ONLY_DOCTOR") filter.organizationId = null;

    const pageNum = Math.max(1, parseInt(page as string, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string, 10)));
    const skip = (pageNum - 1) * limitNum;

    const [doctors, total] = await Promise.all([
      Doctor.find(filter)
        .populate("organizationId", "name slug")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      Doctor.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      data: {
        doctors,
        total,
        page: pageNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/v1/superadmin/doctors/:id/status
 * Activate or Deactivate doctor with website synchronization
 */
superadminRouter.patch("/doctors/:id/status", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status } = req.body;
    if (!["ACTIVE", "INACTIVE", "SUSPENDED"].includes(status)) {
      res.status(400).json({
        success: false,
        error: "Invalid status. Must be ACTIVE, INACTIVE, or SUSPENDED",
        code: "INVALID_STATUS",
      });
      return;
    }

    let doctor: any = null;
    const paramId = String(req.params.id || "");
    if (mongoose.Types.ObjectId.isValid(paramId)) {
      doctor = await Doctor.findById(paramId);
    }
    if (!doctor) {
      doctor = await Doctor.findOne({ slug: paramId.toLowerCase() });
    }
    if (!doctor) {
      res.status(404).json({ success: false, error: "Doctor not found", code: "NOT_FOUND" });
      return;
    }

    const normalizedDoctorStatus = status === "ACTIVE" ? "ACTIVE" : "INACTIVE";
    const deactivatedByRole = normalizedDoctorStatus === "ACTIVE" ? null : "SUPERADMIN";

    doctor.status = normalizedDoctorStatus;
    doctor.deactivatedByRole = deactivatedByRole;
    await doctor.save();

    await Website.updateMany(
      { doctorId: doctor._id },
      {
        $set: {
          publishStatus: normalizedDoctorStatus === "ACTIVE" ? "PUBLISHED" : "SUSPENDED",
          deactivatedByRole,
        },
      }
    );

    await logAuditEvent({
      userId: req.user!.userId,
      userEmail: req.user!.email,
      userRole: req.user!.role,
      action: "DOCTOR_STATUS_CHANGED",
      entityType: "Doctor",
      entityId: doctor._id.toString(),
      organizationId: doctor.organizationId ? doctor.organizationId.toString() : null,
      doctorId: doctor._id.toString(),
      details: { newStatus: status, doctorName: doctor.doctorName },
    });

    res.status(200).json({
      success: true,
      message: `Doctor status updated to ${status}`,
      data: { doctor },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/v1/superadmin/doctors/:id/chatbot-settings
 * Update website and admin chatbot enable/disable toggles
 */
superadminRouter.patch("/doctors/:id/chatbot-settings", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { isWebsiteChatbotEnabled, isAdminChatbotEnabled, isChatbotBookingEnabled } = req.body;
    let doctor: any = null;
    const paramId = String(req.params.id || "");
    if (mongoose.Types.ObjectId.isValid(paramId)) {
      doctor = await Doctor.findById(paramId);
    }
    if (!doctor) {
      doctor = await Doctor.findOne({ slug: paramId.toLowerCase() });
    }
    if (!doctor) {
      res.status(404).json({ success: false, error: "Doctor not found", code: "NOT_FOUND" });
      return;
    }

    // If affiliated with a hospital, enforce parent hospital OFF inheritance
    if (
      doctor.organizationId &&
      (isWebsiteChatbotEnabled === true ||
        isAdminChatbotEnabled === true ||
        isChatbotBookingEnabled === true)
    ) {
      const parentOrg = await Organization.findById(doctor.organizationId)
        .select("name isWebsiteChatbotEnabled isAdminChatbotEnabled isChatbotBookingEnabled")
        .lean();
      if (parentOrg) {
        if (isWebsiteChatbotEnabled === true && parentOrg.isWebsiteChatbotEnabled === false) {
          res.status(400).json({
            success: false,
            error: `Website AI Chatbot is currently turned OFF for parent hospital (${parentOrg.name}). Enable it on the hospital first.`,
            code: "PARENT_HOSPITAL_CHATBOT_DISABLED",
          });
          return;
        }
        if (isAdminChatbotEnabled === true && parentOrg.isAdminChatbotEnabled === false) {
          res.status(400).json({
            success: false,
            error: `Admin AI Copilot is currently turned OFF for parent hospital (${parentOrg.name}). Enable it on the hospital first.`,
            code: "PARENT_HOSPITAL_CHATBOT_DISABLED",
          });
          return;
        }
        if (isChatbotBookingEnabled === true && parentOrg.isChatbotBookingEnabled === false) {
          res.status(400).json({
            success: false,
            error: `Book Appointment on Chatbot is currently turned OFF for parent hospital (${parentOrg.name}). Enable it on the hospital first.`,
            code: "PARENT_HOSPITAL_CHATBOT_DISABLED",
          });
          return;
        }
      }
    }

    if (typeof isWebsiteChatbotEnabled === "boolean") {
      doctor.isWebsiteChatbotEnabled = isWebsiteChatbotEnabled;
    }
    if (typeof isAdminChatbotEnabled === "boolean") {
      doctor.isAdminChatbotEnabled = isAdminChatbotEnabled;
    }
    if (typeof isChatbotBookingEnabled === "boolean") {
      doctor.isChatbotBookingEnabled = isChatbotBookingEnabled;
    }
    await doctor.save();

    await logAuditEvent({
      userId: req.user!.userId,
      userEmail: req.user!.email,
      userRole: req.user!.role,
      action: "DOCTOR_CHATBOT_SETTINGS_CHANGED",
      entityType: "Doctor",
      entityId: doctor._id.toString(),
      organizationId: doctor.organizationId ? doctor.organizationId.toString() : null,
      doctorId: doctor._id.toString(),
      details: {
        isWebsiteChatbotEnabled: doctor.isWebsiteChatbotEnabled,
        isAdminChatbotEnabled: doctor.isAdminChatbotEnabled,
        isChatbotBookingEnabled: doctor.isChatbotBookingEnabled,
        doctorName: doctor.doctorName,
      },
    });

    res.status(200).json({
      success: true,
      message: "Doctor chatbot settings updated successfully",
      data: {
        id: doctor._id,
        isWebsiteChatbotEnabled: doctor.isWebsiteChatbotEnabled,
        isAdminChatbotEnabled: doctor.isAdminChatbotEnabled,
        isChatbotBookingEnabled: doctor.isChatbotBookingEnabled,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/v1/superadmin/doctors/:id/ai-regenerate-settings
 * Enable or disable AI Content Regeneration for an individual doctor.
 * Enforces parent hospital rule: cannot enable if parent hospital has AI Regeneration OFF.
 */
superadminRouter.patch("/doctors/:id/ai-regenerate-settings", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { isAiRegenerateEnabled } = req.body;
    if (typeof isAiRegenerateEnabled !== "boolean") {
      res.status(400).json({
        success: false,
        error: "isAiRegenerateEnabled must be a boolean",
        code: "INVALID_INPUT",
      });
      return;
    }

    let doctor: any = null;
    const paramId = String(req.params.id || "");
    if (mongoose.Types.ObjectId.isValid(paramId)) {
      doctor = await Doctor.findById(paramId);
    }
    if (!doctor) {
      doctor = await Doctor.findOne({ slug: paramId.toLowerCase() });
    }
    if (!doctor) {
      res.status(404).json({ success: false, error: "Doctor not found", code: "NOT_FOUND" });
      return;
    }

    if (doctor.organizationId && isAiRegenerateEnabled === true) {
      const parentOrg = await Organization.findById(doctor.organizationId)
        .select("name isAiRegenerateEnabled")
        .lean();
      if (parentOrg && parentOrg.isAiRegenerateEnabled !== true) {
        res.status(400).json({
          success: false,
          error: `AI Content Regeneration is currently turned OFF for parent hospital (${parentOrg.name}). Enable it on the hospital first.`,
          code: "PARENT_HOSPITAL_AI_REGENERATE_DISABLED",
        });
        return;
      }
    }

    doctor.isAiRegenerateEnabled = isAiRegenerateEnabled;
    await doctor.save();

    await logAuditEvent({
      userId: req.user!.userId,
      userEmail: req.user!.email,
      userRole: req.user!.role,
      action: "DOCTOR_AI_REGENERATE_CHANGED",
      entityType: "Doctor",
      entityId: doctor._id.toString(),
      organizationId: doctor.organizationId ? doctor.organizationId.toString() : null,
      doctorId: doctor._id.toString(),
      details: {
        isAiRegenerateEnabled,
        doctorName: doctor.doctorName,
      },
    });

    res.status(200).json({
      success: true,
      message: `AI Content Regeneration ${isAiRegenerateEnabled ? "enabled" : "disabled"} for Dr. ${doctor.doctorName}.`,
      data: {
        id: doctor._id,
        isAiRegenerateEnabled: doctor.isAiRegenerateEnabled,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/v1/superadmin/doctors/:id
 * Content updates are strictly disabled for superadmin
 */
superadminRouter.put("/doctors/:id", async (_req: Request, res: Response) => {
  res.status(403).json({
    success: false,
    error: "Superadmin is restricted from updating doctor content. Only clinicians can update their profile content.",
    code: "CONTENT_UPDATE_RESTRICTED",
  });
});

/**
 * DELETE /api/v1/superadmin/doctors/:id
 * Permanent deletion of doctor and associated website by superadmin with media purge
 */
superadminRouter.delete("/doctors/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    let doctor: any = null;
    const paramId = String(req.params.id || "");
    if (mongoose.Types.ObjectId.isValid(paramId)) {
      doctor = await Doctor.findById(paramId);
    }
    if (!doctor) {
      doctor = await Doctor.findOne({ slug: paramId.toLowerCase() });
    }
    if (!doctor) {
      res.status(404).json({ success: false, error: "Doctor not found", code: "NOT_FOUND" });
      return;
    }

    const docId = doctor._id;
    const targetType = doctor.organizationId ? "HOSPITAL_DOCTOR" : "ONLY_DOCTOR";
    const ownerIds: (mongoose.Types.ObjectId | string)[] = [docId];
    const additionalPublicIds: string[] = [];

    if (doctor.doctorPhoto?.publicId) additionalPublicIds.push(doctor.doctorPhoto.publicId);
    if (doctor.clinicLogo?.publicId) additionalPublicIds.push(doctor.clinicLogo.publicId);
    if (Array.isArray(doctor.clinicPhotos)) {
      doctor.clinicPhotos.forEach((p: any) => {
        if (p?.publicId) additionalPublicIds.push(p.publicId);
      });
    }

    // Permanently clean up all doctor accounts
    if (doctor.userId) {
      ownerIds.push(doctor.userId.toString());
      await User.findByIdAndDelete(doctor.userId);
    }
    if (doctor.email) {
      await User.deleteMany({
        email: doctor.email.toLowerCase().trim(),
        role: doctor.organizationId ? UserRole.HOSPITAL_DOCTOR : UserRole.ONLY_DOCTOR,
      });
    }

    // Permanently purge all tenant media from Cloudinary, local storage, and DB
    await MediaService.purgeAllTenantMedia(ownerIds, additionalPublicIds);

    // Release any custom domain from Vercel Project before deleting DB record
    const docWebsites = await Website.find({
      $or: [{ doctorId: docId }, { ownerId: docId }],
      customDomain: { $exists: true, $nin: [null, ""] },
    });
    for (const w of docWebsites) {
      await CustomDomainService.removeCustomDomain(w).catch(() => {});
    }

    await Website.deleteMany({ $or: [{ doctorId: docId }, { ownerId: docId }] });
    await AIContent.deleteMany({ $or: [{ doctorId: docId }, { targetId: docId }, { targetType, targetId: docId }] });
    await Review.deleteMany({ doctorId: docId });
    await Appointment.deleteMany({ doctorId: docId });
    await ChatbotConversation.deleteMany({
      $or: [
        { doctorId: docId },
        { "scope.doctorId": docId },
      ],
    });
    await Doctor.findByIdAndDelete(docId);

    // Increment deleted count in PlatformConfig
    await PlatformConfig.findOneAndUpdate(
      {},
      { $inc: { deletedDoctorsCount: 1 } },
      { upsert: true }
    );

    await logAuditEvent({
      userId: req.user!.userId,
      userEmail: req.user!.email,
      userRole: req.user!.role,
      action: "DOCTOR_PERMANENTLY_DELETED",
      entityType: "Doctor",
      entityId: docId.toString(),
      doctorId: docId.toString(),
      organizationId: doctor.organizationId ? doctor.organizationId.toString() : null,
      details: { doctorName: doctor.doctorName },
    });

    res.status(200).json({
      success: true,
      message: "Doctor, media files, and associated website permanently deleted.",
      data: { doctorId: docId },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/superadmin/websites
 * Platform-wide website directory with publish status controls
 */
superadminRouter.get("/websites", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { search, publishStatus, websiteType, page = "1", limit = "20" } = req.query;
    const filter: Record<string, unknown> = {};

    if (search) {
      filter.slug = { $regex: search, $options: "i" };
    }
    if (publishStatus) filter.publishStatus = publishStatus;
    if (websiteType) filter.websiteType = websiteType;

    const pageNum = Math.max(1, parseInt(page as string, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string, 10)));
    const skip = (pageNum - 1) * limitNum;

    const [websites, total] = await Promise.all([
      Website.find(filter)
        .populate("organizationId", "name slug")
        .populate("doctorId", "doctorName slug")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      Website.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      data: {
        websites,
        total,
        page: pageNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/v1/superadmin/websites/:id/publish-status
 * Toggle website publication status (PUBLISHED / DRAFT)
 */
superadminRouter.patch("/websites/:id/publish-status", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { publishStatus } = req.body;
    const allowedStatuses = ["PUBLISHED", "DRAFT", "GENERATING", "REVIEW", "SUSPENDED"];
    if (!allowedStatuses.includes(publishStatus)) {
      res.status(400).json({
        success: false,
        error: "Invalid publish status. Must be PUBLISHED, DRAFT, GENERATING, REVIEW, or SUSPENDED",
        code: "INVALID_STATUS",
      });
      return;
    }

    const website = await Website.findById(req.params.id);
    if (!website) {
      res.status(404).json({ success: false, error: "Website not found", code: "NOT_FOUND" });
      return;
    }

    const isPublished = publishStatus === "PUBLISHED";
    const deactivatedByRole = isPublished ? null : "SUPERADMIN";

    website.publishStatus = publishStatus;
    website.deactivatedByRole = deactivatedByRole;
    await website.save();

    if (website.doctorId) {
      await Doctor.updateOne(
        { _id: website.doctorId },
        {
          $set: {
            status: isPublished ? "ACTIVE" : "INACTIVE",
            deactivatedByRole,
          },
        }
      ).catch(() => {});
    } else if (website.websiteType === "HOSPITAL_CLINIC" && website.organizationId) {
      await Organization.updateOne(
        { _id: website.organizationId },
        { $set: { status: isPublished ? "ACTIVE" : "INACTIVE" } }
      ).catch(() => {});

      if (!isPublished) {
        await Promise.all([
          Doctor.updateMany(
            { organizationId: website.organizationId },
            { $set: { status: "INACTIVE", deactivatedByRole: "SUPERADMIN" } }
          ),
          Website.updateMany(
            { organizationId: website.organizationId, websiteType: "HOSPITAL_DOCTOR" },
            { $set: { publishStatus: "SUSPENDED", deactivatedByRole: "SUPERADMIN" } }
          ),
        ]).catch(() => {});
      } else {
        const approvedDocs = await Doctor.find({
          organizationId: website.organizationId,
          approvalStatus: { $nin: ["PENDING", "REJECTED"] },
        })
          .select("_id")
          .lean();
        const approvedDocIds = approvedDocs.map((d) => d._id);
        await Promise.all([
          Doctor.updateMany(
            { _id: { $in: approvedDocIds } },
            { $set: { status: "ACTIVE", deactivatedByRole: null } }
          ),
          ...(approvedDocIds.length > 0
            ? [
                Website.updateMany(
                  { doctorId: { $in: approvedDocIds } },
                  { $set: { publishStatus: "PUBLISHED", deactivatedByRole: null } }
                ),
              ]
            : []),
        ]).catch(() => {});
      }
    }

    await logAuditEvent({
      userId: req.user!.userId,
      userEmail: req.user!.email,
      userRole: req.user!.role,
      action: "WEBSITE_PUBLISH_STATUS_CHANGED",
      entityType: "Website",
      entityId: website._id.toString(),
      organizationId: website.organizationId ? website.organizationId.toString() : null,
      doctorId: website.doctorId ? website.doctorId.toString() : null,
      details: { newPublishStatus: publishStatus, slug: website.slug },
    });

    res.status(200).json({
      success: true,
      message: `Website publish status changed to ${publishStatus}`,
      data: { website },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/superadmin/users
 * Search and list users with roles
 */
superadminRouter.get("/users", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { search, role, status, page = "1", limit = "20" } = req.query;
    // Exclude superadmin accounts from general users & accounts list and counts
    const filter: Record<string, unknown> = {
      role: { $ne: UserRole.SUPERADMIN },
    };

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }
    if (role && role !== UserRole.SUPERADMIN) {
      filter.role = role;
    }
    if (status) filter.isActive = status === "ACTIVE";

    const pageNum = Math.max(1, parseInt(page as string, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string, 10)));
    const skip = (pageNum - 1) * limitNum;

    const [users, total] = await Promise.all([
      User.find(filter, "-passwordHash")
        .populate("organizationId", "name slug")
        .populate("doctorProfileId", "doctorName slug")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      User.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      data: {
        users,
        total,
        page: pageNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/v1/superadmin/users/:id/status
 * Activate or Deactivate user account
 */
superadminRouter.patch("/users/:id/status", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status } = req.body;
    if (!["ACTIVE", "INACTIVE", "SUSPENDED"].includes(status)) {
      res.status(400).json({
        success: false,
        error: "Invalid status. Must be ACTIVE, INACTIVE, or SUSPENDED",
        code: "INVALID_STATUS",
      });
      return;
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      res.status(404).json({ success: false, error: "User not found", code: "NOT_FOUND" });
      return;
    }

    // Safety: prevent deactivating own superadmin account
    if (user._id.toString() === req.user!.userId.toString()) {
      res.status(400).json({
        success: false,
        error: "Cannot deactivate your own superadmin account",
        code: "SELF_DEACTIVATION_PROHIBITED",
      });
      return;
    }

    user.isActive = status === "ACTIVE";
    await user.save();

    await logAuditEvent({
      userId: req.user!.userId,
      userEmail: req.user!.email,
      userRole: req.user!.role,
      action: "USER_STATUS_CHANGED",
      entityType: "User",
      entityId: user._id.toString(),
      details: { targetEmail: user.email, newStatus: status, isActive: user.isActive },
    });

    res.status(200).json({
      success: true,
      message: `User status changed to ${status}`,
      data: { userId: user._id, isActive: user.isActive, status },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/superadmin/settings/domain
 * Fetch current platform domain configuration
 */
superadminRouter.get(
  "/settings/domain",
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const config = await PlatformConfigService.getConfig();
      res.status(200).json({
        success: true,
        data: config,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PUT /api/v1/superadmin/settings/domain
 * Update primary platform root domain
 */
superadminRouter.put(
  "/settings/domain",
  async (_req: Request, res: Response) => {
    res.status(400).json({
      success: false,
      error: "Platform domain is permanently locked to doczeno.vercel.app and cannot be modified.",
      code: "DOMAIN_LOCKED",
    });
  }
);

/**
 * GET /api/v1/superadmin/settings/onboarding-categories
 * Fetch current starting page onboarding category toggles
 */
superadminRouter.get(
  "/settings/onboarding-categories",
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const config = await PlatformConfigService.getConfig();
      res.status(200).json({
        success: true,
        data: {
          onboardingCategories: config.onboardingCategories,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PATCH /api/v1/superadmin/settings/onboarding-categories
 * Enable or disable starting page onboarding categories (Only Doctor, Hospital, Hospital-Affiliated Doctor)
 */
superadminRouter.patch(
  "/settings/onboarding-categories",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { portalEnabled, onlyDoctor, hospital, hospitalDoctor } = req.body || {};
      const updated = await PlatformConfigService.updateOnboardingCategories(
        { portalEnabled, onlyDoctor, hospital, hospitalDoctor },
        { userId: req.user?.userId }
      );

      await logAuditEvent({
        userId: req.user!.userId,
        userEmail: req.user!.email,
        userRole: req.user!.role,
        action: "ONBOARDING_CATEGORIES_UPDATED",
        entityType: "PlatformConfig",
        entityId: "platform_config",
        details: updated as unknown as Record<string, unknown>,
      });

      res.status(200).json({
        success: true,
        message: "Onboarding category availability updated successfully",
        data: {
          onboardingCategories: updated,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/superadmin/custom-domains
 * Lists all websites with custom domains + usage against strict 50-domain ceiling.
 */
superadminRouter.get("/custom-domains", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const [websites, usedCount] = await Promise.all([
      Website.find({
        customDomain: { $exists: true, $nin: [null, ""] },
      })
        .populate("organizationId", "name slug type")
        .populate("doctorId", "doctorName slug specialization")
        .sort({ updatedAt: -1 })
        .lean(),
      CustomDomainService.getCustomDomainUsageCount(),
    ]);

    const domains = websites.map((w: any) => {
      const org = w.organizationId;
      const doc = w.doctorId;
      let path = `/${w.slug}`;
      let entityName = w.slug;
      if (w.websiteType === "HOSPITAL_DOCTOR" && org && doc) {
        path = `/${org.slug}/${doc.slug}`;
        entityName = `Dr. ${doc.doctorName} (${org.name})`;
      } else if (w.websiteType === "ONLY_DOCTOR" && doc) {
        path = `/${doc.slug || w.slug}`;
        entityName = `Dr. ${doc.doctorName}`;
      } else if (w.websiteType === "HOSPITAL_CLINIC" && org) {
        path = `/${org.slug || w.slug}`;
        entityName = org.name;
      }

      return {
        websiteId: w._id.toString(),
        websiteType: w.websiteType,
        entityName,
        doczenoPath: path,
        customDomain: w.customDomain,
        customDomainStatus: w.customDomainStatus || "PENDING",
        customDomainRedirect: w.customDomainRedirect !== false,
        customDomainVerifiedAt: w.customDomainVerifiedAt || null,
        customDomainLastCheckedAt: w.customDomainLastCheckedAt || null,
        customDomainLastError: w.customDomainLastError || null,
        dnsInstructions: buildDnsInstructions(w.customDomain, w.customDomainVerification || []),
      };
    });

    res.status(200).json({
      success: true,
      data: {
        usedCount,
        maxLimit: MAX_CUSTOM_DOMAINS,
        vercelConfigured: CustomDomainService.isVercelApiConfigured(),
        domains,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/superadmin/custom-domains
 * Assigns a custom domain to an Organization or Doctor website (strictly capped at 50 total).
 */
superadminRouter.post("/custom-domains", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { targetType, targetId, customDomain, redirectEnabled } = req.body || {};
    if (!targetType || !targetId || !customDomain) {
      res.status(400).json({
        success: false,
        error: "targetType, targetId, and customDomain are required.",
        code: "BAD_REQUEST",
      });
      return;
    }

    let website: any = null;
    if (targetType === "ORGANIZATION") {
      website = await Website.findOne({ organizationId: targetId, websiteType: "HOSPITAL_CLINIC" });
    } else if (targetType === "DOCTOR") {
      website = await Website.findOne({ doctorId: targetId });
    } else {
      res.status(400).json({ success: false, error: "Invalid targetType", code: "BAD_REQUEST" });
      return;
    }

    if (!website) {
      res.status(404).json({
        success: false,
        error: "Website record not found for the selected entity.",
        code: "WEBSITE_NOT_FOUND",
      });
      return;
    }

    const result = await CustomDomainService.assignCustomDomain({
      website,
      rawDomain: String(customDomain),
      redirectEnabled: typeof redirectEnabled === "boolean" ? redirectEnabled : true,
    });

    await logAuditEvent({
      userId: req.user!.userId,
      userEmail: req.user!.email,
      userRole: req.user!.role,
      action: "CUSTOM_DOMAIN_ASSIGNED",
      entityType: "Website",
      entityId: website._id.toString(),
      organizationId: website.organizationId ? website.organizationId.toString() : null,
      doctorId: website.doctorId ? website.doctorId.toString() : null,
      details: {
        customDomain: result.website.customDomain,
        status: result.website.customDomainStatus,
        vercelAttached: result.vercelAttached,
      },
    });

    const usedCount = await CustomDomainService.getCustomDomainUsageCount();

    res.status(200).json({
      success: true,
      message: result.vercelMessage || "Custom domain configured successfully!",
      data: {
        websiteId: result.website._id.toString(),
        customDomain: result.website.customDomain,
        customDomainStatus: result.website.customDomainStatus,
        customDomainRedirect: result.website.customDomainRedirect !== false,
        dnsInstructions: result.dnsInstructions,
        vercelAttached: result.vercelAttached,
        usedCount,
        maxLimit: MAX_CUSTOM_DOMAINS,
      },
    });
  } catch (error: any) {
    if (error?.status === 400 || error?.message) {
      res.status(error?.status || 400).json({
        success: false,
        error: error.message,
        code: error.code || "CUSTOM_DOMAIN_ERROR",
      });
      return;
    }
    next(error);
  }
});

/**
 * POST /api/v1/superadmin/custom-domains/:websiteId/verify
 * Triggers live DNS & Vercel SSL verification for a configured custom domain.
 */
superadminRouter.post("/custom-domains/:websiteId/verify", async (req: Request, res: Response) => {
  try {
    const website = await Website.findById(req.params.websiteId);
    if (!website || !website.customDomain) {
      res.status(404).json({ success: false, error: "Custom domain configuration not found", code: "NOT_FOUND" });
      return;
    }

    const result = await CustomDomainService.verifyCustomDomain(website);

    await logAuditEvent({
      userId: req.user!.userId,
      userEmail: req.user!.email,
      userRole: req.user!.role,
      action: "CUSTOM_DOMAIN_VERIFIED",
      entityType: "Website",
      entityId: website._id.toString(),
      details: { customDomain: website.customDomain, verified: result.verified },
    });

    res.status(200).json({
      success: true,
      message: result.message,
      data: result,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error?.message || "Failed to verify custom domain",
      code: "VERIFICATION_FAILED",
    });
  }
});

/**
 * PATCH /api/v1/superadmin/custom-domains/:websiteId
 * Updates redirect toggle for an existing custom domain.
 */
superadminRouter.patch("/custom-domains/:websiteId", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { customDomainRedirect } = req.body || {};
    const website = await Website.findById(req.params.websiteId);
    if (!website || !website.customDomain) {
      res.status(404).json({ success: false, error: "Custom domain configuration not found", code: "NOT_FOUND" });
      return;
    }

    if (typeof customDomainRedirect === "boolean") {
      website.customDomainRedirect = customDomainRedirect;
      await website.save();
    }

    res.status(200).json({
      success: true,
      message: `Redirect from doczeno slug ${website.customDomainRedirect ? "enabled" : "disabled"}.`,
      data: {
        websiteId: website._id.toString(),
        customDomainRedirect: website.customDomainRedirect !== false,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/v1/superadmin/custom-domains/:websiteId
 * Removes a custom domain from Vercel Project & MongoDB, freeing 1 of 50 slots.
 */
superadminRouter.delete("/custom-domains/:websiteId", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const website = await Website.findById(req.params.websiteId);
    if (!website) {
      res.status(404).json({ success: false, error: "Website not found", code: "NOT_FOUND" });
      return;
    }

    const removedDomain = website.customDomain;
    await CustomDomainService.removeCustomDomain(website);

    await logAuditEvent({
      userId: req.user!.userId,
      userEmail: req.user!.email,
      userRole: req.user!.role,
      action: "CUSTOM_DOMAIN_REMOVED",
      entityType: "Website",
      entityId: website._id.toString(),
      details: { removedDomain },
    });

    const usedCount = await CustomDomainService.getCustomDomainUsageCount();

    res.status(200).json({
      success: true,
      message: `Custom domain ${removedDomain || ""} disconnected and removed.`,
      data: { usedCount, maxLimit: MAX_CUSTOM_DOMAINS },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/superadmin/custom-domains/health-check
 * Manually triggers the lightweight sequential DNS health check across all VERIFIED custom domains.
 */
superadminRouter.post("/custom-domains/health-check", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const summary = await CustomDomainService.runDailyHealthCheck({ forceAll: true });

    await logAuditEvent({
      userId: req.user!.userId,
      userEmail: req.user!.email,
      userRole: req.user!.role,
      action: "CUSTOM_DOMAIN_HEALTH_CHECK",
      entityType: "Website",
      entityId: "bulk_custom_domains",
      details: summary as unknown as Record<string, unknown>,
    });

    res.status(200).json({
      success: true,
      message:
        summary.skippedReason ||
        `Checked ${summary.checked} verified domain(s): ${summary.healthy} healthy, ${summary.disabled} auto-disabled.`,
      data: summary,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/superadmin/gemini-analytics
 * Aggregated analytics and observability for Gemini API
 */
superadminRouter.get(
  "/gemini-analytics",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { range, feature, model, status, organizationId, doctorId } = req.query;
      const analytics = await GeminiLoggerService.getAnalytics({
        range: range as any,
        feature: feature as string,
        model: model as string,
        status: status as string,
        organizationId: organizationId as string,
        doctorId: doctorId as string,
      });

      res.status(200).json({
        success: true,
        data: analytics,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/superadmin/gemini-logs
 * Paginated request logs with filters and diagnostics
 */
superadminRouter.get(
  "/gemini-logs",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const {
        page = "1",
        limit = "20",
        feature,
        status,
        model,
        errorCode,
        search,
        range,
      } = req.query;

      const result = await GeminiLoggerService.getLogs({
        page: parseInt(page as string, 10),
        limit: parseInt(limit as string, 10),
        feature: feature as string,
        status: status as string,
        model: model as string,
        errorCode: errorCode as string,
        search: search as string,
        range: range as any,
      });

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/superadmin/export-website/:slug
 * Streams a complete standalone static website package (.zip) for any doctor or hospital practice
 */
superadminRouter.get(
  "/export-website/:slug",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const slug = String(req.params.slug || "");
      const doctorSlug = req.query.doctorSlug as string | undefined;

      const { archive, fileName } = await StaticExportService.generateStaticSiteZip({
        slug,
        doctorSlug,
      });

      res.setHeader("Content-Type", "application/zip");
      res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);

      archive.on("error", () => {
        if (!res.headersSent) {
          res.status(500).json({ success: false, error: "Failed to generate static archive" });
        }
      });

      archive.pipe(res);
      await archive.finalize();
    } catch (error) {
      next(error);
    }
  }
);

