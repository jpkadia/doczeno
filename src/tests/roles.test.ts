import { describe, it, expect } from "vitest";
import {
  requireSuperadmin,
  requireHospitalAdmin,
  requireDoctorAccess,
  AuthorizationError,
} from "@/lib/security";
import { UserRole, TenantSession } from "@/types";

describe("Tenant & Role Authorization Guards", () => {
  const superadminSession: TenantSession = {
    userId: "sa-1",
    email: "superadmin@doczeno.com",
    role: UserRole.SUPERADMIN,
  };

  const hospitalAdminSession: TenantSession = {
    userId: "ha-1",
    email: "admin@apollo.com",
    role: UserRole.HOSPITAL_ADMIN,
    organizationId: "org-apollo",
  };

  const hospitalDoctorSession: TenantSession = {
    userId: "hd-1",
    email: "dr.rajiv@apollo.com",
    role: UserRole.HOSPITAL_DOCTOR,
    organizationId: "org-apollo",
    doctorProfileId: "doc-rajiv",
  };

  const independentDoctorSession: TenantSession = {
    userId: "ind-1",
    email: "dr.parth@clinic.com",
    role: UserRole.INDEPENDENT_DOCTOR,
    doctorProfileId: "doc-parth",
  };

  describe("requireSuperadmin", () => {
    it("allows SUPERADMIN session", () => {
      expect(() => requireSuperadmin(superadminSession)).not.toThrow();
    });

    it("rejects non-superadmin sessions", () => {
      expect(() => requireSuperadmin(hospitalAdminSession)).toThrow(AuthorizationError);
      expect(() => requireSuperadmin(independentDoctorSession)).toThrow(AuthorizationError);
      expect(() => requireSuperadmin(null)).toThrow(AuthorizationError);
    });
  });

  describe("requireHospitalAdmin", () => {
    it("allows superadmin to manage any hospital", () => {
      expect(() => requireHospitalAdmin(superadminSession, "org-apollo")).not.toThrow();
      expect(() => requireHospitalAdmin(superadminSession, "org-max")).not.toThrow();
    });

    it("allows hospital admin to manage their own hospital", () => {
      expect(() => requireHospitalAdmin(hospitalAdminSession, "org-apollo")).not.toThrow();
    });

    it("rejects hospital admin attempting to manage a different hospital", () => {
      expect(() => requireHospitalAdmin(hospitalAdminSession, "org-other-hospital")).toThrow(
        AuthorizationError
      );
    });

    it("rejects hospital doctors from managing hospital wide data", () => {
      expect(() => requireHospitalAdmin(hospitalDoctorSession, "org-apollo")).toThrow(
        AuthorizationError
      );
    });
  });

  describe("requireDoctorAccess", () => {
    it("allows independent doctor to modify only their own record", () => {
      expect(() =>
        requireDoctorAccess(independentDoctorSession, "doc-parth")
      ).not.toThrow();

      expect(() =>
        requireDoctorAccess(independentDoctorSession, "doc-other")
      ).toThrow(AuthorizationError);
    });

    it("allows hospital doctor to modify only their own record", () => {
      expect(() =>
        requireDoctorAccess(hospitalDoctorSession, "doc-rajiv", "org-apollo")
      ).not.toThrow();

      expect(() =>
        requireDoctorAccess(hospitalDoctorSession, "doc-other-doctor", "org-apollo")
      ).toThrow(AuthorizationError);
    });

    it("allows hospital admin to modify doctors within their organization", () => {
      expect(() =>
        requireDoctorAccess(hospitalAdminSession, "doc-rajiv", "org-apollo")
      ).not.toThrow();

      expect(() =>
        requireDoctorAccess(hospitalAdminSession, "doc-rajiv", "org-other-hospital")
      ).toThrow(AuthorizationError);
    });
  });
});
