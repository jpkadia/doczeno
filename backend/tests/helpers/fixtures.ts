import { User, Organization, Doctor, Website } from "@/models";
import { AuthService } from "@/services/auth.service";
import { UserRole, WebsiteType } from "@/types";

export function getTodayIstDateStr(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

export const OPEN_ALL_WEEK_HOURS = JSON.stringify([
  { day: "Monday", isClosed: false, slots: [{ startTime: "09:00", endTime: "20:00" }] },
  { day: "Tuesday", isClosed: false, slots: [{ startTime: "09:00", endTime: "20:00" }] },
  { day: "Wednesday", isClosed: false, slots: [{ startTime: "09:00", endTime: "20:00" }] },
  { day: "Thursday", isClosed: false, slots: [{ startTime: "09:00", endTime: "20:00" }] },
  { day: "Friday", isClosed: false, slots: [{ startTime: "09:00", endTime: "20:00" }] },
  { day: "Saturday", isClosed: false, slots: [{ startTime: "09:00", endTime: "20:00" }] },
  { day: "Sunday", isClosed: false, slots: [{ startTime: "09:00", endTime: "20:00" }] },
]);

export async function createSuperadminFixture(suffix = "1") {
  const user = await User.create({
    email: `superadmin-${suffix}@doczeno.test`,
    passwordHash: "hashed",
    name: "Platform Superadmin",
    role: UserRole.SUPERADMIN,
    isActive: true,
  });
  return { user, token: AuthService.generateToken(user) };
}

export async function createHospitalFixture(params?: {
  slug?: string;
  name?: string;
  specialties?: string[];
  email?: string;
}) {
  const slug = params?.slug || `city-care-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const specs = params?.specialties || ["Cardiology", "Orthopedics"];
  const org = await Organization.create({
    name: params?.name || "City Care Hospital",
    type: "HOSPITAL",
    slug,
    specialties: specs,
    departments: specs,
    phone: "9876500001",
    email: params?.email || `${slug}@hospital.test`,
    address: { city: "Ahmedabad", state: "Gujarat", pincode: "380001", country: "India" },
    workingHours: OPEN_ALL_WEEK_HOURS,
    weeklyOff: "",
    status: "ACTIVE",
  });

  const website = await Website.create({
    websiteType: WebsiteType.HOSPITAL_CLINIC,
    ownerType: "ORGANIZATION",
    ownerId: org._id,
    organizationId: org._id,
    slug,
    templateId: "hospital-classic",
    publishStatus: "PUBLISHED",
  });

  const user = await User.create({
    email: `admin-${slug}@hospital.test`,
    passwordHash: "hashed",
    name: `${org.name} Admin`,
    role: UserRole.HOSPITAL_ADMIN,
    organizationId: org._id,
    isActive: true,
  });

  return { org, website, user, token: AuthService.generateToken(user) };
}

export async function createHospitalDoctorFixture(
  orgId: any,
  hospitalSlug: string,
  params?: {
    slug?: string;
    doctorName?: string;
    specialization?: string;
  }
) {
  const docSlug = params?.slug || `dr-patel-${Math.random().toString(36).slice(2, 6)}`;
  const doctor = await Doctor.create({
    organizationId: orgId,
    doctorName: params?.doctorName || "Rohan Patel",
    gender: "MALE",
    degree: "MD Medicine",
    specialization: params?.specialization || "Cardiology",
    yearsOfExperience: 8,
    newCaseFee: 500,
    oldCaseFee: 300,
    email: `${docSlug}@hospital.test`,
    slug: docSlug,
    consultationHours: OPEN_ALL_WEEK_HOURS,
    weeklyOff: "",
    status: "ACTIVE",
    approvalStatus: "APPROVED",
  });

  const website = await Website.create({
    websiteType: WebsiteType.HOSPITAL_DOCTOR,
    ownerType: "DOCTOR",
    ownerId: doctor._id,
    organizationId: orgId,
    doctorId: doctor._id,
    slug: `${hospitalSlug}-${docSlug}`,
    templateId: "hospital-classic",
    publishStatus: "PUBLISHED",
  });

  const user = await User.create({
    email: doctor.email,
    passwordHash: "hashed",
    name: doctor.doctorName,
    role: UserRole.HOSPITAL_DOCTOR,
    organizationId: orgId,
    doctorProfileId: doctor._id,
    isActive: true,
  });

  return { doctor, website, user, token: AuthService.generateToken(user) };
}

export async function createOnlyDoctorFixture(params?: {
  slug?: string;
  doctorName?: string;
  specialization?: string;
}) {
  const slug = params?.slug || `dr-mehta-${Math.random().toString(36).slice(2, 6)}`;
  const doctor = await Doctor.create({
    organizationId: null,
    doctorName: params?.doctorName || "Karan Mehta",
    gender: "MALE",
    degree: "MD Dermatology",
    specialization: params?.specialization || "Dermatology",
    yearsOfExperience: 10,
    newCaseFee: 700,
    oldCaseFee: 400,
    clinicName: "Mehta Skin Clinic",
    phone: "9876500099",
    email: `${slug}@clinic.test`,
    address: { city: "Surat", state: "Gujarat", pincode: "395001", country: "India" },
    slug,
    consultationHours: OPEN_ALL_WEEK_HOURS,
    weeklyOff: "",
    status: "ACTIVE",
    approvalStatus: "APPROVED",
  });

  const website = await Website.create({
    websiteType: WebsiteType.ONLY_DOCTOR,
    ownerType: "DOCTOR",
    ownerId: doctor._id,
    doctorId: doctor._id,
    slug,
    templateId: "hospital-classic",
    publishStatus: "PUBLISHED",
  });

  const user = await User.create({
    email: doctor.email,
    passwordHash: "hashed",
    name: doctor.doctorName,
    role: UserRole.ONLY_DOCTOR,
    doctorProfileId: doctor._id,
    isActive: true,
  });

  return { doctor, website, user, token: AuthService.generateToken(user) };
}
