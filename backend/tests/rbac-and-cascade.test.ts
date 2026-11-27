import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { createApp } from "@/app";
import { Doctor, Website, Review } from "@/models";
import { clearTestDatabase } from "./setup";
import {
  createSuperadminFixture,
  createHospitalFixture,
  createHospitalDoctorFixture,
  createOnlyDoctorFixture,
} from "./helpers/fixtures";

const app = createApp();

describe("RBAC Cross-Tenant Isolation & Hospital Deactivation Cascade", () => {
  beforeEach(async () => {
    await clearTestDatabase();
  });

  it("blocks unauthenticated requests and cross-tenant/privilege-escalation attempts", async () => {
    const { org: hospitalA } = await createHospitalFixture({ slug: "hospital-a" });
    const { org: hospitalB, token: hospitalBToken } = await createHospitalFixture({ slug: "hospital-b" });
    const { doctor: onlyDocA, token: onlyDocAToken } = await createOnlyDoctorFixture({ slug: "only-doc-a" });
    const { doctor: onlyDocB } = await createOnlyDoctorFixture({ slug: "only-doc-b" });

    // Unauthenticated protected endpoints -> 401
    expect((await request(app).get("/api/v1/organizations/me")).status).toBe(401);
    expect((await request(app).get("/api/v1/superadmin/stats")).status).toBe(401);

    // Doctor trying to access Superadmin routes -> 403
    const docToSuperRes = await request(app)
      .get("/api/v1/superadmin/organizations")
      .set("Authorization", `Bearer ${onlyDocAToken}`);
    expect(docToSuperRes.status).toBe(403);

    // Hospital B Admin trying to access Hospital A AI Content -> 403
    const crossHospAiRes = await request(app)
      .get(`/api/v1/ai/content/HOSPITAL/${hospitalA._id.toString()}`)
      .set("Authorization", `Bearer ${hospitalBToken}`);
    expect(crossHospAiRes.status).toBe(403);

    // Hospital B Admin trying to mutate Hospital A status directly -> 403
    const crossSuperStatusRes = await request(app)
      .patch(`/api/v1/superadmin/organizations/${hospitalB._id.toString()}/status`)
      .set("Authorization", `Bearer ${hospitalBToken}`)
      .send({ status: "INACTIVE" });
    expect(crossSuperStatusRes.status).toBe(403);

    // Only Doctor A trying to update Only Doctor B review -> 403
    const docBReview = await Review.create({
      doctorId: onlyDocB._id,
      patientName: "Patient B",
      rating: 5,
      comment: "Original review",
      tag: "Care",
      isVerified: true,
      isPublished: true,
    });

    const crossReviewRes = await request(app)
      .put(`/api/v1/reviews/${docBReview._id.toString()}`)
      .set("Authorization", `Bearer ${onlyDocAToken}`)
      .send({ comment: "Tampered by Doctor A" });
    expect(crossReviewRes.status).toBe(403);

    // Only Doctor A can access own AI content cleanly
    const ownAiRes = await request(app)
      .get(`/api/v1/ai/content/ONLY_DOCTOR/${onlyDocA._id.toString()}`)
      .set("Authorization", `Bearer ${onlyDocAToken}`);
    expect(ownAiRes.status).toBe(200);
  });

  it("cascades Hospital deactivation/reactivation across all connected Hospital Doctors and respects Superadmin lock", async () => {
    const { token: superToken } = await createSuperadminFixture();
    const { org, website: hospSite, token: hospToken } = await createHospitalFixture({
      slug: "apex-hospital",
    });
    const { doctor: hospDoc, website: hospDocSite } = await createHospitalDoctorFixture(
      org._id,
      org.slug,
      { slug: "dr-surgeon", doctorName: "Anil Rao" }
    );
    const { doctor: unrelatedDoc } = await createOnlyDoctorFixture({ slug: "dr-independent" });

    // 1. Superadmin deactivates Hospital -> affiliated doctor & websites become INACTIVE / SUSPENDED
    const deactRes = await request(app)
      .patch(`/api/v1/superadmin/organizations/${org._id.toString()}/status`)
      .set("Authorization", `Bearer ${superToken}`)
      .send({ status: "INACTIVE" });

    expect(deactRes.status).toBe(200);

    const [docAfterDeact, hospSiteAfterDeact, docSiteAfterDeact, indDocAfter] = await Promise.all([
      Doctor.findById(hospDoc._id).lean(),
      Website.findById(hospSite._id).lean(),
      Website.findById(hospDocSite._id).lean(),
      Doctor.findById(unrelatedDoc._id).lean(),
    ]);

    expect(docAfterDeact?.status).toBe("INACTIVE");
    expect(docAfterDeact?.deactivatedByRole).toBe("SUPERADMIN");
    expect(hospSiteAfterDeact?.publishStatus).toBe("SUSPENDED");
    expect(docSiteAfterDeact?.publishStatus).toBe("SUSPENDED");
    expect(indDocAfter?.status).toBe("ACTIVE"); // Independent doctor unaffected

    // 2. Hospital Admin cannot override Superadmin deactivation on connected doctor (403 DEACTIVATED_BY_SUPERADMIN)
    const overrideRes = await request(app)
      .patch(`/api/v1/doctors/${hospDoc._id.toString()}/status`)
      .set("Authorization", `Bearer ${hospToken}`)
      .send({ status: "ACTIVE" });

    expect(overrideRes.status).toBe(403);
    expect(overrideRes.body.code).toBe("DEACTIVATED_BY_SUPERADMIN");

    // 3. Superadmin reactivates Hospital -> Hospital and all connected approved doctors reactivate together
    const reactRes = await request(app)
      .patch(`/api/v1/superadmin/organizations/${org._id.toString()}/status`)
      .set("Authorization", `Bearer ${superToken}`)
      .send({ status: "ACTIVE" });

    expect(reactRes.status).toBe(200);

    const [docAfterReact, hospSiteAfterReact, docSiteAfterReact] = await Promise.all([
      Doctor.findById(hospDoc._id).lean(),
      Website.findById(hospSite._id).lean(),
      Website.findById(hospDocSite._id).lean(),
    ]);

    expect(docAfterReact?.status).toBe("ACTIVE");
    expect(docAfterReact?.deactivatedByRole).toBeNull();
    expect(hospSiteAfterReact?.publishStatus).toBe("PUBLISHED");
    expect(docSiteAfterReact?.publishStatus).toBe("PUBLISHED");
  });
});
