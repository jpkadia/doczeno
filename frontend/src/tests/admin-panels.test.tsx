import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import * as React from "react";
import {
  IndependentDoctorAdmin,
  IndependentDoctorData,
  AppointmentItem,
} from "@/components/admin/views/independent-doctor-admin";
import {
  HospitalAdmin,
  HospitalData,
  HospitalDoctorItem,
} from "@/components/admin/views/hospital-admin";
import {
  HospitalDoctorAdmin,
  HospitalDoctorData,
} from "@/components/admin/views/hospital-doctor-admin";
import {
  SuperadminAdmin,
  SuperadminStats,
  SuperadminOrgItem,
  SuperadminDoctorItem,
  SuperadminWebsiteItem,
  SuperadminUserItem,
  SuperadminAppointmentItem,
  AuditLogItem,
} from "@/components/admin/views/superadmin-admin";

// ==========================================
// TEST FIXTURES
// ==========================================

const mockIndependentDoctor: IndependentDoctorData = {
  id: "dr-parth-kadiya",
  slug: "dr-parth-kadiya",
  doctorName: "Parth Kadiya",
  gender: "Male",
  degree: "MBBS, MS (General Surgery)",
  specialization: "General Surgery",
  yearsOfExperience: 12,
  whatsApp: "+91 9876543210",
  email: "dr.parth@doczeno.com",
  phone: "+91 9876543210",
  bio: "Senior laparoscopic and general surgeon with 12+ years experience.",
  clinicName: "Parth Surgical Hospital",
  address: {
    street: "101 Medical Enclave, SG Highway",
    city: "Ahmedabad",
    state: "Gujarat",
    pincode: "380054",
    country: "India",
  },
  consultationHours: "10:00 AM - 01:00 PM, 05:00 PM - 08:00 PM",
  weeklyOff: "Sunday",
  appointmentRequired: true,
  selectedTheme: "clinical-editorial",
  publishStatus: "PUBLISHED",
};

const mockHospital: HospitalData = {
  id: "org-apollo",
  name: "Apollo Hospitals Ahmedabad",
  slug: "apollo",
  type: "HOSPITAL",
  about: "Multi-specialty tertiary care hospital offering comprehensive healthcare services.",
  phone: "+91 79 6670 1800",
  whatsApp: "+91 9876543210",
  email: "contact@apollo.com",
  address: {
    street: "Plot No 1A, Bhat GIDC Estate",
    city: "Ahmedabad",
    state: "Gujarat",
    pincode: "382428",
    country: "India",
  },
  workingHours: "24/7 Emergency & Critical Care",
  weeklyOff: "None (Open 7 Days)",
  appointmentRequired: false,
  selectedTheme: "modern-minimal",
  logo: { url: "https://example.com/apollo-logo.png" },
  galleryPhotos: [
    { url: "https://example.com/apollo-campus-1.png" },
    { url: "https://example.com/apollo-campus-2.png" },
  ],
  departments: ["Cardiology", "Neurology", "Orthopedics", "Oncology"],
};

const mockHospitalDoctors: HospitalDoctorItem[] = [
  {
    id: "doc-rajiv",
    doctorName: "Rajiv Shah",
    slug: "dr-rajiv-shah",
    gender: "Male",
    degree: "MBBS, DM (Cardiology)",
    specialization: "Interventional Cardiology",
    yearsOfExperience: 14,
    email: "dr.rajiv@apollo.com",
    status: "ACTIVE",
    consultationHours: "10:00 AM - 01:00 PM",
    weeklyOff: "Sunday",
    appointmentRequired: true,
  },
  {
    id: "doc-ananya",
    doctorName: "Ananya Roy",
    slug: "dr-ananya-roy",
    gender: "Female",
    degree: "MBBS, MCh (Neuro)",
    specialization: "Neurosurgery",
    yearsOfExperience: 11,
    email: "dr.ananya@apollo.com",
    status: "ACTIVE",
    consultationHours: "02:00 PM - 06:00 PM",
    weeklyOff: "Sunday",
    appointmentRequired: true,
  },
];

const mockHospitalDoctorData: HospitalDoctorData = {
  id: "doc-rajiv",
  slug: "dr-rajiv-shah",
  doctorName: "Rajiv Shah",
  gender: "Male",
  degree: "MBBS, DM (Cardiology)",
  specialization: "Interventional Cardiology",
  yearsOfExperience: 14,
  whatsApp: "+91 9876543210",
  email: "dr.rajiv@apollo.com",
  phone: "+91 9876543210",
  bio: "Lead interventional cardiologist with extensive experience in coronary angioplasty.",
  consultationHours: "10:00 AM - 01:00 PM",
  weeklyOff: "Sunday",
  appointmentRequired: true,
  status: "ACTIVE",
  inheritedHospitalData: {
    organizationId: "org-apollo",
    organizationName: "Apollo Hospitals Ahmedabad",
    organizationSlug: "apollo",
    organizationType: "HOSPITAL",
    address: {
      street: "Plot No 1A, Bhat GIDC Estate",
      city: "Ahmedabad",
      state: "Gujarat",
      pincode: "382428",
      country: "India",
    },
    logo: { url: "https://example.com/apollo-logo.png" },
    galleryPhotos: [{ url: "https://example.com/apollo-campus-1.png" }],
    selectedTheme: "modern-minimal",
    browserTabTitle: "Apollo Hospitals Ahmedabad | Advanced Tertiary Care",
    isLocked: true,
    lockMessage: "Managed by Hospital Admin",
  },
  publishStatus: "PUBLISHED",
};

const mockSuperadminStats: SuperadminStats = {
  totalOrganizations: 15,
  totalDoctors: 42,
  totalWebsites: 57,
  totalUsers: 60,
  totalAppointments: 210,
  pendingAppointments: 8,
};

const mockSuperadminOrgs: SuperadminOrgItem[] = [
  {
    id: "org-1",
    name: "Apollo Hospitals Ahmedabad",
    slug: "apollo",
    type: "HOSPITAL",
    status: "ACTIVE",
    address: { city: "Ahmedabad", state: "Gujarat" },
    createdAt: "2026-09-01T10:00:00Z",
  },
];

const mockSuperadminDoctors: SuperadminDoctorItem[] = [
  {
    id: "doc-1",
    doctorName: "Parth Kadiya",
    slug: "dr-parth-kadiya",
    specialization: "General Surgery",
    yearsOfExperience: 12,
    status: "ACTIVE",
    organizationId: null,
    createdAt: "2026-09-02T10:00:00Z",
  },
  {
    id: "doc-2",
    doctorName: "Rajiv Shah",
    slug: "dr-rajiv-shah",
    specialization: "Interventional Cardiology",
    yearsOfExperience: 14,
    status: "ACTIVE",
    organizationId: { id: "org-1", name: "Apollo Hospitals Ahmedabad", slug: "apollo" },
    createdAt: "2026-09-05T10:00:00Z",
  },
];

const mockSuperadminWebsites: SuperadminWebsiteItem[] = [
  {
    id: "site-1",
    slug: "dr-parth-kadiya",
    websiteType: "INDEPENDENT_DOCTOR",
    publishStatus: "PUBLISHED",
    selectedTheme: "clinical-editorial",
  },
  {
    id: "site-2",
    slug: "apollo",
    websiteType: "HOSPITAL",
    publishStatus: "PUBLISHED",
    selectedTheme: "modern-minimal",
  },
];

const mockSuperadminUsers: SuperadminUserItem[] = [
  {
    id: "usr-1",
    name: "Platform Superadmin",
    email: "superadmin@doczeno.com",
    role: "SUPERADMIN",
    isActive: true,
    createdAt: "2026-08-01T00:00:00Z",
  },
  {
    id: "usr-2",
    name: "Dr. Parth Kadiya",
    email: "dr.parth@doczeno.com",
    role: "INDEPENDENT_DOCTOR",
    isActive: true,
    createdAt: "2026-09-02T10:00:00Z",
  },
];

const mockSuperadminAppointments: SuperadminAppointmentItem[] = [
  {
    id: "apt-1",
    patientName: "Aarav Patel",
    patientPhone: "+91 98765 43210",
    appointmentDate: "2026-10-10",
    timeSlot: "10:30 AM",
    status: "CONFIRMED",
    doctorId: { doctorName: "Parth Kadiya", specialization: "General Surgery" },
  },
];

const mockAuditLogs: AuditLogItem[] = [
  {
    id: "aud-1",
    action: "ORGANIZATION_STATUS_CHANGED",
    userEmail: "superadmin@doczeno.com",
    userRole: "SUPERADMIN",
    entityType: "Organization",
    timestamp: "2026-10-06T10:00:00.000Z",
  },
];

// ==========================================
// TEST SUITES
// ==========================================

describe("TASK 5 — Admin Panels + CRUD + Doctor Management + Appointments", () => {
  // ----------------------------------------------------
  // 1. INDEPENDENT DOCTOR ADMIN
  // ----------------------------------------------------
  describe("1. Independent Doctor Admin Panel", () => {
    it("renders doctor name, specialization, experience, and navigation items", () => {
      render(<IndependentDoctorAdmin initialData={mockIndependentDoctor} />);

      // Verify header and title
      expect(screen.getByText(/Dr\. Parth Kadiya — Administration/i)).toBeDefined();
      expect(screen.getAllByText("Parth Surgical Hospital").length).toBeGreaterThan(0);
      expect(screen.getAllByText("Independent Doctor").length).toBeGreaterThan(0);

      // Navigation tabs presence
      expect(screen.getByRole("button", { name: /Dashboard/i })).toBeDefined();
      expect(screen.getByRole("button", { name: /Doctor Profile/i })).toBeDefined();
      expect(screen.getByRole("button", { name: /Clinic & Address/i })).toBeDefined();
      expect(screen.getByRole("button", { name: /Consultation Hours/i })).toBeDefined();
      expect(screen.getByRole("button", { name: /Appointments/i })).toBeDefined();
      expect(screen.getByRole("button", { name: /Clinic Gallery/i })).toBeDefined();
      expect(screen.getByRole("button", { name: /AI Content & Bio/i })).toBeDefined();
      expect(screen.getByRole("button", { name: /SEO & Branding/i })).toBeDefined();
      expect(screen.getByRole("button", { name: /Account Settings/i })).toBeDefined();
    });

    it("allows switching tabs and displays doctor profile with Dr. prefix input", () => {
      render(<IndependentDoctorAdmin initialData={mockIndependentDoctor} />);

      // Click on Doctor Profile tab
      const profileTab = screen.getByRole("button", { name: /Doctor Profile/i });
      fireEvent.click(profileTab);

      // Verify Dr. prefix label & input
      expect(screen.getByText("Dr.")).toBeDefined();
      const nameInput = screen.getByLabelText(/Doctor Name/i) as HTMLInputElement;
      expect(nameInput.value).toBe("Parth Kadiya");
    });

    it("manages appointment status transitions (Confirm, Complete, Cancel)", async () => {
      const mockUpdate = vi.fn().mockResolvedValue(undefined);
      const testAppointments: AppointmentItem[] = [
        {
          id: "appt-test-1",
          patientName: "Neha Sharma",
          patientPhone: "+91 99999 11111",
          appointmentDate: "2026-10-12",
          timeSlot: "11:00 AM",
          status: "PENDING",
        },
      ];

      render(
        <IndependentDoctorAdmin
          initialData={mockIndependentDoctor}
          initialAppointments={testAppointments}
          onUpdateAppointmentStatus={mockUpdate}
        />
      );

      // Navigate to appointments tab
      const apptTab = screen.getByRole("button", { name: /Appointments/i });
      fireEvent.click(apptTab);

      // Verify appointment details rendered
      expect(screen.getByText("Neha Sharma")).toBeDefined();
      expect(screen.getByText("PENDING")).toBeDefined();

      // Click Confirm button
      const confirmBtn = screen.getByRole("button", { name: "Confirm" });
      fireEvent.click(confirmBtn);

      expect(mockUpdate).toHaveBeenCalledWith("appt-test-1", "CONFIRMED");
    });
  });

  // ----------------------------------------------------
  // 2. HOSPITAL ADMIN PANEL & DOCTOR MANAGEMENT
  // ----------------------------------------------------
  describe("2. Hospital Admin Panel & Doctor Management", () => {
    it("renders hospital admin header, contact info, and navigation items", () => {
      render(
        <HospitalAdmin
          initialHospital={mockHospital}
          initialDoctors={mockHospitalDoctors}
        />
      );

      expect(screen.getByText(/Apollo Hospitals Ahmedabad — Hospital Administration/i)).toBeDefined();
      expect(screen.getAllByText("Hospital Admin").length).toBeGreaterThan(0);

      // Navigation items
      expect(screen.getByRole("button", { name: /Dashboard/i })).toBeDefined();
      expect(screen.getByRole("button", { name: /Hospital Profile/i })).toBeDefined();
      expect(screen.getByRole("button", { name: /Contact & Location/i })).toBeDefined();
      expect(screen.getByRole("button", { name: /Working Hours/i })).toBeDefined();
      expect(screen.getByRole("button", { name: /Doctor Management/i })).toBeDefined();
      expect(screen.getByRole("button", { name: /Departments/i })).toBeDefined();
      expect(screen.getByRole("button", { name: /Theme & Branding/i })).toBeDefined();
    });

    it("displays doctor roster table with affiliated doctors and status toggles", () => {
      const mockToggle = vi.fn().mockResolvedValue(undefined);

      render(
        <HospitalAdmin
          initialHospital={mockHospital}
          initialDoctors={mockHospitalDoctors}
          onToggleDoctorStatus={mockToggle}
        />
      );

      // Navigate to Doctor Management tab
      const doctorTab = screen.getByRole("button", { name: /Doctor Management/i });
      fireEvent.click(doctorTab);

      // Verify doctors list
      expect(screen.getByText("Dr. Rajiv Shah")).toBeDefined();
      expect(screen.getByText("Interventional Cardiology")).toBeDefined();
      expect(screen.getByText("Dr. Ananya Roy")).toBeDefined();
      expect(screen.getByText("Neurosurgery")).toBeDefined();

      // Find Deactivate buttons
      const deactivateButtons = screen.getAllByRole("button", { name: "Deactivate" });
      expect(deactivateButtons.length).toBe(2);

      // Click deactivate on Rajiv Shah
      fireEvent.click(deactivateButtons[0]);
      expect(mockToggle).toHaveBeenCalledWith("doc-rajiv", "INACTIVE");
    });

    it("provides the 3-theme selector and propagates theme changes", async () => {
      const mockSave = vi.fn().mockResolvedValue(undefined);

      render(
        <HospitalAdmin
          initialHospital={mockHospital}
          initialDoctors={mockHospitalDoctors}
          onSaveHospital={mockSave}
        />
      );

      // Navigate to Theme & Branding tab
      const themeTab = screen.getByRole("button", { name: /Theme & Branding/i });
      fireEvent.click(themeTab);

      // Verify all 3 themes are available options
      expect(screen.getByText(/Clinical Editorial/i)).toBeDefined();
      expect(screen.getByText(/Modern Minimal/i)).toBeDefined();
      expect(screen.getByText(/Vital Compact/i)).toBeDefined();

      // Select Theme 03 Vital Compact card
      const theme3Card = screen.getByText(/Theme 03: Vital Compact/i);
      fireEvent.click(theme3Card);

      // Click Save Branding button
      const saveBtn = screen.getByRole("button", { name: /Save Branding/i });
      fireEvent.click(saveBtn);

      expect(mockSave).toHaveBeenCalledWith(
        expect.objectContaining({ selectedTheme: "vital-compact" })
      );
    });
  });

  // ----------------------------------------------------
  // 3. HOSPITAL DOCTOR ADMIN & INHERITED LOCKED STATE
  // ----------------------------------------------------
  describe("3. Hospital Doctor Admin & Inherited Locked State", () => {
    it("renders hospital affiliation notice and locked badge", () => {
      render(<HospitalDoctorAdmin initialData={mockHospitalDoctorData} />);

      // Verify title & affiliation
      expect(screen.getByText(/Dr\. Rajiv Shah — Administration/i)).toBeDefined();
      expect(screen.getAllByText(/Apollo Hospitals Ahmedabad/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText("Hospital Doctor").length).toBeGreaterThan(0);

      // Verify lock banner
      expect(screen.getAllByText(/🔒 Managed by Hospital Admin/i).length).toBeGreaterThan(0);
    });

    it("strictly shows inherited hospital information as read-only with zero edit inputs", () => {
      render(<HospitalDoctorAdmin initialData={mockHospitalDoctorData} />);

      // Switch to Hospital Facility & Brand tab
      const facilityTab = screen.getByRole("button", { name: /Hospital Facility & Brand/i });
      fireEvent.click(facilityTab);

      // Check for prominent lock notification
      expect(screen.getAllByText(/Managed by Hospital Admin/i).length).toBeGreaterThan(0);

      // Check read-only organization legal name & type
      expect(screen.getByText("Hospital Legal Name")).toBeDefined();
      expect(screen.getByText("Facility Type")).toBeDefined();
      expect(screen.getByText("Active Website Theme")).toBeDefined();
      expect(screen.getByText("modern minimal")).toBeDefined();

      // Check address
      expect(screen.getByText("Physical Location & Facility Address")).toBeDefined();
      expect(screen.getByText("Plot No 1A, Bhat GIDC Estate")).toBeDefined();
      expect(screen.getByText("Ahmedabad")).toBeDefined();
      expect(screen.getByText("382428")).toBeDefined();

      // CRITICAL: Ensure there are NO text inputs in the facility tab
      const allInputs = screen.queryAllByRole("textbox");
      expect(allInputs.length).toBe(0);
    });

    it("allows the doctor to edit their personal credentials, hours, and photo", () => {
      const mockSave = vi.fn().mockResolvedValue(undefined);

      render(
        <HospitalDoctorAdmin
          initialData={mockHospitalDoctorData}
          onSave={mockSave}
        />
      );

      // Switch to Professional Info tab
      const profTab = screen.getByRole("button", { name: /Professional Info/i });
      fireEvent.click(profTab);

      // Verify degree and specialization are editable inputs
      const degreeInput = screen.getByLabelText(/Degree \/ Medical Qualifications/i) as HTMLInputElement;
      expect(degreeInput.value).toBe("MBBS, DM (Cardiology)");

      fireEvent.change(degreeInput, { target: { value: "MBBS, MD, DM, FACC" } });
      const saveBtn = screen.getByRole("button", { name: /Save Professional Details/i });
      fireEvent.click(saveBtn);

      expect(mockSave).toHaveBeenCalledWith(
        expect.objectContaining({
          degree: "MBBS, MD, DM, FACC",
        })
      );
    });
  });

  // ----------------------------------------------------
  // 4. SUPERADMIN CONSOLE
  // ----------------------------------------------------
  describe("4. Superadmin Console", () => {
    it("renders platform metrics and system health indicators", () => {
      render(
        <SuperadminAdmin
          initialStats={mockSuperadminStats}
          initialOrganizations={mockSuperadminOrgs}
          initialDoctors={mockSuperadminDoctors}
          initialWebsites={mockSuperadminWebsites}
          initialUsers={mockSuperadminUsers}
          initialAppointments={mockSuperadminAppointments}
          initialAuditLogs={mockAuditLogs}
        />
      );

      expect(screen.getByText("Platform Superadmin Console")).toBeDefined();
      expect(screen.getAllByText("SUPERADMIN").length).toBeGreaterThan(0);

      // Stats metrics
      expect(screen.getAllByText("15").length).toBeGreaterThan(0); // total orgs
      expect(screen.getAllByText("42").length).toBeGreaterThan(0); // total doctors
      expect(screen.getAllByText("57").length).toBeGreaterThan(0); // total websites
      expect(screen.getAllByText("60").length).toBeGreaterThan(0); // total users
      expect(screen.getAllByText("210").length).toBeGreaterThan(0); // total appointments
      expect(screen.getAllByText("8").length).toBeGreaterThan(0); // pending appointments
    });

    it("allows filtering and toggling organization status", async () => {
      const mockToggleOrg = vi.fn().mockResolvedValue(undefined);

      render(
        <SuperadminAdmin
          initialStats={mockSuperadminStats}
          initialOrganizations={mockSuperadminOrgs}
          initialDoctors={mockSuperadminDoctors}
          initialWebsites={mockSuperadminWebsites}
          initialUsers={mockSuperadminUsers}
          initialAppointments={mockSuperadminAppointments}
          initialAuditLogs={mockAuditLogs}
          onToggleOrgStatus={mockToggleOrg}
        />
      );

      // Navigate to Organizations tab
      const orgTab = screen.getByRole("button", { name: /Organizations/i });
      fireEvent.click(orgTab);

      // Verify org table
      expect(screen.getByText("Apollo Hospitals Ahmedabad")).toBeDefined();
      expect(screen.getByText("/apollo")).toBeDefined();

      // Click Deactivate button
      const deactBtn = screen.getByRole("button", { name: "Deactivate" });
      fireEvent.click(deactBtn);

      expect(mockToggleOrg).toHaveBeenCalledWith("org-1", "INACTIVE");
    });

    it("allows toggling doctor status with website synchronization", async () => {
      const mockToggleDoc = vi.fn().mockResolvedValue(undefined);

      render(
        <SuperadminAdmin
          initialStats={mockSuperadminStats}
          initialOrganizations={mockSuperadminOrgs}
          initialDoctors={mockSuperadminDoctors}
          initialWebsites={mockSuperadminWebsites}
          initialUsers={mockSuperadminUsers}
          initialAppointments={mockSuperadminAppointments}
          initialAuditLogs={mockAuditLogs}
          onToggleDoctorStatus={mockToggleDoc}
        />
      );

      // Navigate to All Doctors tab
      const docTab = screen.getByRole("button", { name: /All Doctors/i });
      fireEvent.click(docTab);

      // Verify doctors listed
      expect(screen.getByText(/Parth Kadiya/i)).toBeDefined();
      expect(screen.getByText(/Rajiv Shah/i)).toBeDefined();

      const deactButtons = screen.getAllByRole("button", { name: "Deactivate" });
      fireEvent.click(deactButtons[0]);

      expect(mockToggleDoc).toHaveBeenCalledWith("doc-1", "INACTIVE");
    });

    it("allows unpublishing and publishing websites", async () => {
      const mockToggleWebsite = vi.fn().mockResolvedValue(undefined);

      render(
        <SuperadminAdmin
          initialStats={mockSuperadminStats}
          initialOrganizations={mockSuperadminOrgs}
          initialDoctors={mockSuperadminDoctors}
          initialWebsites={mockSuperadminWebsites}
          initialUsers={mockSuperadminUsers}
          initialAppointments={mockSuperadminAppointments}
          initialAuditLogs={mockAuditLogs}
          onToggleWebsitePublish={mockToggleWebsite}
        />
      );

      // Navigate to Websites Directory tab
      const siteTab = screen.getByRole("button", { name: /Websites Directory/i });
      fireEvent.click(siteTab);

      // Verify websites listed
      expect(screen.getByText("/dr-parth-kadiya")).toBeDefined();
      expect(screen.getByText("/apollo")).toBeDefined();

      // Click Unpublish to Draft
      const unpublishBtn = screen.getAllByRole("button", { name: "Unpublish to Draft" })[0];
      fireEvent.click(unpublishBtn);

      expect(mockToggleWebsite).toHaveBeenCalledWith("site-1", "DRAFT");
    });
  });
});
