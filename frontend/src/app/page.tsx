import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ShieldCheck,
  Building2,
  UserCheck,
  Users,
  Activity,
  Layers,
  Database,
  Lock,
  Sparkles,
} from "lucide-react";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/30">
      {/* Top Navigation Bar */}
      <header className="border-b bg-card/80 backdrop-blur-md sticky top-0 z-50">
        <div className="container flex h-16 items-center justify-between px-4 sm:px-8">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold shadow-md">
              <Activity className="h-5 w-5" />
            </div>
            <div>
              <span className="text-xl font-bold tracking-tight text-foreground">Doczeno</span>
              <span className="ml-2 text-xs font-semibold px-2 py-0.5 rounded-full bg-accent text-accent-foreground border border-primary/20">
                Core Engine v1.0
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button asChild size="sm" variant="default">
              <Link href="/onboarding">Get Started / Onboarding</Link>
            </Button>
            <Badge variant="outline" className="border-emerald-500/30 text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 hidden sm:flex">
              <span className="h-2 w-2 rounded-full bg-emerald-500 mr-1.5 animate-pulse" />
              Multi-Tenant Architecture
            </Badge>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="container px-4 sm:px-8 py-12 max-w-6xl space-y-12">
        <div className="text-center space-y-4 max-w-3xl mx-auto">
          <Badge variant="secondary" className="px-3 py-1 text-xs uppercase tracking-wider font-semibold">
            Production Foundation Ready
          </Badge>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-foreground">
            Multi-Tenant Healthcare Website Platform
          </h1>
          <p className="text-lg text-muted-foreground leading-relaxed">
            Scalable digital presence for independent medical practices, multi-specialty hospitals,
            and affiliated clinicians with zero-drift data inheritance.
          </p>

          <div className="flex flex-wrap justify-center gap-3 pt-2">
            <Button asChild size="lg">
              <Link href="/onboarding/doctor">Create Doctor Website</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/onboarding/hospital">Register Hospital/Clinic</Link>
            </Button>
            <Button asChild size="lg" variant="ghost">
              <Link href="/onboarding/hospital-doctor">Join as Hospital Doctor</Link>
            </Button>
          </div>
        </div>

        {/* Multi-Tenant Models Grid */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-bold tracking-tight">Multi-Tenant Website Archetypes</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Type A: Independent Doctor */}
            <Card className="hover:shadow-md transition-shadow border-t-4 border-t-primary">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <Badge variant="default" className="text-xs">Type A</Badge>
                  <UserCheck className="h-5 w-5 text-primary" />
                </div>
                <CardTitle className="mt-2">Independent Doctor</CardTitle>
                <CardDescription>Autonomous medical practitioners</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <p className="text-muted-foreground">
                  The doctor controls branding, domain routing, clinic profile, and appointments.
                </p>
                <div className="rounded-md bg-muted p-2.5 font-mono text-xs text-foreground/80 break-all">
                  doctorwebsite.in/dr-parth-kadiya
                </div>
                <div className="text-xs text-muted-foreground flex items-center gap-1">
                  <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                  Admin: /dr-parth-kadiya/admin/login
                </div>
              </CardContent>
            </Card>

            {/* Type B: Hospital / Clinic */}
            <Card className="hover:shadow-md transition-shadow border-t-4 border-t-emerald-600">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <Badge variant="success" className="text-xs">Type B</Badge>
                  <Building2 className="h-5 w-5 text-emerald-600" />
                </div>
                <CardTitle className="mt-2">Hospital / Clinic</CardTitle>
                <CardDescription>Parent healthcare organizations</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <p className="text-muted-foreground">
                  Source of truth for branding, facilities, address, theme, and doctor directories.
                </p>
                <div className="rounded-md bg-muted p-2.5 font-mono text-xs text-foreground/80 break-all">
                  doctorwebsite.in/apollo
                </div>
                <div className="text-xs text-muted-foreground flex items-center gap-1">
                  <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                  Admin: /apollo/login
                </div>
              </CardContent>
            </Card>

            {/* Type C: Hospital Doctor */}
            <Card className="hover:shadow-md transition-shadow border-t-4 border-t-sky-600">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <Badge variant="secondary" className="text-xs">Type C</Badge>
                  <Users className="h-5 w-5 text-sky-600" />
                </div>
                <CardTitle className="mt-2">Hospital Doctor</CardTitle>
                <CardDescription>Affiliated child medical staff</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <p className="text-muted-foreground">
                  Inherits hospital assets at runtime. Doctor controls qualifications and schedule.
                </p>
                <div className="rounded-md bg-muted p-2.5 font-mono text-xs text-foreground/80 break-all">
                  doctorwebsite.in/apollo/dr-rajiv-shah
                </div>
                <div className="text-xs text-muted-foreground flex items-center gap-1">
                  <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                  Admin: /apollo/dr-rajiv-shah/admin/login
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Foundation Architecture Highlights */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-bold tracking-tight">Core System Subsystems</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="bg-card/50">
              <CardHeader className="p-5">
                <Database className="h-5 w-5 text-primary mb-2" />
                <CardTitle className="text-base">Mongoose Connection</CardTitle>
                <CardDescription className="text-xs">
                  Serverless connection caching with zero pool explosion
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="bg-card/50">
              <CardHeader className="p-5">
                <Lock className="h-5 w-5 text-emerald-600 mb-2" />
                <CardTitle className="text-base">Better Auth Layer</CardTitle>
                <CardDescription className="text-xs">
                  Role-guarded multi-tenant authentication and session management
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="bg-card/50">
              <CardHeader className="p-5">
                <Layers className="h-5 w-5 text-sky-600 mb-2" />
                <CardTitle className="text-base">Media Pipeline</CardTitle>
                <CardDescription className="text-xs">
                  Strict file type and size validation per tenant role
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="bg-card/50">
              <CardHeader className="p-5">
                <Sparkles className="h-5 w-5 text-amber-500 mb-2" />
                <CardTitle className="text-base">Healthcare AI Rules</CardTitle>
                <CardDescription className="text-xs">
                  Draft-only text generation with strict medical guardrails
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>

        {/* Interactive Primitive Tokens Preview */}
        <Card className="border bg-card shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Design System Foundation Primitives</CardTitle>
            <CardDescription>
              Consistent clinical tokens, accessible typography, and interactive button states.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="default">Primary Action</Button>
              <Button variant="secondary">Secondary Action</Button>
              <Button variant="outline">Outline Action</Button>
              <Button variant="destructive">Destructive Action</Button>
              <Button variant="success">Success Action</Button>
              <Button variant="ghost">Ghost Button</Button>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-2 border-t">
              <Badge variant="default">Role: SUPERADMIN</Badge>
              <Badge variant="secondary">Role: HOSPITAL_ADMIN</Badge>
              <Badge variant="outline">Role: HOSPITAL_DOCTOR</Badge>
              <Badge variant="success">Role: INDEPENDENT_DOCTOR</Badge>
              <Badge variant="warning">Status: Verification Pending</Badge>
              <Badge variant="destructive">Status: Suspended</Badge>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
