import { Metadata } from "next";
import Link from "next/link";
import { DoczenoLogo } from "@/components/brand/doczeno-logo";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Stethoscope,
  Building2,
  UserCheck,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Healthcare Setup & Onboarding | Doczeno",
  description: "Select your healthcare entity type to launch your verified digital presence.",
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/icon-round.png", type: "image/png" },
      { url: "/favicon.ico", sizes: "any" },
    ],
    shortcut: "/favicon.svg",
    apple: "/icon-round.png",
  },
};

const ONBOARDING_FLOWS = [
  {
    id: "doctor",
    title: "Only Doctor",
    badge: "Solo Doctor",
    description: "For individual medical practitioners operating their private clinic.",
    icon: Stethoscope,
    href: "/onboarding/doctor",
    features: [
      "Dedicated Doctor Website (/dr-name)",
      "OPD Timings & Online Appointment Booking",
      "Private Doctor Admin Dashboard",
    ],
    cta: "Start Doctor Setup",
  },
  {
    id: "hospital",
    title: "Hospital or Clinic",
    badge: "Healthcare Facility",
    description: "For multi-specialty hospitals and clinics managing departments & doctors.",
    icon: Building2,
    href: "/onboarding/hospital",
    features: [
      "Official Hospital Website (/hospital-name)",
      "Departments, Specialties & Doctor Management",
      "Dedicated Hospital Admin Portal",
    ],
    cta: "Register Facility",
  },
  {
    id: "hospital-doctor",
    title: "Hospital-Affiliated Doctor",
    badge: "Affiliated Doctor",
    description: "For doctors practicing under an existing registered hospital or clinic.",
    icon: UserCheck,
    href: "/onboarding/hospital-doctor",
    features: [
      "Direct Link to Registered Hospital",
      "Personal Clinical Profile (/hospital/dr-name)",
      "OPD Consultation Hours & Schedule Control",
    ],
    cta: "Join Facility",
  },
];

export default function HomePage() {
  return (
    <div className="min-h-screen lg:h-screen lg:max-h-screen lg:overflow-hidden bg-[#eaf4fd] bg-[url('/images/mobile.png')] md:bg-[url('/images/bg.png')] bg-cover bg-top md:bg-center bg-no-repeat text-slate-900 flex flex-col justify-between font-sans">
      {/* Top Navigation Bar - Transparent Glassmorphism with Rounded Angles */}
      <header className="border-b border-x border-white/40 bg-white/20 backdrop-blur-xs sticky top-0 z-50 shrink-0 mx-2 sm:mx-6 lg:mx-8 rounded-b-2xl sm:rounded-b-3xl shadow-2xs">
        <div className="container max-w-7xl mx-auto flex h-14 lg:h-15 items-center justify-between px-4 sm:px-6 lg:px-8">
          <DoczenoLogo
            variant="horizontal"
            size="sm"
            subtitle="Healthcare Platform"
            href="/"
          />

          <div className="flex items-center gap-3">
            <Badge
              variant="outline"
              className="border-blue-200/60 bg-white/70 backdrop-blur-xs text-[#1560aa] font-medium text-xs hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full shadow-2xs"
            >
              <span className="h-2 w-2 rounded-full bg-[#1a76d1] animate-pulse" />
              Verified Healthcare Platform
            </Badge>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container flex-1 flex flex-col justify-center py-3 sm:py-5 lg:py-2 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto w-full">
        {/* Header Section */}
        <div className="text-center space-y-1 lg:space-y-1 max-w-2xl mx-auto mb-3 sm:mb-4 lg:mb-4">
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wider bg-white/80 backdrop-blur-xs text-[#1560aa] border border-blue-200/80 shadow-2xs">
            Doczeno Healthcare Onboarding
          </span>
          <h1 className="text-2xl sm:text-3xl lg:text-3xl xl:text-4xl font-extrabold tracking-tight text-slate-900 drop-shadow-2xs">
            Choose Your Healthcare Setup
          </h1>
          <p className="text-slate-600 text-xs sm:text-sm leading-relaxed max-w-xl mx-auto">
            Select the profile that best matches your practice to launch your verified digital presence.
          </p>
        </div>

        {/* Pathways Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 sm:gap-4 lg:gap-5">
          {ONBOARDING_FLOWS.map((flow) => {
            const Icon = flow.icon;
            return (
              <Card
                key={flow.id}
                className="flex flex-col justify-between border border-white/80 rounded-2xl bg-white/90 backdrop-blur-md hover:border-[#1a76d1]/60 hover:bg-white/95 transition-all duration-200 hover:shadow-xl shadow-md"
              >
                <div>
                  <CardHeader className="space-y-1.5 sm:space-y-2 p-4 sm:p-5 pb-1 lg:pb-1.5">
                    <div className="flex items-center justify-between">
                      <div className="h-9 w-9 sm:h-10 sm:w-10 lg:h-11 lg:w-11 rounded-xl bg-blue-50 text-[#1a76d1] border border-blue-100 flex items-center justify-center shadow-2xs shrink-0">
                        <Icon className="h-5 w-5 lg:h-5.5 lg:w-5.5" />
                      </div>
                      <Badge className="bg-blue-50/90 text-[#1560aa] border border-blue-200/80 hover:bg-blue-100 text-[10px] sm:text-[11px] font-semibold px-2 py-0.5">
                        {flow.badge}
                      </Badge>
                    </div>
                    <CardTitle className="text-base sm:text-lg lg:text-xl font-bold text-slate-900 pt-0.5">
                      {flow.title}
                    </CardTitle>
                    <CardDescription className="text-xs text-slate-600 leading-snug line-clamp-2 min-h-[30px]">
                      {flow.description}
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="space-y-1.5 sm:space-y-2 px-4 sm:px-5 pt-1 pb-2 lg:pb-2.5">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Key Highlights
                    </div>
                    <ul className="space-y-1 sm:space-y-1.5 text-xs text-slate-700">
                      {flow.features.map((feature, idx) => (
                        <li key={idx} className="flex items-start gap-2 font-medium leading-tight">
                          <CheckCircle2 className="h-3.5 w-3.5 text-[#1a76d1] shrink-0 mt-0.5" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </div>

                <div className="p-4 sm:p-5 pt-0">
                  <Button
                    asChild
                    className="w-full group bg-[#1a76d1] hover:bg-[#1560aa] text-white font-semibold text-xs sm:text-sm h-9 sm:h-9.5 lg:h-10 rounded-xl shadow-xs transition-all"
                  >
                    <Link href={flow.href}>
                      <span>{flow.cta}</span>
                      <ArrowRight className="h-3.5 w-3.5 ml-1.5 group-hover:translate-x-1 transition-transform" />
                    </Link>
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      </main>

      {/* Footer - Transparent Glassmorphism with Rounded Angles */}
      <footer className="border-t border-x border-white/30 py-2 sm:py-2.5 lg:py-2 bg-white/20 backdrop-blur-xs text-center text-xs text-slate-600 font-medium shrink-0 mx-2 sm:mx-6 lg:mx-8 rounded-t-2xl sm:rounded-t-3xl shadow-2xs">
        <div className="container max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-center gap-2">
          <span>&copy; {new Date().getFullYear()} Doczeno Healthcare Platform. All rights reserved.</span>
        </div>
      </footer>
    </div>
  );
}
