import { Metadata } from "next";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Stethoscope, Building2, UserCheck, ArrowRight, ShieldCheck, Sparkles, CheckCircle2 } from "lucide-react";

export const metadata: Metadata = {
  title: "Onboarding Wizard Selection | Doczeno",
  description: "Select your healthcare entity type to launch your verified, deterministic digital presence.",
};

const ONBOARDING_FLOWS = [
  {
    id: "doctor",
    title: "Independent Doctor",
    badge: "Solo Practice",
    badgeVariant: "success" as const,
    description: "For private practitioners and consultants operating their own independent practice or clinic.",
    icon: Stethoscope,
    href: "/onboarding/doctor",
    features: [
      "Dedicated clinical website with 3 layout themes",
      "Custom day-wise consultation schedule builder",
      "Normalized Dr. prefix verification",
      "Doctor photo, clinic logo & facility gallery uploads",
      "Direct WhatsApp & appointment configuration",
    ],
    cta: "Start Doctor Onboarding",
  },
  {
    id: "hospital",
    title: "Hospital or Clinic",
    badge: "Healthcare Facility",
    badgeVariant: "secondary" as const,
    description: "For multi-specialty hospitals, polyclinics, and nursing homes needing comprehensive institutional presence.",
    icon: Building2,
    href: "/onboarding/hospital",
    features: [
      "Institutional portal with unique website slug",
      "Admin credential setup & tenant security boundary",
      "Facility logo & 6-photo verified gallery",
      "Working hours and weekly off scheduling",
      "Centralized master for doctor data inheritance",
    ],
    cta: "Register Facility",
  },
  {
    id: "hospital-doctor",
    title: "Hospital-Affiliated Doctor",
    badge: "Clinician Affiliation",
    badgeVariant: "outline" as const,
    description: "For doctors practicing under an existing registered hospital or clinic on Doczeno.",
    icon: UserCheck,
    href: "/onboarding/hospital-doctor",
    features: [
      "Select from verified active healthcare facilities",
      "Automatic zero-drift inheritance of hospital branding & address",
      "Personalized clinical profile and consultation hours",
      "Cross-tenant isolation & ownership protection",
      "Inherited theme, favicon, and contact details",
    ],
    cta: "Join Facility",
  },
];

export default function OnboardingHubPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-secondary/20 to-secondary/40 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto space-y-12">
        {/* Header Section */}
        <div className="text-center space-y-4 max-w-2xl mx-auto">
          <Badge variant="secondary" className="px-3 py-1 text-xs uppercase tracking-wider font-semibold">
            Doczeno Multi-Tenant Onboarding
          </Badge>
          <h1 className="text-4xl font-extrabold tracking-tight text-foreground">
            Choose Your Healthcare Setup
          </h1>
          <p className="text-muted-foreground text-base leading-relaxed">
            Select the profile that best matches your practice. All portals feature rigorous server-side validation,
            accessible UI wizard steps, and zero-drift data inheritance.
          </p>
        </div>

        {/* Pathways Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {ONBOARDING_FLOWS.map((flow) => {
            const Icon = flow.icon;
            return (
              <Card
                key={flow.id}
                className="flex flex-col justify-between border hover:border-primary/50 transition-all hover:shadow-lg bg-card"
              >
                <div>
                  <CardHeader className="space-y-3 pb-4">
                    <div className="flex items-center justify-between">
                      <div className="h-12 w-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                        <Icon className="h-6 w-6" />
                      </div>
                      <Badge variant={flow.badgeVariant}>{flow.badge}</Badge>
                    </div>
                    <CardTitle className="text-xl font-bold">{flow.title}</CardTitle>
                    <CardDescription className="text-sm leading-relaxed">
                      {flow.description}
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="space-y-4 pt-2">
                    <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Included Capabilities
                    </div>
                    <ul className="space-y-2.5 text-sm">
                      {flow.features.map((feature, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-muted-foreground">
                          <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </div>

                <div className="p-6 pt-0">
                  <Button asChild className="w-full group" size="lg">
                    <Link href={flow.href}>
                      <span>{flow.cta}</span>
                      <ArrowRight className="h-4 w-4 ml-2 group-hover:translate-x-1 transition-transform" />
                    </Link>
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>

        {/* Security & Architecture Guarantees */}
        <Card className="border bg-card/60 backdrop-blur-sm">
          <CardContent className="p-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-center sm:text-left">
              <div className="flex items-start gap-3">
                <ShieldCheck className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
                <div>
                  <div className="text-sm font-semibold text-foreground">Strict Server Boundary</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    Client validation enhances UX; Node.js/Express APIs enforce absolute data integrity.
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Sparkles className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <div className="text-sm font-semibold text-foreground">Deterministic Themes</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    Prebuilt layouts rendered deterministically without generative hallucinations.
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Building2 className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
                <div>
                  <div className="text-sm font-semibold text-foreground">Zero-Drift Inheritance</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    Hospital branding & addresses resolve at runtime without stale data duplication.
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
