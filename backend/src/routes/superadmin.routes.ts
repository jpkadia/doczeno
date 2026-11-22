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
      totalUsers,
      totalAppointments,
      pendingAppointments,
      platformConfig,
    ] = await Promise.all([
      Organization.countDocuments(),
      Doctor.countDocuments(),
      Website.countDocuments(),
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

    org.status = status;
    await org.save();

    // Cascading effect: when deactivating or suspending hospital, cascade update affiliated doctors
    if (status !== "ACTIVE") {
      await Doctor.updateMany({ organizationId: org._id }, { $set: { status: "INACTIVE" } });
    } else {
      // Re-activating hospital: allow affiliated records to be active
      await Doctor.updateMany({ organizationId: org._id }, { $set: { status: "ACTIVE" } });
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

    doctor.status = status;
    await doctor.save();

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

    website.publishStatus = publishStatus;
    await website.save();

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

