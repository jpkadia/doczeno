import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { createApp } from "@/app";
import { Appointment, Doctor } from "@/models";
import { clearChatbotRateLimitState } from "@/middleware/chatbot-rate-limit";
import { clearTestDatabase } from "./setup";
import {
  createOnlyDoctorFixture,
  createHospitalFixture,
  createHospitalDoctorFixture,
  getTodayIstDateStr,
} from "./helpers/fixtures";

const app = createApp();

describe("Strict Time-Slot Capacity Locking, Token Assignment & Live OPD Queue", () => {
  beforeEach(async () => {
    await clearTestDatabase();
  });

  it("atomically enforces maxPatients per slot under concurrent same-millisecond traffic and assigns sequential tokens", async () => {
    const schedule = JSON.stringify([
      { day: "Monday", isClosed: false, slots: [{ startTime: "09:00", endTime: "13:00", maxPatients: 3 }] },
      { day: "Tuesday", isClosed: false, slots: [{ startTime: "09:00", endTime: "13:00", maxPatients: 3 }] },
      { day: "Wednesday", isClosed: false, slots: [{ startTime: "09:00", endTime: "13:00", maxPatients: 3 }] },
      { day: "Thursday", isClosed: false, slots: [{ startTime: "09:00", endTime: "13:00", maxPatients: 3 }] },
      { day: "Friday", isClosed: false, slots: [{ startTime: "09:00", endTime: "13:00", maxPatients: 3 }] },
      { day: "Saturday", isClosed: false, slots: [{ startTime: "09:00", endTime: "13:00", maxPatients: 3 }] },
      { day: "Sunday", isClosed: false, slots: [{ startTime: "09:00", endTime: "13:00", maxPatients: 3 }] },
    ]);

    const { doctor } = await createOnlyDoctorFixture({ slug: "dr-slot-cap" });
    await Doctor.findByIdAndUpdate(doctor._id, { consultationHours: schedule });

    const todayStr = getTodayIstDateStr();

    // Fire 8 concurrent bookings into a slot with maxPatients = 3
    const responses = await Promise.all(
      Array.from({ length: 8 }, (_, idx) =>
        request(app)
          .post("/api/v1/appointments")
          .send({
            doctorId: doctor._id.toString(),
            patientName: `Concurrent Patient ${idx + 1}`,
            patientAge: 25 + idx,
            patientPhone: `987659000${idx}`,
            appointmentDate: todayStr,
            timeSlot: "09:00 AM - 01:00 PM",
            notes: "Consultation",
          })
      )
    );

    const succeeded = responses.filter((r) => r.status === 201);
    const fullRejected = responses.filter((r) => r.status === 409);

    expect(succeeded).toHaveLength(3);
    expect(fullRejected).toHaveLength(5);

    const tokens = succeeded
      .map((r) => r.body.data.tokenNumber as number)
      .sort((a, b) => a - b);
    expect(tokens).toEqual([1, 2, 3]);

    for (const rej of fullRejected) {
      expect(rej.body.code).toBe("SLOT_FULL");
    }

    expect(await Appointment.countDocuments({ doctorId: doctor._id })).toBe(3);
  });

  it("prevents booking loophole between Hospital Website/Chatbot and Hospital Doctor slot capacity", async () => {
    const schedule = JSON.stringify([
      { day: "Monday", isClosed: false, slots: [{ startTime: "10:00", endTime: "13:00", maxPatients: 2 }] },
      { day: "Tuesday", isClosed: false, slots: [{ startTime: "10:00", endTime: "13:00", maxPatients: 2 }] },
      { day: "Wednesday", isClosed: false, slots: [{ startTime: "10:00", endTime: "13:00", maxPatients: 2 }] },
      { day: "Thursday", isClosed: false, slots: [{ startTime: "10:00", endTime: "13:00", maxPatients: 2 }] },
      { day: "Friday", isClosed: false, slots: [{ startTime: "10:00", endTime: "13:00", maxPatients: 2 }] },
      { day: "Saturday", isClosed: false, slots: [{ startTime: "10:00", endTime: "13:00", maxPatients: 2 }] },
      { day: "Sunday", isClosed: false, slots: [{ startTime: "10:00", endTime: "13:00", maxPatients: 2 }] },
    ]);

    const { org } = await createHospitalFixture({
      slug: "unified-lock-hosp",
      specialties: ["Cardiology"],
    });
    const { doctor: hospDoc } = await createHospitalDoctorFixture(org._id, org.slug, {
      slug: "dr-cardio",
      doctorName: "Arjun Cardio",
      specialization: "Cardiology",
    });
    await Doctor.findByIdAndUpdate(hospDoc._id, { consultationHours: schedule });

    const todayStr = getTodayIstDateStr();

    // 1. Fill seat 1 via Doctor direct website form
    const form1 = await request(app).post("/api/v1/appointments").send({
      doctorId: hospDoc._id.toString(),
      patientName: "Patient A",
      patientAge: 42,
      patientPhone: "9811111111",
      appointmentDate: todayStr,
      timeSlot: "10:00 AM - 01:00 PM",
      notes: "Heart checkup",
      source: "WEBSITE_FORM",
    });
    expect(form1.status).toBe(201);
    expect(form1.body.data.tokenNumber).toBe(1);

    // 2. Fill seat 2 via Hospital website form -> must share same doctor's SlotCounter!
    const form2 = await request(app).post("/api/v1/appointments").send({
      doctorId: hospDoc._id.toString(),
      organizationId: org._id.toString(),
      patientName: "Patient B",
      patientAge: 44,
      patientPhone: "9822222222",
      appointmentDate: todayStr,
      timeSlot: "Morning",
      notes: "Chest pain",
      source: "WEBSITE_FORM",
    });
    expect(form2.status).toBe(201);
    expect(form2.body.data.tokenNumber).toBe(2);

    // 3. Hospital AI Chatbot attempt for same slot must hit SLOT_FULL instead of bypassing!
    clearChatbotRateLimitState();
    await request(app).post("/api/v1/chatbot/public/message").send({
      slug: org.slug,
      sessionId: "hosp-chat-full-1",
      message: `I have heart pain, name is Rahul Verma, age 45, phone 9833333333, date ${todayStr}, time 10:00 AM - 01:00 PM`,
    });
    clearChatbotRateLimitState();
    const chatConfirmRes = await request(app).post("/api/v1/chatbot/public/message").send({
      slug: org.slug,
      sessionId: "hosp-chat-full-1",
      message: "Confirm",
    });

    expect(chatConfirmRes.status).toBe(200);
    expect(chatConfirmRes.body.isAppointmentBooked).toBeFalsy();
    expect(chatConfirmRes.body.response.toLowerCase()).toContain("full");
    expect(await Appointment.countDocuments({ doctorId: hospDoc._id })).toBe(2);
  });

  it("releases slot capacity on cancellation, skips cancelled tokens in Live OPD Queue, and shows live queue position", async () => {
    const schedule = JSON.stringify([
      { day: "Monday", isClosed: false, slots: [{ startTime: "09:00", endTime: "13:00", maxPatients: 3 }] },
      { day: "Tuesday", isClosed: false, slots: [{ startTime: "09:00", endTime: "13:00", maxPatients: 3 }] },
      { day: "Wednesday", isClosed: false, slots: [{ startTime: "09:00", endTime: "13:00", maxPatients: 3 }] },
      { day: "Thursday", isClosed: false, slots: [{ startTime: "09:00", endTime: "13:00", maxPatients: 3 }] },
      { day: "Friday", isClosed: false, slots: [{ startTime: "09:00", endTime: "13:00", maxPatients: 3 }] },
      { day: "Saturday", isClosed: false, slots: [{ startTime: "09:00", endTime: "13:00", maxPatients: 3 }] },
      { day: "Sunday", isClosed: false, slots: [{ startTime: "09:00", endTime: "13:00", maxPatients: 3 }] },
    ]);

    const { org, token: hospToken } = await createHospitalFixture({ slug: "queue-hosp" });
    const { doctor: doc, token: docToken } = await createHospitalDoctorFixture(org._id, org.slug, {
      slug: "dr-queue",
      doctorName: "Queue Specialist",
    });
    await Doctor.findByIdAndUpdate(doc._id, { consultationHours: schedule });

    const todayStr = getTodayIstDateStr();

    // Book Tokens #1, #2, #3 (fills 3/3)
    const bookings = [];
    for (let i = 1; i <= 3; i++) {
      const r = await request(app).post("/api/v1/appointments").send({
        doctorId: doc._id.toString(),
        organizationId: org._id.toString(),
        patientName: `Queue Patient ${i}`,
        patientAge: 30,
        patientPhone: `987654320${i}`,
        appointmentDate: todayStr,
        timeSlot: "09:00 AM - 01:00 PM",
        notes: "Checkup",
      });
      expect(r.status).toBe(201);
      bookings.push(r.body.data);
    }

    // Slot is full -> 4th booking fails
    const fourthBlocked = await request(app).post("/api/v1/appointments").send({
      doctorId: doc._id.toString(),
      patientName: "Queue Patient 4",
      patientAge: 30,
      patientPhone: "9876543204",
      appointmentDate: todayStr,
      timeSlot: "09:00 AM - 01:00 PM",
      notes: "Checkup",
    });
    expect(fourthBlocked.status).toBe(409);

    // Hospital Admin cancels Token #2 -> frees seat immediately!
    const cancelRes = await request(app)
      .patch(`/api/v1/appointments/${bookings[1].appointment._id}/status`)
      .set("Authorization", `Bearer ${hospToken}`)
      .send({ status: "CANCELLED" });
    expect(cancelRes.status).toBe(200);

    // Now Patient 4 can book the freed seat and receives fresh Token #4
    const fourthBooked = await request(app).post("/api/v1/appointments").send({
      doctorId: doc._id.toString(),
      patientName: "Queue Patient 4",
      patientAge: 31,
      patientPhone: "9876543204",
      appointmentDate: todayStr,
      timeSlot: "09:00 AM - 01:00 PM",
      notes: "Checkup",
    });
    expect(fourthBooked.status).toBe(201);
    expect(fourthBooked.body.data.tokenNumber).toBe(4);

    // Doctor calls Next Patient -> starts at Token #1, next in line skips cancelled #2 and points to #3
    const call1 = await request(app)
      .post("/api/v1/appointments/queue/next")
      .set("Authorization", `Bearer ${docToken}`)
      .send({ date: todayStr });
    expect(call1.status).toBe(200);
    expect(call1.body.data.currentServingToken).toBe(1);
    expect(call1.body.data.nextTokenNumber).toBe(3);

    // Patient 4 checks status -> Token #4 sees currently serving #1 and 1 active waiting (#3) ahead (cancelled #2 excluded!)
    const statusP4 = await request(app)
      .post("/api/v1/appointments/check-status")
      .send({
        appointmentId: fourthBooked.body.data.appointmentId,
        slug: org.slug,
        doctorSlug: doc.slug,
      });
    expect(statusP4.status).toBe(200);
    expect(statusP4.body.data.tokenNumber).toBe(4);
    expect(statusP4.body.data.queueInfo.currentServingToken).toBe(1);
    expect(statusP4.body.data.queueInfo.patientsAhead).toBe(1); // Only Token #3 ahead!

    // Doctor advances queue again -> Token #1 completes, Now Serving becomes Token #3 (skipping cancelled #2)
    const call2 = await request(app)
      .post("/api/v1/appointments/queue/next")
      .set("Authorization", `Bearer ${docToken}`)
      .send({ date: todayStr });
    expect(call2.status).toBe(200);
    expect(call2.body.data.currentServingToken).toBe(3);
    expect(call2.body.data.nextTokenNumber).toBe(4);
  });
});
