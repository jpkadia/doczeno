import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { createApp } from "@/app";
import { Organization, Doctor, Website, User } from "@/models";
import { UserRole } from "@/types";
import { AuthService } from "@/services/auth.service";

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

describe("Onboarding Wizard & Server Validation API (Supertest)", () => {
  const app = createApp();

  const validSchedule = [
    {
      day: "Monday",
      isClosed: false,
      slots: [{ startTime: "09:00", endTime: "13:00" }, { startTime: "17:00", endTime: "20:00" }],
    },
    {
      day: "Tuesday",
      isClosed: false,
      slots: [{ startTime: "09:00", endTime: "13:00" }],
    },
    {
      day: "Sunday",
      isClosed: true,
      slots: [],
    },
  ];

  const validAddress = {
    street: "123 Clinic Road",
    state: "Maharashtra",
    city: "Mumbai",
    pincode: "400001",
    country: "India",
  };

  const samplePhoto = {
    url: "https://res.cloudinary.com/doczeno/image/upload/sample.jpg",
    publicId: "sample_doc",
    mimeType: "image/jpeg",
    sizeBytes: 1048576,
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("Form A: Independent Doctor Onboarding (POST /api/v1/onboarding/independent-doctor)", () => {
    it("successfully creates independent doctor, normalizes 'Dr.' prefix, and publishes website", async () => {
      vi.spyOn(Website, "findOne").mockResolvedValue(null);

      const mockDoctor = {
        _id: "doc-101",
        doctorName: "Sanjay Gupta",
        specialization: "Cardiology",
        degree: "MBBS, MD",
        yearsOfExperience: 12,
        whatsApp: "+919876543210",
        email: "dr.sanjay@example.com",
        slug: "dr-sanjay-gupta",
        websiteId: null as any,
        save: vi.fn().mockResolvedValue(true),
      };
      vi.spyOn(Doctor, "create").mockResolvedValue(mockDoctor as any);

      const mockWebsite = {
        _id: "web-101",
        slug: "dr-sanjay-gupta",
        templateId: "clinical-editorial",
        publishStatus: "PUBLISHED",
      };
      vi.spyOn(Website, "create").mockResolvedValue(mockWebsite as any);

      const payload = {
        doctorName: "Dr. Sanjay Gupta", // Input with prefix
        gender: "MALE",
        degree: "MBBS, MD",
        specialization: "Cardiology",
        yearsOfExperience: 12,
        whatsApp: "+919876543210",
        email: "dr.sanjay@example.com",
        consultationHours: validSchedule,
        weeklyOff: ["Sunday"],
        appointmentRequired: true,
        clinicName: "Gupta Heart Care",
        address: validAddress,
        selectedTheme: "clinical-editorial",
        doctorPhoto: samplePhoto,
        isDraft: false,
      };

      const res = await request(app)
        .post("/api/v1/onboarding/independent-doctor")
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(Doctor.create).toHaveBeenCalledWith(
        expect.objectContaining({
          doctorName: "Sanjay Gupta", // Stripped "Dr." prefix
          specialization: "Cardiology",
          organizationId: null, // Autonomous
        })
      );
      expect(Website.create).toHaveBeenCalledWith(
        expect.objectContaining({
          slug: "dr-sanjay-gupta",
          templateId: "clinical-editorial",
        })
      );
      expect(res.body.data.publicUrl).toBe("doctorwebsite.in/dr-sanjay-gupta");
    });

    it("rejects invalid email address with structured validation error", async () => {
      const payload = {
        doctorName: "Dr. Meera Rao",
        gender: "FEMALE",
        degree: "BDS, MDS",
        specialization: "Dentistry",
        yearsOfExperience: 8,
        whatsApp: "+919876543210",
        email: "invalid-email-format", // Invalid
        consultationHours: validSchedule,
        weeklyOff: ["Sunday"],
        clinicName: "Smile Dental",
        address: validAddress,
        selectedTheme: "modern-minimal",
        doctorPhoto: samplePhoto,
      };

      const res = await request(app)
        .post("/api/v1/onboarding/independent-doctor")
        .send(payload);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe("VALIDATION_ERROR");
      expect(res.body.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: "email" }),
        ])
      );
    });

    it("rejects invalid WhatsApp phone number format", async () => {
      const payload = {
        doctorName: "Dr. Meera Rao",
        gender: "FEMALE",
        degree: "BDS, MDS",
        specialization: "Dentistry",
        yearsOfExperience: 8,
        whatsApp: "12345", // Too short / invalid phone
        email: "meera@dental.com",
        consultationHours: validSchedule,
        weeklyOff: ["Sunday"],
        clinicName: "Smile Dental",
        address: validAddress,
        selectedTheme: "modern-minimal",
        doctorPhoto: samplePhoto,
      };

      const res = await request(app)
        .post("/api/v1/onboarding/independent-doctor")
        .send(payload);

      expect(res.status).toBe(400);
      expect(res.body.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: "whatsApp" }),
        ])
      );
    });

    it("rejects invalid Indian pincode (e.g. 123 or 000000)", async () => {
      const payload = {
        doctorName: "Dr. Meera Rao",
        gender: "FEMALE",
        degree: "BDS, MDS",
        specialization: "Dentistry",
        yearsOfExperience: 8,
        whatsApp: "+919876543210",
        email: "meera@dental.com",
        consultationHours: validSchedule,
        weeklyOff: ["Sunday"],
        clinicName: "Smile Dental",
        address: {
          ...validAddress,
          pincode: "000000", // Invalid Indian pincode (cannot start with 0)
        },
        selectedTheme: "modern-minimal",
        doctorPhoto: samplePhoto,
      };

      const res = await request(app)
        .post("/api/v1/onboarding/independent-doctor")
        .send(payload);

      expect(res.status).toBe(400);
      expect(res.body.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: "address.pincode" }),
        ])
      );
    });

    it("rejects invalid state-city combination (Mumbai does not belong to Gujarat)", async () => {
      const payload = {
        doctorName: "Dr. Meera Rao",
        gender: "FEMALE",
        degree: "BDS, MDS",
        specialization: "Dentistry",
        yearsOfExperience: 8,
        whatsApp: "+919876543210",
        email: "meera@dental.com",
        consultationHours: validSchedule,
        weeklyOff: ["Sunday"],
        clinicName: "Smile Dental",
        address: {
          street: "Station Road",
          state: "Gujarat",
          city: "Mumbai", // Incompatible! Mumbai is in Maharashtra
          pincode: "380001",
          country: "India",
        },
        selectedTheme: "modern-minimal",
        doctorPhoto: samplePhoto,
      };

      const res = await request(app)
        .post("/api/v1/onboarding/independent-doctor")
        .send(payload);

      expect(res.status).toBe(400);
      expect(res.body.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: "address.city" }),
        ])
      );
    });

    it("rejects negative years of experience", async () => {
      const payload = {
        doctorName: "Dr. Meera Rao",
        gender: "FEMALE",
        degree: "BDS, MDS",
        specialization: "Dentistry",
        yearsOfExperience: -5, // Invalid negative
        whatsApp: "+919876543210",
        email: "meera@dental.com",
        consultationHours: validSchedule,
        weeklyOff: ["Sunday"],
        clinicName: "Smile Dental",
        address: validAddress,
        selectedTheme: "modern-minimal",
        doctorPhoto: samplePhoto,
      };

      const res = await request(app)
        .post("/api/v1/onboarding/independent-doctor")
        .send(payload);

      expect(res.status).toBe(400);
      expect(res.body.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: "yearsOfExperience" }),
        ])
      );
    });

    it("rejects consultation hours where start time is equal or after end time", async () => {
      const invalidSchedule = [
        {
          day: "Monday",
          isClosed: false,
          slots: [{ startTime: "18:00", endTime: "09:00" }], // End time earlier than start time
        },
      ];

      const payload = {
        doctorName: "Dr. Meera Rao",
        gender: "FEMALE",
        degree: "BDS, MDS",
        specialization: "Dentistry",
        yearsOfExperience: 5,
        whatsApp: "+919876543210",
        email: "meera@dental.com",
        consultationHours: invalidSchedule,
        weeklyOff: ["Sunday"],
        clinicName: "Smile Dental",
        address: validAddress,
        selectedTheme: "modern-minimal",
        doctorPhoto: samplePhoto,
      };

      const res = await request(app)
        .post("/api/v1/onboarding/independent-doctor")
        .send(payload);

      expect(res.status).toBe(400);
      expect(res.body.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            message: "Slot start time must be earlier than end time",
          }),
        ])
      );
    });

    it("rejects reserved custom slugs (e.g. 'admin', 'api')", async () => {
      const payload = {
        doctorName: "Dr. Meera Rao",
        gender: "FEMALE",
        degree: "BDS, MDS",
        specialization: "Dentistry",
        yearsOfExperience: 5,
        whatsApp: "+919876543210",
        email: "meera@dental.com",
        consultationHours: validSchedule,
        weeklyOff: ["Sunday"],
        clinicName: "Smile Dental",
        address: validAddress,
        selectedTheme: "modern-minimal",
        doctorPhoto: samplePhoto,
        customSlug: "admin", // Reserved!
      };

      const res = await request(app)
        .post("/api/v1/onboarding/independent-doctor")
        .send(payload);

      expect(res.status).toBe(400);
      expect(res.body.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: "customSlug" }),
        ])
      );
    });
  });

  describe("Form B: Hospital / Clinic Onboarding (POST /api/v1/onboarding/hospital)", () => {
    it("successfully creates hospital organization, admin user, and website", async () => {
      vi.spyOn(Organization, "findOne").mockResolvedValue(null);

      const mockOrg = {
        _id: "org-201",
        name: "Metro Multispeciality Hospital",
        slug: "metro-hospital",
        type: "HOSPITAL",
      };
      vi.spyOn(Organization, "create").mockResolvedValue(mockOrg as any);

      const mockAdmin = {
        _id: "usr-admin-201",
        email: "admin@metrohospital.com",
        name: "Hospital Admin",
        role: UserRole.HOSPITAL_ADMIN,
        organizationId: "org-201",
      };
      vi.spyOn(User, "create").mockResolvedValue(mockAdmin as any);

      const mockWebsite = {
        _id: "web-org-201",
        slug: "metro-hospital",
        templateId: "vital-compact",
        publishStatus: "PUBLISHED",
      };
      vi.spyOn(Website, "create").mockResolvedValue(mockWebsite as any);

      const payload = {
        hospitalName: "Metro Multispeciality Hospital",
        type: "HOSPITAL",
        slug: "metro-hospital",
        about: "Leading healthcare hospital providing world-class tertiary care facilities.",
        phone: "+912224567890",
        whatsApp: "+919876500000",
        email: "contact@metrohospital.com",
        address: validAddress,
        workingHours: validSchedule,
        weeklyOff: ["Sunday"],
        appointmentRequired: true,
        logo: samplePhoto,
        galleryPhotos: [samplePhoto],
        selectedTheme: "vital-compact",
        adminName: "Hospital Admin",
        adminEmail: "admin@metrohospital.com",
        adminPassword: "SecureHospitalPassword123!",
        confirmPassword: "SecureHospitalPassword123!",
        isDraft: false,
      };

      const res = await request(app)
        .post("/api/v1/onboarding/hospital")
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.organization.slug).toBe("metro-hospital");
      expect(res.body.data.adminUser.role).toBe(UserRole.HOSPITAL_ADMIN);
      expect(res.body.data.token).toBeDefined();
    });

    it("rejects hospital registration if slug is already taken (409 Conflict)", async () => {
      vi.spyOn(Organization, "findOne").mockResolvedValue({
        _id: "existing-org",
        slug: "apollo-mumbai",
      } as any);

      const payload = {
        hospitalName: "Apollo Hospitals Mumbai",
        type: "HOSPITAL",
        slug: "apollo-mumbai",
        about: "Premier health center offering comprehensive healthcare services.",
        phone: "+912224567890",
        whatsApp: "+919876500000",
        email: "contact@apollo-mumbai.com",
        address: validAddress,
        workingHours: validSchedule,
        weeklyOff: ["Sunday"],
        appointmentRequired: true,
        logo: samplePhoto,
        galleryPhotos: [],
        selectedTheme: "vital-compact",
        adminName: "Admin User",
        adminEmail: "admin@apollo.com",
        adminPassword: "StrongPassword123!",
        confirmPassword: "StrongPassword123!",
      };

      const res = await request(app)
        .post("/api/v1/onboarding/hospital")
        .send(payload);

      expect(res.status).toBe(409);
      expect(res.body.code).toBe("SLUG_ALREADY_EXISTS");
    });

    it("rejects hospital registration when passwords do not match", async () => {
      const payload = {
        hospitalName: "City Clinic",
        type: "CLINIC",
        slug: "city-clinic-mumbai",
        about: "Family health clinic offering primary consultation and diagnostics.",
        phone: "+912224567890",
        whatsApp: "+919876500000",
        email: "info@cityclinic.com",
        address: validAddress,
        workingHours: validSchedule,
        weeklyOff: ["Sunday"],
        appointmentRequired: true,
        logo: samplePhoto,
        galleryPhotos: [],
        selectedTheme: "modern-minimal",
        adminName: "Clinic Admin",
        adminEmail: "admin@cityclinic.com",
        adminPassword: "Password123!",
        confirmPassword: "DifferentPassword456!", // Mismatch!
      };

      const res = await request(app)
        .post("/api/v1/onboarding/hospital")
        .send(payload);

      expect(res.status).toBe(400);
      expect(res.body.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: "confirmPassword",
            message: "Passwords do not match",
          }),
        ])
      );
    });

    it("rejects more than 6 hospital gallery photos", async () => {
      const sevenPhotos = Array(7).fill(samplePhoto);

      const payload = {
        hospitalName: "City Clinic",
        type: "CLINIC",
        slug: "city-clinic-gallery",
        about: "Family health clinic offering primary consultation and diagnostics.",
        phone: "+912224567890",
        whatsApp: "+919876500000",
        email: "info@cityclinic.com",
        address: validAddress,
        workingHours: validSchedule,
        weeklyOff: ["Sunday"],
        appointmentRequired: true,
        logo: samplePhoto,
        galleryPhotos: sevenPhotos, // Exceeds max 6!
        selectedTheme: "modern-minimal",
        adminName: "Clinic Admin",
        adminEmail: "admin@cityclinic.com",
        adminPassword: "Password123!",
        confirmPassword: "Password123!",
      };

      const res = await request(app)
        .post("/api/v1/onboarding/hospital")
        .send(payload);

      expect(res.status).toBe(400);
      expect(res.body.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: "galleryPhotos" }),
        ])
      );
    });
  });

  describe("Form C: Hospital Doctor Onboarding (POST /api/v1/onboarding/hospital-doctor)", () => {
    it("successfully registers affiliated doctor with verified hospital and runtime theme inheritance", async () => {
      const mockParentHospital = {
        _id: "org-apollo",
        name: "Apollo Hospital",
        slug: "apollo-hospital",
        status: "ACTIVE",
        selectedTheme: "vital-compact",
        address: { city: "Mumbai" },
      };
      vi.spyOn(Organization, "findById").mockResolvedValue(mockParentHospital as any);

      const mockDoctor = {
        _id: "doc-child-301",
        doctorName: "Ananya Deshmukh",
        specialization: "Neurology",
        organizationId: "org-apollo",
        websiteId: null as any,
        save: vi.fn().mockResolvedValue(true),
      };
      vi.spyOn(Doctor, "create").mockResolvedValue(mockDoctor as any);

      const mockWebsite = {
        _id: "web-child-301",
        slug: "apollo-hospital-dr-ananya-deshmukh",
        templateId: "vital-compact", // Inherited
      };
      vi.spyOn(Website, "create").mockResolvedValue(mockWebsite as any);

      const payload = {
        organizationId: "org-apollo",
        doctorName: "Dr. Ananya Deshmukh",
        gender: "FEMALE",
        degree: "MBBS, DM Neurology",
        specialization: "Neurology",
        yearsOfExperience: 10,
        whatsApp: "+919876511111",
        email: "dr.ananya@apollo.com",
        consultationHours: validSchedule,
        weeklyOff: ["Sunday"],
        appointmentRequired: true,
        doctorPhoto: samplePhoto,
        isDraft: false,
      };

      const res = await request(app)
        .post("/api/v1/onboarding/hospital-doctor")
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(Doctor.create).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: "org-apollo",
          doctorName: "Ananya Deshmukh", // Normalized name
        })
      );
      // Doctor document must NOT duplicate hospital address, logo, gallery
      const doctorCreateArg = (Doctor.create as any).mock.calls[0][0];
      expect(doctorCreateArg.address).toBeUndefined();
      expect(doctorCreateArg.logo).toBeUndefined();
      expect(doctorCreateArg.galleryPhotos).toBeUndefined();

      // Child website gets parent's theme
      expect(Website.create).toHaveBeenCalledWith(
        expect.objectContaining({
          templateId: "vital-compact",
        })
      );
    });

    it("rejects doctor registration if selected hospital organization does not exist", async () => {
      vi.spyOn(Organization, "findById").mockResolvedValue(null);

      const payload = {
        organizationId: "non-existent-org-id",
        doctorName: "Dr. Ananya Deshmukh",
        gender: "FEMALE",
        degree: "MBBS, DM Neurology",
        specialization: "Neurology",
        yearsOfExperience: 10,
        whatsApp: "+919876511111",
        email: "dr.ananya@apollo.com",
        consultationHours: validSchedule,
        weeklyOff: ["Sunday"],
        appointmentRequired: true,
        doctorPhoto: samplePhoto,
      };

      const res = await request(app)
        .post("/api/v1/onboarding/hospital-doctor")
        .send(payload);

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("INVALID_ORGANIZATION_ID");
    });

    it("rejects doctor registration if hospital is inactive/suspended", async () => {
      vi.spyOn(Organization, "findById").mockResolvedValue({
        _id: "org-suspended",
        name: "Suspended Clinic",
        status: "SUSPENDED", // Inactive!
      } as any);

      const payload = {
        organizationId: "org-suspended",
        doctorName: "Dr. Ananya Deshmukh",
        gender: "FEMALE",
        degree: "MBBS, DM Neurology",
        specialization: "Neurology",
        yearsOfExperience: 10,
        whatsApp: "+919876511111",
        email: "dr.ananya@apollo.com",
        consultationHours: validSchedule,
        weeklyOff: ["Sunday"],
        appointmentRequired: true,
        doctorPhoto: samplePhoto,
      };

      const res = await request(app)
        .post("/api/v1/onboarding/hospital-doctor")
        .send(payload);

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("INVALID_ORGANIZATION_ID");
    });

    it("rejects cross-tenant organization assignment when authenticated hospital admin targets foreign hospital", async () => {
      const mockParentHospital = {
        _id: "org-target-hospital",
        status: "ACTIVE",
        slug: "target-hospital",
        selectedTheme: "modern-minimal",
        address: { city: "Delhi" },
      };
      vi.spyOn(Organization, "findById").mockResolvedValue(mockParentHospital as any);

      // Hospital Admin of org-own-hospital tries to register to org-target-hospital
      const foreignAdminToken = AuthService.generateToken({
        _id: "admin-foreign",
        name: "Foreign Admin",
        email: "admin@ownhospital.com",
        role: UserRole.HOSPITAL_ADMIN,
        organizationId: "org-own-hospital",
      } as any);

      const payload = {
        organizationId: "org-target-hospital", // Mismatch with admin's org-own-hospital
        doctorName: "Dr. Vikram Singh",
        gender: "MALE",
        degree: "MBBS, MS Orthopedics",
        specialization: "Orthopedics & Joint Replacement",
        yearsOfExperience: 15,
        whatsApp: "+919876522222",
        email: "dr.vikram@target.com",
        consultationHours: validSchedule,
        weeklyOff: ["Sunday"],
        appointmentRequired: true,
        doctorPhoto: samplePhoto,
      };

      const res = await request(app)
        .post("/api/v1/onboarding/hospital-doctor")
        .set("Authorization", `Bearer ${foreignAdminToken}`)
        .send(payload);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("CROSS_TENANT_ORGANIZATION_ASSIGNMENT");
    });
  });

  describe("GET /api/v1/onboarding/eligible-hospitals", () => {
    it("returns list of only active hospital organizations", async () => {
      const mockHospitals = [
        {
          _id: "org-1",
          name: "Apollo Hospital",
          slug: "apollo",
          type: "HOSPITAL",
        },
        {
          _id: "org-2",
          name: "Care Clinic",
          slug: "care-clinic",
          type: "CLINIC",
        },
      ];

      const findQuery = {
        sort: vi.fn().mockResolvedValue(mockHospitals),
      };
      vi.spyOn(Organization, "find").mockReturnValue(findQuery as any);

      const res = await request(app).get("/api/v1/onboarding/eligible-hospitals");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Organization.find).toHaveBeenCalledWith(
        { status: "ACTIVE" },
        expect.any(String)
      );
      expect(res.body.data.hospitals).toHaveLength(2);
    });
  });
});
