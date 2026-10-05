import { Metadata } from "next";
import { IndependentDoctorWizard } from "@/components/forms/independent-doctor-wizard";
import Link from "next/link";
import { ArrowLeft, Stethoscope } from "lucide-react";

export const metadata: Metadata = {
  title: "Independent Doctor Onboarding | Doczeno",
  description: "Create and launch your verified clinical website with custom scheduling, branding, and deterministic themes.",
};

export default function DoctorOnboardingPage() {
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
            <Stethoscope className="h-4 w-4 text-primary" />
            <span>Independent Practitioner</span>
          </div>
        </div>

        <IndependentDoctorWizard />
      </div>
    </div>
  );
}
