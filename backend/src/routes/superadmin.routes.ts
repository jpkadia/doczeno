import { Router, Request, Response, NextFunction } from "express";
import { Organization, Doctor, Website, User, Appointment } from "@/models";
import { requireAuthenticatedUser } from "@/middleware/auth";
import { requireRole } from "@/middleware/rbac";
import { UserRole } from "@/types";
import { logAuditEvent } from "@/services/audit.service";

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
    ] = await Promise.all([
      Organization.countDocuments(),
      Doctor.countDocuments(),
      Website.countDocuments(),
      User.countDocuments(),
      Appointment.countDocuments(),
      Appointment.countDocuments({ status: "PENDING" }),
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

    const org = await Organization.findById(req.params.id);
    if (!org) {
      res.status(404).json({ success: false, error: "Organization not found", code: "NOT_FOUND" });
      return;
    }

    org.status = status;
    await org.save();

    // Cascading effect: when deactivating or suspending hospital, cascade update affiliated doctors and websites
    if (status !== "ACTIVE") {
      await Doctor.updateMany({ organizationId: org._id }, { $set: { status: "INACTIVE" } });
      await Website.updateMany(
        { organizationId: org._id },
        { $set: { publishStatus: "DRAFT" } }
      );
    } else {
      // Re-activating hospital: allow affiliated records to be active
      await Doctor.updateMany({ organizationId: org._id }, { $set: { status: "ACTIVE" } });
      await Website.updateMany(
        { organizationId: org._id },
        { $set: { publishStatus: "PUBLISHED" } }
      );
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
 * DELETE /api/v1/superadmin/organizations/:id
 * Safe delete / soft-delete flow with dependency validation
 */
superadminRouter.delete("/organizations/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const org = await Organization.findById(req.params.id);
    if (!org) {
      res.status(404).json({ success: false, error: "Organization not found", code: "NOT_FOUND" });
      return;
    }

    // Dependency check: count pending appointments
    const pendingAppointmentsCount = await Appointment.countDocuments({
      organizationId: org._id,
      status: "PENDING",
    });

    if (pendingAppointmentsCount > 0) {
      res.status(409).json({
        success: false,
        error: `Cannot safely delete organization: ${pendingAppointmentsCount} pending appointment(s) exist. Please resolve appointments or deactivate first.`,
        code: "ACTIVE_DEPENDENCIES_EXIST",
        details: { pendingAppointmentsCount },
      });
      return;
    }

    // Soft delete strategy (prefer safe deactivation over destructive orphan creation)
    org.status = "INACTIVE";
    await org.save();

    // Cascade to affiliated entities
    await Doctor.updateMany({ organizationId: org._id }, { $set: { status: "INACTIVE" } });
    await Website.updateMany({ organizationId: org._id }, { $set: { publishStatus: "DRAFT" } });

    await logAuditEvent({
      userId: req.user!.userId,
      userEmail: req.user!.email,
      userRole: req.user!.role,
      action: "ORGANIZATION_SOFT_DELETED",
      entityType: "Organization",
      entityId: org._id.toString(),
      organizationId: org._id.toString(),
      details: { organizationName: org.name },
    });

    res.status(200).json({
      success: true,
      message: "Organization safely deactivated and all affiliated websites unpublished.",
      data: { organizationId: org._id },
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
    if (affiliation === "INDEPENDENT") filter.organizationId = null;

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

    const doctor = await Doctor.findById(req.params.id);
    if (!doctor) {
      res.status(404).json({ success: false, error: "Doctor not found", code: "NOT_FOUND" });
      return;
    }

    doctor.status = status;
    await doctor.save();

    // Sync website publish status
    const newPublishStatus = status === "ACTIVE" ? "PUBLISHED" : "DRAFT";
    await Website.updateMany({ doctorId: doctor._id }, { $set: { publishStatus: newPublishStatus } });

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
    const filter: Record<string, unknown> = {};

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }
    if (role) filter.role = role;
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
