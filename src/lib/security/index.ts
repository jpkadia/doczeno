import { UserRole, TenantSession } from "@/types";

export class AuthorizationError extends Error {
  constructor(message = "Unauthorized access attempt") {
    super(message);
    this.name = "AuthorizationError";
  }
}

/**
 * Validates that the active session has platform-wide superadmin privileges
 */
export function requireSuperadmin(session: TenantSession | null | undefined): void {
  if (!session || session.role !== UserRole.SUPERADMIN) {
    throw new AuthorizationError("Action requires SUPERADMIN privilege");
  }
}

/**
 * Validates hospital administration rights for a target organization
 */
export function requireHospitalAdmin(
  session: TenantSession | null | undefined,
  targetOrganizationId: string
): void {
  if (!session) {
    throw new AuthorizationError("Authentication required");
  }

  if (session.role === UserRole.SUPERADMIN) {
    return; // Superadmin has platform-wide authority
  }

  if (
    session.role === UserRole.HOSPITAL_ADMIN &&
    session.organizationId === targetOrganizationId
  ) {
    return;
  }

  throw new AuthorizationError("Forbidden: You cannot manage this hospital organization");
}

/**
 * Validates doctor record access for a specific doctor profile
 */
export function requireDoctorAccess(
  session: TenantSession | null | undefined,
  targetDoctorProfileId: string,
  targetOrganizationId?: string
): void {
  if (!session) {
    throw new AuthorizationError("Authentication required");
  }

  if (session.role === UserRole.SUPERADMIN) {
    return;
  }

  // Hospital admin can manage doctors belonging to their hospital
  if (
    session.role === UserRole.HOSPITAL_ADMIN &&
    targetOrganizationId &&
    session.organizationId === targetOrganizationId
  ) {
    return;
  }

  // Doctor can only modify their own profile
  if (
    (session.role === UserRole.HOSPITAL_DOCTOR ||
      session.role === UserRole.INDEPENDENT_DOCTOR) &&
    session.doctorProfileId === targetDoctorProfileId
  ) {
    return;
  }

  throw new AuthorizationError("Forbidden: Unauthorized doctor record access");
}
