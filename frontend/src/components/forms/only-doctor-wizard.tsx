"use client";

import * as React from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  onlyDoctorOnboardingSchema,
  OnlyDoctorFormValues,
} from "@/validations/onboarding";
import { StepProgress, StepItem } from "./step-progress";
import { SpecializationSelect } from "./specialization-select";
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
import { ArrowLeft, ArrowRight, Save, CheckCircle, CheckCircle2, ExternalLink, Loader2, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { OtpVerificationDialog } from "./otp-verification-dialog";
import { useFormDraft } from "@/hooks/use-form-draft";
import { DraftResumeBanner } from "./draft-resume-banner";
import { SlugInput } from "./slug-input";
import { ThemeColorSelector } from "./theme-color-selector";
import { usePlatformDomain } from "@/hooks/use-platform-domain";

const WIZARD_STEPS: StepItem[] = [
  { id: 1, label: "Basic Info" },
  { id: 2, label: "Contact & Security" },
  { id: 3, label: "Schedule" },
  { id: 4, label: "Clinic Data" },
  { id: 5, label: "Media" },
  { id: 6, label: "Review" },
  { id: 7, label: "Publish" },
];

const DEFAULT_FORM_VALUES: Partial<OnlyDoctorFormValues> = {
  customSlug: "",
  gender: "MALE",
  newCaseFee: undefined,
  oldCaseFee: undefined,
  appointmentRequired: true,
  selectedTheme: "blue",
  consultationHours: DEFAULT_WEEK_SCHEDULE,
  weeklyOff: ["Sunday"],
  address: {
    country: "India",
    state: "",
    city: "",
    pincode: "",
    street: "",
  },
  clinicPhotos: [],
  isDraft: false,
};

export function OnlyDoctorWizard() {
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
  } = useForm<OnlyDoctorFormValues>({
    resolver: zodResolver(onlyDoctorOnboardingSchema),
    defaultValues: DEFAULT_FORM_VALUES,
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
  } = useFormDraft<OnlyDoctorFormValues>({
    key: "doczeno_only_doctor_draft_v1",
    formValues,
    currentStep,
    formType: "ONLY_DOCTOR",
    getEmail: (v) => v.email,
    getName: (v) => v.doctorName,
    hasContent: (v, step) => {
      if (step && step > 1) return true;
      return !!(
        v.doctorName?.trim() ||
        v.degree?.trim() ||
        v.email?.trim() ||
        v.clinicName?.trim()
      );
    },
    onRestore: (savedData, savedStep) => {
      const restored = {
        ...DEFAULT_FORM_VALUES,
        ...savedData,
        address: {
          country: "India",
          state: "",
          city: "",
          pincode: "",
          street: "",
          ...(DEFAULT_FORM_VALUES.address || {}),
          ...(savedData.address || {}),
        },
        consultationHours: savedData.consultationHours?.length
          ? savedData.consultationHours
          : DEFAULT_WEEK_SCHEDULE,
        weeklyOff: savedData.weeklyOff || ["Sunday"],
        clinicPhotos: savedData.clinicPhotos || [],
        isDraft: false,
      } as OnlyDoctorFormValues;

      reset(restored);

      // Force individual field synchronization so all inputs/watches update immediately
      Object.entries(restored).forEach(([k, v]) => {
        setValue(k as any, v, { shouldDirty: false });
      });

      setCurrentStep(Math.min(Math.max(savedStep || 1, 1), 7));
    },
    onDiscard: () => {
      reset(DEFAULT_FORM_VALUES as OnlyDoctorFormValues);
      Object.entries(DEFAULT_FORM_VALUES).forEach(([k, v]) => {
        setValue(k as any, v, { shouldDirty: false });
      });
      setCurrentStep(1);
    },
  });

  const handleSlugAutofill = (name: string) => {
    if (!formValues.customSlug && name.trim()) {
      const clean = name
        .toLowerCase()
        .replace(/^dr[\.\s_-]*/i, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
      if (clean) {
        setValue("customSlug", `dr-${clean}`, { shouldValidate: true, shouldDirty: true });
      }
    }
  };

  // Validate only the current step fields before progressing
  const validateStep = async (step: number): Promise<boolean> => {
    switch (step) {
      case 1: {
        if (!formValues.customSlug && formValues.doctorName) {
          handleSlugAutofill(formValues.doctorName);
        }
        const isValid = await trigger(["doctorName", "gender", "degree", "yearsOfExperience", "customSlug", "newCaseFee", "oldCaseFee"]);
        if (!isValid) return false;

        const slugToCheck = getValues("customSlug");
        if (slugToCheck && slugToCheck.length >= 2) {
          try {
            const check = await apiClient.get<{ available: boolean; error?: string }>(
              "/onboarding/check-slug",
              { params: { slug: slugToCheck, type: "ONLY_DOCTOR" } }
            );
            if (!check.available) {
              setError("customSlug", {
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

      case 2: {
        const isFieldsValid = await trigger(["email", "whatsApp", "password", "confirmPassword"]);
        const pwd = formValues.password;
        const confirmPwd = formValues.confirmPassword;

        let hasPasswordError = false;

        if (!pwd || pwd.length < 6) {
          setError("password", {
            type: "manual",
            message: "Password must be at least 6 characters with uppercase, number & symbol",
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

        clearErrors(["password", "confirmPassword"]);
        return true;
      }

      case 3:
        return trigger(["consultationHours", "weeklyOff", "appointmentRequired"]);

      case 4:
        return trigger(["specialization", "clinicName", "address"]);

      case 5:
        return trigger(["doctorPhoto", "clinicLogo", "clinicPhotos"]);

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
    if (isValid && currentStep < 7) {
      setCurrentStep((prev) => prev + 1);
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    }
  };

  const handlePrev = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1);
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    }
  };

  const onSaveDraft = () => {
    saveDraftNow();
  };

  const handleVerifyOtpAndPublish = async (otp: string) => {
    try {
      setIsSubmitting(true);
      setValue("otp", otp);
      const res = await apiClient.post<{ publicUrl?: string; data?: { publicUrl?: string } }>(
        "/onboarding/only-doctor",
        { ...formValues, otp, isDraft: false }
      );
      const url = res.publicUrl || res.data?.publicUrl || "";
      setPublishedUrl(url);
      const cleanSlug = url.split("/").pop() || "";
      setCreatedSlug(cleanSlug);
      // Clean up the saved draft upon successful publication
      clearDraft();
      toast.success("Only Doctor Website Published Successfully!");
      setCurrentStep(7);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : (err as { message?: string })?.message || "Failed to publish website";
      toast.error(msg);
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePublishClick = async () => {
    const isValid = await trigger();
    if (!isValid) {
      toast.error("Please fill all required fields correctly before verifying.");
      return;
    }
    setShowOtpDialog(true);
  };

  if (currentStep === 7) {
    const slug =
      createdSlug ||
      (publishedUrl ? publishedUrl.split("/").pop() : "") ||
      formValues.customSlug ||
      "dr-" + formValues.doctorName.toLowerCase().replace(/[^a-z0-9]/g, "-");

    return (
      <div className="py-4 sm:py-8 flex items-center justify-center min-h-[55vh]">
        <Card className="w-full max-w-lg mx-auto border border-blue-100/80 rounded-2xl shadow-xl bg-white/95 backdrop-blur-md">
          <CardContent className="p-5 sm:p-7 text-center space-y-3.5">
            <div className="h-12 w-12 rounded-full bg-blue-50 border border-blue-200 text-[#1a76d1] flex items-center justify-center mx-auto shadow-xs">
              <CheckCircle className="h-7 w-7" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
                Website Successfully Created!
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 max-w-sm mx-auto mt-1">
                Dr. {formValues.doctorName}&apos;s clinical website is live with the verified Classic Healthcare Blue design.
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
                  Doctor Administration Portal (Manual URL Access)
                </span>
                <p className="text-slate-500 leading-snug text-[11px]">
                  For security and privacy compliance, direct admin links are not placed on public pages. Please copy and manually open your private admin login link:
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
          stepTitle={WIZARD_STEPS.find((s) => s.id === draftInfo.step)?.label}
          totalSteps={7}
          formattedDate={draftInfo.formattedDate}
          previewTitle={draftInfo.previewTitle}
          onResume={resumeDraft}
          onDiscard={discardDraft}
        />
      )}

      {/* Step Progress Bar */}
      <StepProgress
        steps={WIZARD_STEPS}
        currentStep={currentStep}
        onStepClick={(step) => {
          if (step < currentStep) {
            setCurrentStep(step);
            window.scrollTo({ top: 0, left: 0, behavior: "instant" });
          }
        }}
      />

      <Card className="border border-blue-100/80 rounded-2xl shadow-lg bg-white/95 backdrop-blur-md">
        <CardHeader className="border-b border-blue-100/70 bg-blue-50/50 p-4 sm:p-6 rounded-t-2xl">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-[#1560aa] uppercase tracking-wider">
                Step 0{currentStep} of 07
              </span>
              <CardTitle className="text-xl mt-1">
                {currentStep === 1 && "Basic Information"}
                {currentStep === 2 && "Contact Channels"}
                {currentStep === 3 && "Consultation Schedule"}
                {currentStep === 4 && "Clinic Information & Location"}
                {currentStep === 5 && "Doctor & Clinic Media"}
                {currentStep === 6 && "Review Everything"}
                {currentStep === 7 && "Website Ready!"}
              </CardTitle>
            </div>

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
            {currentStep === 1 && "Personal credentials and medical background"}
            {currentStep === 2 && "Official channels for patient booking and communication"}
            {currentStep === 3 && "Define working days, consultation slots, and weekly offs"}
            {currentStep === 4 && "Specialty, clinic name, and regional address"}
            {currentStep === 5 && "Upload profile photo and clinical facility gallery"}
            {currentStep === 6 && "Select one of three dedicated architectural themes"}
            {currentStep === 7 && "Carefully review all clinician parameters before generating"}
            {currentStep === 8 && "Your doctor website is live"}
          </CardDescription>
        </CardHeader>

        <CardContent className="p-6">
          <form onSubmit={(e) => { e.preventDefault(); handlePublishClick(); }} className="space-y-6">
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
                      onBlur={(e) => {
                        register("doctorName").onBlur(e);
                        handleSlugAutofill(e.target.value);
                      }}
                      placeholder="Full Name"
                      className="rounded-l-none"
                    />
                  </div>
                </FormField>

                <Controller
                  name="customSlug"
                  control={control}
                  render={({ field }) => (
                    <SlugInput
                      id="customSlug"
                      label="Choose Website URL"
                      value={field.value || ""}
                      onChange={(val) => setValue("customSlug", val, { shouldValidate: true })}
                      onBlur={field.onBlur}
                      error={errors.customSlug?.message}
                      prefix={formatPrefix()}
                      type="ONLY_DOCTOR"
                      placeholder="dr-fullname"
                      hint="Unique link for your website. You can customize your URL here."
                      required
                    />
                  )}
                />

                <div className="space-y-2">
                  <Label className="text-sm font-medium">
                    Gender <span className="text-destructive">*</span>
                  </Label>
                  <div className="flex gap-4 pt-1">
                    {["MALE", "FEMALE"].map((g) => (
                      <label key={g} className="flex items-center gap-2 text-sm cursor-pointer">
                        <input
                          type="radio"
                          value={g}
                          {...register("gender")}
                          className="h-4 w-4 text-primary"
                        />
                        <span>{g === "MALE" ? "Male" : "Female"}</span>
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
                    hint="e.g. MBBS, MD, MS"
                    error={errors.degree?.message}
                  >
                    <Input id="degree" {...register("degree")} placeholder="MBBS, MD, MS" />
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
                      placeholder="e.g. 12"
                    />
                  </FormField>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    id="newCaseFee"
                    label="Consultation Fee - New Case (₹)"
                    hint="Standard fee for first-time patient visits"
                    error={errors.newCaseFee?.message}
                  >
                    <Input
                      id="newCaseFee"
                      type="number"
                      min={0}
                      {...register("newCaseFee", {
                        setValueAs: (v) => (v === "" || v === null || isNaN(Number(v)) ? undefined : Number(v)),
                      })}
                      placeholder="e.g. 500"
                    />
                  </FormField>

                  <FormField
                    id="oldCaseFee"
                    label="Consultation Fee - Follow-up / Old Case (₹)"
                    hint="Fee for returning/follow-up patients"
                    error={errors.oldCaseFee?.message}
                  >
                    <Input
                      id="oldCaseFee"
                      type="number"
                      min={0}
                      {...register("oldCaseFee", {
                        setValueAs: (v) => (v === "" || v === null || isNaN(Number(v)) ? undefined : Number(v)),
                      })}
                      placeholder="e.g. 300"
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
                  <Input id="email" type="email" {...register("email")} placeholder="doctor@clinic.com" />
                </FormField>

                <FormField
                  id="whatsApp"
                  label="WhatsApp Consultation Number"
                  required
                  error={errors.whatsApp?.message}
                >
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

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t">
                  <FormField
                    id="password"
                    label="Create Admin Password"
                    required
                    hint="Min 6 chars, 1 uppercase, 1 number, 1 symbol (@, #, $, !)"
                    error={errors.password?.message}
                  >
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        autoComplete="new-password"
                        className="pr-10"
                        {...register("password", {
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
                    label="Confirm Password"
                    required
                    hint="Re-enter your password to confirm"
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
                            const pwd = formValues.password;
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

            {/* STEP 3: Schedule */}
            {currentStep === 3 && (
              <div className="space-y-6">
                <Controller
                  name="consultationHours"
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
                      error={errors.consultationHours?.message}
                    />
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
                  label="Clinic / Hospital Name"
                  required
                  error={errors.clinicName?.message}
                >
                  <Input id="clinicName" {...register("clinicName")} placeholder="Enter clinic / hospital name" />
                </FormField>

                <FormField
                  id="street"
                  label="Street Address / Building"
                  error={errors.address?.street?.message}
                >
                  <Input id="street" {...register("address.street")} placeholder="Enter street / building address" />
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
                      label="Clinic Logo (Optional)"
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

            {/* STEP 6: Review */}
            {currentStep === 6 && (
              <div className="space-y-6">
                <div className="rounded-lg border bg-muted/30 p-4 space-y-4">
                  <h4 className="font-semibold text-sm text-foreground">Summary of Website Details</h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    <div>
                      <span className="text-muted-foreground block">Doctor:</span>
                      <span className="font-medium text-foreground">Dr. {formValues.doctorName}</span>
                    </div>
                    {formValues.customSlug && (
                      <div>
                        <span className="text-muted-foreground block">Website URL:</span>
                        <span className="font-medium text-primary font-mono text-xs">
                          {formatUrl(formValues.customSlug)}
                        </span>
                      </div>
                    )}
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
                      <span className="text-muted-foreground block">Consultation Fee (New):</span>
                      <span className="font-medium text-foreground">
                        {formValues.newCaseFee !== undefined && formValues.newCaseFee !== null
                          ? `₹${formValues.newCaseFee}`
                          : "Not specified"}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block">Consultation Fee (Old):</span>
                      <span className="font-medium text-foreground">
                        {formValues.oldCaseFee !== undefined && formValues.oldCaseFee !== null
                          ? `₹${formValues.oldCaseFee}`
                          : "Not specified"}
                      </span>
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
                      <span className="text-muted-foreground block">Website Theme:</span>
                      <span className="font-medium text-[#1560aa]">Classic Healthcare Blue (Default)</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block">Facility Photos:</span>
                      <span className="font-medium text-foreground">{formValues.clinicPhotos?.length || 0} images</span>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-blue-200/80 bg-blue-50/60 p-4 text-xs text-[#1560aa] leading-relaxed">
                  All clinical credentials and media assets have been verified against healthcare platform rules.
                  Clicking <strong>Publish Website</strong> will finalize your site and issue a verified public URL.
                </div>
              </div>
            )}

            {/* STEP 7: Success / Published */}
            {currentStep === 7 && (
              <div className="text-center py-8 space-y-4">
                <div className="h-14 w-14 rounded-full bg-blue-50 border border-blue-200 text-[#1a76d1] flex items-center justify-center mx-auto shadow-xs">
                  <CheckCircle className="h-8 w-8" />
                </div>
                <h3 className="text-2xl font-bold text-slate-900">Website Successfully Created!</h3>
                <p className="text-sm text-slate-600 max-w-md mx-auto">
                  Dr. {formValues.doctorName}&apos;s clinical website has been registered with the verified Classic Healthcare Blue design.
                </p>

                {publishedUrl && (
                  <div className="pt-4 flex flex-col items-center justify-center gap-4">
                    <a
                      href={`/${createdSlug || publishedUrl.split("/").pop()}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#1a76d1] text-white text-sm font-semibold shadow hover:bg-[#1560aa] transition-colors"
                    >
                      <span>View Public Website</span>
                      <ExternalLink className="h-4 w-4" />
                    </a>

                    <div className="w-full max-w-lg p-4 bg-slate-50 rounded-xl border border-slate-200 text-left space-y-2 text-xs">
                      <span className="font-bold text-slate-900 block">
                        Doctor Administration Portal (Manual URL Access)
                      </span>
                      <p className="text-slate-600 leading-relaxed">
                        For security and privacy compliance, direct admin links are not placed on public pages. Please copy and manually open your private admin login link:
                      </p>
                      <div className="p-2.5 bg-white rounded-lg border border-slate-200 font-mono text-[11px] text-[#1a76d1] font-semibold select-all break-all">
                        /{createdSlug || publishedUrl.split("/").pop()}/admin/login
                      </div>
                    </div>
                  </div>
                )}
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
                      "Publish Website"
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
        email={formValues.email || ""}
        name={formValues.doctorName}
        onVerified={handleVerifyOtpAndPublish}
      />
    </div>
  );
}
