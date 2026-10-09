"use client";

import * as React from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  hospitalDoctorOnboardingSchema,
  HospitalDoctorFormValues,
} from "@/validations/onboarding";
import { SpecializationSelect } from "./specialization-select";
import { ConsultationHoursBuilder, DEFAULT_WEEK_SCHEDULE } from "./consultation-hours-builder";
import { WeeklyOffSelector } from "./weekly-off-selector";
import { ImageUploader } from "./image-uploader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { FormField } from "./form-field";
import { apiClient } from "@/lib/api-client";
import { Users, Info, CheckCircle, ExternalLink, Loader2, Building2 } from "lucide-react";
import { toast } from "sonner";
import { OtpVerificationDialog } from "./otp-verification-dialog";

interface EligibleHospital {
  _id: string;
  name: string;
  slug: string;
  type: string;
  address?: {
    city?: string;
    state?: string;
  };
}

interface HospitalDoctorFormProps {
  defaultOrganizationId?: string;
  lockOrganization?: boolean;
}

export function HospitalDoctorForm({
  defaultOrganizationId,
  lockOrganization = false,
}: HospitalDoctorFormProps) {
  const [hospitals, setHospitals] = React.useState<EligibleHospital[]>([]);
  const [isLoadingHospitals, setIsLoadingHospitals] = React.useState(true);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [publishedUrl, setPublishedUrl] = React.useState<string | null>(null);
  const [showOtpDialog, setShowOtpDialog] = React.useState(false);
  const [createdDocSlug, setCreatedDocSlug] = React.useState<string | null>(null);

  const {
    register,
    control,
    watch,
    setValue,
    trigger,
    formState: { errors },
  } = useForm<HospitalDoctorFormValues>({
    resolver: zodResolver(hospitalDoctorOnboardingSchema),
    defaultValues: {
      organizationId: defaultOrganizationId || "",
      gender: "MALE",
      appointmentRequired: true,
      consultationHours: DEFAULT_WEEK_SCHEDULE,
      weeklyOff: ["Sunday"],
      isDraft: false,
    },
    mode: "onBlur",
  });

  const formValues = watch();

  // Load eligible active hospitals from backend
  React.useEffect(() => {
    async function fetchHospitals() {
      try {
        setIsLoadingHospitals(true);
        const res = await apiClient.get<{ hospitals: EligibleHospital[] }>(
          "/onboarding/eligible-hospitals"
        );
        setHospitals(res.hospitals);

        // If only 1 hospital or default given, select it
        if (defaultOrganizationId) {
          setValue("organizationId", defaultOrganizationId);
        } else if (res.hospitals.length === 1 && res.hospitals[0]) {
          setValue("organizationId", res.hospitals[0]._id);
        }
      } catch {
        toast.error("Failed to load active hospitals");
      } finally {
        setIsLoadingHospitals(false);
      }
    }

    fetchHospitals();
  }, [defaultOrganizationId, setValue]);

  const selectedHospital = hospitals.find((h) => h._id === formValues.organizationId);

  const handleFormSubmit = async () => {
    const isValid = await trigger();
    if (!isValid) {
      toast.error("Please fill all required doctor details and credentials correctly.");
      return;
    }
    setShowOtpDialog(true);
  };

  const handleVerifyOtpAndCreate = async (otp: string) => {
    try {
      setIsSubmitting(true);
      setValue("otp", otp);
      const res = await apiClient.post<{ publicUrl?: string; data?: { publicUrl?: string } }>(
        "/onboarding/hospital-doctor",
        {
          ...formValues,
          otp,
          isDraft: false,
        }
      );
      const url = res.publicUrl || res.data?.publicUrl || "";
      setPublishedUrl(url);
      const docSlug = url.split("/").pop() || "";
      setCreatedDocSlug(docSlug);
      toast.success("Affiliated Doctor Registered Successfully!");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : (err as { message?: string })?.message || "Registration failed";
      toast.error(msg);
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  };

  if (publishedUrl) {
    const orgSlug = selectedHospital?.slug || "hospital";
    const doctorSlug = createdDocSlug || formValues.customSlug || ("dr-" + formValues.doctorName.toLowerCase().replace(/[^a-z0-9]/g, "-"));

    return (
      <Card className="max-w-2xl mx-auto border shadow-sm">
        <CardContent className="p-8 text-center space-y-4">
          <div className="h-16 w-16 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-600 flex items-center justify-center mx-auto">
            <CheckCircle className="h-9 w-9" />
          </div>
          <h2 className="text-2xl font-bold text-foreground">
            Dr. {formValues.doctorName} is Affiliated!
          </h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Doctor profile has been linked to {selectedHospital?.name || "the hospital"}. Branding, facility photos, and regional address are automatically inherited at runtime.
          </p>
          <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
            <a
              href={`/${orgSlug}/${doctorSlug}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md bg-primary text-primary-foreground text-sm font-semibold shadow hover:bg-primary/90 transition-colors"
            >
              <span>View Doctor Profile</span>
              <ExternalLink className="h-4 w-4" />
            </a>
            <a
              href={`/${orgSlug}/${doctorSlug}/admin/login`}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md border bg-card text-foreground text-sm font-semibold shadow-sm hover:bg-accent transition-colors"
            >
              <span>Access Doctor Admin</span>
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="max-w-3xl mx-auto border shadow-sm">
      <CardHeader className="border-b bg-card/60">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-sky-100 dark:bg-sky-950 text-sky-600 flex items-center justify-center">
            <Users className="h-6 w-6" />
          </div>
          <div>
            <CardTitle className="text-xl">Affiliated Hospital Doctor Form</CardTitle>
            <CardDescription>
              Register a clinician under an active hospital or clinic organization.
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-6">
        <form onSubmit={(e) => { e.preventDefault(); handleFormSubmit(); }} className="space-y-6">
          {/* Hospital Selection */}
          <div className="space-y-2 p-4 rounded-lg border bg-muted/30">
            <div className="flex items-center justify-between">
              <Label htmlFor="hospital-select" className="text-sm font-semibold flex items-center gap-2">
                <Building2 className="h-4 w-4 text-primary" />
                Select Parent Hospital / Clinic Organization <span className="text-destructive">*</span>
              </Label>
              {lockOrganization && (
                <span className="text-xs font-semibold text-primary">Locked to Current Hospital</span>
              )}
            </div>

            {isLoadingHospitals ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                Loading verified hospitals...
              </div>
            ) : (
              <select
                id="hospital-select"
                disabled={lockOrganization}
                {...register("organizationId")}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">Select a Hospital Organization</option>
                {hospitals.map((h) => (
                  <option key={h._id} value={h._id}>
                    {h.name} ({h.address?.city || "Healthcare Center"})
                  </option>
                ))}
              </select>
            )}

            {errors.organizationId && (
              <p className="text-xs text-destructive font-medium">{errors.organizationId.message}</p>
            )}

            {/* Informational Callout regarding Data Inheritance */}
            <div className="flex items-start gap-2.5 rounded-md bg-sky-50 dark:bg-sky-950/40 p-3 text-xs text-sky-800 dark:text-sky-300 border border-sky-200 dark:border-sky-900 mt-2">
              <Info className="h-4 w-4 shrink-0 text-sky-600 mt-0.5" />
              <div>
                <strong>Automatic Runtime Data Inheritance:</strong> Hospital branding, logo, facility photos, address, city, theme, and tab title are inherited dynamically from {selectedHospital?.name || "the selected hospital"}. Clinicians do not enter or duplicate common hospital data.
              </div>
            </div>
          </div>

          {/* Clinician Personal Credentials */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">
              Clinician Credentials
            </h3>

            <FormField
              id="doctorName"
              label="Doctor Name"
              required
              hint="Type only your name. Dr. prefix is automatically formatted."
              error={errors.doctorName?.message}
            >
              <div className="relative flex rounded-md shadow-sm">
                <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-input bg-muted text-muted-foreground text-sm font-semibold select-none">
                  Dr.
                </span>
                <Input
                  id="doctorName"
                  {...register("doctorName")}
                  placeholder="Rajiv Shah"
                  className="rounded-l-none"
                />
              </div>
            </FormField>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">
                  Gender <span className="text-destructive">*</span>
                </Label>
                <div className="flex gap-4 pt-2">
                  {["MALE", "FEMALE", "OTHER"].map((g) => (
                    <label key={g} className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="radio"
                        value={g}
                        {...register("gender")}
                        className="h-4 w-4 text-primary"
                      />
                      <span>{g === "MALE" ? "Male" : g === "FEMALE" ? "Female" : "Other"}</span>
                    </label>
                  ))}
                </div>
              </div>

              <FormField
                id="degree"
                label="Medical Degree"
                required
                error={errors.degree?.message}
              >
                <Input id="degree" {...register("degree")} placeholder="MBBS, MD, DM (Cardiology)" />
              </FormField>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">
                  Clinical Specialization <span className="text-destructive">*</span>
                </Label>
                <Controller
                  name="specialization"
                  control={control}
                  render={({ field }) => (
                    <SpecializationSelect
                      value={field.value}
                      onChange={field.onChange}
                      error={errors.specialization?.message}
                    />
                  )}
                />
              </div>

              <FormField
                id="yearsOfExperience"
                label="Years of Experience"
                required
                error={errors.yearsOfExperience?.message}
              >
                <Input
                  id="yearsOfExperience"
                  type="number"
                  min={0}
                  max={70}
                  {...register("yearsOfExperience", { valueAsNumber: true })}
                  placeholder="14"
                />
              </FormField>
            </div>
          </div>

          {/* Contact Details */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">
              Doctor Contact Channels
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField id="email" label="Doctor Email" required error={errors.email?.message}>
                <Input id="email" type="email" {...register("email")} placeholder="dr.rajiv@apollo.com" />
              </FormField>

              <FormField id="whatsApp" label="WhatsApp Number" required error={errors.whatsApp?.message}>
                <Input id="whatsApp" {...register("whatsApp")} placeholder="+91 9876543210" />
              </FormField>
            </div>
          </div>

          {/* Schedule */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">
              Consultation Schedule
            </h3>

            <Controller
              name="consultationHours"
              control={control}
              render={({ field }) => (
                <ConsultationHoursBuilder
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.consultationHours?.message}
                />
              )}
            />

            <Controller
              name="weeklyOff"
              control={control}
              render={({ field }) => (
                <WeeklyOffSelector value={field.value} onChange={field.onChange} />
              )}
            />
          </div>

          {/* Media: Doctor Photo Only (Hospital owns Logo/Gallery) */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">
              Doctor Photo
            </h3>

            <Controller
              name="doctorPhoto"
              control={control}
              render={({ field }) => (
                <ImageUploader
                  label="Doctor Portrait"
                  category="DOCTOR_PHOTO"
                  maxSizeBytes={3 * 1024 * 1024}
                  required
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.doctorPhoto?.message}
                />
              )}
            />
          </div>

          {/* Security Credentials */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">
              Doctor Account & Credentials
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                id="password"
                label="Create Password"
                required
                hint="Min 6 chars, 1 uppercase, 1 number, 1 symbol (@, #, $, !)"
                error={errors.password?.message}
              >
                <Input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  {...register("password")}
                  placeholder="••••••••"
                />
              </FormField>

              <FormField
                id="confirmPassword"
                label="Confirm Password"
                required
                hint="Re-enter password to confirm"
                error={errors.confirmPassword?.message}
              >
                <Input
                  id="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  {...register("confirmPassword")}
                  placeholder="••••••••"
                />
              </FormField>
            </div>
          </div>

          <div className="pt-6 border-t flex justify-end">
            <Button
              type="button"
              onClick={handleFormSubmit}
              disabled={isSubmitting}
              size="lg"
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Affiliating Doctor...
                </>
              ) : (
                "Affiliate Doctor to Hospital"
              )}
            </Button>
          </div>
        </form>
      </CardContent>

      <OtpVerificationDialog
        open={showOtpDialog}
        onOpenChange={setShowOtpDialog}
        email={formValues.email || ""}
        name={formValues.doctorName}
        onVerified={handleVerifyOtpAndCreate}
      />
    </Card>
  );
}
