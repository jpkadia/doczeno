import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { createApp } from "@/app";
import { AIContent, Review } from "@/models";
import { geminiService } from "@/services/gemini.service";
import { clearTestDatabase } from "./setup";
import { createHospitalFixture, createOnlyDoctorFixture } from "./helpers/fixtures";

const app = createApp();

describe("Hospital Specialties Sync Lock & Exact-4 AI Reviews", () => {
  beforeEach(async () => {
    await clearTestDatabase();
  });

  it("locks Hospital AI Content services count to selected Specialties and syncs changes automatically", async () => {
    const { org, token: hospToken } = await createHospitalFixture({
      slug: "sync-hospital",
      specialties: ["Cardiology", "Neurology"],
    });

    // 1. Initial GET creates default AIContent matched strictly 1-to-1 to the 2 selected specialties
    const getRes = await request(app)
      .get(`/api/v1/ai/content/HOSPITAL/${org._id.toString()}`)
      .set("Authorization", `Bearer ${hospToken}`);

    expect(getRes.status).toBe(200);
    expect(getRes.body.hospitalSpecialties).toEqual(["Cardiology", "Neurology"]);
    expect(getRes.body.data.publishedContent.services).toHaveLength(2);

    // 2. Trying to bypass limit by posting 3 services directly to update-live must fail (400)
    const livePayload = {
      ...getRes.body.data.publishedContent,
      services: [
        ...getRes.body.data.publishedContent.services,
        { title: "Extra Service", description: "Should not be allowed without Specialty tab" },
      ],
    };

    const bypassRes = await request(app)
      .post("/api/v1/ai/content/update-live")
      .set("Authorization", `Bearer ${hospToken}`)
      .send({
        targetType: "HOSPITAL",
        targetId: org._id.toString(),
        content: livePayload,
      });

    expect(bypassRes.status).toBe(400);
    expect(bypassRes.body.error).toContain("Specialties");

    // 3. Updating specialties in Hospital Admin (2 -> 3 specialties) automatically syncs AIContent
    const orgUpdateRes = await request(app)
      .patch("/api/v1/organizations/me")
      .set("Authorization", `Bearer ${hospToken}`)
      .send({
        specialties: ["Cardiology", "Neurology", "Orthopedics"],
        departments: ["Cardiology", "Neurology", "Orthopedics"],
      });

    expect(orgUpdateRes.status).toBe(200);

    const updatedAi = await AIContent.findOne({
      targetType: "HOSPITAL",
      targetId: org._id,
    }).lean();
    expect(updatedAi?.publishedContent?.services).toHaveLength(3);
    expect(
      updatedAi?.publishedContent?.services?.map((s: any) => s.title)
    ).toEqual(["Cardiology", "Neurology", "Orthopedics"]);

    // 4. Attempting to remove all specialties (empty array) must fail
    const emptySpecRes = await request(app)
      .patch("/api/v1/organizations/me")
      .set("Authorization", `Bearer ${hospToken}`)
      .send({ specialties: [] });

    expect(emptySpecRes.status).toBeGreaterThanOrEqual(400);
  });

  it("always generates exactly 4 AI patient reviews and enforces Min 3 / Max 9 admin boundaries", async () => {
    const { doctor, token: docToken } = await createOnlyDoctorFixture({
      slug: "dr-reviews-limit",
    });

    // 1. AI testimonial generation always returns exactly 4 (both Doctor and Hospital)
    const docReviews = await geminiService.generatePatientTestimonials({
      type: "DOCTOR",
      doctorName: doctor.doctorName,
      specialization: doctor.specialization,
      city: "Surat",
    });
    expect(docReviews).toHaveLength(4);

    const hospReviews = await geminiService.generatePatientTestimonials({
      type: "HOSPITAL",
      hospitalName: "Test Multispecialty Hospital",
      city: "Ahmedabad",
    });
    expect(hospReviews).toHaveLength(4);

    // 2. Regenerate via API inserts exactly 4 reviews
    const regenRes = await request(app)
      .post("/api/v1/reviews/regenerate-ai")
      .set("Authorization", `Bearer ${docToken}`)
      .send({ mode: "REPLACE" });

    expect(regenRes.status).toBe(200);
    expect(regenRes.body.data.reviews).toHaveLength(4);

    // 3. Add up to 9 reviews, 10th fails with MAX_REVIEWS_REACHED
    for (let i = 5; i <= 9; i++) {
      const addRes = await request(app)
        .post("/api/v1/reviews")
        .set("Authorization", `Bearer ${docToken}`)
        .send({
          patientName: `Manual Patient ${i}`,
          rating: 5,
          comment: "Great clinical consultation and clear guidance.",
          tag: "Consultation",
        });
      expect(addRes.status).toBe(201);
    }

    const tenthRes = await request(app)
      .post("/api/v1/reviews")
      .set("Authorization", `Bearer ${docToken}`)
      .send({
        patientName: "Patient 10",
        rating: 5,
        comment: "Should be blocked at max 9",
        tag: "Consultation",
      });
    expect(tenthRes.status).toBe(400);
    expect(tenthRes.body.code).toBe("MAX_REVIEWS_REACHED");

    // 4. Delete down to 3 reviews, deleting below 3 fails with MIN_REVIEWS_REQUIRED
    const allReviews = await Review.find({ doctorId: doctor._id }).sort({ createdAt: 1 });
    expect(allReviews).toHaveLength(9);

    for (let i = 0; i < 6; i++) {
      const delRes = await request(app)
        .delete(`/api/v1/reviews/${allReviews[i]!._id.toString()}`)
        .set("Authorization", `Bearer ${docToken}`);
      expect(delRes.status).toBe(200);
    }

    const fourthDelAttempt = await request(app)
      .delete(`/api/v1/reviews/${allReviews[6]!._id.toString()}`)
      .set("Authorization", `Bearer ${docToken}`);
    expect(fourthDelAttempt.status).toBe(400);
    expect(fourthDelAttempt.body.code).toBe("MIN_REVIEWS_REQUIRED");
  });
});
