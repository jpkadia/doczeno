"use client";

import * as React from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  hospitalDoctorOnboardingSchema,
  HospitalDoctorFormValues,
} from "@/validations/onboarding";
import { StepProgress, StepItem } from "./step-progress";
import { SpecializationSelect } from "./specialization-select";
import { ConsultationHoursBuilder, DEFAULT_WEEK_SCHEDULE } from "./consultation-hours-builder";
import { ImageUploader } from "./image-uploader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { FormField } from "./form-field";
import { PhoneInput } from "@/components/ui/phone-input";
import { apiClient } from "@/lib/api-client";
import {
  Info,
  CheckCircle,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Building2,
  Save,
  Stethoscope,
  ArrowLeft,
  ArrowRight,
  Eye,
  EyeOff,
  Clock,
} from "lucide-react";
import { toast } from "sonner";
import { OtpVerificationDialog } from "./otp-verification-dialog";
import { useFormDraft } from "@/hooks/use-form-draft";
import { DraftResumeBanner } from "./draft-resume-banner";
import { HospitalSearchSelect, EligibleHospital } from "./hospital-search-select";
import { SlugInput } from "./slug-input";
import { usePlatformDomain } from "@/hooks/use-platform-domain";

interface HospitalDoctorFormProps {
  defaultOrganizationId?: string;
  lockOrganization?: boolean;
}

const WIZARD_STEPS: StepItem[] = [
  { id: 1, label: "Parent Hospital" },
  { id: 2, label: "Doctor Profile" },
  { id: 3, label: "Contact Info" },
  { id: 4, label: "Schedule" },
  { id: 5, label: "Photo" },
  { id: 6, label: "Account Security" },
  { id: 7, label: "Review" },
  { id: 8, label: "Publish" },
];

export function HospitalDoctorForm({
  defaultOrganizationId,
  lockOrganization = false,
}: HospitalDoctorFormProps) {
  const [currentStep, setCurrentStep] = React.useState(1);
  const [hospitals, setHospitals] = React.useState<EligibleHospital[]>([]);
  const [isLoadingHospitals, setIsLoadingHospitals] = React.useState(true);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [publishedUrl, setPublishedUrl] = React.useState<string | null>(null);
  const [showOtpDialog, setShowOtpDialog] = React.useState(false);
  const [createdDocSlug, setCreatedDocSlug] = React.useState<string | null>(null);
  const [isPendingApproval, setIsPendingApproval] = React.useState(false);
  const [showPassword, setShowPassword] = React.useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);
  const { formatPrefix, formatUrl } = usePlatformDomain();

  // Security: Clean any session token so first-time admin access requires email & password login
  React.useEffect(() => {
    if ((publishedUrl || currentStep === 8) && typeof window !== "undefined") {
      try {
        localStorage.removeItem("doczeno_auth_token");
        document.cookie = "doczeno_session=; path=/; max-age=0; SameSite=Lax; Secure";
      } catch {}
    }
  }, [publishedUrl, currentStep]);

  const defaultValues: Partial<HospitalDoctorFormValues> = React.useMemo(
    () => ({
      organizationId: defaultOrganizationId || "",
      customSlug: "",
      gender: "MALE",
      appointmentRequired: true,
      consultationHours: DEFAULT_WEEK_SCHEDULE,
      weeklyOff: ["Sunday"],
      isDraft: false,
    }),
    [defaultOrganizationId]
  );

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
  } = useForm<HospitalDoctorFormValues>({
    resolver: zodResolver(hospitalDoctorOnboardingSchema),
    defaultValues,
    mode: "onBlur",
  });

  const formValues = watch();

  // Load eligible active hospitals from backend
  React.useEffect(() => {
    async function fetchHospitals() {
      try {
        setIsLoadingHospitals(true);
        const res = await apiClient.get<{
          success?: boolean;
          hospitals?: EligibleHospital[];
          data?: { hospitals?: EligibleHospital[] };
        }>("/onboarding/eligible-hospitals");

        const list = Array.isArray(res?.data?.hospitals)
          ? res.data.hospitals
          : Array.isArray(res?.hospitals)
          ? res.hospitals
          : Array.isArray(res)
          ? (res as unknown as EligibleHospital[])
          : [];

        setHospitals(list);

        // If default given, ensure organizationId is set
        if (defaultOrganizationId) {
          setValue("organizationId", defaultOrganizationId, { shouldValidate: true });
        }
      } catch {
        setHospitals([]);
        toast.error("Failed to load active hospitals");
      } finally {
        setIsLoadingHospitals(false);
      }
    }

    fetchHospitals();
  }, [defaultOrganizationId, setValue]);

  // Find currently selected hospital
  const selectedHospital = React.useMemo(() => {
    return hospitals.find((h) => h._id === formValues.organizationId);
  }, [hospitals, formValues.organizationId]);

  // Filter doctor specializations strictly to the selected hospital's registered departments
  const hospitalSpecialties = React.useMemo(() => {
    if (!selectedHospital) return [];
    if (
      Array.isArray(selectedHospital.specialties) &&
      selectedHospital.specialties.length > 0
    ) {
      return selectedHospital.specialties;
    }
    return [];
  }, [selectedHospital]);

  // Extract parent hospital's closed days / weekly off
  const hospitalOffDays = React.useMemo(() => {
    if (!selectedHospital) return [];
    const off = new Set<string>();
    if (selectedHospital.weeklyOff) {
      selectedHospital.weeklyOff
        .split(",")
        .map((d) => d.trim())
        .filter(Boolean)
        .forEach((d) => off.add(d));
    }
    if (selectedHospital.workingHours) {
      try {
        const parsed = JSON.parse(selectedHospital.workingHours);
        if (Array.isArray(parsed)) {
          parsed.forEach((s: any) => {
            if (s.isClosed && s.day) off.add(s.day);
          });
        }
      } catch {}
    }
    return Array.from(off);
  }, [selectedHospital]);

  // Save Draft Hook Integration
  const {
    hasDraftToResume,
    draftInfo,
    saveStatus,
    lastSavedText,
    resumeDraft,
    discardDraft,
    saveDraftNow,
    clearDraft,
  } = useFormDraft<HospitalDoctorFormValues>({
    key: "doczeno_hospital_doctor_draft_v1",
    formValues,
    currentStep,
    formType: "HOSPITAL_DOCTOR",
    getEmail: (v) => v.email,
    getName: (v) => v.doctorName,
    hasContent: (v, step) => {
      if (step && step > 1) return true;
      return !!(
        v.doctorName?.trim() ||
        v.degree?.trim() ||
        v.email?.trim() ||
        v.organizationId ||
        v.specialization
      );
    },
    onRestore: (savedData, savedStep) => {
      const restored = {
        ...defaultValues,
        ...savedData,
        consultationHours: savedData.consultationHours?.length
          ? savedData.consultationHours
          : DEFAULT_WEEK_SCHEDULE,
        weeklyOff: savedData.weeklyOff || ["Sunday"],
        isDraft: false,
      } as HospitalDoctorFormValues;

      reset(restored);

      Object.entries(restored).forEach(([k, v]) => {
        setValue(k as any, v, { shouldDirty: false });
      });

      setCurrentStep(Math.min(Math.max(savedStep || 1, 1), 7));
    },
    onDiscard: () => {
      reset(defaultValues as HospitalDoctorFormValues);
      Object.entries(defaultValues).forEach(([k, v]) => {
        setValue(k as any, v, { shouldDirty: false });
      });
      setCurrentStep(1);
    },
  });

  const handleHospitalChange = (orgId: string, hospital?: EligibleHospital) => {
    setValue("organizationId", orgId, { shouldValidate: true, shouldDirty: true });

    // When hospital changes, verify if existing specialization is valid for the new hospital
    if (hospital && Array.isArray(hospital.specialties) && hospital.specialties.length > 0) {
      if (formValues.specialization && !hospital.specialties.includes(formValues.specialization)) {
        setValue("specialization", "" as any, { shouldValidate: true });
        toast.info(
          `Specialization reset. Please select from ${hospital.name}'s departments.`
        );
      }
    }
  };

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

  // Validate only the current step before advancing
  const validateStep = async (step: number): Promise<boolean> => {
    switch (step) {
      case 1: {
        if (!formValues.organizationId) {
          setError("organizationId", {
            type: "manual",
            message: "Please search and select a parent hospital / clinic organization",
          });
          toast.error("Please select a parent hospital organization first");
          return false;
        }
        clearErrors("organizationId");
        return true;
      }

      case 2: {
        if (!formValues.customSlug && formValues.doctorName) {
          handleSlugAutofill(formValues.doctorName);
        }
        const isProfileValid = await trigger([
          "doctorName",
          "gender",
          "degree",
          "specialization",
          "yearsOfExperience",
          "customSlug",
        ]);

        if (!isProfileValid) return false;

        if (
          selectedHospital &&
          Array.isArray(selectedHospital.specialties) &&
          selectedHospital.specialties.length > 0
        ) {
          if (!selectedHospital.specialties.includes(formValues.specialization)) {
            setError("specialization", {
              type: "manual",
              message: `Specialization must be one of ${selectedHospital.name}'s departments`,
            });
            toast.error(`Please select a specialization offered by ${selectedHospital.name}`);
            return false;
          }
        }

        const slugToCheck = getValues("customSlug");
        if (slugToCheck && slugToCheck.length >= 2 && formValues.organizationId) {
          try {
            const check = await apiClient.get<{ available: boolean; error?: string }>(
              "/onboarding/check-slug",
              {
                params: {
                  slug: slugToCheck,
                  type: "HOSPITAL_DOCTOR",
                  orgId: formValues.organizationId,
                },
              }
            );
            if (!check.available) {
              setError("customSlug", {
                type: "manual",
                message: check.error || "This doctor URL slug is already taken in this hospital.",
              });
              return false;
            }
          } catch {
            // Network fallback
          }
        }

        return true;
      }

      case 3:
        return trigger(["email", "whatsApp"]);

      case 4: {
        const isValid = await trigger(["consultationHours", "weeklyOff", "appointmentRequired"]);
        if (!isValid) return false;
        if (hospitalOffDays.length > 0 && Array.isArray(formValues.consultationHours)) {
          const lowerOff = hospitalOffDays.map((d) => d.toLowerCase());
          const violating = formValues.consultationHours.find(
            (s) => !s.isClosed && lowerOff.includes(s.day.toLowerCase())
          );
          if (violating) {
            setError("consultationHours", {
              type: "manual",
              message: `Doctor cannot consult on ${violating.day} because ${selectedHospital?.name || "the hospital"} is closed on this day (Hospital Weekly Off).`,
            });
            toast.error(`Doctor cannot consult on ${violating.day} (Hospital closed)`);
            return false;
          }
        }
        return true;
      }

      case 5: {
        if (!formValues.doctorPhoto || !formValues.doctorPhoto.url) {
          setError("doctorPhoto", {
            type: "manual",
            message: "Doctor profile photo is required before proceeding",
          });
          toast.error("Please upload doctor profile photo");
          return false;
        }
        clearErrors("doctorPhoto");
        return true;
      }

      case 6: {
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

        if (hasPasswordError) {
          return false;
        }

        clearErrors(["password", "confirmPassword"]);
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
    setCurrentStep((prev) => Math.min(prev + 1, 8));
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
    const isStep6Valid = await validateStep(6);
    if (!isStep6Valid) {
      setCurrentStep(6);
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

      const res = await apiClient.post<{
        publicUrl?: string;
        pendingApproval?: boolean;
        message?: string;
        data?: { publicUrl?: string; pendingApproval?: boolean; requestedSlug?: string };
      }>(
        "/onboarding/hospital-doctor",
        {
          ...formValues,
          otp,
          isDraft: false,
        }
      );

      const pending = Boolean(res.pendingApproval || res.data?.pendingApproval);
      setIsPendingApproval(pending);

      const url = res.publicUrl || res.data?.publicUrl || "";
      setPublishedUrl(url);
      const docSlug =
        res.data?.requestedSlug ||
        (url ? url.split("/").pop() || "" : "") ||
        formValues.customSlug ||
        "";
      setCreatedDocSlug(docSlug);
      clearDraft();
      setCurrentStep(8);
      toast.success(
        pending
          ? "Your request is sent to the admin for approval, kindly wait some time."
          : "Affiliated Doctor Registered Successfully!"
      );
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : (err as { message?: string })?.message || "Registration failed";
      toast.error(msg);
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  };

  const stepTitles: Record<number, string> = {
    1: "Select Parent Hospital or Clinic Organization",
    2: "Clinician Profile & Specialization",
    3: "Doctor Contact Channels",
    4: "Consultation Schedule & OPD Policy",
    5: "Doctor Portrait Photo",
    6: "Doctor Account & Credentials",
    7: "Review & Verification Summary",
    8: "Doctor Affiliation Successfully Published!",
  };

  if (publishedUrl || isPendingApproval || currentStep === 8) {
    const orgSlug = selectedHospital?.slug || "hospital";
    const doctorSlug =
      createdDocSlug ||
      formValues.customSlug ||
      "dr-" + formValues.doctorName.toLowerCase().replace(/[^a-z0-9]/g, "-");

    if (isPendingApproval) {
      return (
        <div className="py-4 sm:py-8 flex items-center justify-center min-h-[55vh]">
          <Card className="w-full max-w-lg mx-auto border border-amber-200/80 rounded-2xl shadow-xl bg-white/95 backdrop-blur-md">
            <CardContent className="p-6 sm:p-8 text-center space-y-4">
              <div className="h-14 w-14 rounded-full bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mx-auto shadow-xs">
                <Clock className="h-7 w-7" />
              </div>
              <div className="space-y-2">
                <span className="inline-block px-3 py-1 rounded-full bg-amber-100 text-amber-800 text-[11px] font-bold uppercase tracking-wider">
                  Pending Hospital Admin Approval
                </span>
                <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
                  Request Sent for Approval
                </h2>
                <p className="text-sm text-slate-700 font-medium max-w-md mx-auto leading-relaxed">
                  Your request is sent to the admin for approval, kindly wait some time.
                </p>
              </div>

              <div className="w-full p-4 bg-slate-50 rounded-xl border border-slate-200 text-left space-y-2 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-slate-500 font-medium">Hospital:</span>
                  <span className="font-bold text-slate-900">{selectedHospital?.name || orgSlug}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-slate-500 font-medium">Doctor:</span>
                  <span className="font-bold text-slate-900">Dr. {formValues.doctorName}</span>
                </div>
                <div className="pt-2 border-t border-slate-200 space-y-1">
                  <span className="font-semibold text-slate-700 block">
                    Requested Website URL (Will activate after approval):
                  </span>
                  <div className="p-2 bg-white rounded-lg border border-slate-200 font-mono text-[11px] text-slate-700 font-semibold break-all">
                    {formatUrl(`${orgSlug}/${doctorSlug}`)}
                  </div>
                </div>
              </div>

              <p className="text-[11px] text-slate-500 leading-relaxed">
                Once the {selectedHospital?.name || "hospital"} administrator reviews and approves your profile, your website and doctor admin portal will become active.
              </p>
            </CardContent>
          </Card>
        </div>
      );
    }

    return (
      <div className="py-4 sm:py-8 flex items-center justify-center min-h-[55vh]">
        <Card className="w-full max-w-lg mx-auto border border-blue-100/80 rounded-2xl shadow-xl bg-white/95 backdrop-blur-md">
          <CardContent className="p-5 sm:p-7 text-center space-y-3.5">
            <div className="h-12 w-12 rounded-full bg-blue-50 border border-blue-200 text-[#1a76d1] flex items-center justify-center mx-auto shadow-xs">
              <CheckCircle className="h-7 w-7" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
                Dr. {formValues.doctorName} is Affiliated!
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 max-w-sm mx-auto mt-1">
                Doctor profile has been linked to {selectedHospital?.name || "the hospital"}. Hospital branding, theme, and location are shared.
              </p>
            </div>

            <div className="pt-2 flex flex-col items-center justify-center gap-3">
              <a
                href={`/${orgSlug}/${doctorSlug}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#1a76d1] text-white text-sm font-semibold shadow hover:bg-[#1560aa] transition-colors"
              >
                <span>View Doctor Profile</span>
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
                  {formatUrl(`${orgSlug}/${doctorSlug}/admin/login`)}
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
          stepTitle={WIZARD_STEPS.find((s) => s.id === draftInfo.step)?.label || "Doctor Details"}
          formattedDate={draftInfo.formattedDate}
          previewTitle={draftInfo.previewTitle || `Dr. ${formValues.doctorName || "Doctor"}`}
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

            {/* Autosave and Save Draft Button */}
            {currentStep < 8 && (
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
                  onClick={saveDraftNow}
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
            {currentStep === 1 && "Select the parent hospital or clinic where you practice"}
            {currentStep === 2 && "Personal credentials, medical qualifications, and specialties"}
            {currentStep === 3 && "Direct contact channels for inquiries and notifications"}
            {currentStep === 4 && "Define days, shifts, slot durations, and appointment policies"}
            {currentStep === 5 && "Upload high-quality clinician portrait"}
            {currentStep === 6 && "Set doctor login credentials for private dashboard access"}
            {currentStep === 7 && "Carefully review all affiliated clinician parameters before publishing"}
            {currentStep === 8 && "Your doctor website is live"}
          </CardDescription>
        </CardHeader>

        <CardContent className="p-6">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (currentStep < 7) {
                handleNext();
              } else if (currentStep === 7) {
                handlePublishClick();
              }
            }}
            className="space-y-6"
          >

            {/* STEP 1: Hospital Search Combobox */}
            {currentStep === 1 && (
              <div className="space-y-4">
                <div className="space-y-2 p-4 rounded-lg border bg-muted/20">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-semibold flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-primary" />
                      Parent Hospital / Clinic Organization <span className="text-destructive">*</span>
                    </Label>
                    {lockOrganization && (
                      <span className="text-xs font-semibold text-primary">Locked via Invite</span>
                    )}
                  </div>

                  {isLoadingHospitals ? (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      Loading active hospitals...
                    </div>
                  ) : (
                    <HospitalSearchSelect
                      value={formValues.organizationId}
                      onChange={handleHospitalChange}
                      hospitals={hospitals}
                      isLoading={isLoadingHospitals}
                      locked={lockOrganization}
                      error={errors.organizationId?.message}
                    />
                  )}

                  {/* Informational Callout regarding Linked Hospital Details */}
                  <div className="flex items-start gap-2.5 rounded-md bg-sky-50 dark:bg-sky-950/40 p-3 text-xs text-sky-800 dark:text-sky-300 border border-sky-200 dark:border-sky-900 mt-2">
                    <Info className="h-4 w-4 shrink-0 text-sky-600 mt-0.5" />
                    <div>
                      <strong>Hospital Details Linked:</strong> Hospital logo, address, and facility photos are automatically linked from {selectedHospital?.name || "the selected hospital"}. You don't need to re-enter hospital details—simply enter your professional qualifications and consultation timings.
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 2: Clinician Credentials */}
            {currentStep === 2 && (
              <div className="space-y-5">
                <FormField
                  id="doctorName"
                  label="Doctor Name"
                  required
                  hint="Type only name. 'Dr.' prefix is formatted automatically."
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
                      label="Doctor Profile URL / Slug"
                      value={field.value || ""}
                      onChange={(val) => setValue("customSlug", val, { shouldValidate: true })}
                      onBlur={field.onBlur}
                      error={errors.customSlug?.message}
                      prefix={formatPrefix(selectedHospital?.slug || "hospital")}
                      type="HOSPITAL_DOCTOR"
                      orgId={formValues.organizationId}
                      placeholder="dr-fullname"
                      hint={`Public profile link under ${selectedHospital?.name || "the hospital"}. You can customize your URL here.`}
                      required
                    />
                  )}
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium">
                      Gender <span className="text-destructive">*</span>
                    </Label>
                    <div className="flex gap-4 pt-2">
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
                  </div>

                  <FormField
                    id="degree"
                    label="Medical Degree"
                    required
                    error={errors.degree?.message}
                  >
                    <Input id="degree" {...register("degree")} placeholder="MBBS, MD, MS" />
                  </FormField>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Specialization restricted strictly to selected hospital's departments */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium flex items-center gap-1">
                        <Stethoscope className="h-3.5 w-3.5 text-primary" />
                        Clinical Specialization <span className="text-destructive">*</span>
                      </Label>
                      {selectedHospital && (
                        <span className="text-[10px] text-muted-foreground">
                          {hospitalSpecialties.length} department(s) offered
                        </span>
                      )}
                    </div>

                    <Controller
                      name="specialization"
                      control={control}
                      render={({ field }) => (
                        <SpecializationSelect
                          value={field.value}
                          onChange={(val) => {
                            field.onChange(val);
                            clearErrors("specialization");
                          }}
                          options={hospitalSpecialties}
                          disabled={!selectedHospital}
                          placeholder={
                            !selectedHospital
                              ? "Select a hospital first to view departments"
                              : hospitalSpecialties.length === 0
                              ? `${selectedHospital.name} has no departments listed`
                              : `Select department from ${selectedHospital.name}`
                          }
                          emptyMessage={
                            !selectedHospital
                              ? "Please select a parent hospital first"
                              : hospitalSpecialties.length === 0
                              ? `${selectedHospital.name} has not configured departments yet`
                              : `No matching department found for ${selectedHospital.name}`
                          }
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
                      placeholder="e.g. 12"
                    />
                  </FormField>
                </div>
              </div>
            )}

            {/* STEP 3: Contact Channels */}
            {currentStep === 3 && (
              <div className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField id="email" label="Public Inquiries & Contact Email" required hint="Displayed publicly on your website" error={errors.email?.message}>
                    <Input id="email" type="email" {...register("email")} placeholder="doctor@hospital.com" />
                  </FormField>

                  <FormField id="adminEmail" label="Doctor Admin Login Email (Optional)" hint="Leave blank to use inquiry email" error={errors.adminEmail?.message}>
                    <Input id="adminEmail" type="email" {...register("adminEmail")} placeholder="Leave blank to use inquiry email" />
                  </FormField>
                </div>

                <FormField id="whatsApp" label="WhatsApp Number" required error={errors.whatsApp?.message}>
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
              </div>
            )}

            {/* STEP 4: Consultation Schedule */}
            {currentStep === 4 && (
              <div className="space-y-5">
                <Controller
                  name="consultationHours"
                  control={control}
                  render={({ field }) => (
                    <ConsultationHoursBuilder
                      value={field.value}
                      hospitalWeeklyOff={hospitalOffDays}
                      hospitalName={selectedHospital?.name}
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
                      <span>Yes (Mandatory consultation booking)</span>
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

            {/* STEP 5: Doctor Photo Only (Hospital owns Logo/Gallery) */}
            {currentStep === 5 && (
              <div className="space-y-5">
                <Controller
                  name="doctorPhoto"
                  control={control}
                  render={({ field }) => (
                    <ImageUploader
                      label="Doctor Profile Photo"
                      category="DOCTOR_PHOTO"
                      maxSizeBytes={10 * 1024 * 1024}
                      required
                      enableCrop
                      value={field.value}
                      onChange={field.onChange}
                      error={errors.doctorPhoto?.message}
                    />
                  )}
                />
              </div>
            )}

            {/* STEP 6: Security Credentials */}
            {currentStep === 6 && (
              <div className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    id="password"
                    label="Create Password"
                    required
                    hint="Min 6 chars, 1 uppercase, 1 number, 1 symbol"
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

            {/* STEP 7: Review & Verification */}
            {currentStep === 7 && (
              <div className="space-y-6">
                <div className="rounded-lg border bg-card p-5 space-y-4 shadow-xs">
                  <h4 className="font-semibold text-foreground text-sm uppercase tracking-wider border-b pb-2">
                    Review Affiliated Doctor Information
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    <div>
                      <span className="text-muted-foreground block">Parent Hospital:</span>
                      <span className="font-semibold text-foreground text-sm">
                        {selectedHospital?.name || "Selected Hospital"}
                      </span>
                      <span className="text-[11px] text-muted-foreground block">
                        {selectedHospital?.address?.city || ""}{selectedHospital?.address?.state ? `, ${selectedHospital?.address?.state}` : ""}
                      </span>
                    </div>

                    <div>
                      <span className="text-muted-foreground block">Doctor Name:</span>
                      <span className="font-semibold text-foreground text-sm">
                        Dr. {formValues.doctorName}
                      </span>
                    </div>

                    <div>
                      <span className="text-muted-foreground block">Doctor Profile URL:</span>
                      <span className="font-medium text-primary font-mono text-xs">
                        {formatUrl(`${selectedHospital?.slug || "hospital"}/${formValues.customSlug || "dr-doctor"}`)}
                      </span>
                    </div>

                    <div>
                      <span className="text-muted-foreground block">Degree:</span>
                      <span className="font-medium text-foreground">{formValues.degree}</span>
                    </div>

                    <div>
                      <span className="text-muted-foreground block">Specialization:</span>
                      <span className="font-medium text-foreground">{formValues.specialization}</span>
                    </div>

                    <div>
                      <span className="text-muted-foreground block">Experience:</span>
                      <span className="font-medium text-foreground">{formValues.yearsOfExperience} Years</span>
                    </div>

                    <div>
                      <span className="text-muted-foreground block">Gender:</span>
                      <span className="font-medium text-foreground">{formValues.gender}</span>
                    </div>

                    <div>
                      <span className="text-muted-foreground block">Email:</span>
                      <span className="font-medium text-foreground">{formValues.email}</span>
                    </div>

                    <div>
                      <span className="text-muted-foreground block">WhatsApp:</span>
                      <span className="font-medium text-foreground">{formValues.whatsApp}</span>
                    </div>

                    <div>
                      <span className="text-muted-foreground block">Appointment Policy:</span>
                      <span className="font-medium text-foreground">
                        {formValues.appointmentRequired ? "Prior Appointment Mandatory" : "Walk-in Welcome"}
                      </span>
                    </div>

                    <div>
                      <span className="text-muted-foreground block">Doctor Photo:</span>
                      <span className="font-medium text-emerald-600 dark:text-emerald-400">
                        {formValues.doctorPhoto ? "Verified & Ready" : "Missing"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="rounded-md border border-primary/20 bg-primary/5 p-4 text-xs text-primary leading-relaxed">
                  Doctor credentials and photo have been verified. The hospital's logo, facility details, and address are automatically shared with this doctor's profile.
                  Clicking <strong>Affiliate Doctor to Hospital</strong> will verify email and publish profile.
                </div>
              </div>
            )}

            {/* Footer Navigation Controls */}
            {currentStep < 8 && (
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

                {currentStep < 7 ? (
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
                      "Affiliate Doctor to Hospital"
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
        onVerified={handleVerifyOtpAndCreate}
      />
    </div>
  );
}
