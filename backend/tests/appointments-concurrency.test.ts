import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { createApp } from "@/app";
import { Appointment } from "@/models";
import { clearTestDatabase } from "./setup";
import {
  createOnlyDoctorFixture,
  createHospitalFixture,
  createHospitalDoctorFixture,
  getTodayIstDateStr,
} from "./helpers/fixtures";

const app = createApp();

describe("Appointments Concurrency & Privacy Status Tracking", () => {
  beforeEach(async () => {
    await clearTestDatabase();
  });

  it("generates unique, sequential Appointment IDs under concurrent same-millisecond requests", async () => {
    const { doctor } = await createOnlyDoctorFixture();
    const todayStr = getTodayIstDateStr();

    const requests = Array.from({ length: 10 }, (_, idx) =>
      request(app)
        .post("/api/v1/appointments")
        .send({
          doctorId: doctor._id.toString(),
          patientName: `Patient Concurrency ${idx + 1}`,
          patientAge: 28 + idx,
          patientPhone: `987650010${idx}`,
          appointmentDate: todayStr,
          timeSlot: "10:00 AM - 10:30 AM",
          notes: "Fever and routine checkup",
          source: idx % 2 === 0 ? "WEBSITE_FORM" : "SLUG_ADMIN",
        })
    );

    const responses = await Promise.all(requests);

    for (const res of responses) {
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(typeof res.body.data?.appointmentId).toBe("string");
    }

    const ids = responses.map((r) => r.body.data.appointmentId as string);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(10);

    const dbCount = await Appointment.countDocuments({ doctorId: doctor._id });
    expect(dbCount).toBe(10);

    // Confirm sequential counter values 1..10 exist cleanly
    const seqNumbers = ids
      .map((id) => parseInt(id.slice(8), 10))
      .sort((a, b) => a - b);
    expect(seqNumbers).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it("scopes hospital sequential Appointment IDs cleanly across doctors under one hospital", async () => {
    const { org } = await createHospitalFixture({ slug: "metro-hospital" });
    const { doctor: doc1 } = await createHospitalDoctorFixture(org._id, org.slug, {
      slug: "doc-one",
      doctorName: "Doc One",
    });
    const { doctor: doc2 } = await createHospitalDoctorFixture(org._id, org.slug, {
      slug: "doc-two",
      doctorName: "Doc Two",
    });

    const todayStr = getTodayIstDateStr();
    const [r1, r2, r3] = await Promise.all([
      request(app).post("/api/v1/appointments").send({
        doctorId: doc1._id.toString(),
        organizationId: org._id.toString(),
        patientName: "Patient One",
        patientAge: 32,
        patientPhone: "9876511111",
        appointmentDate: todayStr,
        timeSlot: "Morning",
        notes: "Chest evaluation",
      }),
      request(app).post("/api/v1/appointments").send({
        doctorId: doc2._id.toString(),
        organizationId: org._id.toString(),
        patientName: "Patient Two",
        patientAge: 40,
        patientPhone: "9876522222",
        appointmentDate: todayStr,
        timeSlot: "Evening",
        notes: "Knee pain",
      }),
      request(app).post("/api/v1/appointments").send({
        doctorId: doc1._id.toString(),
        organizationId: org._id.toString(),
        patientName: "Patient Three",
        patientAge: 25,
        patientPhone: "9876533333",
        appointmentDate: todayStr,
        timeSlot: "Evening",
        notes: "Follow-up visit",
      }),
    ]);

    expect(r1.status).toBe(201);
    expect(r2.status).toBe(201);
    expect(r3.status).toBe(201);
    const hospitalIds = new Set([
      r1.body.data.appointmentId,
      r2.body.data.appointmentId,
      r3.body.data.appointmentId,
    ]);
    expect(hospitalIds.size).toBe(3);
  });

  it("enforces privacy and tenant scoping on public /appointments/check-status", async () => {
    const { doctor: docA, website: siteA } = await createOnlyDoctorFixture({ slug: "dr-alpha" });
    const { website: siteB } = await createOnlyDoctorFixture({ slug: "dr-beta" });
    const todayStr = getTodayIstDateStr();

    const createRes = await request(app).post("/api/v1/appointments").send({
      doctorId: docA._id.toString(),
      patientName: "Private Patient",
      patientAge: 35,
      patientPhone: "9988776655",
      patientEmail: "secret@patient.test",
      appointmentDate: todayStr,
      timeSlot: "11:00 AM",
      notes: "Skin rash",
    });

    const apptId = createRes.body.data.appointmentId;

    // Valid tenant check-status succeeds without exposing phone/email
    const okRes = await request(app)
      .post("/api/v1/appointments/check-status")
      .send({ appointmentId: apptId, slug: siteA.slug });

    expect(okRes.status).toBe(200);
    expect(okRes.body.data.appointmentId).toBe(apptId);
    expect(okRes.body.data.patientName).toBe("Private Patient");
    expect(okRes.body.data.patientPhone).toBeUndefined();
    expect(okRes.body.data.patientEmail).toBeUndefined();

    // Cross-tenant lookup from siteB must NOT leak siteA's appointment
    const crossRes = await request(app)
      .post("/api/v1/appointments/check-status")
      .send({ appointmentId: apptId, slug: siteB.slug });

    expect(crossRes.status).toBe(404);
  });
});
