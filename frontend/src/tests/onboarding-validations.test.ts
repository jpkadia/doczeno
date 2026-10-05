import { describe, it, expect } from "vitest";
import {
  normalizeDoctorName,
  timeSlotSchema,
  independentDoctorOnboardingSchema,
  hospitalOnboardingSchema,
  hospitalDoctorOnboardingSchema,
} from "@/validations/onboarding";
import { MEDICAL_SPECIALIZATIONS } from "@/constants/healthcare";

describe("Frontend Client-Side Validation Rules", () => {
  const samplePhoto = {
    url: "https://res.cloudinary.com/doczeno/image/upload/sample.jpg",
  };

  const validSchedule = [
    {
      day: "Monday" as const,
      isClosed: false,
      slots: [{ startTime: "10:00", endTime: "14:00" }],
    },
    {
      day: "Sunday" as const,
      isClosed: true,
      slots: [],
    },
  ];

  const validAddress = {
    state: "Karnataka",
    city: "Bengaluru",
    pincode: "560001",
  };

  describe("Doctor Name Normalization", () => {
    it("strips various Dr. prefixes to prevent Dr. Dr. duplication in UI", () => {
      expect(normalizeDoctorName("Dr. Rajesh Kumar")).toBe("Rajesh Kumar");
      expect(normalizeDoctorName("dr. Rajesh Kumar")).toBe("Rajesh Kumar");
      expect(normalizeDoctorName("Dr Rajesh Kumar")).toBe("Rajesh Kumar");
      expect(normalizeDoctorName("Doctor Rajesh Kumar")).toBe("Rajesh Kumar");
      expect(normalizeDoctorName("doctor Rajesh Kumar")).toBe("Rajesh Kumar");
      expect(normalizeDoctorName("Rajesh Kumar")).toBe("Rajesh Kumar");
    });
  });

  describe("Consultation Time Slot Validation", () => {
    it("accepts valid start time before end time", () => {
      const result = timeSlotSchema.safeParse({
        startTime: "09:30",
        endTime: "13:00",
      });
      expect(result.success).toBe(true);
    });

    it("rejects slot where start time equals end time", () => {
      const result = timeSlotSchema.safeParse({
        startTime: "10:00",
        endTime: "10:00",
      });
      expect(result.success).toBe(false);
    });

    it("rejects slot where start time is after end time", () => {
      const result = timeSlotSchema.safeParse({
        startTime: "17:00",
        endTime: "11:00",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("Independent Doctor Schema", () => {
    it("validates compliant doctor form values", () => {
      const validForm = {
        doctorName: "Dr. Ananya Sharma",
        gender: "FEMALE",
        degree: "MBBS, MS",
        specialization: MEDICAL_SPECIALIZATIONS[0],
        yearsOfExperience: 10,
        whatsApp: "+919876543210",
        email: "ananya@sharma.clinic",
        consultationHours: validSchedule,
        weeklyOff: ["Sunday"],
        appointmentRequired: true,
        clinicName: "Sharma Health Center",
        address: validAddress,
        selectedTheme: "clinical-editorial",
        doctorPhoto: samplePhoto,
        galleryPhotos: [],
        isDraft: false,
      };

      const result = independentDoctorOnboardingSchema.safeParse(validForm);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.doctorName).toBe("Ananya Sharma");
      }
    });

    it("rejects invalid pincode", () => {
      const invalidForm = {
        doctorName: "Ananya Sharma",
        gender: "FEMALE",
        degree: "MBBS",
        specialization: MEDICAL_SPECIALIZATIONS[0],
        yearsOfExperience: 5,
        whatsApp: "+919876543210",
        email: "ananya@clinic.com",
        consultationHours: validSchedule,
        weeklyOff: [],
        clinicName: "Clinic",
        address: {
          state: "Karnataka",
          city: "Bengaluru",
          pincode: "123", // Invalid
        },
        selectedTheme: "modern-minimal",
        doctorPhoto: samplePhoto,
      };

      const result = independentDoctorOnboardingSchema.safeParse(invalidForm);
      expect(result.success).toBe(false);
    });
  });

  describe("Hospital Creation Schema", () => {
    it("rejects mismatching confirm password", () => {
      const result = hospitalOnboardingSchema.safeParse({
        hospitalName: "LifeCare Hospital",
        type: "HOSPITAL",
        slug: "lifecare-hospital",
        about: "A premier multi-speciality tertiary care hospital.",
        phone: "+918012345678",
        whatsApp: "+919876543210",
        email: "admin@lifecare.com",
        address: validAddress,
        workingHours: validSchedule,
        weeklyOff: ["Sunday"],
        appointmentRequired: true,
        logo: samplePhoto,
        galleryPhotos: [],
        selectedTheme: "vital-compact",
        adminName: "Hospital Admin",
        adminEmail: "admin@lifecare.com",
        adminPassword: "Password123!",
        confirmPassword: "WrongPassword123!", // Mismatch
      });

      expect(result.success).toBe(false);
    });
  });

  describe("Hospital Doctor Schema", () => {
    it("validates compliant affiliated clinician input", () => {
      const result = hospitalDoctorOnboardingSchema.safeParse({
        organizationId: "org-123",
        doctorName: "Dr. K. S. Verma",
        gender: "MALE",
        degree: "MBBS, MD",
        specialization: "Cardiology",
        yearsOfExperience: 14,
        whatsApp: "+919876543210",
        email: "verma@lifecare.com",
        consultationHours: validSchedule,
        weeklyOff: ["Sunday"],
        appointmentRequired: true,
        doctorPhoto: samplePhoto,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.doctorName).toBe("K. S. Verma");
      }
    });
  });
});
