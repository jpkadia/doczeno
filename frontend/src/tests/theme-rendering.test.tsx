import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import * as React from "react";
import { ThemeRenderer } from "@/components/themes/theme-renderer";
import { ClinicalEditorialTheme } from "@/components/themes/clinical-editorial-theme";
import { ModernMinimalTheme } from "@/components/themes/modern-minimal-theme";
import { VitalCompactTheme } from "@/components/themes/vital-compact-theme";
import { EffectiveWebsiteData } from "@/types";

const mockDoctorData: EffectiveWebsiteData = {
  websiteType: "INDEPENDENT_DOCTOR",
  slug: "dr-parth-kadiya",
  organizationName: "Aarogyam Heart Care",
  logo: { url: "https://res.cloudinary.com/doczeno/clinic-logo.png" },
  galleryPhotos: [
    { url: "https://res.cloudinary.com/doczeno/clinic-photo-1.jpg" },
    { url: "https://res.cloudinary.com/doczeno/clinic-photo-2.jpg" },
  ],
  address: {
    street: "102 Med Towers, SG Road",
    city: "Ahmedabad",
    state: "Gujarat",
    pincode: "380015",
    country: "India",
  },
  selectedTheme: "clinical-editorial",
  faviconUrl: "https://res.cloudinary.com/doczeno/favicon.ico",
  browserTabTitle: "Dr. Parth Kadiya — Cardiology Specialist",
  doctorName: "Parth Kadiya",
  gender: "MALE",
  degree: "MBBS, MD (General Medicine), DM (Cardiology)",
  specialization: "Cardiology",
  yearsOfExperience: 12,
  bio: "Dr. Parth Kadiya is a consultant interventional cardiologist specializing in coronary interventions, preventive cardiology, and structural heart care.",
  consultationHours: JSON.stringify([
    { day: "Monday", slots: [{ startTime: "10:00", endTime: "13:00" }, { startTime: "17:00", endTime: "20:00" }] },
    { day: "Wednesday", slots: [{ startTime: "10:00", endTime: "13:00" }] },
  ]),
  weeklyOff: "Sunday",
  appointmentRequired: true,
  whatsApp: "+919876543210",
  email: "dr.parth@aarogyam.com",
  phone: "+919876543210",
  doctorPhoto: { url: "https://res.cloudinary.com/doczeno/dr-parth.jpg" },
  isHospitalChild: false,
  faqs: [
    { question: "What should I bring to my first cardiac consultation?", answer: "Please bring past ECGs, blood reports, and current prescriptions." },
    { question: "Do you offer second opinions for angioplasty?", answer: "Yes, comprehensive angiogram review and non-invasive evaluations are provided." },
  ],
};

const mockHospitalData: EffectiveWebsiteData = {
  websiteType: "HOSPITAL_CLINIC",
  slug: "apollo-ahmedabad",
  organizationName: "Apollo Hospital International",
  organizationType: "HOSPITAL",
  logo: { url: "https://res.cloudinary.com/doczeno/apollo-logo.png" },
  galleryPhotos: [
    { url: "https://res.cloudinary.com/doczeno/icu.jpg" },
    { url: "https://res.cloudinary.com/doczeno/lobby.jpg" },
  ],
  address: {
    street: "Plot 1A, GIDC Bhat",
    city: "Gandhinagar",
    state: "Gujarat",
    pincode: "382428",
    country: "India",
  },
  selectedTheme: "modern-minimal",
  faviconUrl: "https://res.cloudinary.com/doczeno/apollo-fav.ico",
  browserTabTitle: "Apollo Hospitals International — Gandhinagar",
  bio: "Apollo Hospitals Gandhinagar is a multi-specialty tertiary care center equipped with state-of-the-art diagnostic and surgical technologies.",
  departments: ["Interventional Cardiology", "Neurology & Neurosurgery", "Oncology", "Orthopedics"],
  consultationHours: "24 Hours Emergency & Regular OPD 09:00 - 18:00",
  weeklyOff: "None (Open 24/7)",
  appointmentRequired: true,
  whatsApp: "+917966701800",
  email: "info@apolloahmedabad.com",
  phone: "+917966701800",
  isHospitalChild: false,
  doctorDirectory: [
    {
      id: "doc-1",
      doctorId: "doc-1",
      doctorName: "Rajiv Shah",
      slug: "dr-rajiv-shah",
      specialization: "Cardiology",
      degree: "MBBS, DM Cardiology",
      yearsOfExperience: 14,
      doctorPhoto: { url: "https://res.cloudinary.com/doczeno/dr-rajiv.jpg" },
    },
    {
      id: "doc-2",
      doctorId: "doc-2",
      doctorName: "Sneha Patel",
      slug: "dr-sneha-patel",
      specialization: "Neurology",
      degree: "MD, DM Neurology",
      yearsOfExperience: 9,
    },
  ],
  faqs: [
    { question: "Is the emergency trauma department open 24/7?", answer: "Yes, fully staffed round the clock with intensive care teams." },
  ],
};

const mockHospitalDoctorData: EffectiveWebsiteData = {
  websiteType: "HOSPITAL_DOCTOR",
  slug: "apollo-ahmedabad/dr-rajiv-shah",
  organizationName: "Apollo Hospital International",
  organizationType: "HOSPITAL",
  logo: { url: "https://res.cloudinary.com/doczeno/apollo-logo.png" },
  galleryPhotos: [
    { url: "https://res.cloudinary.com/doczeno/icu.jpg" },
  ],
  address: {
    street: "Plot 1A, GIDC Bhat",
    city: "Gandhinagar",
    state: "Gujarat",
    pincode: "382428",
    country: "India",
  },
  selectedTheme: "vital-compact",
  faviconUrl: "https://res.cloudinary.com/doczeno/apollo-fav.ico",
  browserTabTitle: "Apollo Hospitals International — Gandhinagar",
  doctorName: "Rajiv Shah",
  gender: "MALE",
  degree: "MBBS, DM Cardiology",
  specialization: "Cardiology",
  yearsOfExperience: 14,
  bio: "Dr. Rajiv Shah is a senior consultant cardiologist at Apollo Hospital International.",
  consultationHours: JSON.stringify([
    { day: "Tuesday", slots: [{ startTime: "10:00", endTime: "14:00" }] },
  ]),
  weeklyOff: "Sunday",
  appointmentRequired: true,
  whatsApp: "+919876511111",
  email: "dr.rajiv@apollo.com",
  phone: "+917966701800",
  doctorPhoto: { url: "https://res.cloudinary.com/doczeno/dr-rajiv.jpg" },
  isHospitalChild: true,
  hospitalSlug: "apollo-ahmedabad",
};

describe("Public Website Engine & Deterministic Themes (React)", () => {
  describe("ThemeRenderer Dispatcher", () => {
    it("dispatches to ClinicalEditorialTheme when selectedTheme is clinical-editorial", () => {
      render(<ThemeRenderer data={mockDoctorData} />);
      expect(screen.getByTestId("theme-clinical-editorial")).toBeDefined();
    });

    it("dispatches to ModernMinimalTheme when selectedTheme is modern-minimal", () => {
      render(<ThemeRenderer data={mockHospitalData} />);
      expect(screen.getByTestId("theme-modern-minimal")).toBeDefined();
    });

    it("dispatches to VitalCompactTheme when selectedTheme is vital-compact", () => {
      render(<ThemeRenderer data={mockHospitalDoctorData} />);
      expect(screen.getByTestId("theme-vital-compact")).toBeDefined();
    });

    it("defaults to ClinicalEditorialTheme when unknown theme string is passed", () => {
      const fallbackData = { ...mockDoctorData, selectedTheme: "unknown-theme-xyz" };
      render(<ThemeRenderer data={fallbackData} />);
      expect(screen.getByTestId("theme-clinical-editorial")).toBeDefined();
    });
  });

  describe("Theme 01: Clinical Editorial Theme", () => {
    it("renders authoritative editorial structure with 2-column layout and quote block", () => {
      render(<ClinicalEditorialTheme data={mockDoctorData} />);

      // Doctor identity
      expect(screen.getAllByText("Dr. Parth Kadiya").length).toBeGreaterThan(0);
      expect(screen.getAllByText("Cardiology").length).toBeGreaterThan(0);
      expect(screen.getByText("12+ Years Experience")).toBeDefined();

      // Clinical ethos quote block
      expect(screen.getByText(/Clinical precision, diagnostic thoroughness/i)).toBeDefined();

      // Editorial consultation schedule card
      expect(screen.getByText("Consultation Schedule")).toBeDefined();
      expect(screen.getByText("Monday")).toBeDefined();

      // Clinic practice details
      expect(screen.getAllByText("Aarogyam Heart Care").length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Ahmedabad/).length).toBeGreaterThan(0);

      // FAQ accordion
      expect(screen.getByText("What should I bring to my first cardiac consultation?")).toBeDefined();
    });
  });

  describe("Theme 02: Modern Minimal Theme", () => {
    it("renders geometric centered hero with floating stats ribbon and frameless cards", () => {
      render(<ModernMinimalTheme data={mockHospitalData} />);

      // Hospital identity
      expect(screen.getAllByText("Apollo Hospital International").length).toBeGreaterThan(0);

      // Floating stats ribbon
      expect(screen.getByText("Emergency Care")).toBeDefined();
      expect(screen.getByText("Verified Care")).toBeDefined();
      expect(screen.getByText("Weekly Access")).toBeDefined();

      // Departments listed
      expect(screen.getByText("Interventional Cardiology")).toBeDefined();
      expect(screen.getByText("Neurology & Neurosurgery")).toBeDefined();

      // Doctor directory rendering
      expect(screen.getByText("Specialists Directory")).toBeDefined();
      expect(screen.getByText("Dr. Rajiv Shah")).toBeDefined();
      expect(screen.getByText("Dr. Sneha Patel")).toBeDefined();

      // Affiliated doctor directory navigation links
      const doctorLinks = screen.getAllByRole("link", { name: /View Profile/i });
      expect(doctorLinks.length).toBeGreaterThan(0);
      expect(doctorLinks[0]!.getAttribute("href")).toBe("/apollo-ahmedabad/dr-rajiv-shah");
    });
  });

  describe("Theme 03: Vital Compact Theme", () => {
    it("renders high-density card stack with segmented tabs and sticky bottom booking bar", () => {
      render(<VitalCompactTheme data={mockHospitalDoctorData} />);

      // Doctor identity in compact header
      expect(screen.getAllByText("Dr. Rajiv Shah").length).toBeGreaterThan(0);
      expect(screen.getAllByText("Cardiology").length).toBeGreaterThan(0);

      // Segmented navigation tabs
      expect(screen.getByRole("button", { name: "Overview" })).toBeDefined();
      expect(screen.getByRole("button", { name: "Hours" })).toBeDefined();
      expect(screen.getByRole("button", { name: "Info & FAQ" })).toBeDefined();

      // Sticky bottom booking bar
      expect(screen.getAllByText(/Book Consultation/).length).toBeGreaterThan(0);
    });

    it("switches visible content card when clicking segmented navigation tabs", () => {
      render(<VitalCompactTheme data={mockHospitalDoctorData} />);

      // Click Hours tab
      const hoursTab = screen.getByRole("button", { name: "Hours" });
      fireEvent.click(hoursTab);

      expect(screen.getByText("Consultation Timings")).toBeDefined();
      expect(screen.getByText("Tuesday")).toBeDefined();

      // Click Info & FAQ tab
      const infoTab = screen.getByRole("button", { name: "Info & FAQ" });
      fireEvent.click(infoTab);

      expect(screen.getByText("Practice Address & Directions")).toBeDefined();
      expect(screen.getAllByText(/Gandhinagar/).length).toBeGreaterThan(0);
    });
  });

  describe("Runtime Hospital Doctor Inheritance Rendering", () => {
    it("renders parent hospital banner and inherits address without data duplication", () => {
      render(<ClinicalEditorialTheme data={mockHospitalDoctorData} />);

      // Doctor-owned credentials
      expect(screen.getAllByText("Dr. Rajiv Shah").length).toBeGreaterThan(0);
      expect(screen.getAllByText("Cardiology").length).toBeGreaterThan(0);
      expect(screen.getByText("14+ Years Experience")).toBeDefined();

      // Runtime inherited parent organization banner
      expect(screen.getByText(/Affiliated Specialist at/i)).toBeDefined();
      expect(screen.getAllByText("Apollo Hospital International").length).toBeGreaterThan(0);

      // Runtime inherited address (not stored in doctor document)
      expect(screen.getAllByText(/Gandhinagar/).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/382428/).length).toBeGreaterThan(0);

      // Back navigation link to parent hospital
      const backLink = screen.getByRole("link", { name: /Back to Apollo Hospital International/i });
      expect(backLink).toBeDefined();
      expect(backLink.getAttribute("href")).toBe("/apollo-ahmedabad");
    });
  });
});
