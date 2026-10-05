"use client";

import * as React from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  hospitalOnboardingSchema,
  HospitalFormValues,
} from "@/validations/onboarding";
import { StateCitySelect } from "./state-city-select";
import { ConsultationHoursBuilder, DEFAULT_WEEK_SCHEDULE } from "./consultation-hours-builder";
import { WeeklyOffSelector } from "./weekly-off-selector";
import { ImageUploader } from "./image-uploader";
import { GalleryUploader } from "./gallery-uploader";
import { ThemeSelector } from "./theme-selector";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { FormField } from "./form-field";
import { apiClient } from "@/lib/api-client";
import { Building2, Save, CheckCircle, ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";

export function HospitalCreationForm() {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [publishedUrl, setPublishedUrl] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useForm<HospitalFormValues>({
    resolver: zodResolver(hospitalOnboardingSchema),
    defaultValues: {
      type: "HOSPITAL",
      appointmentRequired: true,
      selectedTheme: "vital-compact",
      workingHours: DEFAULT_WEEK_SCHEDULE,
      weeklyOff: ["Sunday"],
      galleryPhotos: [],
      isDraft: false,
    },
    mode: "onBlur",
  });

  const formValues = watch();

  const handleSlugAutofill = (name: string) => {
    if (!formValues.slug) {
      const generated = name.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-");
      setValue("slug", generated, { shouldValidate: true });
    }
  };

  const onSubmit = async (data: HospitalFormValues) => {
    try {
      setIsSubmitting(true);
      const res = await apiClient.post<{ publicUrl: string }>("/onboarding/hospital", data);
      setPublishedUrl(res.publicUrl);
      toast.success("Hospital / Clinic Created Successfully!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Creation failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  const onSaveDraft = async () => {
    try {
      setIsSubmitting(true);
      setValue("isDraft", true);
      const res = await apiClient.post<{ publicUrl: string }>("/onboarding/hospital", {
        ...formValues,
        isDraft: true,
      });
      toast.success("Hospital profile saved as draft!");
      if (res.publicUrl) setPublishedUrl(res.publicUrl);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save draft");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (publishedUrl) {
    return (
      <Card className="max-w-3xl mx-auto border shadow-sm">
        <CardContent className="p-8 text-center space-y-4">
          <div className="h-16 w-16 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-600 flex items-center justify-center mx-auto">
            <CheckCircle className="h-9 w-9" />
          </div>
          <h2 className="text-2xl font-bold text-foreground">
            {formValues.hospitalName} is Live!
          </h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Your healthcare organization and hospital admin credentials have been configured. You can now add child doctors under this hospital.
          </p>
          <div className="pt-2">
            <a
              href={`https://${publishedUrl}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md bg-primary text-primary-foreground text-sm font-semibold shadow hover:bg-primary/90"
            >
              <span>Visit {publishedUrl}</span>
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="max-w-4xl mx-auto border shadow-sm">
      <CardHeader className="border-b bg-card/60">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-600 flex items-center justify-center">
              <Building2 className="h-6 w-6" />
            </div>
            <div>
              <CardTitle className="text-xl">Hospital & Clinic Creation Wizard</CardTitle>
              <CardDescription>
                Register a parent healthcare organization and initialize hospital-wide source-of-truth details.
              </CardDescription>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onSaveDraft}
            disabled={isSubmitting}
            className="text-xs"
          >
            <Save className="h-3.5 w-3.5 mr-1.5" />
            Save Draft
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-6">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
          {/* Section 1: Organization Identity */}
          <div className="space-y-4">
            <h3 className="text-base font-semibold text-foreground border-b pb-2">
              1. Organization Identity
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                id="hospitalName"
                label="Hospital / Clinic Name"
                required
                error={errors.hospitalName?.message}
              >
                <Input
                  id="hospitalName"
                  {...register("hospitalName")}
                  placeholder="Apollo Hospitals"
                  onBlur={(e) => handleSlugAutofill(e.target.value)}
                />
              </FormField>

              <div className="space-y-1.5">
                <Label className="text-sm font-medium">
                  Organization Type <span className="text-destructive">*</span>
                </Label>
                <div className="flex gap-4 pt-2">
                  {["HOSPITAL", "CLINIC"].map((t) => (
                    <label key={t} className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="radio"
                        value={t}
                        {...register("type")}
                        className="h-4 w-4 text-primary"
                      />
                      <span>{t === "HOSPITAL" ? "Multi-Specialty Hospital" : "Outpatient Clinic"}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <FormField
              id="slug"
              label="Unique Website Slug"
              required
              hint="Public URL identifier: doctorwebsite.in/<slug>"
              error={errors.slug?.message}
            >
              <div className="relative flex rounded-md shadow-sm">
                <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-input bg-muted text-muted-foreground text-xs select-none">
                  doctorwebsite.in/
                </span>
                <Input
                  id="slug"
                  {...register("slug")}
                  placeholder="apollo"
                  className="rounded-l-none lowercase font-mono text-sm"
                />
              </div>
            </FormField>

            <FormField
              id="about"
              label="About Hospital / Clinic"
              required
              hint="Brief description of hospital medical excellence and infrastructure"
              error={errors.about?.message}
            >
              <textarea
                id="about"
                rows={3}
                {...register("about")}
                placeholder="Apollo Hospital is a state-of-the-art tertiary care medical center dedicated to patient-centered clinical care..."
                className="w-full rounded-md border border-input bg-background p-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </FormField>
          </div>

          {/* Section 2: Contact & Regional Address */}
          <div className="space-y-4">
            <h3 className="text-base font-semibold text-foreground border-b pb-2">
              2. Official Contact & Address
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <FormField id="phone" label="Landline / Phone" required error={errors.phone?.message}>
                <Input id="phone" {...register("phone")} placeholder="079 6670 1800" />
              </FormField>

              <FormField id="whatsApp" label="WhatsApp Helpdesk" required error={errors.whatsApp?.message}>
                <Input id="whatsApp" {...register("whatsApp")} placeholder="+91 9876543210" />
              </FormField>

              <FormField id="email" label="Official Inquiries Email" required error={errors.email?.message}>
                <Input id="email" type="email" {...register("email")} placeholder="contact@apollo.com" />
              </FormField>
            </div>

            <FormField id="street" label="Hospital Campus / Street" error={errors.address?.street?.message}>
              <Input id="street" {...register("address.street")} placeholder="Plot 1A, SG Highway, Bhat" />
            </FormField>

            <Controller
              name="address"
              control={control}
              render={({ field }) => (
                <StateCitySelect
                  stateValue={field.value?.state}
                  cityValue={field.value?.city}
                  onStateChange={(state) => setValue("address.state", state, { shouldValidate: true })}
                  onCityChange={(city) => setValue("address.city", city, { shouldValidate: true })}
                  stateError={errors.address?.state?.message}
                  cityError={errors.address?.city?.message}
                />
              )}
            />

            <FormField id="pincode" label="Pincode" required error={errors.address?.pincode?.message}>
              <Input id="pincode" {...register("address.pincode")} placeholder="382428" maxLength={6} />
            </FormField>
          </div>

          {/* Section 3: Hours & Operational Settings */}
          <div className="space-y-4">
            <h3 className="text-base font-semibold text-foreground border-b pb-2">
              3. Hospital Working Hours & Schedule
            </h3>

            <Controller
              name="workingHours"
              control={control}
              render={({ field }) => (
                <ConsultationHoursBuilder
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.workingHours?.message}
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

            <div className="space-y-2 pt-2 border-t">
              <Label className="text-sm font-medium">
                Mandatory Prior Appointment? <span className="text-destructive">*</span>
              </Label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="radio"
                    value="true"
                    checked={formValues.appointmentRequired === true}
                    onChange={() => setValue("appointmentRequired", true)}
                    className="h-4 w-4 text-primary"
                  />
                  <span>Yes (OPD booking required)</span>
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="radio"
                    value="false"
                    checked={formValues.appointmentRequired === false}
                    onChange={() => setValue("appointmentRequired", false)}
                    className="h-4 w-4 text-primary"
                  />
                  <span>No (Walk-in OPD accepted)</span>
                </label>
              </div>
            </div>
          </div>

          {/* Section 4: Hospital Media Assets */}
          <div className="space-y-4">
            <h3 className="text-base font-semibold text-foreground border-b pb-2">
              4. Hospital Media & Facility Photos
            </h3>

            <Controller
              name="logo"
              control={control}
              render={({ field }) => (
                <ImageUploader
                  label="Hospital / Clinic Logo"
                  category="CLINIC_LOGO"
                  maxSizeBytes={2 * 1024 * 1024}
                  required
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.logo?.message}
                />
              )}
            />

            <Controller
              name="galleryPhotos"
              control={control}
              render={({ field }) => (
                <GalleryUploader
                  label="Hospital Campus, ICU & Operation Theater Photos (Max 6)"
                  value={field.value || []}
                  onChange={field.onChange}
                  maxFiles={6}
                  maxSizeBytes={3 * 1024 * 1024}
                  error={errors.galleryPhotos?.message}
                />
              )}
            />
          </div>

          {/* Section 5: Theme Selection */}
          <div className="space-y-4">
            <h3 className="text-base font-semibold text-foreground border-b pb-2">
              5. Website Design Architecture
            </h3>
            <Controller
              name="selectedTheme"
              control={control}
              render={({ field }) => (
                <ThemeSelector
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.selectedTheme?.message}
                />
              )}
            />
          </div>

          {/* Section 6: Hospital Admin Security Credentials */}
          <div className="space-y-4">
            <h3 className="text-base font-semibold text-foreground border-b pb-2">
              6. Hospital Administrator Credentials
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField id="adminName" label="Admin Name" required error={errors.adminName?.message}>
                <Input id="adminName" {...register("adminName")} placeholder="Dr. Rajiv Mehta" />
              </FormField>

              <FormField id="adminEmail" label="Admin Login Email" required error={errors.adminEmail?.message}>
                <Input id="adminEmail" type="email" {...register("adminEmail")} placeholder="admin@apollo.com" />
              </FormField>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField id="adminPassword" label="Admin Password" required error={errors.adminPassword?.message}>
                <Input id="adminPassword" type="password" {...register("adminPassword")} placeholder="••••••••••••" />
              </FormField>

              <FormField id="confirmPassword" label="Confirm Password" required error={errors.confirmPassword?.message}>
                <Input id="confirmPassword" type="password" {...register("confirmPassword")} placeholder="••••••••••••" />
              </FormField>
            </div>
          </div>

          {/* Submit Button */}
          <div className="pt-6 border-t flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Doctors will be created and affiliated under this hospital after registration.
            </p>
            <Button type="submit" disabled={isSubmitting} size="lg" variant="success">
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating Hospital Website...
                </>
              ) : (
                "Create Hospital Website"
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
