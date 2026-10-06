import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { createApp } from "@/app";
import { UserRole } from "@/types";
import { Organization, Doctor, Website, User, Appointment } from "@/models";

vi.mock("@/db/connection", () => ({
  connectToDatabase: vi.fn().mockResolvedValue({
    connection: { readyState: 1 },
  }),
  checkDatabaseHealth: vi.fn().mockResolvedValue(true),
  disconnectDatabase: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/services/audit.service", () => ({
  logAuditEvent: vi.fn().mockResolvedValue(undefined),
}));

const AUTH_SECRET = "doczeno-secure-default-auth-secret-key-32chars";

function generateTestToken(payload: {
  userId: string;
  email: string;
  role: UserRole;
  organizationId?: string | null;
  doctorProfileId?: string | null;
}): string {
  return jwt.sign(payload, AUTH_SECRET, { expiresIn: "1h" });
}

describe("Admin Panels, CRUD, Doctor Management & Appointment System (Supertest)", () => {
  const app = createApp();

  const superadminId = new mongoose.Types.ObjectId().toString();
  const hospitalAdminId = new mongoose.Types.ObjectId().toString();
  const hospitalId = new mongoose.Types.ObjectId().toString();
  const foreignHospitalId = new mongoose.Types.ObjectId().toString();
  const hospitalDoctorId = new mongoose.Types.ObjectId().toString();
  const otherDoctorId = new mongoose.Types.ObjectId().toString();

  const superadminToken = generateTestToken({
    userId: superadminId,
    email: "superadmin@doczeno.com",
    role: UserRole.SUPERADMIN,
  });

  const apolloAdminToken = generateTestToken({
    userId: hospitalAdminId,
    email: "admin@apollo.com",
    role: UserRole.HOSPITAL_ADMIN,
    organizationId: hospitalId,
  });

  const hospitalDoctorToken = generateTestToken({
    userId: "u-hosp-doc",
    email: "dr.rajiv@apollo.com",
    role: UserRole.HOSPITAL_DOCTOR,
    doctorProfileId: hospitalDoctorId,
    organizationId: hospitalId,
  });

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("Superadmin Platform Management & Safe Cascading Deletion", () => {
    it("GET /api/v1/superadmin/stats returns platform aggregation metrics", async () => {
      vi.spyOn(Organization, "countDocuments").mockResolvedValue(15 as any);
      vi.spyOn(Doctor, "countDocuments").mockResolvedValue(48 as any);
      vi.spyOn(Website, "countDocuments").mockResolvedValue(45 as any);
      vi.spyOn(User, "countDocuments").mockResolvedValue(60 as any);
      vi.spyOn(Appointment, "countDocuments")
        .mockResolvedValueOnce(350 as any) // Total appointments
        .mockResolvedValueOnce(42 as any); // Pending appointments

      const res = await request(app)
        .get("/api/v1/superadmin/stats")
        .set("Authorization", `Bearer ${superadminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.totalOrganizations).toBe(15);
      expect(res.body.data.totalDoctors).toBe(48);
      expect(res.body.data.totalWebsites).toBe(45);
      expect(res.body.data.totalUsers).toBe(60);
      expect(res.body.data.totalAppointments).toBe(350);
      expect(res.body.data.pendingAppointments).toBe(42);
    });

    it("PATCH /api/v1/superadmin/organizations/:id/status deactivates hospital and cascades to doctors and websites", async () => {
      const mockOrg = {
        _id: hospitalId,
        name: "Apollo Hospitals",
        status: "ACTIVE",
        save: vi.fn().mockResolvedValue(true),
      };
      vi.spyOn(Organization, "findById").mockResolvedValue(mockOrg as any);
      const doctorUpdateSpy = vi.spyOn(Doctor, "updateMany").mockResolvedValue({} as any);
      const websiteUpdateSpy = vi.spyOn(Website, "updateMany").mockResolvedValue({} as any);

      const res = await request(app)
        .patch(`/api/v1/superadmin/organizations/${hospitalId}/status`)
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({ status: "INACTIVE" });

      expect(res.status).toBe(200);
      expect(mockOrg.status).toBe("INACTIVE");
      expect(mockOrg.save).toHaveBeenCalled();
      // Verifies cascade deactivation
      expect(doctorUpdateSpy).toHaveBeenCalledWith(
        { organizationId: hospitalId },
        { $set: { status: "INACTIVE" } }
      );
      // Verifies cascade unpublishing of websites to DRAFT
      expect(websiteUpdateSpy).toHaveBeenCalledWith(
        { organizationId: hospitalId },
        { $set: { publishStatus: "DRAFT" } }
      );
    });

    it("DELETE /api/v1/superadmin/organizations/:id blocks deletion if active pending appointments exist", async () => {
      const mockOrg = {
        _id: hospitalId,
        name: "Apollo Hospitals",
        status: "ACTIVE",
      };
      vi.spyOn(Organization, "findById").mockResolvedValue(mockOrg as any);
      // Pending appointments exist!
      vi.spyOn(Appointment, "countDocuments").mockResolvedValue(3 as any);

      const res = await request(app)
        .delete(`/api/v1/superadmin/organizations/${hospitalId}`)
        .set("Authorization", `Bearer ${superadminToken}`);

      expect(res.status).toBe(409);
      expect(res.body.code).toBe("ACTIVE_DEPENDENCIES_EXIST");
      expect(res.body.details.pendingAppointmentsCount).toBe(3);
    });

    it("DELETE /api/v1/superadmin/organizations/:id performs safe deactivation when no dependencies block", async () => {
      const mockOrg = {
        _id: hospitalId,
        name: "Apollo Hospitals",
        status: "ACTIVE",
        save: vi.fn().mockResolvedValue(true),
      };
      vi.spyOn(Organization, "findById").mockResolvedValue(mockOrg as any);
      vi.spyOn(Appointment, "countDocuments").mockResolvedValue(0 as any);
      vi.spyOn(Doctor, "updateMany").mockResolvedValue({} as any);
      vi.spyOn(Website, "updateMany").mockResolvedValue({} as any);

      const res = await request(app)
        .delete(`/api/v1/superadmin/organizations/${hospitalId}`)
        .set("Authorization", `Bearer ${superadminToken}`);

      expect(res.status).toBe(200);
      expect(mockOrg.status).toBe("INACTIVE");
    });
  });

  describe("Hospital Admin Doctor Management & Tenant Boundaries", () => {
    it("POST /api/v1/doctors creates doctor under own hospital and initializes website", async () => {
      const newDocId = new mongoose.Types.ObjectId();
      const mockCreatedDoc = {
        _id: newDocId,
        doctorName: "Dr. Alok Verma",
        slug: "dr-alok-verma",
        specialization: "Pediatrics",
        organizationId: hospitalId,
      };
      vi.spyOn(Doctor, "create").mockResolvedValue(mockCreatedDoc as any);
      vi.spyOn(Organization, "findById").mockResolvedValue({
        _id: hospitalId,
        slug: "apollo",
        selectedTheme: "vital-compact",
      } as any);
      const websiteCreateSpy = vi.spyOn(Website, "create").mockResolvedValue({} as any);

      const res = await request(app)
        .post("/api/v1/doctors")
        .set("Authorization", `Bearer ${apolloAdminToken}`)
        .send({
          doctorName: "Dr. Alok Verma",
          slug: "dr-alok-verma",
          gender: "MALE",
          degree: "MD Pediatrics",
          specialization: "Pediatrics",
          yearsOfExperience: 8,
          organizationId: hospitalId,
          whatsApp: "+919876543210",
          email: "dr.alok@apollo.com",
          consultationHours: "10:00 - 16:00",
          weeklyOff: "Sunday",
          appointmentRequired: true,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(websiteCreateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          slug: "apollo-dr-alok-verma",
          websiteType: "HOSPITAL_DOCTOR",
          templateId: "vital-compact",
          publishStatus: "PUBLISHED",
        })
      );
    });

    it("POST /api/v1/doctors rejects if Hospital Admin attempts to create doctor in a foreign hospital", async () => {
      const res = await request(app)
        .post("/api/v1/doctors")
        .set("Authorization", `Bearer ${apolloAdminToken}`)
        .send({
          doctorName: "Dr. Malicious Injection",
          slug: "dr-malicious",
          gender: "MALE",
          degree: "MD",
          specialization: "Cardiology",
          yearsOfExperience: 5,
          organizationId: foreignHospitalId, // Different hospital!
          whatsApp: "+919876543210",
          email: "bad@doctor.com",
          consultationHours: "10:00 - 16:00",
          weeklyOff: "Sunday",
          appointmentRequired: true,
        });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("ORGANIZATION_MISMATCH");
    });

    it("PATCH /api/v1/doctors/:id/status deactivates doctor in own hospital", async () => {
      const mockDoc = {
        _id: hospitalDoctorId,
        organizationId: hospitalId, // Belongs to Apollo
        doctorName: "Dr. Rajiv Shah",
        status: "ACTIVE",
        save: vi.fn().mockResolvedValue(true),
      };
      vi.spyOn(Doctor, "findById").mockResolvedValue(mockDoc as any);
      vi.spyOn(Website, "updateMany").mockResolvedValue({} as any);

      const res = await request(app)
        .patch(`/api/v1/doctors/${hospitalDoctorId}/status`)
        .set("Authorization", `Bearer ${apolloAdminToken}`)
        .send({ status: "INACTIVE" });

      expect(res.status).toBe(200);
      expect(mockDoc.status).toBe("INACTIVE");
      expect(mockDoc.save).toHaveBeenCalled();
    });

    it("PATCH /api/v1/doctors/:id/status rejects modification of doctor belonging to another hospital", async () => {
      const mockForeignDoc = {
        _id: otherDoctorId,
        organizationId: foreignHospitalId, // Belongs to Manipal, NOT Apollo!
        doctorName: "Dr. Foreign Specialist",
        status: "ACTIVE",
      };
      vi.spyOn(Doctor, "findById").mockResolvedValue(mockForeignDoc as any);

      const res = await request(app)
        .patch(`/api/v1/doctors/${otherDoctorId}/status`)
        .set("Authorization", `Bearer ${apolloAdminToken}`)
        .send({ status: "INACTIVE" });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("DOCTOR_ACCESS_DENIED");
    });
  });

  describe("Hospital Doctor Inherited Data Restrictions & Locked State", () => {
    it("GET /api/v1/doctors/me returns doctor profile with inherited hospital locked data", async () => {
      const mockDoc = {
        _id: hospitalDoctorId,
        organizationId: hospitalId,
        doctorName: "Rajiv Shah",
        specialization: "Cardiology",
        degree: "MBBS, DM",
        yearsOfExperience: 14,
        status: "ACTIVE",
      };
      const mockParentHospital = {
        _id: hospitalId,
        name: "Apollo Hospital International",
        slug: "apollo",
        type: "HOSPITAL",
        address: { city: "Ahmedabad", state: "Gujarat", pincode: "382428" },
        logo: { url: "https://res.cloudinary.com/doczeno/apollo-logo.png" },
        galleryPhotos: [{ url: "https://res.cloudinary.com/doczeno/icu.jpg" }],
        selectedTheme: "vital-compact",
        faviconUrl: "https://res.cloudinary.com/doczeno/fav.ico",
        browserTabTitle: "Apollo Hospitals Ahmedabad",
      };

      vi.spyOn(Doctor, "findById").mockResolvedValue(mockDoc as any);
      vi.spyOn(Organization, "findById").mockResolvedValue(mockParentHospital as any);
      vi.spyOn(Website, "findOne").mockResolvedValue({
        slug: "apollo-dr-rajiv-shah",
        publishStatus: "PUBLISHED",
      } as any);

      const res = await request(app)
        .get("/api/v1/doctors/me")
        .set("Authorization", `Bearer ${hospitalDoctorToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const data = res.body.data;
      expect(data.doctor.doctorName).toBe("Rajiv Shah");
      expect(data.inheritedHospitalData).toBeDefined();
      expect(data.inheritedHospitalData.isLocked).toBe(true);
      expect(data.inheritedHospitalData.lockMessage).toBe("Managed by Hospital Admin");
      expect(data.inheritedHospitalData.organizationName).toBe("Apollo Hospital International");
      expect(data.inheritedHospitalData.selectedTheme).toBe("vital-compact");
    });

    it("PUT /api/v1/doctors/:id allows hospital doctor to update personal bio and experience", async () => {
      const mockDoc = {
        _id: hospitalDoctorId,
        organizationId: hospitalId,
        doctorName: "Rajiv Shah",
        bio: "Updated clinical profile and cardiological research highlights.",
        yearsOfExperience: 15,
      };
      vi.spyOn(Doctor, "findById").mockResolvedValue(mockDoc as any);
      vi.spyOn(Doctor, "findByIdAndUpdate").mockResolvedValue({
        ...mockDoc,
        bio: "Updated clinical profile and cardiological research highlights.",
        yearsOfExperience: 15,
      } as any);

      const res = await request(app)
        .put(`/api/v1/doctors/${hospitalDoctorId}`)
        .set("Authorization", `Bearer ${hospitalDoctorToken}`)
        .send({
          bio: "Updated clinical profile and cardiological research highlights.",
          yearsOfExperience: 15,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("PUT /api/v1/doctors/:id STRICTLY REJECTS mutation when hospital doctor attempts to change hospital theme, address, or logo", async () => {
      const mockDoc = {
        _id: hospitalDoctorId,
        organizationId: hospitalId,
      };
      vi.spyOn(Doctor, "findById").mockResolvedValue(mockDoc as any);

      const res = await request(app)
        .put(`/api/v1/doctors/${hospitalDoctorId}`)
        .set("Authorization", `Bearer ${hospitalDoctorToken}`)
        .send({
          bio: "New bio",
          selectedTheme: "modern-minimal", // FORBIDDEN: Hospital-controlled!
          address: { city: "Hacked City" }, // FORBIDDEN: Hospital-controlled!
          logo: { url: "https://evil.com/fake.png" }, // FORBIDDEN!
        });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("INHERITED_FIELD_MUTATION_FORBIDDEN");
      expect(res.body.violations).toContain("selectedTheme");
      expect(res.body.violations).toContain("address");
      expect(res.body.violations).toContain("logo");
    });
  });

  describe("Appointment System Multi-Tenant Scoping & Lifecycle", () => {
    it("POST /api/v1/appointments allows patient to book appointment publicly", async () => {
      const mockAppt = {
        _id: new mongoose.Types.ObjectId(),
        patientName: "Meera Joshi",
        patientPhone: "+919876500000",
        appointmentDate: new Date("2026-10-15"),
        timeSlot: "10:00 - 11:00",
        status: "PENDING",
      };
      vi.spyOn(Appointment, "create").mockResolvedValue(mockAppt as any);

      const res = await request(app)
        .post("/api/v1/appointments")
        .send({
          doctorId: hospitalDoctorId,
          organizationId: hospitalId,
          patientName: "Meera Joshi",
          patientPhone: "+919876500000",
          appointmentDate: "2026-10-15T00:00:00.000Z",
          timeSlot: "10:00 - 11:00",
          notes: "Routine cardiac evaluation",
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.appointment.patientName).toBe("Meera Joshi");
    });

    it("GET /api/v1/appointments scopes to own doctor when accessed by Hospital Doctor", async () => {
      const mockFind = vi.fn().mockReturnValue({
        populate: vi.fn().mockReturnThis(),
        sort: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([
          { patientName: "Patient A", doctorId: hospitalDoctorId, status: "PENDING" },
        ]),
      });
      vi.spyOn(Appointment, "find").mockImplementation(mockFind as any);
      vi.spyOn(Appointment, "countDocuments").mockResolvedValue(1 as any);

      const res = await request(app)
        .get("/api/v1/appointments")
        .set("Authorization", `Bearer ${hospitalDoctorToken}`);

      expect(res.status).toBe(200);
      // Strictly enforced doctorId in filter!
      expect(mockFind).toHaveBeenCalledWith(
        expect.objectContaining({
          doctorId: hospitalDoctorId,
        })
      );
    });

    it("PATCH /api/v1/appointments/:id/status updates status and logs audit event", async () => {
      const apptId = new mongoose.Types.ObjectId().toString();
      const mockAppt = {
        _id: apptId,
        doctorId: hospitalDoctorId, // Matches current doctor
        patientName: "Patient A",
        status: "PENDING",
        save: vi.fn().mockResolvedValue(true),
      };
      vi.spyOn(Appointment, "findById").mockResolvedValue(mockAppt as any);

      const res = await request(app)
        .patch(`/api/v1/appointments/${apptId}/status`)
        .set("Authorization", `Bearer ${hospitalDoctorToken}`)
        .send({ status: "CONFIRMED" });

      expect(res.status).toBe(200);
      expect(mockAppt.status).toBe("CONFIRMED");
      expect(mockAppt.save).toHaveBeenCalled();
    });

    it("PATCH /api/v1/appointments/:id/status rejects doctor attempting to modify another doctor's appointment", async () => {
      const apptId = new mongoose.Types.ObjectId().toString();
      const mockOtherDoctorAppt = {
        _id: apptId,
        doctorId: otherDoctorId, // Belongs to a different doctor!
        patientName: "Patient X",
        status: "PENDING",
      };
      vi.spyOn(Appointment, "findById").mockResolvedValue(mockOtherDoctorAppt as any);

      const res = await request(app)
        .patch(`/api/v1/appointments/${apptId}/status`)
        .set("Authorization", `Bearer ${hospitalDoctorToken}`)
        .send({ status: "CONFIRMED" });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("FORBIDDEN");
    });
  });
});
