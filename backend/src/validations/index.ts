import { z } from "zod";
import { UserRole } from "@/types";

export const registerSchema = z.object({
  email: z.string().email("Valid email is required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  name: z.string().min(2, "Name must be at least 2 characters"),
  role: z.nativeEnum(UserRole).default(UserRole.INDEPENDENT_DOCTOR),
  organizationId: z.string().optional(),
  doctorProfileId: z.string().optional(),
});

export const loginSchema = z.object({
  email: z.string().email("Valid email is required"),
  password: z.string().min(1, "Password is required"),
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
});

export const organizationUpdateSchema = organizationCreateSchema.partial();

export const doctorCreateSchema = z.object({
  organizationId: z.string().nullable().optional(),
  doctorName: z.string().min(2, "Doctor name is required"),
  gender: z.enum(["MALE", "FEMALE", "OTHER"]).default("MALE"),
  degree: z.string().min(2, "Degree is required"),
  specialization: z.string().min(2, "Specialization is required"),
  yearsOfExperience: z.number().min(0, "Experience must be a positive number"),
  whatsApp: z.string().optional(),
  email: z.string().email("Valid email is required"),
  consultationHours: z.string().optional(),
  weeklyOff: z.string().optional(),
  appointmentRequired: z.boolean().default(true),
  slug: z.string().min(2).regex(/^[a-z0-9-]+$/, "Slug must contain only lowercase alphanumeric characters and hyphens"),
});

export const doctorUpdateSchema = doctorCreateSchema.partial();

export const appointmentCreateSchema = z.object({
  organizationId: z.string().nullable().optional(),
  doctorId: z.string().min(1, "Doctor ID is required"),
  patientName: z.string().min(2, "Patient name is required"),
  patientPhone: z.string().min(5, "Patient phone is required"),
  patientEmail: z.string().email().optional(),
  appointmentDate: z.coerce.date(),
  timeSlot: z.string().min(1, "Time slot is required"),
  notes: z.string().optional(),
});
