"use client";

import * as React from "react";
import Link from "next/link";
import { EffectiveWebsiteData } from "@/types";
import { AppointmentDialog } from "./shared/appointment-dialog";
import { FaqAccordion } from "./shared/faq-accordion";
import { GalleryLightbox } from "./shared/gallery-lightbox";
import { ChatbotWidget } from "./shared/chatbot-widget";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Phone,
  MessageSquare,
  MapPin,
  Building2,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface VitalCompactThemeProps {
  data: EffectiveWebsiteData;
}

export function VitalCompactTheme({ data }: VitalCompactThemeProps) {
  const isDoctor = data.websiteType !== "HOSPITAL_CLINIC";
  const addressStr = `${data.address.street ? `${data.address.street}, ` : ""}${data.address.city}, ${data.address.state} - ${data.address.pincode}`;
  const [activeTab, setActiveTab] = React.useState<"overview" | "schedule" | "faculty" | "info">("overview");

  let scheduleSlots: Array<{ day: string; isClosed?: boolean; slots: Array<{ startTime: string; endTime: string }> }> = [];
  if (data.consultationHours || data.workingHours) {
    try {
      scheduleSlots = JSON.parse(data.consultationHours || data.workingHours || "[]");
    } catch {
      // String fallback
    }
  }

  const cleanWhatsApp = (data.whatsApp || "").replace(/[^0-9]/g, "");

  return (
    <div data-testid="theme-vital-compact" className="min-h-screen bg-slate-100/70 text-slate-900 pb-24 font-sans">
      {/* 1. Compact App Header */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200 px-4 py-3 shadow-xs">
        <div className="container mx-auto max-w-3xl flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            {data.logo?.url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={data.logo.url}
                alt={data.organizationName}
                className="h-8 w-8 rounded-md object-cover border border-slate-200"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />
            )}
            <div className="truncate">
              <span className="font-bold text-sm text-slate-900 block truncate">
                {isDoctor ? `Dr. ${data.doctorName}` : data.organizationName}
              </span>
              <span className="text-[11px] text-slate-500 block">
                {isDoctor ? data.specialization : (data.organizationType || "Medical Center")}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 mr-1 animate-pulse" />
              Verified
            </Badge>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="container mx-auto max-w-3xl px-4 py-4 space-y-4">
        {/* 2. Hero Profile Card with Direct Actions */}
        <Card className="border border-slate-200 shadow-sm bg-white overflow-hidden">
          <CardContent className="p-4 sm:p-6 space-y-4">
            <div className="flex items-start gap-4">
              <div className="relative shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={
                    (isDoctor ? data.doctorPhoto?.url : data.galleryPhotos[0]?.url) ||
                    data.logo?.url ||
                    "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&w=300&q=80"
                  }
                  alt={isDoctor ? `Dr. ${data.doctorName}` : data.organizationName}
                  className="h-20 w-20 sm:h-24 sm:w-24 rounded-xl object-cover border border-slate-200 shadow-xs"
                  onError={(e) => {
                    e.currentTarget.src = "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&w=300&q=80";
                  }}
                />
              </div>

              <div className="space-y-1 min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xs font-semibold text-sky-700 bg-sky-50 px-2 py-0.5 rounded">
                    {isDoctor ? data.specialization : (data.organizationType || "Healthcare")}
                  </span>
                  {data.isHospitalChild && data.organizationName && (
                    <span className="text-xs text-slate-600 bg-slate-100 px-2 py-0.5 rounded flex items-center gap-1">
                      <Building2 className="h-3 w-3" />
                      {data.organizationName}
                    </span>
                  )}
                </div>

                <h1 className="text-xl sm:text-2xl font-black text-slate-900 truncate">
                  {isDoctor ? `Dr. ${data.doctorName}` : data.organizationName}
                </h1>

                <p className="text-xs text-slate-600">
                  {isDoctor ? `${data.degree} • ${data.yearsOfExperience} Years Clinical Practice` : data.address.city}
                </p>

                <div className="flex items-center gap-1 text-[11px] text-slate-500 pt-1">
                  <MapPin className="h-3 w-3 text-rose-500 shrink-0" />
                  <span className="truncate">{data.address.city}, {data.address.state}</span>
                </div>
              </div>
            </div>

            {/* Quick Action Grid */}
            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100">
              {cleanWhatsApp ? (
                <Button
                  size="sm"
                  asChild
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold"
                >
                  <a href={`https://wa.me/${cleanWhatsApp}`} target="_blank" rel="noreferrer">
                    <MessageSquare className="h-3.5 w-3.5 mr-1.5" />
                    WhatsApp
                  </a>
                </Button>
              ) : null}

              {data.phone ? (
                <Button
                  size="sm"
                  variant="outline"
                  asChild
                  className="w-full text-xs font-semibold"
                >
                  <a href={`tel:${data.phone}`}>
                    <Phone className="h-3.5 w-3.5 mr-1.5 text-sky-600" />
                    Call Clinic
                  </a>
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>

        {/* 3. Segmented Navigation Tabs */}
        <div className="flex rounded-xl bg-slate-200/80 p-1 text-xs font-semibold text-slate-600 shadow-xs">
          <button
            type="button"
            onClick={() => setActiveTab("overview")}
            className={cn(
              "flex-1 py-2 text-center rounded-lg transition-all",
              activeTab === "overview" ? "bg-white text-slate-900 shadow-xs" : "hover:text-slate-900"
            )}
          >
            Overview
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("schedule")}
            className={cn(
              "flex-1 py-2 text-center rounded-lg transition-all",
              activeTab === "schedule" ? "bg-white text-slate-900 shadow-xs" : "hover:text-slate-900"
            )}
          >
            Hours
          </button>
          {!isDoctor && data.doctorDirectory && data.doctorDirectory.length > 0 && (
            <button
              type="button"
              onClick={() => setActiveTab("faculty")}
              className={cn(
                "flex-1 py-2 text-center rounded-lg transition-all",
                activeTab === "faculty" ? "bg-white text-slate-900 shadow-xs" : "hover:text-slate-900"
              )}
            >
              Doctors
            </button>
          )}
          <button
            type="button"
            onClick={() => setActiveTab("info")}
            className={cn(
              "flex-1 py-2 text-center rounded-lg transition-all",
              activeTab === "info" ? "bg-white text-slate-900 shadow-xs" : "hover:text-slate-900"
            )}
          >
            Info & FAQ
          </button>
        </div>

        {/* Tab 1: Overview */}
        {activeTab === "overview" && (
          <div className="space-y-4">
            <Card className="border border-slate-200 bg-white p-5 shadow-xs">
              <h3 className="text-sm font-bold text-slate-900 mb-2">About & Clinical Practice</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                {isDoctor
                  ? data.bio ||
                    `Dr. ${data.doctorName} specializes in ${data.specialization} with ${data.yearsOfExperience}+ years of diagnostic and therapeutic clinical expertise.`
                  : data.about ||
                    "Premier healthcare facility providing specialized outpatient and inpatient medical services."}
              </p>
            </Card>

            {data.galleryPhotos && data.galleryPhotos.length > 0 && (
              <Card className="border border-slate-200 bg-white p-5 shadow-xs space-y-3">
                <h3 className="text-sm font-bold text-slate-900">Clinic Environment</h3>
                <GalleryLightbox photos={data.galleryPhotos} gridCols="grid-cols-2 sm:grid-cols-3" />
              </Card>
            )}
          </div>
        )}

        {/* Tab 2: Consultation Schedule */}
        {activeTab === "schedule" && (
          <Card className="border border-slate-200 bg-white p-5 shadow-xs space-y-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Consultation Timings</h3>
              <p className="text-[11px] text-slate-500">Day-wise active slots for consultation.</p>
            </div>

            <div className="space-y-2">
              {scheduleSlots.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-2.5 rounded-lg border border-slate-100 bg-slate-50/50 text-xs"
                >
                  <span className="font-semibold text-slate-800">{item.day}</span>
                  <div>
                    {item.isClosed ? (
                      <span className="text-red-500 font-medium">Weekly Off</span>
                    ) : item.slots && item.slots.length > 0 ? (
                      <div className="flex gap-1.5 font-mono text-slate-700">
                        {item.slots.map((s, sIdx) => (
                          <span key={sIdx} className="bg-white px-2 py-0.5 rounded border border-slate-200">
                            {s.startTime} – {s.endTime}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-slate-500">Regular hours</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Tab 3: Hospital Doctors */}
        {activeTab === "faculty" && !isDoctor && data.doctorDirectory && (
          <div className="space-y-3">
            {data.doctorDirectory.map((doc) => (
              <Card key={doc.doctorId || doc.slug} className="border border-slate-200 bg-white p-3.5 shadow-xs">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    {doc.doctorPhoto?.url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={doc.doctorPhoto.url}
                        alt={doc.doctorName}
                        className="h-12 w-12 rounded-lg object-cover border border-slate-200"
                      />
                    ) : (
                      <div className="h-12 w-12 rounded-lg bg-slate-100 flex items-center justify-center text-xs font-bold">
                        Dr
                      </div>
                    )}
                    <div>
                      <h4 className="font-bold text-xs text-slate-900">Dr. {doc.doctorName}</h4>
                      <p className="text-[11px] text-sky-700 font-medium">{doc.specialization}</p>
                      <p className="text-[10px] text-slate-500">{doc.degree} • {doc.yearsOfExperience}y exp</p>
                    </div>
                  </div>
                  <Button asChild size="sm" variant="outline" className="text-xs">
                    <Link href={`/${data.slug}/${doc.slug}`}>
                      <span>Profile</span>
                      <ChevronRight className="h-3 w-3 ml-1" />
                    </Link>
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Tab 4: Info & FAQ */}
        {activeTab === "info" && (
          <div className="space-y-4">
            <Card className="border border-slate-200 bg-white p-5 shadow-xs space-y-3">
              <h3 className="text-sm font-bold text-slate-900">Practice Address & Directions</h3>
              <p className="text-xs text-slate-600 leading-relaxed flex items-start gap-2">
                <MapPin className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
                <span>{addressStr}</span>
              </p>
            </Card>

            {data.faqs && data.faqs.length > 0 && (
              <Card className="border border-slate-200 bg-white p-5 shadow-xs space-y-3">
                <h3 className="text-sm font-bold text-slate-900">Patient Guidelines</h3>
                <FaqAccordion faqs={data.faqs} itemClassName="border-slate-100 bg-slate-50/50" />
              </Card>
            )}
          </div>
        )}
      </main>

      {/* 4. Full-Width Sticky Bottom Booking Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 p-3 shadow-lg">
        <div className="container mx-auto max-w-3xl flex items-center gap-3">
          <div className="hidden sm:block min-w-0 flex-1">
            <span className="font-bold text-xs text-slate-900 block truncate">
              {isDoctor ? `Dr. ${data.doctorName}` : data.organizationName}
            </span>
            <span className="text-[10px] text-slate-500 block truncate">
              {data.appointmentRequired ? "Pre-booking required" : "Instant consultation request"}
            </span>
          </div>

          <div className="flex w-full sm:w-auto items-center gap-2 flex-1 sm:flex-initial">
            <AppointmentDialog
              doctorName={data.doctorName}
              organizationName={data.organizationName}
              whatsApp={data.whatsApp}
              phone={data.phone}
              consultationHours={data.consultationHours || data.workingHours}
            >
              <Button className="flex-1 sm:flex-initial bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs h-10 px-6">
                Book Consultation
              </Button>
            </AppointmentDialog>

            {cleanWhatsApp && (
              <Button
                asChild
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-10 px-4"
              >
                <a href={`https://wa.me/${cleanWhatsApp}`} target="_blank" rel="noreferrer">
                  <MessageSquare className="h-4 w-4" />
                </a>
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* 5. Chatbot Widget */}
      <ChatbotWidget
        entityName={isDoctor ? `Dr. ${data.doctorName}` : data.organizationName}
        specialization={data.specialization}
        consultationHours={data.consultationHours || data.workingHours}
        addressSummary={addressStr}
      />
    </div>
  );
}
