import { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import { UserRole } from "@/types";
import { Doctor, Website } from "@/models";

export function requireRole(allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: "Authentication required",
        code: "UNAUTHORIZED",
      });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        error: `Forbidden: Action requires one of [${allowedRoles.join(", ")}] roles`,
        code: "FORBIDDEN_ROLE",
      });
      return;
    }

    next();
  };
}

/**
 * Validates that the authenticated user has permission to manage the target organization.
 * Superadmin: platform-wide access.
 * Hospital Admin: only their assigned organizationId.
 * Other roles: forbidden.
 */
export async function requireOrganizationAccess(
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

  const targetOrgId = req.params.organizationId || req.params.id || req.body.organizationId;
  if (!targetOrgId) {
    res.status(400).json({ success: false, error: "Target organization ID is required", code: "BAD_REQUEST" });
    return;
  }

  if (
    user.role === UserRole.HOSPITAL_ADMIN &&
    user.organizationId &&
    user.organizationId.toString() === targetOrgId.toString()
  ) {
    return next();
  }

  res.status(403).json({
    success: false,
    error: "Forbidden: You do not have permission to manage this organization",
    code: "TENANT_ACCESS_DENIED",
  });
}

/**
 * Validates that the authenticated user has permission to view or mutate the target doctor.
 * Superadmin: all doctors.
 * Hospital Admin: only doctors belonging to their hospital.
 * Only Doctor: only their own profile.
 * Hospital Doctor: only their own profile.
 */
export async function requireDoctorAccess(
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

  const rawDoctorId = req.params.doctorId || req.params.id || req.body?.doctorId;
  const targetDoctorId = String(rawDoctorId || "");
  if (!targetDoctorId) {
    res.status(400).json({ success: false, error: "Target doctor ID is required", code: "BAD_REQUEST" });
    return;
  }

  // Doctor accessing their own profile
  if (
    (user.role === UserRole.HOSPITAL_DOCTOR || user.role === UserRole.ONLY_DOCTOR) &&
    user.doctorProfileId &&
    user.doctorProfileId.toString() === targetDoctorId.toString()
  ) {
    return next();
  }

  // Hospital Admin accessing a doctor in their hospital
  if (user.role === UserRole.HOSPITAL_ADMIN && user.organizationId) {
    try {
      let doctor: any = null;
      if (mongoose.Types.ObjectId.isValid(targetDoctorId)) {
        doctor = await Doctor.findById(targetDoctorId);
      }
      if (!doctor) {
        doctor = await Doctor.findOne({ slug: String(targetDoctorId).toLowerCase() });
      }
      if (
        doctor &&
        doctor.organizationId &&
        doctor.organizationId.toString() === user.organizationId.toString()
      ) {
        return next();
      }
    } catch {
      // Continue to forbidden response
    }
  }

  res.status(403).json({
    success: false,
    error: "Forbidden: You do not have permission to access or modify this doctor profile",
    code: "DOCTOR_ACCESS_DENIED",
  });
}

/**
 * Strictly prevents Hospital Doctors from mutating hospital-controlled fields.
 */
export function preventHospitalDoctorInheritedFieldMutation(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const user = req.user;
  if (!user || user.role !== UserRole.HOSPITAL_DOCTOR) {
    return next();
  }

  const forbiddenFields = [
    "hospitalName",
    "organizationName",
    "logo",
    "galleryPhotos",
    "gallery",
    "address",
    "city",
    "state",
    "pincode",
    "theme",
    "selectedTheme",
    "favicon",
    "faviconUrl",
    "tabTitle",
    "browserTabTitle",
    "organizationId",
  ];

  const attemptedKeys = Object.keys(req.body);
  const violations = attemptedKeys.filter((key) => forbiddenFields.includes(key));

  if (violations.length > 0) {
    res.status(403).json({
      success: false,
      error: `Forbidden: Hospital doctors cannot modify hospital-owned fields: ${violations.join(", ")}`,
      code: "INHERITED_FIELD_MUTATION_FORBIDDEN",
      violations,
    });
    return;
  }

  next();
}

/**
 * Validates website access permissions based on ownership.
 */
export async function requireWebsiteAccess(
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

  const rawWebsiteId = req.params.websiteId || req.params.id;
  const targetWebsiteId = String(rawWebsiteId || "");
  if (!targetWebsiteId) {
    res.status(400).json({ success: false, error: "Website ID is required", code: "BAD_REQUEST" });
    return;
  }

  let website: any = null;
  if (mongoose.Types.ObjectId.isValid(targetWebsiteId)) {
    website = await Website.findById(targetWebsiteId);
  }
  if (!website) {
    website = await Website.findOne({ slug: String(targetWebsiteId).toLowerCase() });
  }

  if (!website) {
    res.status(404).json({ success: false, error: "Website not found", code: "NOT_FOUND" });
    return;
  }

  // Hospital admin can manage websites belonging to their organization (hospital or hospital doctors)
  if (
    user.role === UserRole.HOSPITAL_ADMIN &&
    user.organizationId
  ) {
    if (website.organizationId && website.organizationId.toString() === user.organizationId.toString()) {
      return next();
    }
    if (website.doctorId) {
      const doc = await Doctor.findOne({ _id: website.doctorId, organizationId: user.organizationId });
      if (doc) return next();
    }
  }

  // Doctor can manage their own website
  if (
    (user.role === UserRole.HOSPITAL_DOCTOR || user.role === UserRole.ONLY_DOCTOR) &&
    user.doctorProfileId &&
    website.doctorId &&
    website.doctorId.toString() === user.doctorProfileId.toString()
  ) {
    return next();
  }

  res.status(403).json({
    success: false,
    error: "Forbidden: You do not have permission to manage this website",
    code: "WEBSITE_ACCESS_DENIED",
  });
}
