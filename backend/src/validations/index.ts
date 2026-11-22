import { z } from "zod";
import { UserRole } from "@/types";

export const registerSchema = z.object({
  email: z.string().email("Valid email is required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  name: z.string().min(2, "Name must be at least 2 characters"),
  role: z.nativeEnum(UserRole).default(UserRole.ONLY_DOCTOR),
  organizationId: z.string().optional(),
  doctorProfileId: z.string().optional(),
});

export const loginSchema = z.object({
  email: z.string().email("Valid email is required"),
  password: z.string().min(1, "Password is required"),
  targetSlug: z.string().optional(),
  doctorSlug: z.string().optional(),
  requiredRole: z.nativeEnum(UserRole).optional(),
});

export const forgotPasswordSendOtpSchema = z.object({
  email: z.string().email("Valid email is required"),
  targetSlug: z.string().optional(),
  doctorSlug: z.string().optional(),
});

export const forgotPasswordVerifyOtpSchema = z.object({
  email: z.string().email("Valid email is required"),
  otp: z.string().length(6, "Verification code must be 6 digits"),
  targetSlug: z.string().optional(),
  doctorSlug: z.string().optional(),
});

export const forgotPasswordResetSchema = z
  .object({
    email: z.string().email("Valid email is required"),
    resetToken: z.string().min(1, "Reset token is required"),
    newPassword: z
      .string()
      .min(6, "Password must be at least 6 characters")
      .regex(/[A-Z]/, "Password must contain at least 1 uppercase letter")
      .regex(/[0-9]/, "Password must contain at least 1 number")
      .regex(/[^A-Za-z0-9]/, "Password must contain at least 1 special symbol"),
    confirmPassword: z.string().min(1, "Please confirm your new password"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Password and Confirm Password must match",
    path: ["confirmPassword"],
  });

export const organizationCreateSchema = z.object({
  name: z.string().min(2, "Organization name is required"),
  type: z.enum(["HOSPITAL", "CLINIC"]).default("HOSPITAL"),
  slug: z.string().min(2).regex(/^[a-z0-9-]+$/, "Slug must contain only lowercase alphanumeric characters and hyphens"),
  about: z.string().optional(),
  phone: z.string().min(5, "Phone is required"),
  whatsApp: z.string().optional(),
  email: z.string().email("Valid email is required"),
  address: z.object({
    street: z.string().optional(),
    city: z.string().min(2, "City is required"),
    state: z.string().min(2, "State is required"),
    pincode: z.string().min(4, "Pincode is required"),
    country: z.string().default("India"),
  }),
  workingHours: z.string().optional(),
  weeklyOff: z.string().optional(),
  appointmentRequired: z.boolean().default(true),
  selectedTheme: z.string().default("theme-teal-modern"),
  faviconUrl: z.string().optional(),
  browserTabTitle: z.string().default("Hospital & Healthcare Center"),
  logo: z.object({ url: z.string(), publicId: z.string().optional() }).optional(),
  buildingPhoto: z.object({ url: z.string(), publicId: z.string().optional() }).optional(),
  galleryPhotos: z.array(z.object({ url: z.string(), publicId: z.string().optional() })).optional(),
  specialties: z.array(z.string()).optional(),
  departments: z.array(z.string()).optional(),
});

export const organizationUpdateSchema = organizationCreateSchema.partial();

export const doctorCreateSchema = z.object({
  organizationId: z.string().nullable().optional(),
  doctorName: z.string().min(2, "Doctor name is required"),
  gender: z.enum(["MALE", "FEMALE"]).default("MALE"),
  degree: z.string().min(2, "Degree is required"),
  specialization: z.string().min(2, "Specialization is required"),
  yearsOfExperience: z.number().min(0, "Experience must be a positive number"),
  newCaseFee: z.number().min(0, "Fee cannot be negative").optional(),
  oldCaseFee: z.number().min(0, "Fee cannot be negative").optional(),
  whatsApp: z.string().optional(),
  email: z.string().email("Valid email is required"),
  consultationHours: z.string().optional(),
  weeklyOff: z.string().optional(),
  appointmentRequired: z.boolean().default(true),
  slug: z.string().min(2).regex(/^[a-z0-9-]+$/, "Slug must contain only lowercase alphanumeric characters and hyphens"),
  selectedTheme: z.string().optional(),
  faviconUrl: z.string().optional(),
  browserTabTitle: z.string().optional(),
  bio: z.string().optional(),
  phone: z.string().optional(),
  clinicName: z.string().optional(),
  doctorPhoto: z.object({ url: z.string(), publicId: z.string().optional() }).optional(),
  clinicLogo: z.object({ url: z.string(), publicId: z.string().optional() }).optional(),
  clinicPhotos: z.array(z.object({ url: z.string(), publicId: z.string().optional() })).optional(),
});

export const doctorUpdateSchema = doctorCreateSchema.partial();

export const appointmentCreateSchema = z.object({
  organizationId: z.string().nullable().optional(),
  doctorId: z.string().min(1, "Doctor ID is required"),
  patientName: z.string().min(2, "Patient name is required"),
  patientAge: z.coerce.number().min(1, "Patient age is required").max(120, "Please enter a valid age"),
  patientPhone: z.string().min(5, "Patient phone is required"),
  patientEmail: z.string().email().optional(),
  appointmentDate: z.coerce.date(),
  timeSlot: z.string().min(1, "Time slot is required"),
  notes: z.string().min(2, "Patient medical concern / reason for visit is required"),
});
