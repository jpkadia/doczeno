import { Metadata } from "next";
import { HospitalCreationForm } from "@/components/forms/hospital-creation-form";
import Link from "next/link";
import { ArrowLeft, Building2 } from "lucide-react";

export const metadata: Metadata = {
  title: "Hospital & Clinic Onboarding | Doczeno",
  description: "Register your healthcare facility, configure departments, and establish a digital presence with zero-drift clinician inheritance.",
};

export default function HospitalOnboardingPage() {
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
            <Building2 className="h-4 w-4 text-primary" />
            <span>Healthcare Facility</span>
          </div>
        </div>

        <HospitalCreationForm />
      </div>
    </div>
  );
}
