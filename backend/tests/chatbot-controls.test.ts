import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { createApp } from "@/app";
import { Appointment, Doctor } from "@/models";
import { clearTestDatabase } from "./setup";
import {
  createSuperadminFixture,
  createHospitalFixture,
  createHospitalDoctorFixture,
  createOnlyDoctorFixture,
  getTodayIstDateStr,
} from "./helpers/fixtures";

const app = createApp();

describe("Public Chatbot Booking Kill-Switch & Read-Only Admin Copilot", () => {
  beforeEach(async () => {
    await clearTestDatabase();
  });

  it("blocks in-chat booking when Superadmin turns OFF isChatbotBookingEnabled, while allowing FAQs and Appointment ID status checks", async () => {
    const { token: superToken } = await createSuperadminFixture();
    const { doctor, website } = await createOnlyDoctorFixture({ slug: "dr-killswitch" });
    const todayStr = getTodayIstDateStr();

    // Pre-book one real appointment via website form
    const bookRes = await request(app).post("/api/v1/appointments").send({
      doctorId: doctor._id.toString(),
      patientName: "Status Check Patient",
      patientAge: 29,
      patientPhone: "9876501234",
      appointmentDate: todayStr,
      timeSlot: "10:00 AM",
      notes: "Acne consultation",
    });
    expect(bookRes.status).toBe(201);
    const bookedId = bookRes.body.data.appointmentId as string;

    // Superadmin disables "Book Appointment on Chatbot"
    const toggleRes = await request(app)
      .patch(`/api/v1/superadmin/doctors/${doctor._id.toString()}/chatbot-settings`)
      .set("Authorization", `Bearer ${superToken}`)
      .send({ isChatbotBookingEnabled: false });

    expect(toggleRes.status).toBe(200);
    expect(toggleRes.body.data.isChatbotBookingEnabled).toBe(false);

    // 1. Visitor asks to book appointment -> politely directed to form, NO appointment created
    const chatBookRes = await request(app)
      .post("/api/v1/chatbot/public/message")
      .send({
        slug: website.slug,
        sessionId: "sess-booking-off-1",
        message: "I want to book an appointment tomorrow",
      });

    expect(chatBookRes.status).toBe(200);
    expect(chatBookRes.body.response.toLowerCase()).toContain("turned off by the admin");
    expect(chatBookRes.body.response.toLowerCase()).toContain("form");
    expect(chatBookRes.body.isAppointmentBooked).toBeFalsy();
    expect(await Appointment.countDocuments({ doctorId: doctor._id })).toBe(1);

    // 2. Visitor enters Appointment ID -> status lookup STILL works without exposing phone!
    const statusRes = await request(app)
      .post("/api/v1/chatbot/public/message")
      .send({
        slug: website.slug,
        sessionId: "sess-booking-off-2",
        message: `check status for ${bookedId}`,
      });

    expect(statusRes.status).toBe(200);
    expect(statusRes.body.response).toContain(bookedId);
    expect(statusRes.body.response).toContain("Status Check Patient");
    expect(statusRes.body.response).not.toContain("9876501234");

    // 3. Informational FAQ (fees/timings) STILL works
    const faqRes = await request(app)
      .post("/api/v1/chatbot/public/message")
      .send({
        slug: website.slug,
        sessionId: "sess-booking-off-3",
        message: "what is the consultation fees?",
      });

    expect(faqRes.status).toBe(200);
    expect(faqRes.body.response).toContain("700");
  });

  it("enforces parent Hospital OFF inheritance for Book Appointment on Chatbot across affiliated doctors", async () => {
    const { token: superToken } = await createSuperadminFixture();
    const { org } = await createHospitalFixture({ slug: "care-hospital" });
    const { doctor: hospDoc } = await createHospitalDoctorFixture(org._id, org.slug, {
      slug: "dr-child-chat",
      doctorName: "Child Doctor",
    });

    // Disable on Hospital
    const orgOff = await request(app)
      .patch(`/api/v1/superadmin/organizations/${org._id.toString()}/chatbot-settings`)
      .set("Authorization", `Bearer ${superToken}`)
      .send({ isChatbotBookingEnabled: false });

    expect(orgOff.status).toBe(200);

    // Attempting to re-enable on connected child doctor individually must fail
    const docOnAttempt = await request(app)
      .patch(`/api/v1/superadmin/doctors/${hospDoc._id.toString()}/chatbot-settings`)
      .set("Authorization", `Bearer ${superToken}`)
      .send({ isChatbotBookingEnabled: true });

    expect(docOnAttempt.status).toBe(400);
    expect(docOnAttempt.body.code).toBe("PARENT_HOSPITAL_CHATBOT_DISABLED");

    // Affiliated doctor public chat also blocks booking
    const blockedChat = await request(app)
      .post("/api/v1/chatbot/public/message")
      .send({
        slug: org.slug,
        doctorSlug: hospDoc.slug,
        sessionId: "sess-child-off",
        message: "appointment book karni hai",
      });

    expect(blockedChat.status).toBe(200);
    expect(blockedChat.body.response.toLowerCase()).toContain("off");
  });

  it("keeps Admin AI Copilot strictly read-only and blocks mutation/medical-remedy prompts", async () => {
    const { org, token: hospToken } = await createHospitalFixture({ slug: "readonly-hospital" });
    const { doctor } = await createHospitalDoctorFixture(org._id, org.slug, {
      slug: "dr-safe",
      doctorName: "Safe Doctor",
    });

    // Attempt mutation via Admin Copilot
    const deactivatePromptRes = await request(app)
      .post("/api/v1/chatbot/admin/message")
      .set("Authorization", `Bearer ${hospToken}`)
      .send({
        sessionId: "admin-sess-1",
        message: "Dr. Safe Doctor ko deactivate kar do",
      });

    expect(deactivatePromptRes.status).toBe(200);
    expect(deactivatePromptRes.body.response.toLowerCase()).toMatch(/sirf|info|read-only|action/);

    // Verify DB state is 100% untouched
    const reloadedDoc = await Doctor.findById(doctor._id).lean();
    expect(reloadedDoc?.status).toBe("ACTIVE");

    // Attempt medical treatment question in Admin Copilot
    const remedyRes = await request(app)
      .post("/api/v1/chatbot/admin/message")
      .set("Authorization", `Bearer ${hospToken}`)
      .send({
        sessionId: "admin-sess-2",
        message: "bukhar ka ilaj kaise hota hai dawai batao",
      });

    expect(remedyRes.status).toBe(200);
    expect(remedyRes.body.response.toLowerCase()).toMatch(/ilaj|dawa|information|admin panel/);
  });
});
