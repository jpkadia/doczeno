import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import mongoose from "mongoose";
import { createApp } from "@/app";
import { WebsiteType } from "@/types";
import { Organization, Doctor, Website } from "@/models";

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

describe("Public Website Rendering Engine & Runtime Inheritance API (Supertest)", () => {
  const app = createApp();

  const orgId = new mongoose.Types.ObjectId();
  const docId = new mongoose.Types.ObjectId();

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("Single-Slug Public Website Resolution (GET /api/v1/websites/effective/:slug)", () => {
    it("resolves published independent doctor website with clinic data, hours, and custom theme", async () => {
      vi.spyOn(Website, "findOne").mockResolvedValue({
        _id: new mongoose.Types.ObjectId(),
        slug: "dr-parth-kadiya",
        websiteType: WebsiteType.INDEPENDENT_DOCTOR,
        ownerType: "DOCTOR",
        ownerId: docId,
        doctorId: docId,
        templateId: "clinical-editorial",
        publishStatus: "PUBLISHED",
        seoMetadata: {
          title: "Dr. Parth Kadiya — Interventional Cardiology",
          description: "Consult Dr. Parth Kadiya (MD, DM) for cardiology care.",
        },
      } as any);

      vi.spyOn(Doctor, "findById").mockResolvedValue({
        _id: docId,
        doctorName: "Parth Kadiya",
        gender: "MALE",
        degree: "MBBS, MD, DM Cardiology",
        specialization: "Cardiology",
        yearsOfExperience: 11,
        whatsApp: "+919876543210",
        email: "dr.parth@heartclinic.in",
        consultationHours: JSON.stringify([
          { day: "Monday", slots: [{ startTime: "09:00", endTime: "13:00" }] },
        ]),
        weeklyOff: "Sunday",
        appointmentRequired: true,
        clinicName: "Kadiya Heart Institute",
        address: {
          street: "Ring Road",
          city: "Ahmedabad",
          state: "Gujarat",
          pincode: "380015",
          country: "India",
        },
        clinicLogo: { url: "https://res.cloudinary.com/doczeno/kadiya-logo.png" },
        doctorPhoto: { url: "https://res.cloudinary.com/doczeno/dr-parth.jpg" },
        clinicPhotos: [{ url: "https://res.cloudinary.com/doczeno/clinic-opd.jpg" }],
        slug: "dr-parth-kadiya",
        status: "ACTIVE",
      } as any);

      const res = await request(app).get("/api/v1/websites/effective/dr-parth-kadiya");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const data = res.body.data;
      expect(data.websiteType).toBe(WebsiteType.INDEPENDENT_DOCTOR);
      expect(data.doctorName).toBe("Parth Kadiya");
      expect(data.specialization).toBe("Cardiology");
      expect(data.organizationName).toBe("Kadiya Heart Institute");
      expect(data.selectedTheme).toBe("clinical-editorial");
      expect(data.address.city).toBe("Ahmedabad");
      expect(data.address.pincode).toBe("380015");
      expect(data.logo.url).toBe("https://res.cloudinary.com/doczeno/kadiya-logo.png");
      expect(data.doctorPhoto.url).toBe("https://res.cloudinary.com/doczeno/dr-parth.jpg");
      expect(data.galleryPhotos).toHaveLength(1);
      expect(data.isHospitalChild).toBe(false);
      expect(data.browserTabTitle).toBe("Dr. Parth Kadiya — Interventional Cardiology");
    });

    it("resolves published hospital website with doctor directory and departments", async () => {
      vi.spyOn(Website, "findOne").mockResolvedValue({
        _id: new mongoose.Types.ObjectId(),
        slug: "apollo-hospital",
        websiteType: WebsiteType.HOSPITAL_CLINIC,
        ownerType: "ORGANIZATION",
        ownerId: orgId,
        organizationId: orgId,
        templateId: "vital-compact",
        publishStatus: "PUBLISHED",
      } as any);

      vi.spyOn(Organization, "findById").mockResolvedValue({
        _id: orgId,
        name: "Apollo Hospital International",
        type: "HOSPITAL",
        slug: "apollo-hospital",
        about: "Leading multi-specialty tertiary care hospital.",
        phone: "+912224567890",
        whatsApp: "+919876500000",
        email: "info@apollo.com",
        address: {
          city: "Mumbai",
          state: "Maharashtra",
          pincode: "400001",
          country: "India",
        },
        workingHours: JSON.stringify([
          { day: "Monday", slots: [{ startTime: "08:00", endTime: "20:00" }] },
        ]),
        selectedTheme: "vital-compact",
        browserTabTitle: "Apollo Hospitals — Compassion & Excellence",
        logo: { url: "https://res.cloudinary.com/doczeno/apollo-logo.png" },
        galleryPhotos: [{ url: "https://res.cloudinary.com/doczeno/hospital-exterior.jpg" }],
        status: "ACTIVE",
      } as any);

      const mockDoctors = [
        {
          _id: new mongoose.Types.ObjectId(),
          doctorName: "Rajiv Shah",
          degree: "MD, DM",
          specialization: "Cardiology",
          yearsOfExperience: 15,
          slug: "dr-rajiv-shah",
          doctorPhoto: { url: "https://res.cloudinary.com/doczeno/dr-rajiv.jpg" },
        },
        {
          _id: new mongoose.Types.ObjectId(),
          doctorName: "Sunita Menon",
          degree: "MS, MCh",
          specialization: "Neurosurgery",
          yearsOfExperience: 18,
          slug: "dr-sunita-menon",
          doctorPhoto: { url: "https://res.cloudinary.com/doczeno/dr-sunita.jpg" },
        },
      ];

      const selectMock = {
        select: vi.fn().mockResolvedValue(mockDoctors),
      };
      vi.spyOn(Doctor, "find").mockReturnValue(selectMock as any);

      const res = await request(app).get("/api/v1/websites/effective/apollo-hospital");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const data = res.body.data;
      expect(data.websiteType).toBe(WebsiteType.HOSPITAL_CLINIC);
      expect(data.organizationName).toBe("Apollo Hospital International");
      expect(data.selectedTheme).toBe("vital-compact");
      expect(data.doctorDirectory).toHaveLength(2);
      expect(data.doctorDirectory?.[0].doctorName).toBe("Rajiv Shah");
      expect(data.departments).toContain("Cardiology");
      expect(data.departments).toContain("Neurosurgery");
      expect(data.isHospitalChild).toBe(false);
    });

    it("rejects unpublished draft website with 404 (not exposed publicly)", async () => {
      vi.spyOn(Website, "findOne").mockResolvedValue({
        slug: "draft-clinic",
        websiteType: WebsiteType.INDEPENDENT_DOCTOR,
        publishStatus: "DRAFT", // Unpublished!
      } as any);

      const res = await request(app).get("/api/v1/websites/effective/draft-clinic");
      expect(res.status).toBe(404);
      expect(res.body.code).toBe("NOT_FOUND");
    });

    it("rejects suspended / inactive doctor website with 404", async () => {
      vi.spyOn(Website, "findOne").mockResolvedValue({
        slug: "inactive-dr",
        websiteType: WebsiteType.INDEPENDENT_DOCTOR,
        ownerId: docId,
        doctorId: docId,
        publishStatus: "PUBLISHED",
      } as any);

      vi.spyOn(Doctor, "findById").mockResolvedValue({
        _id: docId,
        status: "INACTIVE", // Suspended!
      } as any);

      const res = await request(app).get("/api/v1/websites/effective/inactive-dr");
      expect(res.status).toBe(404);
    });
  });

  describe("Dual-Slug Hospital Doctor Resolution (GET /api/v1/websites/effective/:orgSlug/:doctorSlug)", () => {
    it("resolves hospital doctor website with runtime parent inheritance", async () => {
      // 1. Mock active parent Organization
      const mockParentOrg = {
        _id: orgId,
        name: "Apollo Hospital International",
        slug: "apollo",
        type: "HOSPITAL",
        logo: { url: "https://res.cloudinary.com/doczeno/apollo-logo.png" },
        galleryPhotos: [{ url: "https://res.cloudinary.com/doczeno/apollo-gallery-1.jpg" }],
        address: {
          street: "Central Avenue",
          city: "Bengaluru",
          state: "Karnataka",
          pincode: "560001",
          country: "India",
        },
        selectedTheme: "modern-minimal",
        faviconUrl: "https://res.cloudinary.com/doczeno/apollo-fav.ico",
        browserTabTitle: "Apollo Hospitals Bengaluru",
        phone: "+918022223333",
        whatsApp: "+919876543210",
        status: "ACTIVE",
      };
      vi.spyOn(Organization, "findOne").mockResolvedValue(mockParentOrg as any);

      // 2. Mock active child Doctor with organizationId matching parent Org internal ID
      const mockChildDoc = {
        _id: docId,
        doctorName: "Rajiv Shah",
        gender: "MALE",
        degree: "MBBS, DM Cardiology",
        specialization: "Cardiology",
        yearsOfExperience: 14,
        organizationId: orgId, // Matched!
        whatsApp: "+919876511111",
        email: "dr.rajiv@apollo.com",
        consultationHours: JSON.stringify([
          { day: "Tuesday", slots: [{ startTime: "10:00", endTime: "16:00" }] },
        ]),
        weeklyOff: "Sunday",
        appointmentRequired: true,
        doctorPhoto: { url: "https://res.cloudinary.com/doczeno/dr-rajiv.jpg" },
        slug: "dr-rajiv-shah",
        status: "ACTIVE",
      };
      vi.spyOn(Doctor, "findOne").mockResolvedValue(mockChildDoc as any);

      // 3. Mock published Website
      vi.spyOn(Website, "findOne").mockResolvedValue({
        _id: new mongoose.Types.ObjectId(),
        websiteType: WebsiteType.HOSPITAL_DOCTOR,
        doctorId: docId,
        organizationId: orgId,
        slug: "apollo-dr-rajiv-shah",
        templateId: "modern-minimal",
        publishStatus: "PUBLISHED",
      } as any);

      const res = await request(app).get("/api/v1/websites/effective/apollo/dr-rajiv-shah");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const data = res.body.data;

      // Doctor-owned data:
      expect(data.doctorName).toBe("Rajiv Shah");
      expect(data.degree).toBe("MBBS, DM Cardiology");
      expect(data.specialization).toBe("Cardiology");
      expect(data.doctorPhoto.url).toBe("https://res.cloudinary.com/doczeno/dr-rajiv.jpg");

      // Inherited from parent Hospital at runtime (not copied to doctor record):
      expect(data.organizationName).toBe("Apollo Hospital International");
      expect(data.logo.url).toBe("https://res.cloudinary.com/doczeno/apollo-logo.png");
      expect(data.galleryPhotos[0].url).toBe("https://res.cloudinary.com/doczeno/apollo-gallery-1.jpg");
      expect(data.address.city).toBe("Bengaluru");
      expect(data.address.pincode).toBe("560001");
      expect(data.selectedTheme).toBe("modern-minimal");
      expect(data.faviconUrl).toBe("https://res.cloudinary.com/doczeno/apollo-fav.ico");
      expect(data.browserTabTitle).toBe("Apollo Hospitals Bengaluru");
      expect(data.isHospitalChild).toBe(true);
      expect(data.hospitalSlug).toBe("apollo");
    });

    it("CRUCIAL TEST: changes to hospital address, logo, gallery, theme, favicon, and tab title immediately reflect on child doctor without modifying doctor record", async () => {
      // 1. Initial State: Apollo Bengaluru with theme "clinical-editorial"
      const initialParentOrg = {
        _id: orgId,
        name: "Apollo Hospital",
        slug: "apollo",
        logo: { url: "https://res.cloudinary.com/doczeno/logo-v1.png" },
        galleryPhotos: [{ url: "https://res.cloudinary.com/doczeno/gallery-v1.jpg" }],
        address: {
          city: "Bengaluru",
          state: "Karnataka",
          pincode: "560001",
          country: "India",
        },
        selectedTheme: "clinical-editorial",
        faviconUrl: "https://res.cloudinary.com/doczeno/fav-v1.ico",
        browserTabTitle: "Apollo Hospitals Bengaluru",
        status: "ACTIVE",
      };

      const doctorRecord = {
        _id: docId,
        doctorName: "Ananya Deshmukh",
        degree: "MBBS, MD",
        specialization: "Neurology",
        yearsOfExperience: 12,
        organizationId: orgId,
        doctorPhoto: { url: "https://res.cloudinary.com/doczeno/dr-ananya.jpg" },
        slug: "dr-ananya-deshmukh",
        status: "ACTIVE",
        // Note: doctorRecord does NOT store address, logo, gallery, theme, or favicon!
      };

      const websiteRecord = {
        _id: new mongoose.Types.ObjectId(),
        websiteType: WebsiteType.HOSPITAL_DOCTOR,
        doctorId: docId,
        organizationId: orgId,
        publishStatus: "PUBLISHED",
      };

      vi.spyOn(Doctor, "findOne").mockResolvedValue(doctorRecord as any);
      vi.spyOn(Website, "findOne").mockResolvedValue(websiteRecord as any);
      vi.spyOn(Organization, "findOne").mockResolvedValue(initialParentOrg as any);

      // First Request: check initial inherited values
      const res1 = await request(app).get("/api/v1/websites/effective/apollo/dr-ananya-deshmukh");
      expect(res1.status).toBe(200);
      expect(res1.body.data.selectedTheme).toBe("clinical-editorial");
      expect(res1.body.data.logo.url).toBe("https://res.cloudinary.com/doczeno/logo-v1.png");
      expect(res1.body.data.address.city).toBe("Bengaluru");
      expect(res1.body.data.faviconUrl).toBe("https://res.cloudinary.com/doczeno/fav-v1.ico");

      // 2. Hospital Mutates its branding, address, theme, favicon, and tab title:
      const updatedParentOrg = {
        ...initialParentOrg,
        name: "Apollo Health City (Relocated)",
        logo: { url: "https://res.cloudinary.com/doczeno/logo-brand-new-v2.png" },
        galleryPhotos: [
          { url: "https://res.cloudinary.com/doczeno/gallery-new-icu.jpg" },
          { url: "https://res.cloudinary.com/doczeno/gallery-new-reception.jpg" },
        ],
        address: {
          city: "Hyderabad", // Relocated!
          state: "Telangana",
          pincode: "500096",
          country: "India",
        },
        selectedTheme: "vital-compact", // Changed theme!
        faviconUrl: "https://res.cloudinary.com/doczeno/fav-modern-v2.ico", // Changed favicon!
        browserTabTitle: "Apollo Health City Hyderabad — Global Care", // Changed tab title!
      };

      // Mock organization lookup returning updated document
      vi.spyOn(Organization, "findOne").mockResolvedValue(updatedParentOrg as any);

      // Second Request: verify child doctor immediately reflects changes dynamically
      const res2 = await request(app).get("/api/v1/websites/effective/apollo/dr-ananya-deshmukh");
      expect(res2.status).toBe(200);
      const updatedData = res2.body.data;

      // Effective child doctor data reflects hospital updates:
      expect(updatedData.selectedTheme).toBe("vital-compact"); // New theme!
      expect(updatedData.logo.url).toBe("https://res.cloudinary.com/doczeno/logo-brand-new-v2.png"); // New logo!
      expect(updatedData.galleryPhotos).toHaveLength(2); // New gallery!
      expect(updatedData.address.city).toBe("Hyderabad"); // New city!
      expect(updatedData.address.pincode).toBe("500096"); // New pincode!
      expect(updatedData.faviconUrl).toBe("https://res.cloudinary.com/doczeno/fav-modern-v2.ico"); // New favicon!
      expect(updatedData.browserTabTitle).toBe("Apollo Health City Hyderabad — Global Care"); // New tab title!

      // Verify the doctor document was NOT modified and never duplicated these fields:
      expect((doctorRecord as any).address).toBeUndefined();
      expect((doctorRecord as any).logo).toBeUndefined();
      expect((doctorRecord as any).galleryPhotos).toBeUndefined();
      expect((doctorRecord as any).selectedTheme).toBeUndefined();
    });

    it("enforces internal ID authorization and rejects cross-tenant doctor lookup", async () => {
      // Parent org is Apollo
      const mockParentOrg = {
        _id: orgId,
        slug: "apollo",
        status: "ACTIVE",
      };
      vi.spyOn(Organization, "findOne").mockResolvedValue(mockParentOrg as any);

      // When querying Doctor with { slug: "dr-foreign", organizationId: orgId }, Mongoose returns null
      // because dr-foreign belongs to a different hospital!
      vi.spyOn(Doctor, "findOne").mockResolvedValue(null);

      const res = await request(app).get("/api/v1/websites/effective/apollo/dr-foreign");
      expect(res.status).toBe(404);
      expect(res.body.code).toBe("NOT_FOUND");
      expect(Doctor.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          slug: "dr-foreign",
          organizationId: orgId, // Strictly enforces parent internal ID!
        })
      );
    });

    it("returns 404 when hospital is inactive or suspended", async () => {
      vi.spyOn(Organization, "findOne").mockResolvedValue(null);

      const res = await request(app).get("/api/v1/websites/effective/suspended-hospital/dr-rajiv");
      expect(res.status).toBe(404);
      expect(res.body.code).toBe("NOT_FOUND");
    });
  });
});
