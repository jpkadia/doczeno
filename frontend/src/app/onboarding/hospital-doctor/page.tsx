import { Metadata } from "next";
import { Suspense } from "react";
import { HospitalDoctorFormWrapper } from "./form-wrapper";
import Link from "next/link";
import { ArrowLeft, UserCheck, Loader2 } from "lucide-react";

export const metadata: Metadata = {
  title: "Hospital Doctor Onboarding | Doczeno",
  description: "Join a verified healthcare organization and publish your clinical profile with hospital branding and address.",
};

export default function HospitalDoctorOnboardingPage() {
  return (
    <div className="min-h-screen bg-[#eaf4fd] bg-[url('/images/mobile.png')] md:bg-[url('/images/bg.png')] bg-cover bg-top md:bg-center bg-no-repeat bg-fixed py-6 sm:py-10 px-3 sm:px-6 lg:px-8 font-sans text-slate-900">
      <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6">
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center text-xs sm:text-sm font-semibold text-slate-700 hover:text-[#1a76d1] transition-colors bg-white/80 backdrop-blur-xs px-3 py-1.5 rounded-full border border-blue-100 shadow-2xs"
          >
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            Back to Options
          </Link>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/85 backdrop-blur-xs border border-blue-200 text-xs font-semibold text-[#1560aa] shadow-2xs">
            <UserCheck className="h-3.5 w-3.5 text-[#1a76d1]" />
            <span>Hospital Clinician Setup</span>
          </div>
        </div>

        <Suspense
          fallback={
            <div className="flex justify-center items-center py-24">
              <Loader2 className="h-8 w-8 animate-spin text-[#1a76d1]" />
            </div>
          }
        >
          <HospitalDoctorFormWrapper />
        </Suspense>
      </div>
    </div>
  );
}
