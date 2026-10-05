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

describe("Runtime Data Inheritance Engine (Supertest)", () => {
  const app = createApp();

  const orgId = new mongoose.Types.ObjectId().toString();
  const docId = new mongoose.Types.ObjectId().toString();

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("dynamically resolves hospital branding and address for child doctor website", async () => {
    // Mock Website
    vi.spyOn(Website, "findOne").mockResolvedValue({
      slug: "apollo-dr-rajiv-shah",
      websiteType: WebsiteType.HOSPITAL_DOCTOR,
      doctorId: docId,
      organizationId: orgId,
    } as any);

    // Mock Doctor (does NOT store hospital address or logo)
    vi.spyOn(Doctor, "findById").mockResolvedValue({
      _id: docId,
      organizationId: orgId,
      doctorName: "Dr. Rajiv Shah",
      degree: "MD, DM (Cardiology)",
      specialization: "Cardiology",
      yearsOfExperience: 14,
      consultationHours: "10:00 AM - 4:00 PM",
      weeklyOff: "Sunday",
      doctorPhoto: { url: "https://res.cloudinary.com/doczeno/dr-rajiv.jpg" },
      gender: "MALE",
    } as any);

    // Mock Parent Hospital (the runtime source of truth)
    vi.spyOn(Organization, "findById").mockResolvedValue({
      _id: orgId,
      name: "Apollo Hospital International",
      slug: "apollo",
      logo: { url: "https://res.cloudinary.com/doczeno/apollo-logo.png" },
      galleryPhotos: [{ url: "https://res.cloudinary.com/doczeno/hospital-front.jpg" }],
      address: {
        street: "Bhat, SG Highway",
        city: "Ahmedabad",
        state: "Gujarat",
        pincode: "382428",
        country: "India",
      },
      selectedTheme: "theme-teal-hospital",
      faviconUrl: "https://res.cloudinary.com/doczeno/apollo-favicon.ico",
      browserTabTitle: "Apollo Hospitals — Compassion & Excellence",
    } as any);

    const res = await request(app).get("/api/v1/websites/effective/apollo-dr-rajiv-shah");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const data = res.body.data;

    // Inherited from parent organization:
    expect(data.organizationName).toBe("Apollo Hospital International");
    expect(data.logo.url).toBe("https://res.cloudinary.com/doczeno/apollo-logo.png");
    expect(data.address.city).toBe("Ahmedabad");
    expect(data.address.pincode).toBe("382428");
    expect(data.selectedTheme).toBe("theme-teal-hospital");
    expect(data.faviconUrl).toBe("https://res.cloudinary.com/doczeno/apollo-favicon.ico");
    expect(data.browserTabTitle).toBe("Apollo Hospitals — Compassion & Excellence");
    expect(data.isHospitalChild).toBe(true);
    expect(data.hospitalSlug).toBe("apollo");

    // Doctor's personal professional details:
    expect(data.doctorName).toBe("Dr. Rajiv Shah");
    expect(data.specialization).toBe("Cardiology");
    expect(data.degree).toBe("MD, DM (Cardiology)");
    expect(data.yearsOfExperience).toBe(14);
    expect(data.doctorPhoto.url).toBe("https://res.cloudinary.com/doczeno/dr-rajiv.jpg");
  });

  it("returns 404 when website slug does not exist", async () => {
    vi.spyOn(Website, "findOne").mockResolvedValue(null);

    const res = await request(app).get("/api/v1/websites/effective/non-existent-slug");
    expect(res.status).toBe(404);
    expect(res.body.code).toBe("NOT_FOUND");
  });
});
