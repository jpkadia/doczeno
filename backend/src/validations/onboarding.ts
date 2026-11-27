import { z } from "zod";
import {
  INDIA_STATES_AND_CITIES,
  DAYS_OF_WEEK,
  RESERVED_SLUGS,
} from "@/constants/healthcare";

/**
 * Safely strips duplicate "Dr.", "Dr ", or "Doctor " prefixes to prevent "Dr. Dr." display bugs
 */
export function normalizeDoctorName(input: string): string {
  if (!input) return "";
  let trimmed = input.trim();
  // Case-insensitive removal of leading Dr., Dr, Doctor prefixes
  trimmed = trimmed.replace(/^(dr\.|dr|doctor)\s+/i, "");
  return trimmed.trim();
}

/**
 * Converts "HH:MM" to total minutes from midnight for comparisons
 */
export function timeStringToMinutes(timeStr: string): number {
  const parts = timeStr.split(":");
  if (parts.length !== 2) return NaN;
  const hours = parseInt(parts[0] || "", 10);
  const minutes = parseInt(parts[1] || "", 10);
  if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return NaN;
  }
  return hours * 60 + minutes;
}

export const timeSlotSchema = z
  .object({
    startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Start time must be in HH:MM format (24h)"),
    endTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "End time must be in HH:MM format (24h)"),
  })
  .refine(
    (slot) => {
      const startMin = timeStringToMinutes(slot.startTime);
      const endMin = timeStringToMinutes(slot.endTime);
      return !isNaN(startMin) && !isNaN(endMin) && startMin < endMin;
    },
    {
      message: "Slot start time must be earlier than end time",
      path: ["endTime"],
    }
  );

export const dayScheduleSchema = z.object({
  day: z.enum(DAYS_OF_WEEK),
  isClosed: z.boolean().default(false),
  slots: z.array(timeSlotSchema).default([]),
});

export const consultationHoursSchema = z
  .array(dayScheduleSchema)
  .min(1, "At least one day schedule is required")
  .refine(
    (days) => {
      // For any open day, ensure at least one valid slot exists
      return days.every((d) => d.isClosed || d.slots.length > 0);
    },
    {
      message: "Open days must have at least one consultation slot",
    }
  );

export const phoneSchema = z
  .string()
  .min(7, "Phone number must have at least 7 digits")
  .regex(/^\+?[0-9\s-]{7,20}$/, "Invalid phone or WhatsApp number format");

export function validatePostalCodeForCountry(
  countryNameOrCode: string,
  pincode: string
): { isValid: boolean; error?: string } {
  const norm = (countryNameOrCode || "India").trim().toLowerCase();
  const trimmed = (pincode || "").trim();

  if (!trimmed) {
    return { isValid: false, error: "Postal/PIN code is required" };
  }

  if (norm === "india" || norm === "in") {
    if (!/^[1-9][0-9]{5}$/.test(trimmed)) {
      return { isValid: false, error: "Must be a valid 6-digit Indian PIN code" };
    }
    return { isValid: true };
  }

  if (norm === "united states" || norm === "us" || norm === "usa") {
    if (!/^\d{5}(-\d{4})?$/.test(trimmed)) {
      return { isValid: false, error: "Must be a valid 5-digit US ZIP code" };
    }
    return { isValid: true };
  }

  if (norm === "united kingdom" || norm === "gb" || norm === "uk") {
    if (!/^[A-Za-z]{1,2}\d[A-Za-z\d]? ?\d[A-Za-z]{2}$/.test(trimmed)) {
      return { isValid: false, error: "Must be a valid UK postcode" };
    }
    return { isValid: true };
  }

  if (norm === "canada" || norm === "ca") {
    if (!/^[A-Za-z]\d[A-Za-z] ?\d[A-Za-z]\d$/.test(trimmed)) {
      return { isValid: false, error: "Must be a valid Canadian postal code" };
    }
    return { isValid: true };
  }

  if (norm === "australia" || norm === "au") {
    if (!/^\d{4}$/.test(trimmed)) {
      return { isValid: false, error: "Must be a valid 4-digit Australian postcode" };
    }
    return { isValid: true };
  }

  if (!/^[A-Za-z0-9\s-]{3,10}$/.test(trimmed)) {
    return { isValid: false, error: "Must be a valid postal code (3-10 characters)" };
  }

  return { isValid: true };
}

export const pincodeSchema = z.string().min(2, "Postal/PIN code is required");

export const slugSchema = z
  .string()
  .min(2, "Slug must be at least 2 characters")
  .max(60, "Slug cannot exceed 60 characters")
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must contain only lowercase alphanumeric characters and hyphens")
  .refine((slug) => !RESERVED_SLUGS.includes(slug as (typeof RESERVED_SLUGS)[number]), {
    message: "This website slug is reserved and cannot be used",
  });

export const mediaAssetSchema = z.object({
  url: z.string().min(1, "Valid URL or path is required"),
  publicId: z.string().optional(),
  altText: z.string().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
  sizeBytes: z.number().optional(),
  mimeType: z.string().optional(),
});

export const addressSchema = z
  .object({
    street: z.string().optional(),
    country: z.string().default("India"),
    state: z.string().min(1, "State is required"),
    city: z.string().min(1, "City is required"),
    pincode: pincodeSchema,
  })
  .refine(
    (addr) => {
      if (addr.country && addr.country !== "India") return true;
      const cities = INDIA_STATES_AND_CITIES[addr.state];
      if (!cities) return false;
      return cities.includes(addr.city);
    },
    {
      message: "Selected city does not belong to the selected state",
      path: ["city"],
    }
  )
  .refine(
    (addr) => {
      return validatePostalCodeForCountry(addr.country || "India", addr.pincode).isValid;
    },
    (addr) => ({
      message: validatePostalCodeForCountry(addr.country || "India", addr.pincode).error || "Invalid postal code",
      path: ["pincode"],
    })
  );

export const securePasswordSchema = z
  .string()
  .min(6, "Password must be at least 6 characters")
  .regex(/[A-Z]/, "Password must contain at least 1 uppercase letter")
  .regex(/[0-9]/, "Password must contain at least 1 number")
  .regex(/[^A-Za-z0-9]/, "Password must contain at least 1 special symbol (e.g. @, #, $, !)");

export const onlyDoctorOnboardingSchema = z
  .object({
    doctorName: z
      .string()
      .min(2, "Doctor name must be at least 2 characters")
      .transform(normalizeDoctorName),
    gender: z.enum(["MALE", "FEMALE"]),
    degree: z.string().min(2, "Medical degree is required (e.g. MBBS, MD)"),
    specialization: z.string().min(2, "Specialization is required"),
    yearsOfExperience: z
      .number()
      .int("Years of experience must be an integer")
      .min(0, "Experience cannot be negative")
      .max(70, "Experience cannot exceed 70 years"),
    whatsApp: phoneSchema,
    email: z.string().email("Valid email address is required"),
    adminEmail: z.string().email("Valid admin login email is required").optional().or(z.literal("")),
    consultationHours: consultationHoursSchema,
    weeklyOff: z.array(z.enum(DAYS_OF_WEEK)).min(0),
    appointmentRequired: z.boolean().default(true),
    newCaseFee: z.number().min(0, "Fee cannot be negative").optional(),
    oldCaseFee: z.number().min(0, "Fee cannot be negative").optional(),
    clinicName: z.string().min(2, "Clinic or Hospital name is required"),
    address: addressSchema,
    selectedTheme: z.string().default("hospital-classic"),
    doctorPhoto: mediaAssetSchema.optional(),
    clinicLogo: mediaAssetSchema.optional(),
    clinicPhotos: z.array(mediaAssetSchema).max(6, "Maximum 6 clinic gallery photos allowed").default([]),
    password: securePasswordSchema.optional(),
    confirmPassword: z.string().optional(),
    otp: z.string().length(6, "Verification code must be 6 digits").optional(),
    isDraft: z.boolean().default(false),
    customSlug: slugSchema.optional(),
  })
  .refine((data) => data.isDraft || !!data.doctorPhoto, {
    message: "Doctor profile photo is required before publishing",
    path: ["doctorPhoto"],
  })
  .refine((data) => data.isDraft || (!!data.password && data.password.length >= 6), {
    message: "Password must be at least 6 characters",
    path: ["password"],
  })
  .refine((data) => data.isDraft || (!!data.password && !!data.confirmPassword && data.password === data.confirmPassword), {
    message: "Password and Confirm Password must match",
    path: ["confirmPassword"],
  });

export const hospitalOnboardingSchema = z
  .object({
    hospitalName: z.string().min(2, "Hospital or Clinic name is required"),
    type: z.enum(["HOSPITAL", "CLINIC"]).default("HOSPITAL"),
    specialties: z.array(z.string()).min(1, "Please select at least one medical specialty/department").default([]),
    slug: slugSchema,
    about: z.string().optional().default(""),
    phone: phoneSchema,
    whatsApp: phoneSchema,
    email: z.string().email("Valid official email address is required"),
    address: addressSchema,
    workingHours: consultationHoursSchema,
    weeklyOff: z.array(z.enum(DAYS_OF_WEEK)).min(0),
    appointmentRequired: z.boolean().default(true),
    logo: mediaAssetSchema,
    buildingPhoto: mediaAssetSchema,
    galleryPhotos: z.array(mediaAssetSchema).max(6, "Maximum 6 hospital photos allowed").default([]),
    selectedTheme: z.string().default("hospital-classic"),
    adminName: z.string().min(2, "Admin name is required"),
    adminEmail: z.string().email("Valid admin login email is required"),
    adminPassword: z.string().optional(),
    password: securePasswordSchema.optional(),
    confirmPassword: z.string().optional(),
    otp: z.string().length(6, "Verification code must be 6 digits").optional(),
    isDraft: z.boolean().default(false),
  })
  .refine(
    (data) => {
      const pwd = data.password || data.adminPassword;
      return data.isDraft || (!!pwd && pwd.length >= 6);
    },
    {
      message: "Admin password must be at least 6 characters",
      path: ["adminPassword"],
    }
  )
  .refine(
    (data) => {
      const pwd = data.password || data.adminPassword;
      return data.isDraft || (!!pwd && !!data.confirmPassword && pwd === data.confirmPassword);
    },
    {
      message: "Password and Confirm Password must match",
      path: ["confirmPassword"],
    }
  );

export const hospitalDoctorOnboardingSchema = z
  .object({
    organizationId: z.string().min(1, "A valid hospital organization must be selected"),
    doctorName: z
      .string()
      .min(2, "Doctor name must be at least 2 characters")
      .transform(normalizeDoctorName),
    gender: z.enum(["MALE", "FEMALE"]),
    degree: z.string().min(2, "Medical degree is required"),
    specialization: z.string().min(2, "Specialization is required"),
    yearsOfExperience: z
      .number()
      .int("Years of experience must be an integer")
      .min(0, "Experience cannot be negative")
      .max(70, "Experience cannot exceed 70 years"),
    whatsApp: phoneSchema,
    email: z.string().email("Valid email address is required"),
    adminEmail: z.string().email("Valid admin login email is required").optional().or(z.literal("")),
    consultationHours: consultationHoursSchema,
    weeklyOff: z.array(z.enum(DAYS_OF_WEEK)).min(0),
    appointmentRequired: z.boolean().default(true),
    newCaseFee: z.number().min(0, "Fee cannot be negative").optional(),
    oldCaseFee: z.number().min(0, "Fee cannot be negative").optional(),
    doctorPhoto: mediaAssetSchema,
    password: securePasswordSchema.optional(),
    confirmPassword: z.string().optional(),
    otp: z.string().length(6, "Verification code must be 6 digits").optional(),
    isDraft: z.boolean().default(false),
    customSlug: slugSchema.optional(),
  })
  .refine((data) => data.isDraft || (!!data.password && data.password.length >= 6), {
    message: "Password must be at least 6 characters",
    path: ["password"],
  })
  .refine((data) => data.isDraft || (!!data.password && !!data.confirmPassword && data.password === data.confirmPassword), {
    message: "Password and Confirm Password must match",
    path: ["confirmPassword"],
  });
