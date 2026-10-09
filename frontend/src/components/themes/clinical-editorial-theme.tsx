import * as React from "react";
import Link from "next/link";
import { EffectiveWebsiteData } from "@/types";
import { AppointmentDialog } from "./shared/appointment-dialog";
import { FaqAccordion } from "./shared/faq-accordion";
import { GalleryLightbox } from "./shared/gallery-lightbox";
import { ChatbotWidget } from "./shared/chatbot-widget";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Phone,
  MessageSquare,
  MapPin,
  Clock,
  Calendar,
  Award,
  CheckCircle2,
  Building2,
  Stethoscope,
  ChevronRight,
  ShieldCheck,
  Quote,
  Users,
} from "lucide-react";

interface ClinicalEditorialThemeProps {
  data: EffectiveWebsiteData;
}

export function ClinicalEditorialTheme({ data }: ClinicalEditorialThemeProps) {
  const isDoctor = data.websiteType !== "HOSPITAL_CLINIC";
  const addressStr = `${data.address.street ? `${data.address.street}, ` : ""}${data.address.city}, ${data.address.state} - ${data.address.pincode}`;

  // Parse consultation hours if JSON string
  let scheduleSlots: Array<{ day: string; isClosed?: boolean; slots: Array<{ startTime: string; endTime: string }> }> = [];
  if (data.consultationHours || data.workingHours) {
    try {
      scheduleSlots = JSON.parse(data.consultationHours || data.workingHours || "[]");
    } catch {
      // String format fallback
    }
  }

  return (
    <div data-testid="theme-clinical-editorial" className="min-h-screen bg-slate-50/60 text-slate-900 font-sans selection:bg-slate-900 selection:text-white">
      {/* 1. Top Utility Bar */}
      <div className="border-b border-slate-200 bg-slate-900 text-slate-100 text-xs py-2 px-4 sm:px-8">
        <div className="container mx-auto max-w-6xl flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5 text-slate-300">
              <Clock className="h-3.5 w-3.5 text-emerald-400" />
              <span>
                {data.appointmentRequired ? "Appointment Required" : "Walk-ins & Appointments Welcome"}
              </span>
            </span>
            {data.weeklyOff && (
              <span className="hidden sm:inline text-slate-400 border-l border-slate-700 pl-4">
                Weekly Off: {data.weeklyOff}
              </span>
            )}
          </div>
          <div className="flex items-center gap-4">
            {data.phone && (
              <a
                href={`tel:${data.phone}`}
                className="flex items-center gap-1 text-slate-200 hover:text-white transition-colors"
              >
                <Phone className="h-3.5 w-3.5 text-sky-400" />
                <span>{data.phone}</span>
              </a>
            )}
            {data.whatsApp && (
              <a
                href={`https://wa.me/${data.whatsApp.replace(/[^0-9]/g, "")}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-emerald-400 hover:text-emerald-300 transition-colors font-medium"
              >
                <MessageSquare className="h-3.5 w-3.5" />
                <span>WhatsApp</span>
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Hospital Affiliation Banner (when child doctor) */}
      {data.isHospitalChild && data.hospitalSlug && (
        <div className="bg-sky-50 border-b border-sky-100 py-2 px-4 sm:px-8 text-xs text-sky-800">
          <div className="container mx-auto max-w-6xl flex items-center justify-between">
            <span>
              Affiliated Specialist at <strong>{data.organizationName}</strong>
            </span>
            <Link
              href={`/${data.hospitalSlug}`}
              className="font-medium underline hover:text-sky-950 transition-colors"
            >
              Back to {data.organizationName} &rarr;
            </Link>
          </div>
        </div>
      )}

      {/* 2. Main Editorial Header */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-xs">
        <div className="container mx-auto max-w-6xl px-4 sm:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {data.logo?.url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={data.logo.url}
                alt={data.organizationName}
                className="h-12 w-12 rounded-lg object-cover border border-slate-200 shadow-xs"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />
            )}
            <div>
              <Link href={`/${data.slug}`} className="hover:opacity-90 transition-opacity">
                <span className="font-serif text-xl sm:text-2xl font-bold tracking-tight text-slate-900 block leading-tight">
                  {isDoctor ? `Dr. ${data.doctorName}` : data.organizationName}
                </span>
                <span className="text-xs uppercase tracking-wider text-slate-500 font-medium block">
                  {isDoctor ? data.specialization : (data.organizationType || "Healthcare Institution")}
                </span>
              </Link>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
            <a href="#about" className="hover:text-slate-900 transition-colors">
              About
            </a>
            <a href="#schedule" className="hover:text-slate-900 transition-colors">
              Schedule
            </a>
            {!isDoctor && data.doctorDirectory && data.doctorDirectory.length > 0 && (
              <a href="#doctors" className="hover:text-slate-900 transition-colors">
                Specialists
              </a>
            )}
            {data.galleryPhotos && data.galleryPhotos.length > 0 && (
              <a href="#facility" className="hover:text-slate-900 transition-colors">
                Facility
              </a>
            )}
            <a href="#contact" className="hover:text-slate-900 transition-colors">
              Contact
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
              <Button className="bg-slate-900 hover:bg-slate-800 text-white font-medium shadow-sm">
                Book Consultation
              </Button>
            </AppointmentDialog>
          </div>
        </div>
      </header>

      {/* 3. Asymmetric Two-Column Hero */}
      <section className="border-b border-slate-200 bg-white py-12 sm:py-20">
        <div className="container mx-auto max-w-6xl px-4 sm:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
            {/* Left Column (Hero Content) */}
            <div className="lg:col-span-7 space-y-6">
              <div className="flex flex-wrap items-center gap-2">
                {isDoctor ? (
                  <>
                    <Badge variant="outline" className="border-slate-300 text-slate-800 bg-slate-50 font-medium">
                      <Stethoscope className="h-3.5 w-3.5 mr-1 text-slate-700" />
                      {data.specialization}
                    </Badge>
                    <Badge variant="secondary" className="bg-slate-100 text-slate-800">
                      {data.degree}
                    </Badge>
                    {data.isHospitalChild && data.organizationName ? (
                      <Badge variant="outline" className="border-sky-300 text-sky-800 bg-sky-50">
                        <Building2 className="h-3 w-3 mr-1" />
                        {data.organizationName}
                      </Badge>
                    ) : data.organizationName ? (
                      <Badge variant="outline" className="border-slate-300 text-slate-700 bg-slate-50">
                        <Building2 className="h-3 w-3 mr-1" />
                        {data.organizationName}
                      </Badge>
                    ) : null}
                  </>
                ) : (
                  <Badge variant="outline" className="border-slate-300 text-slate-800 bg-slate-50 font-medium">
                    <Building2 className="h-3.5 w-3.5 mr-1 text-slate-700" />
                    Verified Healthcare Facility
                  </Badge>
                )}
              </div>

              <h1 className="font-serif text-3xl sm:text-5xl font-extrabold text-slate-900 leading-[1.15] tracking-tight">
                {isDoctor ? (
                  <>Dr. {data.doctorName}</>
                ) : (
                  <>{data.organizationName}</>
                )}
              </h1>

              <p className="text-base sm:text-lg text-slate-600 leading-relaxed max-w-2xl">
                {isDoctor
                  ? data.bio ||
                    `Specialist in ${data.specialization} with ${data.yearsOfExperience}+ years of dedicated clinical experience. Providing evidence-based, compassionate patient care.`
                  : data.about ||
                    "Committed to exceptional clinical outcomes, advanced diagnostics, and compassionate patient healthcare services."}
              </p>

              {/* Editorial Quote Box */}
              <div className="rounded-xl border-l-4 border-slate-900 bg-slate-50 p-4 sm:p-5 text-sm italic text-slate-700 space-y-2">
                <Quote className="h-5 w-5 text-slate-400 rotate-180" />
                <p>
                  &ldquo;
                  {isDoctor
                    ? "Clinical precision, diagnostic thoroughness, and dedicated attention to every patient concern."
                    : "Delivering accessible, world-class healthcare driven by clinical integrity and medical excellence."}
                  &rdquo;
                </p>
                <div className="text-xs font-semibold not-italic text-slate-900">
                  — {isDoctor ? `Dr. ${data.doctorName}` : `${data.organizationName} Clinical Board`}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <AppointmentDialog
                  doctorName={data.doctorName}
                  organizationName={data.organizationName}
                  whatsApp={data.whatsApp}
                  phone={data.phone}
                  consultationHours={data.consultationHours || data.workingHours}
                >
                  <Button size="lg" className="bg-slate-900 hover:bg-slate-800 text-white shadow-md">
                    Schedule Consultation
                  </Button>
                </AppointmentDialog>

                {data.whatsApp && (
                  <Button
                    size="lg"
                    variant="outline"
                    asChild
                    className="border-emerald-600 text-emerald-700 hover:bg-emerald-50"
                  >
                    <a
                      href={`https://wa.me/${data.whatsApp.replace(/[^0-9]/g, "")}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <MessageSquare className="h-4 w-4 mr-2" />
                      Chat on WhatsApp
                    </a>
                  </Button>
                )}
              </div>
            </div>

            {/* Right Column (Hero Imagery) */}
            <div className="lg:col-span-5 relative">
              <div className="relative mx-auto max-w-md rounded-2xl overflow-hidden border border-slate-200 bg-white shadow-xl p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={
                    (isDoctor ? data.doctorPhoto?.url : data.galleryPhotos[0]?.url) ||
                    data.logo?.url ||
                    "https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&w=800&q=80"
                  }
                  alt={isDoctor ? `Dr. ${data.doctorName}` : data.organizationName}
                  className="w-full aspect-[4/5] object-cover rounded-xl"
                  onError={(e) => {
                    e.currentTarget.src = "https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&w=800&q=80";
                  }}
                />

                {/* Overlaid Credential Badge */}
                {isDoctor && data.yearsOfExperience !== undefined && (
                  <div className="absolute bottom-6 left-6 right-6 bg-slate-900/90 backdrop-blur-md text-white p-3.5 rounded-xl shadow-lg border border-white/10 flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                      <Award className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-base font-bold leading-tight">
                        {data.yearsOfExperience}+ Years Experience
                      </div>
                      <div className="text-xs text-slate-300">
                        {data.degree} • {data.specialization}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Clinical Overview & Core Qualifications */}
      <section id="about" className="py-16 sm:py-20 border-b border-slate-200">
        <div className="container mx-auto max-w-6xl px-4 sm:px-8 space-y-12">
          <div className="max-w-2xl">
            <span className="text-xs uppercase tracking-wider font-bold text-slate-500">
              Practice Standards
            </span>
            <h2 className="font-serif text-2xl sm:text-4xl font-bold text-slate-900 mt-1">
              {isDoctor ? "Qualifications & Clinical Expertise" : "Institutional Medical Excellence"}
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="border border-slate-200 bg-white shadow-xs">
              <CardHeader className="pb-3">
                <Award className="h-6 w-6 text-slate-900 mb-2" />
                <CardTitle className="text-lg font-serif">Verified Qualifications</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-slate-600 leading-relaxed">
                {isDoctor ? (
                  <>
                    Holds credentials in <strong>{data.degree}</strong> specializing in{" "}
                    <strong>{data.specialization}</strong> with over {data.yearsOfExperience} years of practice.
                  </>
                ) : (
                  <>
                    Accredited multi-specialty institution adhering to rigorous clinical safety, medical protocols, and diagnostics.
                  </>
                )}
              </CardContent>
            </Card>

            <Card className="border border-slate-200 bg-white shadow-xs">
              <CardHeader className="pb-3">
                <ShieldCheck className="h-6 w-6 text-emerald-600 mb-2" />
                <CardTitle className="text-lg font-serif">Diagnostic Integrity</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-slate-600 leading-relaxed">
                Treatment pathways customized to individual health indicators, clinical history, and recognized medical protocols.
              </CardContent>
            </Card>

            <Card className="border border-slate-200 bg-white shadow-xs">
              <CardHeader className="pb-3">
                <Calendar className="h-6 w-6 text-sky-600 mb-2" />
                <CardTitle className="text-lg font-serif">Direct Access & Support</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-slate-600 leading-relaxed">
                Structured consultation schedules, verified WhatsApp integration, and responsive patient coordination.
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* 5. Schedule & Consultation Timings Section */}
      <section id="schedule" className="py-16 sm:py-20 bg-white border-b border-slate-200">
        <div className="container mx-auto max-w-6xl px-4 sm:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
            {/* Schedule Table */}
            <div className="lg:col-span-7 space-y-6">
              <div>
                <span className="text-xs uppercase tracking-wider font-bold text-slate-500">
                  Operating Hours
                </span>
                <h2 className="font-serif text-2xl sm:text-4xl font-bold text-slate-900 mt-1">
                  Consultation Schedule
                </h2>
                <p className="text-sm text-slate-600 mt-1">
                  Timings may vary on public holidays. Prior appointment is recommended.
                </p>
              </div>

              {scheduleSlots.length > 0 ? (
                <div className="rounded-xl border border-slate-200 overflow-hidden divide-y divide-slate-200">
                  {scheduleSlots.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 sm:p-4 flex items-center justify-between text-sm bg-white hover:bg-slate-50/50"
                    >
                      <span className="font-semibold text-slate-900">{item.day}</span>
                      <div>
                        {item.isClosed ? (
                          <Badge variant="outline" className="border-red-200 text-red-600 bg-red-50 text-xs">
                            Closed / Weekly Off
                          </Badge>
                        ) : item.slots && item.slots.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5 justify-end">
                            {item.slots.map((s, sIdx) => (
                              <Badge
                                key={sIdx}
                                variant="secondary"
                                className="bg-slate-100 text-slate-800 text-xs font-mono"
                              >
                                {s.startTime} – {s.endTime}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <span className="text-slate-500 text-xs">Open as scheduled</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-6 rounded-xl border border-slate-200 bg-slate-50 text-center text-sm text-slate-600">
                  Standard consultation hours active Monday through Saturday.
                </div>
              )}
            </div>

            {/* Embedded Action Booking Box */}
            <div className="lg:col-span-5">
              <Card className="border border-slate-200 bg-slate-900 text-white shadow-xl">
                <CardHeader>
                  <CardTitle className="font-serif text-xl">Schedule An Appointment</CardTitle>
                  <p className="text-xs text-slate-300">
                    Direct confirmation through practice desk or WhatsApp.
                  </p>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                  <div className="space-y-2 text-slate-300 text-xs">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                      <span>Zero waiting queue with pre-booked slots</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                      <span>Direct verification with clinical coordinator</span>
                    </div>
                  </div>

                  <AppointmentDialog
                    doctorName={data.doctorName}
                    organizationName={data.organizationName}
                    whatsApp={data.whatsApp}
                    phone={data.phone}
                    consultationHours={data.consultationHours || data.workingHours}
                  >
                    <Button className="w-full bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold shadow-md">
                      Request Consultation
                    </Button>
                  </AppointmentDialog>

                  {data.phone && (
                    <div className="text-center pt-2">
                      <a
                        href={`tel:${data.phone}`}
                        className="text-xs text-slate-300 hover:text-white underline"
                      >
                        Call Reception: {data.phone}
                      </a>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* 6. Hospital Specific: Affiliated Doctors Directory */}
      {!isDoctor && data.doctorDirectory && data.doctorDirectory.length > 0 && (
        <section id="doctors" className="py-16 sm:py-20 border-b border-slate-200">
          <div className="container mx-auto max-w-6xl px-4 sm:px-8 space-y-8">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div>
                <span className="text-xs uppercase tracking-wider font-bold text-slate-500">
                  Medical Faculty
                </span>
                <h2 className="font-serif text-2xl sm:text-4xl font-bold text-slate-900 mt-1">
                  Affiliated Clinicians & Specialists
                </h2>
              </div>
              <Badge variant="outline" className="border-slate-300 text-slate-700">
                <Users className="h-3.5 w-3.5 mr-1.5" />
                {data.doctorDirectory.length} Active Specialists
              </Badge>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {data.doctorDirectory.map((doc) => (
                <Card
                  key={doc.doctorId || doc.slug}
                  className="border border-slate-200 bg-white hover:shadow-md transition-shadow group flex flex-col justify-between"
                >
                  <CardHeader className="space-y-3">
                    <div className="flex items-center gap-3">
                      {doc.doctorPhoto?.url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={doc.doctorPhoto.url}
                          alt={doc.doctorName}
                          className="h-14 w-14 rounded-full object-cover border border-slate-200 shadow-xs"
                        />
                      ) : (
                        <div className="h-14 w-14 rounded-full bg-slate-100 flex items-center justify-center text-slate-700 font-bold">
                          Dr
                        </div>
                      )}
                      <div>
                        <CardTitle className="text-base font-serif font-bold text-slate-900 group-hover:text-primary transition-colors">
                          Dr. {doc.doctorName}
                        </CardTitle>
                        <span className="text-xs font-medium text-slate-500 block">
                          {doc.specialization}
                        </span>
                      </div>
                    </div>
                    <div className="text-xs text-slate-600">
                      {doc.degree} • {doc.yearsOfExperience} Years Experience
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <Button asChild variant="outline" size="sm" className="w-full text-xs font-semibold">
                      <Link href={`/${data.slug}/${doc.slug}`}>
                        <span>View Profile & Hours</span>
                        <ChevronRight className="h-3.5 w-3.5 ml-1" />
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* 7. Verified Facility Gallery */}
      {data.galleryPhotos && data.galleryPhotos.length > 0 && (
        <section id="facility" className="py-16 sm:py-20 bg-white border-b border-slate-200">
          <div className="container mx-auto max-w-6xl px-4 sm:px-8 space-y-8">
            <div className="max-w-xl">
              <span className="text-xs uppercase tracking-wider font-bold text-slate-500">
                Facility & Infrastructure
              </span>
              <h2 className="font-serif text-2xl sm:text-4xl font-bold text-slate-900 mt-1">
                Clinical Environment
              </h2>
            </div>

            <GalleryLightbox photos={data.galleryPhotos} />
          </div>
        </section>
      )}

      {/* 8. Patient FAQ Accordion */}
      {data.faqs && data.faqs.length > 0 && (
        <section className="py-16 sm:py-20 border-b border-slate-200">
          <div className="container mx-auto max-w-4xl px-4 sm:px-8 space-y-8">
            <div className="text-center space-y-2">
              <span className="text-xs uppercase tracking-wider font-bold text-slate-500">
                Patient Inquiries
              </span>
              <h2 className="font-serif text-2xl sm:text-4xl font-bold text-slate-900">
                Frequently Asked Questions
              </h2>
            </div>

            <FaqAccordion faqs={data.faqs} itemClassName="border-slate-200 bg-white shadow-xs" />
          </div>
        </section>
      )}

      {/* 9. Contact, Address & Location Details Footer */}
      <footer id="contact" className="py-16 bg-slate-900 text-slate-300">
        <div className="container mx-auto max-w-6xl px-4 sm:px-8 space-y-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Entity Info */}
            <div className="space-y-3">
              <span className="font-serif text-xl font-bold text-white block">
                {isDoctor ? `Dr. ${data.doctorName}` : data.organizationName}
              </span>
              <p className="text-xs text-slate-400 leading-relaxed">
                {isDoctor
                  ? `${data.degree} • Specialist in ${data.specialization}`
                  : data.about || "Comprehensive healthcare and patient consultation services."}
              </p>
              {data.isHospitalChild && (
                <div className="text-xs text-slate-400 pt-1">
                  Practicing at <strong>{data.organizationName}</strong>
                </div>
              )}
            </div>

            {/* Address & Location */}
            <div className="space-y-3">
              <span className="text-xs uppercase tracking-wider font-bold text-slate-100">
                Location & Clinic Address
              </span>
              <div className="flex items-start gap-2 text-xs text-slate-400 leading-relaxed">
                <MapPin className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
                <span>{addressStr}</span>
              </div>
            </div>

            {/* Direct Channels */}
            <div className="space-y-3">
              <span className="text-xs uppercase tracking-wider font-bold text-slate-100">
                Direct Contact
              </span>
              <div className="space-y-2 text-xs text-slate-400">
                {data.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-3.5 w-3.5 text-sky-400" />
                    <span>{data.phone}</span>
                  </div>
                )}
                {data.email && (
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-slate-300">Email:</span>
                    <span>{data.email}</span>
                  </div>
                )}
                {data.whatsApp && (
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-3.5 w-3.5 text-emerald-400" />
                    <span>WhatsApp: {data.whatsApp}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="pt-8 border-t border-slate-800 text-center text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              &copy; {new Date().getFullYear()} {data.organizationName}. All rights reserved.
            </div>
            <div className="text-[11px] text-slate-600">
              Verified Healthcare Website • Powered by Doczeno Clinical Engine
            </div>
          </div>
        </div>
      </footer>

      {/* 10. AI Chatbot Widget */}
      <ChatbotWidget
        entityName={isDoctor ? `Dr. ${data.doctorName}` : data.organizationName}
        specialization={data.specialization}
        consultationHours={data.consultationHours || data.workingHours}
        addressSummary={addressStr}
      />
    </div>
  );
}
