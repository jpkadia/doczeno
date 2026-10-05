import { Metadata } from "next";
import { Suspense } from "react";
import { HospitalDoctorFormWrapper } from "./form-wrapper";
import Link from "next/link";
import { ArrowLeft, UserCheck, Loader2 } from "lucide-react";

export const metadata: Metadata = {
  title: "Hospital Doctor Onboarding | Doczeno",
  description: "Join a verified healthcare organization and publish your clinical profile with inherited hospital branding and address.",
};

export default function HospitalDoctorOnboardingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-secondary/20 to-secondary/40 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <Link
            href="/onboarding"
            className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            Back to Onboarding Options
          </Link>

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <UserCheck className="h-4 w-4 text-primary" />
            <span>Hospital Affiliated Clinician</span>
          </div>
        </div>

        <Suspense
          fallback={
            <div className="flex justify-center items-center py-24">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          }
        >
          <HospitalDoctorFormWrapper />
        </Suspense>
      </div>
    </div>
  );
}
