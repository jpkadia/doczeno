import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { createApp } from "@/app";
import { Review } from "@/models";
import { clearTestDatabase } from "./setup";
import {
  createHospitalFixture,
  createHospitalDoctorFixture,
  createOnlyDoctorFixture,
} from "./helpers/fixtures";

const app = createApp();

describe("Website Section Order, Visibility Toggles, Doctor Custom Section & Review Scoping", () => {
  beforeEach(async () => {
    await clearTestDatabase();
  });

  it("enforces locked sections (home, about, footer) and persists valid sectionOrder & hiddenSections", async () => {
    const { doctor, token } = await createOnlyDoctorFixture({
      slug: "dr-layout-test",
    });

    const getRes = await request(app)
      .get(`/api/v1/ai/content/ONLY_DOCTOR/${doctor._id.toString()}`)
      .set("Authorization", `Bearer ${token}`);
    expect(getRes.status).toBe(200);
    const baseContent = getRes.body.data.publishedContent;

    // 1. Attempting to reorder or hide locked sections (home / about / footer) must fail
    for (const locked of ["home", "about", "footer"]) {
      const reorderLockedRes = await request(app)
        .post("/api/v1/ai/content/update-live")
        .set("Authorization", `Bearer ${token}`)
        .send({
          targetType: "ONLY_DOCTOR",
          targetId: doctor._id.toString(),
          content: {
            ...baseContent,
            sectionOrder: [locked, "services", "reviews"],
          },
        });
      expect(reorderLockedRes.status).toBe(400);

      const hideLockedRes = await request(app)
        .post("/api/v1/ai/content/update-live")
        .set("Authorization", `Bearer ${token}`)
        .send({
          targetType: "ONLY_DOCTOR",
          targetId: doctor._id.toString(),
          content: {
            ...baseContent,
            hiddenSections: [locked],
          },
        });
      expect(hideLockedRes.status).toBe(400);
    }

    // 2. Valid reorder & visibility toggle saves cleanly and exposes via public effective endpoint
    const customOrder = ["reviews", "timings", "services", "faqs", "facility", "custom"];
    const hidden = ["faqs", "facility"];

    const saveRes = await request(app)
      .post("/api/v1/ai/content/update-live")
      .set("Authorization", `Bearer ${token}`)
      .send({
        targetType: "ONLY_DOCTOR",
        targetId: doctor._id.toString(),
        content: {
          ...baseContent,
          sectionOrder: customOrder,
          hiddenSections: hidden,
        },
      });
    expect(saveRes.status).toBe(200);

    const publicRes = await request(app).get(`/api/v1/websites/effective/${doctor.slug}`);
    expect(publicRes.status).toBe(200);
    expect(publicRes.body.data.websiteContent.sectionOrder).toEqual(customOrder);
    expect(publicRes.body.data.websiteContent.hiddenSections).toEqual(hidden);
  });

  it("allows text/card Custom Section for Doctors without images and blocks Custom Section on Hospital websites", async () => {
    const { doctor, token: docToken } = await createOnlyDoctorFixture({
      slug: "dr-custom-sec",
    });
    const { org, token: hospToken } = await createHospitalFixture({
      slug: "hosp-no-custom",
      specialties: ["Cardiology"],
    });

    const docGet = await request(app)
      .get(`/api/v1/ai/content/ONLY_DOCTOR/${doctor._id.toString()}`)
      .set("Authorization", `Bearer ${docToken}`);
    const docBase = docGet.body.data.publishedContent;

    // 1. Reject images in Doctor Custom Section
    const imageRejectRes = await request(app)
      .post("/api/v1/ai/content/update-live")
      .set("Authorization", `Bearer ${docToken}`)
      .send({
        targetType: "ONLY_DOCTOR",
        targetId: doctor._id.toString(),
        content: {
          ...docBase,
          customSection: {
            enabled: true,
            title: "Clinic Values",
            layout: "cards",
            imageUrl: "https://example.com/photo.jpg",
            cards: [
              { title: "Value One", description: "Always honest and transparent care." },
              { title: "Value Two", description: "Strict clinical sterilization." },
            ],
          },
        },
      });
    expect(imageRejectRes.status).toBe(400);
    expect(imageRejectRes.body.error).toContain("Images are not allowed");

    // 2. Reject exceeding max 6 cards
    const tooManyCardsRes = await request(app)
      .post("/api/v1/ai/content/update-live")
      .set("Authorization", `Bearer ${docToken}`)
      .send({
        targetType: "ONLY_DOCTOR",
        targetId: doctor._id.toString(),
        content: {
          ...docBase,
          customSection: {
            enabled: true,
            title: "Patient Promises",
            layout: "cards",
            cards: Array.from({ length: 7 }, (_, i) => ({
              title: `Card ${i + 1}`,
              description: "Patient focused clinical quality promise.",
            })),
          },
        },
      });
    expect(tooManyCardsRes.status).toBe(400);

    // 3. Valid Doctor Custom Section saves & renders in effective website data
    const validCustomRes = await request(app)
      .post("/api/v1/ai/content/update-live")
      .set("Authorization", `Bearer ${docToken}`)
      .send({
        targetType: "ONLY_DOCTOR",
        targetId: doctor._id.toString(),
        content: {
          ...docBase,
          customSection: {
            enabled: true,
            navLabel: "Values",
            badge: "Patient First",
            title: "Our Clinical Standards",
            subtitle: "Transparent care at every visit.",
            layout: "highlights",
            points: [
              { heading: "Zero Hidden Fees", detail: "Upfront consultation charges disclosed before booking." },
              { heading: "Digital Follow-up", detail: "Clear prescription instructions shared promptly." },
            ],
          },
        },
      });
    expect(validCustomRes.status).toBe(200);

    const publicRes = await request(app).get(`/api/v1/websites/effective/${doctor.slug}`);
    expect(publicRes.status).toBe(200);
    expect(publicRes.body.data.websiteContent.customSection.enabled).toBe(true);
    expect(publicRes.body.data.websiteContent.customSection.layout).toBe("highlights");

    // 4. Reject Custom Section enabled on Hospital website
    const hospGet = await request(app)
      .get(`/api/v1/ai/content/HOSPITAL/${org._id.toString()}`)
      .set("Authorization", `Bearer ${hospToken}`);
    const hospCustomRes = await request(app)
      .post("/api/v1/ai/content/update-live")
      .set("Authorization", `Bearer ${hospToken}`)
      .send({
        targetType: "HOSPITAL",
        targetId: org._id.toString(),
        content: {
          ...hospGet.body.data.publishedContent,
          customSection: {
            enabled: true,
            title: "Invalid Hospital Custom",
            layout: "narrative",
            paragraph: "Hospitals should not enable doctor custom sections.",
          },
        },
      });
    expect(hospCustomRes.status).toBe(400);
  });

  it("isolates Hospital reviews (scope=hospital) from affiliated doctor reviews and prevents cross-tenant doctor review access", async () => {
    const { org: hospA, token: tokenHospA } = await createHospitalFixture({
      slug: "hosp-review-iso-a",
    });
    const { org: hospB } = await createHospitalFixture({
      slug: "hosp-review-iso-b",
    });
    const { doctor: docA } = await createHospitalDoctorFixture(hospA, {
      slug: "doc-in-a",
    });
    const { doctor: docB } = await createHospitalDoctorFixture(hospB, {
      slug: "doc-in-b",
    });

    await Review.create([
      {
        organizationId: hospA._id,
        doctorId: null,
        patientName: "Hospital A Patient",
        rating: 5,
        comment: "Clean hospital and caring nurses.",
        isPublished: true,
      },
      {
        organizationId: hospA._id,
        doctorId: docA._id,
        patientName: "Doctor A Patient",
        rating: 5,
        comment: "Dr. A explained the report very clearly.",
        isPublished: true,
      },
    ]);

    // 1. scope=hospital must ONLY return hospital-level review (not Doctor A's review)
    const hospOnlyRes = await request(app)
      .get("/api/v1/reviews?scope=hospital")
      .set("Authorization", `Bearer ${tokenHospA}`);
    expect(hospOnlyRes.status).toBe(200);
    expect(hospOnlyRes.body.data.reviews).toHaveLength(1);
    expect(hospOnlyRes.body.data.reviews[0].patientName).toBe("Hospital A Patient");

    // 2. doctorId=docA returns ONLY Doctor A's review
    const docARes = await request(app)
      .get(`/api/v1/reviews?doctorId=${docA._id.toString()}`)
      .set("Authorization", `Bearer ${tokenHospA}`);
    expect(docARes.status).toBe(200);
    expect(docARes.body.data.reviews).toHaveLength(1);
    expect(docARes.body.data.reviews[0].patientName).toBe("Doctor A Patient");

    // 3. Hospital A Admin CANNOT read Hospital B doctor's reviews (403)
    const crossTenantRes = await request(app)
      .get(`/api/v1/reviews?doctorId=${docB._id.toString()}`)
      .set("Authorization", `Bearer ${tokenHospA}`);
    expect(crossTenantRes.status).toBe(403);

    // 4. Regenerating Hospital A reviews must NOT wipe Doctor A's reviews
    const regenHospRes = await request(app)
      .post("/api/v1/reviews/regenerate-ai")
      .set("Authorization", `Bearer ${tokenHospA}`)
      .send({ mode: "REPLACE" });
    expect(regenHospRes.status).toBe(200);
    expect(regenHospRes.body.data.reviews).toHaveLength(4);

    const remainingDocAReviews = await Review.find({ doctorId: docA._id });
    expect(remainingDocAReviews).toHaveLength(1);
  });
});
