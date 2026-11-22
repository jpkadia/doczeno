"use client";

import * as React from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  hospitalOnboardingSchema,
  HospitalFormValues,
} from "@/validations/onboarding";
import { StepProgress, StepItem } from "./step-progress";
import { SpecialtiesMultiSelect } from "./specialties-multi-select";
import { StateCitySelect } from "./state-city-select";
import { ConsultationHoursBuilder, DEFAULT_WEEK_SCHEDULE } from "./consultation-hours-builder";
import { ImageUploader } from "./image-uploader";
import { GalleryUploader } from "./gallery-uploader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { FormField } from "./form-field";
import { PhoneInput } from "@/components/ui/phone-input";
import { getPostalCodeRule } from "@/constants/countries";
import { apiClient } from "@/lib/api-client";
import {
  ArrowLeft,
  ArrowRight,
  Save,
  CheckCircle,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Stethoscope,
  Eye,
  EyeOff,
} from "lucide-react";
import { toast } from "sonner";
import { useFormDraft } from "@/hooks/use-form-draft";
import { DraftResumeBanner } from "./draft-resume-banner";
import { OtpVerificationDialog } from "./otp-verification-dialog";
import { SlugInput } from "./slug-input";
import { ThemeColorSelector } from "./theme-color-selector";
import { usePlatformDomain } from "@/hooks/use-platform-domain";

const WIZARD_STEPS: StepItem[] = [
  { id: 1, label: "Identity & Departments" },
  { id: 2, label: "Contact & Address" },
  { id: 3, label: "Working Hours" },
  { id: 4, label: "Media & Photos" },
  { id: 5, label: "Admin Account" },
  { id: 6, label: "Review" },
  { id: 7, label: "Publish" },
];

const DEFAULT_HOSPITAL_VALUES: Partial<HospitalFormValues> = {
  type: "HOSPITAL",
  specialties: [],
  appointmentRequired: true,
  selectedTheme: "blue",
  workingHours: DEFAULT_WEEK_SCHEDULE,
  weeklyOff: ["Sunday"],
  address: {
    country: "India",
    state: "",
    city: "",
    pincode: "",
    street: "",
  },
  galleryPhotos: [],
  isDraft: false,
};

export function HospitalCreationForm() {
  const { formatPrefix, formatUrl } = usePlatformDomain();
  const [currentStep, setCurrentStep] = React.useState(1);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [publishedUrl, setPublishedUrl] = React.useState<string | null>(null);
  const [showOtpDialog, setShowOtpDialog] = React.useState(false);
  const [createdSlug, setCreatedSlug] = React.useState<string | null>(null);
  const [showPassword, setShowPassword] = React.useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);

  const {
    register,
    control,
    watch,
    setValue,
    getValues,
    reset,
    setError,
    clearErrors,
    trigger,
    formState: { errors },
  } = useForm<HospitalFormValues>({
    resolver: zodResolver(hospitalOnboardingSchema),
    defaultValues: DEFAULT_HOSPITAL_VALUES,
    mode: "onBlur",
  });

  const formValues = watch();

  const {
    hasDraftToResume,
    draftInfo,
    saveStatus,
    lastSavedText,
    resumeDraft,
    discardDraft,
    saveDraftNow,
    clearDraft,
  } = useFormDraft<HospitalFormValues>({
    key: "doczeno_hospital_draft_v1",
    formValues,
    currentStep,
    formType: "HOSPITAL",
    getEmail: (v) => v.adminEmail || v.email,
    getName: (v) => v.hospitalName,
    hasContent: (v, step) => {
      if (step && step > 1) return true;
      return !!(
        v.hospitalName?.trim() ||
        v.email?.trim() ||
        v.adminEmail?.trim() ||
        (Array.isArray(v.specialties) && v.specialties.length > 0)
      );
    },
    onRestore: (savedData, savedStep) => {
      const restored = {
        ...DEFAULT_HOSPITAL_VALUES,
        ...savedData,
        specialties: savedData.specialties || [],
        address: {
          country: "India",
          state: "",
          city: "",
          pincode: "",
          street: "",
          ...(DEFAULT_HOSPITAL_VALUES.address || {}),
          ...(savedData.address || {}),
        },
        workingHours: savedData.workingHours?.length
          ? savedData.workingHours
          : DEFAULT_WEEK_SCHEDULE,
        weeklyOff: savedData.weeklyOff || ["Sunday"],
        galleryPhotos: savedData.galleryPhotos || [],
        isDraft: false,
      } as HospitalFormValues;

      reset(restored);

      // Force individual field synchronization
      Object.entries(restored).forEach(([k, v]) => {
        setValue(k as any, v, { shouldDirty: false });
      });

      setCurrentStep(Math.min(Math.max(savedStep || 1, 1), 7));
    },
    onDiscard: () => {
      reset(DEFAULT_HOSPITAL_VALUES as HospitalFormValues);
      Object.entries(DEFAULT_HOSPITAL_VALUES).forEach(([k, v]) => {
        setValue(k as any, v, { shouldDirty: false });
      });
      setCurrentStep(1);
    },
  });

  const handleSlugAutofill = (name: string) => {
    if (!formValues.slug) {
      const generated = name.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-");
      setValue("slug", generated, { shouldValidate: true });
    }
  };

  // Validate only the current step before advancing
  const validateStep = async (step: number): Promise<boolean> => {
    switch (step) {
      case 1: {
        const isBasicValid = await trigger(["hospitalName", "type", "slug"]);
        if (!formValues.specialties || formValues.specialties.length === 0) {
          setError("specialties", {
            type: "manual",
            message: "Please select at least one medical specialty / department",
          });
          return false;
        }
        clearErrors("specialties");
        if (!isBasicValid) return false;

        const slugToCheck = getValues("slug");
        if (slugToCheck && slugToCheck.length >= 2) {
          try {
            const check = await apiClient.get<{ available: boolean; error?: string }>(
              "/onboarding/check-slug",
              { params: { slug: slugToCheck, type: "HOSPITAL" } }
            );
            if (!check.available) {
              setError("slug", {
                type: "manual",
                message: check.error || "This website URL is already taken. Please choose another.",
              });
              return false;
            }
          } catch {
            // Network fallback
          }
        }
        return true;
      }

      case 2:
        return trigger(["phone", "whatsApp", "email", "address"]);

      case 3:
        return trigger(["workingHours", "weeklyOff", "appointmentRequired"]);

      case 4: {
        const isMediaValid = await trigger(["galleryPhotos"]);
        let hasError = false;
        if (!formValues.logo || !formValues.logo.url) {
          setError("logo", {
            type: "manual",
            message: "Hospital / Clinic logo is required before continuing",
          });
          toast.error("Please upload hospital logo");
          hasError = true;
        } else {
          clearErrors("logo");
        }

        if (!formValues.buildingPhoto || !formValues.buildingPhoto.url) {
          setError("buildingPhoto", {
            type: "manual",
            message: "Hospital exterior building photo (3:4) is mandatory",
          });
          toast.error("Please upload hospital building photo (3:4 ratio)");
          hasError = true;
        } else {
          clearErrors("buildingPhoto");
        }

        if (hasError) return false;
        return isMediaValid;
      }

      case 5: {
        const isFieldsValid = await trigger(["adminName", "adminEmail"]);
        const pwd = formValues.adminPassword || formValues.password;
        const confirmPwd = formValues.confirmPassword;

        let hasPasswordError = false;

        if (!pwd || pwd.length < 6) {
          setError("adminPassword", {
            type: "manual",
            message: "Admin password must be at least 6 characters with uppercase, number & symbol",
          });
          hasPasswordError = true;
        }

        if (!confirmPwd) {
          setError("confirmPassword", {
            type: "manual",
            message: "Please enter confirm password",
          });
          hasPasswordError = true;
        } else if (pwd !== confirmPwd) {
          setError("confirmPassword", {
            type: "manual",
            message: "Password and Confirm Password must match",
          });
          toast.error("Password and Confirm Password must match");
          hasPasswordError = true;
        }

        if (hasPasswordError || !isFieldsValid) {
          return false;
        }

        clearErrors(["adminPassword", "confirmPassword"]);
        return true;
      }

      default:
        return true;
    }
  };

  // Always scroll to top immediately whenever currentStep changes so user starts at top of form
  React.useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [currentStep]);

  const handleNext = async () => {
    const isValid = await validateStep(currentStep);
    if (!isValid) {
      toast.error("Please fill all required fields correctly before moving forward.");
      return;
    }
    setCurrentStep((prev) => Math.min(prev + 1, 7));
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  };

  const handlePrev = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  };

  const handlePublishClick = async () => {
    const isStep5Valid = await validateStep(5);
    if (!isStep5Valid) {
      setCurrentStep(5);
      return;
    }

    const isGlobalValid = await trigger();
    if (!isGlobalValid) {
      toast.error("Some required details are missing or invalid. Please check previous steps.");
      return;
    }

    setShowOtpDialog(true);
  };

  const handleVerifyOtpAndCreate = async (otp: string) => {
    try {
      setIsSubmitting(true);
      setValue("otp", otp);

      const payload = {
        ...formValues,
        otp,
        isDraft: false,
      };

      const res = await apiClient.post<{ publicUrl?: string; data?: { publicUrl?: string } }>(
        "/onboarding/hospital",
        payload
      );

      const url = res.publicUrl || res.data?.publicUrl || "";
      setPublishedUrl(url);
      setCreatedSlug(formValues.slug);
      clearDraft();
      setCurrentStep(7);
      toast.success("Hospital & Clinic Website Created Successfully!");
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : (err as { message?: string })?.message || "Hospital creation failed";
      toast.error(msg);
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  };

  const onSaveDraft = () => {
    saveDraftNow();
  };

  const stepTitles: Record<number, string> = {
    1: "Organization Identity & Clinical Departments",
    2: "Official Contact Channels & Campus Address",
    3: "Operational Working Hours & Consultation Policy",
    4: "Hospital Logo & Infrastructure Gallery",
    5: "Hospital Administrator Credentials",
    6: "Review & Verification Summary",
    7: "Hospital Website Successfully Created!",
  };

  if (currentStep === 7) {
    const slug = createdSlug || formValues.slug || (publishedUrl ? publishedUrl.split("/").pop() : "") || "hospital";

    return (
      <div className="py-4 sm:py-8 flex items-center justify-center min-h-[55vh]">
        <Card className="w-full max-w-lg mx-auto border border-blue-100/80 rounded-2xl shadow-xl bg-white/95 backdrop-blur-md">
          <CardContent className="p-5 sm:p-7 text-center space-y-3.5">
            <div className="h-12 w-12 rounded-full bg-blue-50 border border-blue-200 text-[#1a76d1] flex items-center justify-center mx-auto shadow-xs">
              <CheckCircle className="h-7 w-7" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
                {formValues.hospitalName} Website Successfully Created!
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 max-w-sm mx-auto mt-1">
                Your healthcare organization and hospital admin credentials are live with the verified Classic Healthcare Blue design.
              </p>
            </div>

            <div className="pt-2 flex flex-col items-center justify-center gap-3">
              <a
                href={`/${slug}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#1a76d1] text-white text-sm font-semibold shadow hover:bg-[#1560aa] transition-colors"
              >
                <span>View Public Website</span>
                <ExternalLink className="h-4 w-4" />
              </a>

              <div className="w-full p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-left space-y-1.5 text-xs">
                <span className="font-bold text-slate-900 block text-xs">
                  Hospital Administration Portal (Manual URL Access)
                </span>
                <p className="text-slate-500 leading-snug text-[11px]">
                  For security and compliance, direct admin links are not placed on public pages. Please copy and manually open your private hospital admin login link:
                </p>
                <div className="p-2 bg-white rounded-lg border border-slate-200 font-mono text-[11px] text-[#1a76d1] font-semibold select-all break-all">
                  {formatUrl(`${slug}/admin/login`)}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Draft Resume Banner */}
      {hasDraftToResume && draftInfo && currentStep === 1 && (
        <DraftResumeBanner
          step={draftInfo.step}
          totalSteps={WIZARD_STEPS.length}
          stepTitle={WIZARD_STEPS.find((s) => s.id === draftInfo.step)?.label || "Hospital Details"}
          formattedDate={draftInfo.formattedDate}
          previewTitle={draftInfo.previewTitle || formValues.hospitalName}
          onResume={resumeDraft}
          onDiscard={discardDraft}
        />
      )}

      {/* Step Progress Bar */}
      <StepProgress
        steps={WIZARD_STEPS}
        currentStep={currentStep}
        onStepClick={(targetStep) => {
          if (targetStep < currentStep) {
            setCurrentStep(targetStep);
            window.scrollTo({ top: 0, left: 0, behavior: "instant" });
          }
        }}
      />

      <Card className="border border-blue-100/80 rounded-2xl shadow-lg bg-white/95 backdrop-blur-md">
        <CardHeader className="border-b border-blue-100/70 bg-blue-50/50 p-4 sm:p-6 rounded-t-2xl">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-[#1560aa] uppercase tracking-wider">
                Step 0{currentStep} of 0{WIZARD_STEPS.length}
              </span>
              <CardTitle className="text-xl mt-1">
                {stepTitles[currentStep]}
              </CardTitle>
            </div>

            {/* Autosave Indicator and Save Draft Button */}
            {currentStep < 7 && (
              <div className="flex items-center gap-3">
                {saveStatus === "saving" && (
                  <span className="hidden sm:inline-flex items-center gap-1.5 text-xs text-muted-foreground animate-pulse">
                    <Loader2 className="h-3 w-3 animate-spin text-primary" />
                    Saving draft...
                  </span>
                )}
                {saveStatus === "saved" && lastSavedText && (
                  <span className="hidden sm:inline-flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {lastSavedText}
                  </span>
                )}

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onSaveDraft}
                  disabled={isSubmitting}
                  className="text-xs"
                  title="Save your progress locally"
                >
                  <Save className="h-3.5 w-3.5 mr-1.5 text-primary" />
                  Save Draft
                </Button>
              </div>
            )}
          </div>
          <CardDescription>
            {currentStep === 1 && "Register a healthcare facility, configure departments, and establish a digital presence"}
            {currentStep === 2 && "Official channels for communication and physical campus address"}
            {currentStep === 3 && "Operational timings, weekly holidays, and appointment booking policies"}
            {currentStep === 4 && "Upload facility logo and interior/exterior infrastructure photos"}
            {currentStep === 5 && "Administrative account credentials to manage your hospital portal"}
            {currentStep === 6 && "Carefully review all hospital details before publishing"}
            {currentStep === 7 && "Your hospital website is live"}
          </CardDescription>
        </CardHeader>

        <CardContent className="p-6">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (currentStep < 6) {
                handleNext();
              } else if (currentStep === 6) {
                handlePublishClick();
              }
            }}
            className="space-y-6"
          >

            {/* STEP 1: Identity & Specialties */}
            {currentStep === 1 && (
              <div className="space-y-5">
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
                      placeholder="Enter hospital / clinic name"
                      onBlur={(e) => handleSlugAutofill(e.target.value)}
                    />
                  </FormField>

                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium">
                      Organization Type <span className="text-destructive">*</span>
                    </Label>
                    <div className="flex gap-4 pt-2">
                      {[
                        { val: "HOSPITAL", label: "Multi-Specialty Hospital" },
                        { val: "CLINIC", label: "Outpatient Clinic" },
                      ].map((t) => (
                        <label key={t.val} className="flex items-center gap-2 text-sm cursor-pointer">
                          <input
                            type="radio"
                            value={t.val}
                            {...register("type")}
                            className="h-4 w-4 text-primary"
                          />
                          <span>{t.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Specialties Multi-Select (Comprehensive list, no max limit) */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium flex items-center gap-1.5">
                      <Stethoscope className="h-4 w-4 text-primary" />
                      Hospital Departments & Specialties Offered <span className="text-destructive">*</span>
                    </Label>
                    <span className="text-[11px] text-muted-foreground">
                      No selection limit • Select all departments available
                    </span>
                  </div>

                  <Controller
                    name="specialties"
                    control={control}
                    render={({ field }) => (
                      <SpecialtiesMultiSelect
                        value={field.value || []}
                        onChange={(val) => {
                          field.onChange(val);
                          clearErrors("specialties");
                        }}
                        error={errors.specialties?.message}
                      />
                    )}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Affiliated doctors will select their specialization strictly from these configured departments.
                  </p>
                </div>

                <Controller
                  name="slug"
                  control={control}
                  render={({ field }) => (
                    <SlugInput
                      id="slug"
                      label="Choose Website URL"
                      value={field.value || ""}
                      onChange={(val) => setValue("slug", val, { shouldValidate: true })}
                      onBlur={field.onBlur}
                      error={errors.slug?.message}
                      prefix={formatPrefix()}
                      type="HOSPITAL"
                      placeholder="hospital-name"
                      hint="Public URL identifier for your hospital / clinic website."
                      required
                    />
                  )}
                />
              </div>
            )}

            {/* STEP 2: Contact & Address */}
            {currentStep === 2 && (
              <div className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <FormField id="phone" label="Landline / Primary Phone" required error={errors.phone?.message}>
                    <PhoneInput
                      id="phone"
                      value={formValues.phone}
                      onChange={(val) => {
                        setValue("phone", val, { shouldValidate: true, shouldDirty: true });
                      }}
                      error={errors.phone?.message}
                      required
                    />
                  </FormField>

                  <FormField id="whatsApp" label="WhatsApp Helpdesk" required error={errors.whatsApp?.message}>
                    <PhoneInput
                      id="whatsApp"
                      value={formValues.whatsApp}
                      onChange={(val) => {
                        setValue("whatsApp", val, { shouldValidate: true, shouldDirty: true });
                      }}
                      error={errors.whatsApp?.message}
                      required
                    />
                  </FormField>

                  <FormField id="email" label="Official Inquiries Email" required error={errors.email?.message}>
                    <Input id="email" type="email" {...register("email")} placeholder="contact@hospital.com" />
                  </FormField>
                </div>

                <FormField id="street" label="Hospital Campus / Street Address" error={errors.address?.street?.message}>
                  <Input id="street" {...register("address.street")} placeholder="Enter campus address / street name" />
                </FormField>

                <Controller
                  name="address"
                  control={control}
                  render={({ field }) => (
                    <StateCitySelect
                      countryValue={field.value?.country}
                      stateValue={field.value?.state}
                      cityValue={field.value?.city}
                      onCountryChange={(country) => setValue("address.country", country, { shouldValidate: true })}
                      onStateChange={(state) => setValue("address.state", state, { shouldValidate: true })}
                      onCityChange={(city) => setValue("address.city", city, { shouldValidate: true })}
                      countryError={errors.address?.country?.message}
                      stateError={errors.address?.state?.message}
                      cityError={errors.address?.city?.message}
                    />
                  )}
                />

                {(() => {
                  const postalRule = getPostalCodeRule(formValues.address?.country || "India");
                  return (
                    <FormField
                      id="pincode"
                      label={postalRule.label}
                      required
                      error={errors.address?.pincode?.message}
                    >
                      <Input
                        id="pincode"
                        {...register("address.pincode")}
                        placeholder={postalRule.placeholder}
                        maxLength={12}
                      />
                    </FormField>
                  );
                })()}
              </div>
            )}

            {/* STEP 3: Working Hours & Operational Schedule */}
            {currentStep === 3 && (
              <div className="space-y-5">
                <Controller
                  name="workingHours"
                  control={control}
                  render={({ field }) => (
                    <ConsultationHoursBuilder
                      value={field.value}
                      onChange={(schedules) => {
                        field.onChange(schedules);
                        const closed = schedules.filter((s) => s.isClosed).map((s) => s.day);
                        setValue("weeklyOff", closed, { shouldDirty: true });
                      }}
                      onClosedDaysChange={(closed) => {
                        setValue("weeklyOff", closed, { shouldDirty: true });
                      }}
                      error={errors.workingHours?.message}
                    />
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
                      <span>Yes (OPD booking mandatory)</span>
                    </label>
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="radio"
                        value="false"
                        checked={formValues.appointmentRequired === false}
                        onChange={() => setValue("appointmentRequired", false)}
                        className="h-4 w-4 text-primary"
                      />
                      <span>No (Walk-in OPD welcome)</span>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 4: Media & Photos */}
            {currentStep === 4 && (
              <div className="space-y-6">
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
                  name="buildingPhoto"
                  control={control}
                  render={({ field }) => (
                    <ImageUploader
                      label="Hospital Building Photo (3:4 Vertical Exterior)"
                      category="BUILDING_PHOTO"
                      cropAspect={3 / 4}
                      aspect={3 / 4}
                      cropDescription="Reposition, zoom, and adjust within the 3:4 vertical frame for the website homepage."
                      maxSizeBytes={5 * 1024 * 1024}
                      required
                      value={field.value}
                      onChange={field.onChange}
                      error={errors.buildingPhoto?.url?.message || (errors.buildingPhoto as any)?.message}
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

                <div className="pt-4 border-t border-slate-100">
                  <Controller
                    name="selectedTheme"
                    control={control}
                    render={({ field }) => (
                      <ThemeColorSelector
                        value={field.value || "blue"}
                        onChange={field.onChange}
                      />
                    )}
                  />
                </div>
              </div>
            )}

            {/* STEP 5: Hospital Administrator Credentials */}
            {currentStep === 5 && (
              <div className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField id="adminName" label="Administrator Name" required error={errors.adminName?.message}>
                    <Input id="adminName" {...register("adminName")} placeholder="Enter administrator full name" />
                  </FormField>

                  <FormField id="adminEmail" label="Admin Login Email" required error={errors.adminEmail?.message}>
                    <Input id="adminEmail" type="email" {...register("adminEmail")} placeholder="admin@hospital.com" />
                  </FormField>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    id="adminPassword"
                    label="Create Admin Password"
                    required
                    hint="Min 6 chars, uppercase, number & symbol"
                    error={errors.adminPassword?.message}
                  >
                    <div className="relative">
                      <Input
                        id="adminPassword"
                        type={showPassword ? "text" : "password"}
                        autoComplete="new-password"
                        className="pr-10"
                        {...register("adminPassword", {
                          onChange: (e) => {
                            const pwd = e.target.value;
                            const confirm = formValues.confirmPassword;
                            if (confirm && pwd && confirm !== pwd) {
                              setError("confirmPassword", {
                                type: "manual",
                                message: "Password and Confirm Password must match",
                              });
                            } else if (confirm && pwd && confirm === pwd) {
                              clearErrors("confirmPassword");
                            }
                          },
                        })}
                        placeholder="Create password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                      </button>
                    </div>
                  </FormField>

                  <FormField
                    id="confirmPassword"
                    label="Confirm Admin Password"
                    required
                    hint="Re-enter password to match"
                    error={errors.confirmPassword?.message}
                  >
                    <div className="relative">
                      <Input
                        id="confirmPassword"
                        type={showConfirmPassword ? "text" : "password"}
                        autoComplete="new-password"
                        className="pr-10"
                        {...register("confirmPassword", {
                          onChange: (e) => {
                            const confirm = e.target.value;
                            const pwd = formValues.adminPassword || formValues.password;
                            if (pwd && confirm && confirm !== pwd) {
                              setError("confirmPassword", {
                                type: "manual",
                                message: "Password and Confirm Password must match",
                              });
                            } else if (pwd && confirm && confirm === pwd) {
                              clearErrors("confirmPassword");
                            }
                          },
                        })}
                        placeholder="Confirm password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
                        aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                      >
                        {showConfirmPassword ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                      </button>
                    </div>
                  </FormField>
                </div>
              </div>
            )}

            {/* STEP 6: Review & Verification */}
            {currentStep === 6 && (
              <div className="space-y-6">
                <div className="rounded-lg border bg-card p-5 space-y-4 shadow-xs">
                  <h4 className="font-semibold text-foreground text-sm uppercase tracking-wider border-b pb-2">
                    Review Hospital & Clinic Details
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    <div>
                      <span className="text-muted-foreground block">Hospital Name:</span>
                      <span className="font-medium text-foreground text-sm">{formValues.hospitalName}</span>
                    </div>

                    <div>
                      <span className="text-muted-foreground block">Organization Type:</span>
                      <span className="font-medium text-foreground">
                        {formValues.type === "HOSPITAL" ? "Multi-Specialty Hospital" : "Outpatient Clinic"}
                      </span>
                    </div>

                    {formValues.slug && (
                      <div className="sm:col-span-2">
                        <span className="text-muted-foreground block">Hospital Website URL:</span>
                        <span className="font-medium text-primary font-mono text-xs">
                          {formatUrl(formValues.slug)}
                        </span>
                      </div>
                    )}

                    <div className="sm:col-span-2">
                      <span className="text-muted-foreground block">Configured Departments ({formValues.specialties?.length || 0}):</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {formValues.specialties?.map((spec) => (
                          <span
                            key={spec}
                            className="inline-block bg-primary/10 text-primary px-2 py-0.5 rounded text-[11px] font-medium"
                          >
                            {spec}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="sm:col-span-2">
                      <span className="text-muted-foreground block">About Narrative:</span>
                      <span className="font-medium text-emerald-600 dark:text-emerald-400">
                        Auto-generated by AI based on departments (editable later in Hospital Admin)
                      </span>
                    </div>

                    <div>
                      <span className="text-muted-foreground block">Phone:</span>
                      <span className="font-medium text-foreground">{formValues.phone}</span>
                    </div>

                    <div>
                      <span className="text-muted-foreground block">WhatsApp:</span>
                      <span className="font-medium text-foreground">{formValues.whatsApp}</span>
                    </div>

                    <div>
                      <span className="text-muted-foreground block">Official Email:</span>
                      <span className="font-medium text-foreground">{formValues.email}</span>
                    </div>

                    <div>
                      <span className="text-muted-foreground block">Administrator:</span>
                      <span className="font-medium text-foreground">
                        {formValues.adminName} ({formValues.adminEmail})
                      </span>
                    </div>

                    <div>
                      <span className="text-muted-foreground block">Campus Location:</span>
                      <span className="font-medium text-foreground">
                        {formValues.address?.city}, {formValues.address?.state} ({formValues.address?.pincode})
                      </span>
                    </div>

                    <div>
                      <span className="text-muted-foreground block">Website Theme:</span>
                      <span className="font-medium text-[#1560aa]">Classic Healthcare Blue (Default)</span>
                    </div>

                    <div>
                      <span className="text-muted-foreground block">Campus Photos:</span>
                      <span className="font-medium text-foreground">{formValues.galleryPhotos?.length || 0} images</span>
                    </div>

                    <div>
                      <span className="text-muted-foreground block">Hospital Logo:</span>
                      {formValues.logo?.url ? (
                        <div className="mt-1 h-12 w-12 rounded-md overflow-hidden border border-slate-200 bg-slate-50">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={formValues.logo.url} alt="Logo" className="h-full w-full object-contain" />
                        </div>
                      ) : (
                        <span className="text-destructive font-medium">Missing</span>
                      )}
                    </div>

                    <div>
                      <span className="text-muted-foreground block">Building Exterior Photo (3:4):</span>
                      {formValues.buildingPhoto?.url ? (
                        <div className="mt-1 h-16 w-12 rounded-md overflow-hidden border border-slate-200 aspect-[3/4]">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={formValues.buildingPhoto.url} alt="Building" className="h-full w-full object-cover" />
                        </div>
                      ) : (
                        <span className="text-destructive font-medium">Missing</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-blue-200/80 bg-blue-50/60 p-4 text-xs text-[#1560aa] leading-relaxed">
                  All healthcare credentials, departments, and media assets have been verified.
                  Clicking <strong>Create Hospital Website</strong> will verify your administrator email and publish your healthcare portal.
                </div>
              </div>
            )}

            {/* Footer Navigation Controls */}
            {currentStep < 7 && (
              <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-6 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handlePrev}
                  disabled={currentStep === 1 || isSubmitting}
                  className="w-full sm:w-auto h-10 text-xs sm:text-sm font-semibold border-slate-200 text-slate-700 hover:bg-blue-50/50 hover:text-[#1a76d1]"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Previous
                </Button>

                {currentStep < 6 ? (
                  <Button
                    type="button"
                    onClick={handleNext}
                    disabled={isSubmitting}
                    className="w-full sm:w-auto h-10 text-xs sm:text-sm font-semibold bg-[#1a76d1] hover:bg-[#1560aa] text-white shadow-xs"
                  >
                    Next
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                ) : (
                  <Button
                    type="button"
                    onClick={handlePublishClick}
                    disabled={isSubmitting}
                    className="w-full sm:w-auto h-10 text-xs sm:text-sm font-semibold bg-[#1a76d1] hover:bg-[#1560aa] text-white shadow-xs"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Please wait...
                      </>
                    ) : (
                      "Create Hospital Website"
                    )}
                  </Button>
                )}
              </div>
            )}
          </form>
        </CardContent>
      </Card>

      <OtpVerificationDialog
        open={showOtpDialog}
        onOpenChange={setShowOtpDialog}
        email={formValues.adminEmail || formValues.email || ""}
        name={formValues.adminName || formValues.hospitalName}
        onVerified={handleVerifyOtpAndCreate}
      />
    </div>
  );
}
