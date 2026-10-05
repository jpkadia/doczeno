import { Request, Response, NextFunction } from "express";
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
 * Independent Doctor: only their own profile.
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

  const targetDoctorId = req.params.doctorId || req.params.id || req.body.doctorId;
  if (!targetDoctorId) {
    res.status(400).json({ success: false, error: "Target doctor ID is required", code: "BAD_REQUEST" });
    return;
  }

  // Doctor accessing their own profile
  if (
    (user.role === UserRole.HOSPITAL_DOCTOR || user.role === UserRole.INDEPENDENT_DOCTOR) &&
    user.doctorProfileId &&
    user.doctorProfileId.toString() === targetDoctorId.toString()
  ) {
    return next();
  }

  // Hospital Admin accessing a doctor in their hospital
  if (user.role === UserRole.HOSPITAL_ADMIN && user.organizationId) {
    try {
      const doctor = await Doctor.findById(targetDoctorId);
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

  const targetWebsiteId = req.params.websiteId || req.params.id;
  if (!targetWebsiteId) {
    res.status(400).json({ success: false, error: "Website ID is required", code: "BAD_REQUEST" });
    return;
  }

  const website = await Website.findById(targetWebsiteId);
  if (!website) {
    res.status(404).json({ success: false, error: "Website not found", code: "NOT_FOUND" });
    return;
  }

  // Hospital admin can manage websites belonging to their organization
  if (
    user.role === UserRole.HOSPITAL_ADMIN &&
    user.organizationId &&
    website.organizationId &&
    website.organizationId.toString() === user.organizationId.toString()
  ) {
    return next();
  }

  // Doctor can manage their own website
  if (
    (user.role === UserRole.HOSPITAL_DOCTOR || user.role === UserRole.INDEPENDENT_DOCTOR) &&
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
