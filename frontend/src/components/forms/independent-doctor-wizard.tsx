"use client";

import * as React from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  independentDoctorOnboardingSchema,
  IndependentDoctorFormValues,
} from "@/validations/onboarding";
import { StepProgress, StepItem } from "./step-progress";
import { SpecializationSelect } from "./specialization-select";
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
import { ArrowLeft, ArrowRight, Save, CheckCircle, ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";

const WIZARD_STEPS: StepItem[] = [
  { id: 1, label: "Basic Info" },
  { id: 2, label: "Contact" },
  { id: 3, label: "Schedule" },
  { id: 4, label: "Clinic Data" },
  { id: 5, label: "Media" },
  { id: 6, label: "Theme" },
  { id: 7, label: "Review" },
  { id: 8, label: "Publish" },
];

export function IndependentDoctorWizard() {
  const [currentStep, setCurrentStep] = React.useState(1);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [publishedUrl, setPublishedUrl] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    trigger,
    formState: { errors },
  } = useForm<IndependentDoctorFormValues>({
    resolver: zodResolver(independentDoctorOnboardingSchema),
    defaultValues: {
      gender: "MALE",
      appointmentRequired: true,
      selectedTheme: "clinical-editorial",
      consultationHours: DEFAULT_WEEK_SCHEDULE,
      weeklyOff: ["Sunday"],
      clinicPhotos: [],
      isDraft: false,
    },
    mode: "onBlur",
  });

  const formValues = watch();

  // Validate only the current step fields before progressing
  const validateStep = async (step: number): Promise<boolean> => {
    let fieldsToValidate: (keyof IndependentDoctorFormValues)[] = [];

    switch (step) {
      case 1:
        fieldsToValidate = ["doctorName", "gender", "degree", "yearsOfExperience"];
        break;
      case 2:
        fieldsToValidate = ["email", "whatsApp"];
        break;
      case 3:
        fieldsToValidate = ["consultationHours", "weeklyOff", "appointmentRequired"];
        break;
      case 4:
        fieldsToValidate = ["specialization", "clinicName", "address"];
        break;
      case 5:
        fieldsToValidate = ["doctorPhoto", "clinicLogo", "clinicPhotos"];
        break;
      case 6:
        fieldsToValidate = ["selectedTheme"];
        break;
      default:
        return true;
    }

    return trigger(fieldsToValidate);
  };

  const handleNext = async () => {
    const isValid = await validateStep(currentStep);
    if (isValid && currentStep < 8) {
      setCurrentStep((prev) => prev + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handlePrev = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const onSaveDraft = async () => {
    try {
      setIsSubmitting(true);
      setValue("isDraft", true);
      const res = await apiClient.post<{ publicUrl: string }>(
        "/onboarding/independent-doctor",
        { ...formValues, isDraft: true }
      );
      toast.success("Onboarding progress saved as draft!");
      if (res.publicUrl) setPublishedUrl(res.publicUrl);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save draft");
    } finally {
      setIsSubmitting(false);
    }
  };

  const onFinalSubmit = async (data: IndependentDoctorFormValues) => {
    try {
      setIsSubmitting(true);
      const res = await apiClient.post<{ publicUrl: string }>(
        "/onboarding/independent-doctor",
        { ...data, isDraft: false }
      );
      setPublishedUrl(res.publicUrl);
      toast.success("Independent Doctor Website Published Successfully!");
      setCurrentStep(8);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Submission failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Step Progress Bar */}
      <StepProgress
        steps={WIZARD_STEPS}
        currentStep={currentStep}
        onStepClick={(step) => {
          if (step < currentStep) setCurrentStep(step);
        }}
      />

      <Card className="border shadow-sm">
        <CardHeader className="border-b bg-card/60">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-primary uppercase tracking-wider">
                Step 0{currentStep} of 08
              </span>
              <CardTitle className="text-xl mt-1">
                {currentStep === 1 && "Basic Information"}
                {currentStep === 2 && "Contact Channels"}
                {currentStep === 3 && "Consultation Schedule"}
                {currentStep === 4 && "Clinical Practice & Location"}
                {currentStep === 5 && "Doctor & Clinic Media"}
                {currentStep === 6 && "Website Theme Architecture"}
                {currentStep === 7 && "Review Everything"}
                {currentStep === 8 && "Website Ready!"}
              </CardTitle>
            </div>

            {currentStep < 8 && (
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
            )}
          </div>
          <CardDescription>
            {currentStep === 1 && "Personal credentials and medical background"}
            {currentStep === 2 && "Official channels for patient booking and communication"}
            {currentStep === 3 && "Define working days, consultation slots, and weekly offs"}
            {currentStep === 4 && "Specialty, clinic name, and regional address"}
            {currentStep === 5 && "Upload profile photo and clinical facility gallery"}
            {currentStep === 6 && "Select one of three dedicated architectural themes"}
            {currentStep === 7 && "Carefully review all clinician parameters before generating"}
            {currentStep === 8 && "Your independent practice website is live"}
          </CardDescription>
        </CardHeader>

        <CardContent className="p-6">
          <form onSubmit={handleSubmit(onFinalSubmit)} className="space-y-6">
            {/* STEP 1: Basic Information */}
            {currentStep === 1 && (
              <div className="space-y-5">
                <FormField
                  id="doctorName"
                  label="Doctor Name"
                  required
                  hint="Type only your name. The 'Dr.' prefix is provided automatically."
                  error={errors.doctorName?.message}
                >
                  <div className="relative flex rounded-md shadow-sm">
                    <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-input bg-muted text-muted-foreground text-sm font-semibold select-none">
                      Dr.
                    </span>
                    <Input
                      id="doctorName"
                      {...register("doctorName")}
                      placeholder="Parth Kadiya"
                      className="rounded-l-none"
                    />
                  </div>
                </FormField>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">
                    Gender <span className="text-destructive">*</span>
                  </Label>
                  <div className="flex gap-4 pt-1">
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
                  {errors.gender && (
                    <p className="text-xs text-destructive font-medium">{errors.gender.message}</p>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    id="degree"
                    label="Medical Degree"
                    required
                    hint="e.g. MBBS, MS, MCh (Neurosurgery)"
                    error={errors.degree?.message}
                  >
                    <Input id="degree" {...register("degree")} placeholder="MBBS, MD (Medicine)" />
                  </FormField>

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
                      placeholder="12"
                    />
                  </FormField>
                </div>
              </div>
            )}

            {/* STEP 2: Contact */}
            {currentStep === 2 && (
              <div className="space-y-5">
                <FormField
                  id="email"
                  label="Official Email Address"
                  required
                  hint="Used for appointment confirmations and clinician administrative notices"
                  error={errors.email?.message}
                >
                  <Input id="email" type="email" {...register("email")} placeholder="dr.parth@clinic.com" />
                </FormField>

                <FormField
                  id="whatsApp"
                  label="WhatsApp Consultation Number"
                  required
                  hint="Includes country code, e.g. +91 9876543210"
                  error={errors.whatsApp?.message}
                >
                  <Input id="whatsApp" {...register("whatsApp")} placeholder="+91 9876543210" />
                </FormField>
              </div>
            )}

            {/* STEP 3: Schedule */}
            {currentStep === 3 && (
              <div className="space-y-6">
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

                <div className="space-y-2 pt-2 border-t">
                  <Label className="text-sm font-medium">
                    Prior Appointment Required? <span className="text-destructive">*</span>
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
                      <span>Yes (Prior slot reservation required)</span>
                    </label>
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="radio"
                        value="false"
                        checked={formValues.appointmentRequired === false}
                        onChange={() => setValue("appointmentRequired", false)}
                        className="h-4 w-4 text-primary"
                      />
                      <span>No (Walk-in consultations welcome)</span>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 4: Professional & Clinic Data */}
            {currentStep === 4 && (
              <div className="space-y-5">
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
                  {errors.specialization && (
                    <p className="text-xs text-destructive font-medium">{errors.specialization.message}</p>
                  )}
                </div>

                <FormField
                  id="clinicName"
                  label="Clinic / Hospital Practice Name"
                  required
                  error={errors.clinicName?.message}
                >
                  <Input id="clinicName" {...register("clinicName")} placeholder="Aura Specialty Clinic" />
                </FormField>

                <FormField
                  id="street"
                  label="Street Address / Building"
                  error={errors.address?.street?.message}
                >
                  <Input id="street" {...register("address.street")} placeholder="402, Medical Enclave, Ring Road" />
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

                <FormField
                  id="pincode"
                  label="Pincode (6-digit Indian Postal Code)"
                  required
                  error={errors.address?.pincode?.message}
                >
                  <Input id="pincode" {...register("address.pincode")} placeholder="380015" maxLength={6} />
                </FormField>
              </div>
            )}

            {/* STEP 5: Media */}
            {currentStep === 5 && (
              <div className="space-y-6">
                <Controller
                  name="doctorPhoto"
                  control={control}
                  render={({ field }) => (
                    <ImageUploader
                      label="Doctor Profile Photo"
                      category="DOCTOR_PHOTO"
                      maxSizeBytes={3 * 1024 * 1024}
                      required
                      value={field.value}
                      onChange={field.onChange}
                      error={errors.doctorPhoto?.message}
                    />
                  )}
                />

                <Controller
                  name="clinicLogo"
                  control={control}
                  render={({ field }) => (
                    <ImageUploader
                      label="Clinic / Practice Logo (Optional)"
                      category="CLINIC_LOGO"
                      maxSizeBytes={2 * 1024 * 1024}
                      value={field.value}
                      onChange={field.onChange}
                      error={errors.clinicLogo?.message}
                    />
                  )}
                />

                <Controller
                  name="clinicPhotos"
                  control={control}
                  render={({ field }) => (
                    <GalleryUploader
                      label="Clinic & Treatment Facility Photos (Max 6)"
                      value={field.value || []}
                      onChange={field.onChange}
                      maxFiles={6}
                      maxSizeBytes={3 * 1024 * 1024}
                      error={errors.clinicPhotos?.message}
                    />
                  )}
                />
              </div>
            )}

            {/* STEP 6: Theme Selection */}
            {currentStep === 6 && (
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
            )}

            {/* STEP 7: Review */}
            {currentStep === 7 && (
              <div className="space-y-6">
                <div className="rounded-lg border bg-muted/30 p-4 space-y-4">
                  <h4 className="font-semibold text-sm text-foreground">Summary of Website Details</h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    <div>
                      <span className="text-muted-foreground block">Doctor:</span>
                      <span className="font-medium text-foreground">Dr. {formValues.doctorName}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block">Degree:</span>
                      <span className="font-medium text-foreground">{formValues.degree}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block">Specialty:</span>
                      <span className="font-medium text-foreground">{formValues.specialization}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block">Experience:</span>
                      <span className="font-medium text-foreground">{formValues.yearsOfExperience} Years</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block">WhatsApp:</span>
                      <span className="font-medium text-foreground">{formValues.whatsApp}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block">Email:</span>
                      <span className="font-medium text-foreground">{formValues.email}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block">Clinic:</span>
                      <span className="font-medium text-foreground">{formValues.clinicName}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block">Location:</span>
                      <span className="font-medium text-foreground">
                        {formValues.address?.city}, {formValues.address?.state} ({formValues.address?.pincode})
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block">Selected Theme:</span>
                      <span className="font-medium text-foreground uppercase">{formValues.selectedTheme}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block">Facility Photos:</span>
                      <span className="font-medium text-foreground">{formValues.clinicPhotos?.length || 0} images</span>
                    </div>
                  </div>
                </div>

                <div className="rounded-md border border-primary/20 bg-primary/5 p-4 text-xs text-primary">
                  All clinical credentials and media assets have been verified against healthcare platform rules.
                  Clicking <strong>Publish Website</strong> will finalize your site and issue a public URL.
                </div>
              </div>
            )}

            {/* STEP 8: Success / Published */}
            {currentStep === 8 && (
              <div className="text-center py-8 space-y-4">
                <div className="h-14 w-14 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-600 flex items-center justify-center mx-auto">
                  <CheckCircle className="h-8 w-8" />
                </div>
                <h3 className="text-2xl font-bold text-foreground">Website Successfully Created!</h3>
                <p className="text-sm text-muted-foreground max-w-md mx-auto">
                  Dr. {formValues.doctorName}&apos;s independent clinical website has been registered and initialized with the {formValues.selectedTheme} theme.
                </p>

                {publishedUrl && (
                  <div className="pt-2">
                    <a
                      href={`https://${publishedUrl}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-semibold shadow hover:bg-primary/90"
                    >
                      <span>Visit {publishedUrl}</span>
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </div>
                )}
              </div>
            )}

            {/* Footer Navigation Controls */}
            {currentStep < 8 && (
              <div className="flex items-center justify-between pt-6 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handlePrev}
                  disabled={currentStep === 1 || isSubmitting}
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Previous
                </Button>

                {currentStep < 7 ? (
                  <Button type="button" onClick={handleNext} disabled={isSubmitting}>
                    Next
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                ) : (
                  <Button type="submit" disabled={isSubmitting} variant="success">
                    {isSubmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Publishing Website...
                      </>
                    ) : (
                      "Publish Website"
                    )}
                  </Button>
                )}
              </div>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
