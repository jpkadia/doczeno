import * as React from "react";
import Link from "next/link";
import { EffectiveWebsiteData } from "@/types";
import { AppointmentDialog } from "./shared/appointment-dialog";
import { FaqAccordion } from "./shared/faq-accordion";
import { GalleryLightbox } from "./shared/gallery-lightbox";
import { ChatbotWidget } from "./shared/chatbot-widget";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  MessageSquare,
  Building2,
  ArrowRight,
  CheckCircle,
} from "lucide-react";

interface ModernMinimalThemeProps {
  data: EffectiveWebsiteData;
}

export function ModernMinimalTheme({ data }: ModernMinimalThemeProps) {
  const isDoctor = data.websiteType !== "HOSPITAL_CLINIC";
  const addressStr = `${data.address.street ? `${data.address.street}, ` : ""}${data.address.city}, ${data.address.state} - ${data.address.pincode}`;

  let scheduleSlots: Array<{ day: string; isClosed?: boolean; slots: Array<{ startTime: string; endTime: string }> }> = [];
  if (data.consultationHours || data.workingHours) {
    try {
      scheduleSlots = JSON.parse(data.consultationHours || data.workingHours || "[]");
    } catch {
      // String format fallback
    }
  }

  return (
    <div data-testid="theme-modern-minimal" className="min-h-screen bg-neutral-50/50 text-neutral-900 font-sans selection:bg-teal-500 selection:text-white">
      {/* 1. Minimalist Sticky Glassmorphism Header */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-neutral-200/60 shadow-xs">
        <div className="container mx-auto max-w-5xl px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {data.logo?.url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={data.logo.url}
                alt={data.organizationName}
                className="h-9 w-9 rounded-full object-cover border border-neutral-200"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />
            )}
            <Link href={`/${data.slug}`} className="hover:opacity-80 transition-opacity">
              <span className="font-semibold text-base sm:text-lg tracking-tight text-neutral-900 block leading-tight">
                {isDoctor ? `Dr. ${data.doctorName}` : data.organizationName}
              </span>
              <span className="text-[11px] text-teal-700 dark:text-teal-400 font-medium block">
                {isDoctor ? data.specialization : (data.organizationType || "Healthcare")}
              </span>
            </Link>
          </div>

          <nav className="hidden md:flex items-center gap-6 text-xs uppercase tracking-wider font-semibold text-neutral-500">
            <a href="#about" className="hover:text-neutral-900 transition-colors">
              Overview
            </a>
            <a href="#schedule" className="hover:text-neutral-900 transition-colors">
              Schedule
            </a>
            {!isDoctor && data.doctorDirectory && data.doctorDirectory.length > 0 && (
              <a href="#specialists" className="hover:text-neutral-900 transition-colors">
                Doctors
              </a>
            )}
            {data.galleryPhotos && data.galleryPhotos.length > 0 && (
              <a href="#gallery" className="hover:text-neutral-900 transition-colors">
                Photos
              </a>
            )}
            <a href="#contact" className="hover:text-neutral-900 transition-colors">
              Location
            </a>
          </nav>

          <div className="flex items-center gap-2">
            <AppointmentDialog
              doctorName={data.doctorName}
              organizationName={data.organizationName}
              whatsApp={data.whatsApp}
              phone={data.phone}
              consultationHours={data.consultationHours || data.workingHours}
            >
              <Button size="sm" className="rounded-full bg-teal-600 hover:bg-teal-700 text-white text-xs px-4">
                Book Slot
              </Button>
            </AppointmentDialog>
          </div>
        </div>
      </header>

      {/* 2. Centered Minimal Hero */}
      <section className="py-16 sm:py-24 text-center px-4 sm:px-6">
        <div className="container mx-auto max-w-3xl space-y-6">
          {/* Avatar / Facility Centerpiece */}
          <div className="relative inline-block mx-auto">
            <div className="h-28 w-28 sm:h-36 sm:w-36 rounded-full overflow-hidden border-4 border-white shadow-xl mx-auto bg-neutral-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={
                  (isDoctor ? data.doctorPhoto?.url : data.galleryPhotos[0]?.url) ||
                  data.logo?.url ||
                  "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&w=400&q=80"
                }
                alt={isDoctor ? `Dr. ${data.doctorName}` : data.organizationName}
                className="h-full w-full object-cover"
                onError={(e) => {
                  e.currentTarget.src = "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&w=400&q=80";
                }}
              />
            </div>
            {isDoctor && (
              <div className="absolute bottom-1 right-1 h-7 w-7 rounded-full bg-teal-600 text-white flex items-center justify-center shadow-md border-2 border-white">
                <CheckCircle className="h-4 w-4" />
              </div>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex justify-center items-center gap-2 flex-wrap">
              <span className="text-xs uppercase tracking-widest font-bold text-teal-700 bg-teal-50 px-3 py-1 rounded-full">
                {isDoctor ? data.specialization : (data.organizationType || "Medical Facility")}
              </span>
              {data.isHospitalChild && data.organizationName && (
                <span className="text-xs font-medium text-neutral-600 bg-neutral-100 px-3 py-1 rounded-full flex items-center gap-1">
                  <Building2 className="h-3 w-3" />
                  {data.organizationName}
                </span>
              )}
            </div>

            <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-neutral-900">
              {isDoctor ? `Dr. ${data.doctorName}` : data.organizationName}
            </h1>
            <p className="text-sm font-medium text-neutral-500">
              {isDoctor ? `${data.degree} • ${data.yearsOfExperience}+ Years Experience` : data.address.city}
            </p>
          </div>

          <p className="text-base text-neutral-600 leading-relaxed max-w-xl mx-auto">
            {isDoctor
              ? data.bio ||
                `Personalized clinical consultation with high diagnostic standards. Focused on patient wellness and long-term health management.`
              : data.about ||
                "Modern healthcare institution providing patient-centric diagnostics and multidisciplinary clinical treatments."}
          </p>

          <div className="flex flex-wrap justify-center items-center gap-3 pt-2">
            <AppointmentDialog
              doctorName={data.doctorName}
              organizationName={data.organizationName}
              whatsApp={data.whatsApp}
              phone={data.phone}
              consultationHours={data.consultationHours || data.workingHours}
            >
              <Button size="lg" className="rounded-full bg-neutral-900 hover:bg-neutral-800 text-white px-8 shadow-sm">
                Schedule Appointment
              </Button>
            </AppointmentDialog>

            {data.whatsApp && (
              <Button
                size="lg"
                variant="outline"
                asChild
                className="rounded-full border-neutral-300 text-neutral-800 hover:bg-neutral-100"
              >
                <a
                  href={`https://wa.me/${data.whatsApp.replace(/[^0-9]/g, "")}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <MessageSquare className="h-4 w-4 mr-2 text-teal-600" />
                  Chat on WhatsApp
                </a>
              </Button>
            )}
          </div>
        </div>
      </section>

      {/* 3. Floating Quick-Stats Ribbon */}
      <section className="container mx-auto max-w-4xl px-4 sm:px-6 mb-16">
        <div className="rounded-2xl border border-neutral-200/80 bg-white p-6 shadow-xs grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
          <div>
            <div className="text-2xl sm:text-3xl font-extrabold text-neutral-900">
              {isDoctor ? `${data.yearsOfExperience}+` : "24/7"}
            </div>
            <div className="text-xs uppercase tracking-wider text-neutral-500 font-medium mt-1">
              {isDoctor ? "Years Practice" : "Emergency Care"}
            </div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-extrabold text-teal-700">100%</div>
            <div className="text-xs uppercase tracking-wider text-neutral-500 font-medium mt-1">
              Verified Care
            </div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-extrabold text-neutral-900">
              {scheduleSlots.length > 0 ? `${scheduleSlots.filter((s) => !s.isClosed).length} Days` : "6 Days"}
            </div>
            <div className="text-xs uppercase tracking-wider text-neutral-500 font-medium mt-1">
              Weekly Access
            </div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-extrabold text-teal-700">Fast</div>
            <div className="text-xs uppercase tracking-wider text-neutral-500 font-medium mt-1">
              WhatsApp Reply
            </div>
          </div>
        </div>
      </section>

      {/* 4. Day-Wise Consultation Hours */}
      <section id="schedule" className="py-16 bg-white border-y border-neutral-200/60">
        <div className="container mx-auto max-w-4xl px-4 sm:px-6 space-y-8">
          <div className="text-center space-y-2">
            <span className="text-xs uppercase tracking-wider font-bold text-teal-700">
              Weekly Timings
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-neutral-900">
              Consultation Schedule
            </h2>
            <p className="text-xs text-neutral-500">
              Please book slots prior to visit to prevent waiting times.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {scheduleSlots.map((slot, idx) => (
              <div
                key={idx}
                className="rounded-xl border border-neutral-100 bg-neutral-50/60 p-4 space-y-2 hover:border-teal-500/40 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-neutral-800">{slot.day}</span>
                  {slot.isClosed ? (
                    <Badge variant="outline" className="text-[10px] text-neutral-400 border-neutral-200">
                      Closed
                    </Badge>
                  ) : (
                    <span className="h-2 w-2 rounded-full bg-teal-500" />
                  )}
                </div>

                {!slot.isClosed && slot.slots && slot.slots.length > 0 ? (
                  <div className="space-y-1">
                    {slot.slots.map((s, sIdx) => (
                      <div key={sIdx} className="text-xs text-neutral-600 font-mono">
                        {s.startTime} – {s.endTime}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-neutral-400">
                    {slot.isClosed ? "No consultation" : "Standard hours"}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 5. Hospital Clinical Departments */}
      {!isDoctor && data.departments && data.departments.length > 0 && (
        <section id="departments" className="py-16 bg-neutral-50/70 border-b border-neutral-200/60">
          <div className="container mx-auto max-w-5xl px-4 sm:px-6 space-y-8">
            <div className="text-center space-y-2">
              <span className="text-xs uppercase tracking-wider font-bold text-teal-700">
                Clinical Departments
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-neutral-900">
                Specialties & Medical Divisions
              </h2>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {data.departments.map((dept, idx) => (
                <div
                  key={idx}
                  className="rounded-xl border border-neutral-200/80 bg-white p-4 text-center shadow-2xs hover:border-teal-500/50 transition-colors"
                >
                  <span className="text-xs font-semibold text-neutral-800">{dept}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* 6. Hospital Doctors Directory */}
      {!isDoctor && data.doctorDirectory && data.doctorDirectory.length > 0 && (
        <section id="specialists" className="py-16">
          <div className="container mx-auto max-w-5xl px-4 sm:px-6 space-y-8">
            <div className="text-center space-y-2">
              <span className="text-xs uppercase tracking-wider font-bold text-teal-700">
                Our Clinicians
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-neutral-900">
                Specialists Directory
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {data.doctorDirectory.map((doc) => (
                <div
                  key={doc.doctorId || doc.slug}
                  className="rounded-2xl border border-neutral-200/80 bg-white p-5 shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between"
                >
                  <div className="flex items-center gap-3 mb-4">
                    {doc.doctorPhoto?.url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={doc.doctorPhoto.url}
                        alt={doc.doctorName}
                        className="h-12 w-12 rounded-full object-cover border border-neutral-200"
                      />
                    ) : (
                      <div className="h-12 w-12 rounded-full bg-neutral-100 flex items-center justify-center text-xs font-bold text-neutral-600">
                        Dr
                      </div>
                    )}
                    <div>
                      <h3 className="font-bold text-sm text-neutral-900">Dr. {doc.doctorName}</h3>
                      <p className="text-xs text-teal-700 font-medium">{doc.specialization}</p>
                    </div>
                  </div>
                  <div className="text-xs text-neutral-500 mb-4">{doc.degree}</div>
                  <Button asChild variant="outline" size="sm" className="w-full text-xs rounded-full">
                    <Link href={`/${data.slug}/${doc.slug}`}>
                      <span>View Profile</span>
                      <ArrowRight className="h-3 w-3 ml-1" />
                    </Link>
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* 6. Facility Photos */}
      {data.galleryPhotos && data.galleryPhotos.length > 0 && (
        <section id="gallery" className="py-16 bg-white border-y border-neutral-200/60">
          <div className="container mx-auto max-w-5xl px-4 sm:px-6 space-y-8">
            <div className="text-center space-y-2">
              <span className="text-xs uppercase tracking-wider font-bold text-teal-700">
                Infrastructure
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-neutral-900">
                Facility & Clinic Photos
              </h2>
            </div>
            <GalleryLightbox photos={data.galleryPhotos} gridCols="grid-cols-1 sm:grid-cols-2 md:grid-cols-3" />
          </div>
        </section>
      )}

      {/* 7. FAQs */}
      {data.faqs && data.faqs.length > 0 && (
        <section className="py-16">
          <div className="container mx-auto max-w-3xl px-4 sm:px-6 space-y-8">
            <div className="text-center space-y-2">
              <span className="text-xs uppercase tracking-wider font-bold text-teal-700">FAQ</span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-neutral-900">
                Frequently Asked Questions
              </h2>
            </div>
            <FaqAccordion faqs={data.faqs} itemClassName="rounded-xl border-neutral-200/80 bg-white" />
          </div>
        </section>
      )}

      {/* 8. Minimalist Footer & Contact */}
      <footer id="contact" className="py-16 bg-white border-t border-neutral-200/60">
        <div className="container mx-auto max-w-4xl px-4 sm:px-6 space-y-8 text-center sm:text-left">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div>
              <span className="font-bold text-sm text-neutral-900 block mb-1">
                {isDoctor ? `Dr. ${data.doctorName}` : data.organizationName}
              </span>
              <p className="text-xs text-neutral-500">{isDoctor ? data.specialization : "Healthcare Institution"}</p>
            </div>
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-neutral-400 block mb-1">
                Address
              </span>
              <p className="text-xs text-neutral-600">{addressStr}</p>
            </div>
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-neutral-400 block mb-1">
                Direct Contact
              </span>
              <div className="text-xs text-neutral-600 space-y-1">
                {data.phone && <div>Phone: {data.phone}</div>}
                {data.email && <div>Email: {data.email}</div>}
                {data.whatsApp && <div>WhatsApp: {data.whatsApp}</div>}
              </div>
            </div>
          </div>

          <div className="pt-8 border-t border-neutral-100 flex flex-col sm:flex-row items-center justify-between text-xs text-neutral-400 gap-2">
            <div>&copy; {new Date().getFullYear()} {data.organizationName}</div>
            <div>Doczeno Platform Verified</div>
          </div>
        </div>
      </footer>

      {/* 9. Chatbot Widget */}
      <ChatbotWidget
        entityName={isDoctor ? `Dr. ${data.doctorName}` : data.organizationName}
        specialization={data.specialization}
        consultationHours={data.consultationHours || data.workingHours}
        addressSummary={addressStr}
      />
    </div>
  );
}
