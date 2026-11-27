"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PhoneInput } from "@/components/ui/phone-input";
import { CalendarPicker } from "@/components/ui/calendar-picker";
import { Phone, MessageSquare, CheckCircle2, AlertCircle, Calendar, Copy, Check, Stethoscope, Clock } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { toast } from "sonner";
import {
  getBookingWindowDays,
  validateAppointmentBookingDate,
  BookingDayOption,
} from "@/lib/appointment-schedule";
import { fetchDoctorLiveSlots, LiveSlotOption, formatSlotSelectLabel } from "@/lib/appointment-slots";
import { cn } from "@/lib/utils";
import { useWebsiteThemeMode } from "./website-mode-context";
import { resolveThemePalette } from "@/lib/theme-palettes";

interface AppointmentDialogProps {
  doctorId?: string;
  organizationId?: string;
  doctorName?: string;
  organizationName: string;
  whatsApp?: string;
  phone?: string;
  consultationHours?: string;
  weeklyOff?: string;
  children?: React.ReactNode;
  selectedTheme?: string;
  doctorDirectory?: Array<{
    id: string;
    doctorName: string;
    slug?: string;
    specialization: string;
    degree?: string;
    consultationHours?: string;
    weeklyOff?: string;
  }>;
  websiteType?: string;
}

export function AppointmentDialog({
  doctorId,
  organizationId,
  doctorName,
  organizationName,
  whatsApp,
  phone,
  consultationHours,
  weeklyOff,
  children,
  selectedTheme,
  doctorDirectory,
  websiteType: _websiteType,
}: AppointmentDialogProps) {
  const { isDark } = useWebsiteThemeMode();
  const theme = resolveThemePalette(selectedTheme);

  const [isOpen, setIsOpen] = React.useState(false);
  const [selectedDoctorId, setSelectedDoctorId] = React.useState<string>(doctorId || "");
  const [patientName, setPatientName] = React.useState("");
  const [patientAge, setPatientAge] = React.useState("");
  const [patientPhone, setPatientPhone] = React.useState("");
  const [preferredDate, setPreferredDate] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [submitted, setSubmitted] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [bookedAppointmentId, setBookedAppointmentId] = React.useState<string | null>(null);
  const [bookedTokenNumber, setBookedTokenNumber] = React.useState<number | null>(null);
  const [bookedTimeSlot, setBookedTimeSlot] = React.useState<string>("");
  const [selectedTimeSlot, setSelectedTimeSlot] = React.useState<string>("");
  const [liveSlots, setLiveSlots] = React.useState<LiveSlotOption[]>([]);
  const [slotsLoading, setSlotsLoading] = React.useState(false);
  const [copiedId, setCopiedId] = React.useState(false);

  const handleCopyId = async () => {
    if (!bookedAppointmentId) return;
    try {
      await navigator.clipboard.writeText(bookedAppointmentId);
      setCopiedId(true);
      toast.success("Appointment ID copied to clipboard!");
      setTimeout(() => setCopiedId(false), 2500);
    } catch {
      toast.info(`Appointment ID: ${bookedAppointmentId}`);
    }
  };

  const inputClass = cn(
    "rounded-xl border transition-all h-10 text-xs sm:text-sm shadow-2xs",
    "focus:border-[var(--theme-primary)] focus-visible:border-[var(--theme-primary)]",
    "focus:ring-2 focus:ring-[var(--theme-primary)]/30 focus-visible:ring-2 focus-visible:ring-[var(--theme-primary)]/30 focus-visible:ring-offset-0",
    isDark ? "text-white placeholder:text-slate-500" : "text-slate-900 placeholder:text-slate-400"
  );

  const inputStyle = {
    backgroundColor: isDark ? theme.innerCardBgDark : "#ffffff",
    borderColor: isDark ? theme.cardBorderDark : theme.cardBorderLight,
  };

  const rawDigits = (whatsApp || phone || "").replace(/[^0-9]/g, "");
  const cleanPhone = rawDigits.length === 10 ? `91${rawDigits}` : rawDigits;

  const targetEntityName = doctorName ? `Dr. ${doctorName}` : organizationName;

  // Compute 4-day window (Today + next 3 days) with schedule check
  const bookingDays: BookingDayOption[] = React.useMemo(() => {
    return getBookingWindowDays(consultationHours, weeklyOff);
  }, [consultationHours, weeklyOff]);

  const minBookingDate = bookingDays[0]?.dateStr || "";
  const maxBookingDate = bookingDays[bookingDays.length - 1]?.dateStr || "";

  // Auto-select earliest available open day when opened
  React.useEffect(() => {
    if (isOpen && !preferredDate && bookingDays.length > 0) {
      const firstOpen = bookingDays.find((d) => d.isOpen);
      if (firstOpen) {
        setPreferredDate(firstOpen.dateStr);
      } else {
        setPreferredDate(bookingDays[0]?.dateStr || "");
      }
    }
  }, [isOpen, bookingDays, preferredDate]);

  React.useEffect(() => {
    if (isOpen && !selectedDoctorId && doctorDirectory && doctorDirectory.length > 0) {
      setSelectedDoctorId(doctorDirectory[0]?.id || "");
    }
  }, [isOpen, selectedDoctorId, doctorDirectory]);

  // Fetch doctor's live open slots + remaining seat capacity when modal/doctor/date changes
  React.useEffect(() => {
    if (!isOpen || !preferredDate) return;
    const effectiveDocId = selectedDoctorId || doctorId;
    if (!effectiveDocId && !organizationId) return;
    let cancelled = false;
    setSlotsLoading(true);
    fetchDoctorLiveSlots({
      doctorId: effectiveDocId || undefined,
      organizationId: organizationId || undefined,
      date: preferredDate,
    })
      .then((res) => {
        if (cancelled) return;
        const list = res?.slots || [];
        setLiveSlots(list);
        const firstAvailable = list.find((s) => !s.isFull);
        if (firstAvailable) {
          setSelectedTimeSlot(firstAvailable.displayLabel);
        } else if (list[0]) {
          setSelectedTimeSlot(list[0].displayLabel);
        } else {
          setSelectedTimeSlot("");
        }
      })
      .finally(() => {
        if (!cancelled) setSlotsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, preferredDate, selectedDoctorId, doctorId, organizationId]);

  // Real-time validation for selected date
  const dateValidation = React.useMemo(() => {
    if (!preferredDate) return null;
    return validateAppointmentBookingDate(
      preferredDate,
      consultationHours,
      weeklyOff,
      targetEntityName
    );
  }, [preferredDate, consultationHours, weeklyOff, targetEntityName]);

  const handleWhatsAppDirect = () => {
    if (!cleanPhone) {
      toast.error("Contact number is not configured for direct messaging.");
      return;
    }
    if (!notes.trim()) {
      toast.error("Please describe the patient's primary medical concern.");
      return;
    }
    if (preferredDate && dateValidation && !dateValidation.isValid) {
      toast.error(dateValidation.errorMessage || "Appointments are not available on the selected date.");
      return;
    }
    const agePart = patientAge ? `, Age: ${patientAge} yrs` : "";
    const message = encodeURIComponent(
      `Hello, I would like to schedule a consultation with ${targetEntityName}. Name: ${
        patientName || "Patient"
      }${agePart}, Preferred Date: ${
        preferredDate || "Earliest available"
      }, Concern/Problem: ${notes.trim()}.`
    );
    window.open(`https://wa.me/${cleanPhone}?text=${message}`, "_blank");
    setIsOpen(false);
  };

  const handleClose = () => {
    setSubmitted(false);
    setIsOpen(false);
    setBookedAppointmentId(null);
    setBookedTokenNumber(null);
    setBookedTimeSlot("");
    setSelectedTimeSlot("");
    setLiveSlots([]);
    setPatientName("");
    setPatientAge("");
    setPatientPhone("");
    setPreferredDate("");
    setNotes("");
  };

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientName.trim() || !patientPhone.trim()) {
      toast.error("Please enter your name and contact phone number.");
      return;
    }
    const parsedAge = parseInt(patientAge, 10);
    if (!patientAge || isNaN(parsedAge) || parsedAge < 1 || parsedAge > 120) {
      toast.error("Please enter a valid patient age (1 to 120 years).");
      return;
    }
    if (!notes.trim()) {
      toast.error("Please describe the patient's primary medical concern.");
      return;
    }

    // Strict advance 3-day and schedule validation
    if (!preferredDate) {
      toast.error("Please select an appointment date within the active booking window.");
      return;
    }

    const check = validateAppointmentBookingDate(
      preferredDate,
      consultationHours,
      weeklyOff,
      targetEntityName
    );
    if (!check.isValid) {
      toast.error(check.errorMessage || "Appointments are not available on the selected date.");
      return;
    }

    const chosenSlotObj = liveSlots.find((s) => s.displayLabel === selectedTimeSlot);
    if (chosenSlotObj?.isFull) {
      toast.error("Selected time slot is FULL. Please choose another available slot or date.");
      return;
    }
    if (liveSlots.length > 0 && !selectedTimeSlot) {
      toast.error("Please select an available consultation time slot.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res: any = await apiClient.post("/appointments", {
        doctorId: selectedDoctorId || doctorId || undefined,
        organizationId: organizationId || undefined,
        patientName: patientName.trim(),
        patientAge: parsedAge,
        patientPhone: patientPhone.trim(),
        appointmentDate: new Date(preferredDate),
        timeSlot: selectedTimeSlot || "Regular Consultation",
        notes: notes.trim(),
        source: "WEBSITE_FORM",
      });

      const genId = res?.data?.appointmentId || res?.data?.appointment?.appointmentId;
      const genToken = res?.data?.tokenNumber ?? res?.data?.appointment?.tokenNumber;
      const resSlot = res?.data?.timeSlot || selectedTimeSlot;
      if (genId) {
        setBookedAppointmentId(genId);
      }
      if (typeof genToken === "number") {
        setBookedTokenNumber(genToken);
      }
      if (resSlot) {
        setBookedTimeSlot(resSlot);
      }
      setSubmitted(true);
      toast.success(
        `Appointment booked!${typeof genToken === "number" ? ` Token #${genToken}` : ""}`
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to book appointment. Please try again.";
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open) handleClose();
      else setIsOpen(true);
    }}>
      <DialogTrigger asChild>
        {children || (
          <Button size="lg" className="font-semibold shadow-md">
            Book Appointment
          </Button>
        )}
      </DialogTrigger>
      <DialogContent
        className={cn(
          "max-w-xl sm:max-w-2xl w-[95vw] max-h-[92dvh] overflow-y-auto rounded-2xl sm:rounded-3xl border shadow-2xl transition-all duration-200 p-4 sm:p-5 md:p-6",
          isDark ? "text-slate-100" : "text-slate-900"
        )}
        style={{
          backgroundColor: isDark ? theme.cardBgDark : "#ffffff",
          borderColor: isDark ? theme.cardBorderDark : theme.cardBorderLight,
          color: isDark ? "#f8fafc" : "#0f172a",
          "--theme-primary": theme.primary,
          "--theme-primary-hover": theme.primaryHover,
          "--theme-primary-light": theme.primaryLight,
          "--theme-card-bg": isDark ? theme.cardBgDark : theme.cardBgLight,
          "--theme-card-border": isDark ? theme.cardBorderDark : theme.cardBorderLight,
          "--theme-inner-card-bg": isDark ? theme.innerCardBgDark : theme.innerCardBgLight,
          "--theme-soft-bg-light": theme.softBgLight,
          "--theme-soft-border-light": theme.softBorderLight,
          "--theme-soft-bg-dark": theme.softBgDark,
          "--theme-soft-border-dark": theme.softBorderDark,
          "--theme-notice-bg-light": theme.noticeBgLight,
          "--theme-notice-border-light": theme.noticeBorderLight,
          "--theme-notice-text-light": theme.noticeTextLight,
          "--theme-notice-bg-dark": theme.noticeBgDark,
          "--theme-notice-border-dark": theme.noticeBorderDark,
          "--theme-notice-text-dark": theme.noticeTextDark,
        } as React.CSSProperties}
      >
        <DialogHeader className="space-y-0.5 pb-0.5 text-left">
          <DialogTitle className={cn("text-xl sm:text-2xl font-bold tracking-tight", isDark ? "text-white" : "text-slate-900")}>
            Schedule Consultation
          </DialogTitle>
          <DialogDescription
            className="text-xs font-semibold"
            style={{ color: isDark ? theme.primaryLight : theme.primary }}
          >
            {targetEntityName}
          </DialogDescription>
        </DialogHeader>

        {submitted ? (
          <div className="py-8 text-center space-y-5">
            <CheckCircle2
              className="h-14 w-14 mx-auto animate-in zoom-in-75"
              style={{ color: isDark ? theme.primaryLight : theme.primary }}
            />
            <div className="space-y-1.5">
              <h3 className={cn("text-xl font-bold", isDark ? "text-white" : "text-slate-900")}>
                Appointment Booked!
              </h3>
              <p className={cn("text-xs max-w-md mx-auto", isDark ? "text-slate-300" : "text-slate-600")}>
                Our clinical coordinator will contact you at {patientPhone} for confirmation.
              </p>
            </div>

            {bookedAppointmentId && (
              <div
                className="p-5 rounded-2xl border space-y-2 max-w-md mx-auto"
                style={{
                  backgroundColor: isDark ? theme.innerCardBgDark : theme.noticeBgLight,
                  borderColor: isDark ? theme.cardBorderDark : theme.noticeBorderLight,
                }}
              >
                <span className="text-[11px] uppercase tracking-wider font-semibold text-slate-400 block">
                  Your Appointment ID
                </span>
                <p
                  className="text-3xl font-mono font-bold select-all tracking-wider"
                  style={{ color: isDark ? theme.primaryLight : theme.primary }}
                >
                  {bookedAppointmentId}
                </p>

                {bookedTokenNumber !== null && (
                  <div className="pt-1 flex flex-wrap items-center justify-center gap-2">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold font-mono border",
                        isDark
                          ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                          : "bg-emerald-50 text-emerald-700 border-emerald-200"
                      )}
                    >
                      Your Queue Token: #{bookedTokenNumber}
                    </span>
                    {bookedTimeSlot && (
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold border",
                          isDark ? "border-white/15 text-slate-300" : "border-slate-200 text-slate-600 bg-white"
                        )}
                      >
                        <Clock className="h-3 w-3" />
                        {bookedTimeSlot}
                      </span>
                    )}
                  </div>
                )}

                {/* Direct Copy Button for Appointment Tracking */}
                <div className="pt-0.5 pb-1 flex justify-center">
                  <button
                    type="button"
                    onClick={handleCopyId}
                    className={cn(
                      "inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold border transition-all active:scale-95 cursor-pointer shadow-xs",
                      copiedId
                        ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30 dark:text-emerald-400"
                        : isDark
                        ? "bg-white/10 hover:bg-white/15 text-slate-100 border-white/20"
                        : "bg-white hover:bg-slate-50 text-slate-800 border-slate-200"
                    )}
                  >
                    {copiedId ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-500 animate-in zoom-in-75" />
                        <span>Copied to Clipboard!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5 text-slate-500" />
                        <span>Copy Appointment ID</span>
                      </>
                    )}
                  </button>
                </div>
                <p className={cn("text-[11px] pt-1", isDark ? "text-slate-400" : "text-slate-600")}>
                  You can use this ID in the <strong>Appointment Status</strong> section on this website to track your status live.
                </p>
              </div>
            )}

            <Button
              onClick={handleClose}
              className="w-full max-w-md mx-auto h-11 rounded-xl font-bold text-sm text-white shadow-sm transition-all"
              style={{
                backgroundColor: theme.primary,
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.backgroundColor = theme.primaryHover;
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.backgroundColor = theme.primary;
              }}
            >
              Done
            </Button>
          </div>
        ) : (
          <div className="space-y-2.5 sm:space-y-3 pt-0.5">
            {/* Quick Contact Badges */}
            <div className="grid grid-cols-2 gap-2.5">
              {cleanPhone && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleWhatsAppDirect}
                  className={cn(
                    "w-full h-9 sm:h-9.5 rounded-xl flex items-center justify-center gap-2 font-semibold text-xs sm:text-sm border transition-all",
                    isDark ? "hover:bg-white/10" : "hover:bg-slate-100"
                  )}
                  style={{
                    backgroundColor: isDark ? theme.innerCardBgDark : theme.softBgLight,
                    borderColor: isDark ? theme.cardBorderDark : theme.cardBorderLight,
                    color: isDark ? theme.primaryLight : theme.primary,
                  }}
                >
                  <MessageSquare className="h-3.5 w-3.5 sm:h-4 sm:w-4" style={{ color: isDark ? theme.primaryLight : theme.primary }} />
                  <span>WhatsApp Direct</span>
                </Button>
              )}
              {phone && (
                <Button
                  type="button"
                  variant="outline"
                  asChild
                  className={cn(
                    "w-full h-9 sm:h-9.5 rounded-xl flex items-center justify-center gap-2 font-semibold text-xs sm:text-sm border transition-all",
                    isDark ? "hover:bg-white/10" : "hover:bg-slate-100"
                  )}
                  style={{
                    backgroundColor: isDark ? theme.innerCardBgDark : theme.softBgLight,
                    borderColor: isDark ? theme.cardBorderDark : theme.cardBorderLight,
                    color: isDark ? theme.primaryLight : theme.primary,
                  }}
                >
                  <a href={`tel:${phone}`}>
                    <Phone className="h-3.5 w-3.5 sm:h-4 sm:w-4" style={{ color: isDark ? theme.primaryLight : theme.primary }} />
                    <span>Call Clinic</span>
                  </a>
                </Button>
              )}
            </div>

            <div className="relative flex py-0.5 items-center">
              <div
                className="flex-grow border-t"
                style={{ borderColor: isDark ? theme.cardBorderDark : theme.cardBorderLight }}
              />
              <span
                className="flex-shrink mx-2.5 text-[10px] font-semibold uppercase tracking-wider"
                style={{ color: isDark ? theme.primaryLight : "rgba(100, 116, 139, 0.9)" }}
              >
                Or Submit Form
              </span>
              <div
                className="flex-grow border-t"
                style={{ borderColor: isDark ? theme.cardBorderDark : theme.cardBorderLight }}
              />
            </div>

            <form onSubmit={handleSubmitRequest} className="space-y-2 sm:space-y-2.5">
              {/* Doctor Selection for Hospital Website Appointments */}
              {doctorDirectory && doctorDirectory.length > 0 && !doctorId && (
                <div className="space-y-1">
                  <Label
                    htmlFor="select-hospital-doctor"
                    className={cn(
                      "text-xs font-semibold h-5 flex items-center gap-1.5",
                      isDark ? "text-slate-200" : "text-slate-700"
                    )}
                  >
                    <Stethoscope className="h-3.5 w-3.5" style={{ color: isDark ? theme.primaryLight : theme.primary }} />
                    <span>Select Specialist / Doctor *</span>
                  </Label>
                  <select
                    id="select-hospital-doctor"
                    value={selectedDoctorId}
                    onChange={(e) => setSelectedDoctorId(e.target.value)}
                    className={cn(
                      "w-full rounded-xl border text-xs sm:text-sm px-3 h-10 outline-hidden transition-all shadow-2xs font-medium cursor-pointer",
                      "focus:border-[var(--theme-primary)] focus:ring-2 focus:ring-[var(--theme-primary)]/30"
                    )}
                    style={{
                      backgroundColor: isDark ? theme.innerCardBgDark : "#ffffff",
                      borderColor: isDark ? theme.cardBorderDark : theme.cardBorderLight,
                      color: isDark ? "#ffffff" : "#0f172a",
                    }}
                    required
                  >
                    {doctorDirectory.map((doc) => (
                      <option
                        key={doc.id}
                        value={doc.id}
                        className={isDark ? "bg-slate-900 text-white" : "bg-white text-slate-900"}
                      >
                        Dr. {doc.doctorName} — {doc.specialization} {doc.degree ? `(${doc.degree})` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-2.5">
                <div className="space-y-1 sm:col-span-2">
                  <Label htmlFor="patient-name" className={cn("text-xs font-semibold h-5 flex items-center", isDark ? "text-slate-200" : "text-slate-700")}>
                    Patient Full Name *
                  </Label>
                  <Input
                    id="patient-name"
                    placeholder="Enter name"
                    value={patientName}
                    onChange={(e) => setPatientName(e.target.value)}
                    className={inputClass}
                    style={inputStyle}
                    required
                  />
                </div>
                <div className="space-y-1 sm:col-span-1">
                  <Label htmlFor="patient-age" className={cn("text-xs font-semibold h-5 flex items-center", isDark ? "text-slate-200" : "text-slate-700")}>
                    Patient Age (Years) *
                  </Label>
                  <Input
                    id="patient-age"
                    type="number"
                    min={1}
                    max={120}
                    placeholder="Enter age"
                    value={patientAge}
                    onChange={(e) => setPatientAge(e.target.value)}
                    className={inputClass}
                    style={inputStyle}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-2.5">
                <div className="space-y-1">
                  <Label htmlFor="patient-phone" className={cn("text-xs font-semibold h-5 flex items-center", isDark ? "text-slate-200" : "text-slate-700")}>
                    Phone / WhatsApp Number *
                  </Label>
                  <PhoneInput
                    id="patient-phone"
                    placeholder="Enter mobile number"
                    value={patientPhone}
                    onChange={(val) => setPatientPhone(val)}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="preferred-date" className={cn("text-xs font-semibold h-5 flex items-center gap-1.5", isDark ? "text-slate-200" : "text-slate-700")}>
                    <Calendar className="h-3.5 w-3.5 shrink-0" style={{ color: isDark ? theme.primaryLight : theme.primary }} />
                    <span>Select Specific Date *</span>
                  </Label>
                  <CalendarPicker
                    id="preferred-date"
                    value={preferredDate}
                    onChange={(val) => setPreferredDate(val)}
                    minDate={minBookingDate}
                    maxDate={maxBookingDate}
                    bookingDays={bookingDays}
                    isDark={isDark}
                    theme={theme}
                    error={dateValidation && !dateValidation.isValid ? dateValidation.errorMessage : undefined}
                    required
                  />
                </div>
              </div>

              {/* Booking Window & Day Selection */}
              <div className="space-y-1 sm:space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className={cn("text-xs font-semibold flex items-center gap-1.5", isDark ? "text-slate-200" : "text-slate-700")}>
                    <span>Quick Date Selection</span>
                  </span>
                  <span className={cn("text-[10px]", isDark ? "text-slate-400" : "text-slate-500")}>
                    Today & next 3 days only
                  </span>
                </div>

                {/* Quick Date Selection Chips (Today, Tomorrow, Day+2, Day+3) */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {bookingDays.map((day) => {
                    const isSelected = preferredDate === day.dateStr;
                    const isClosed = !day.isOpen;

                    let chipStyle: React.CSSProperties = {};
                    if (isClosed) {
                      chipStyle = {
                        backgroundColor: isDark ? "rgba(255, 255, 255, 0.03)" : "rgba(241, 245, 249, 0.6)",
                        borderColor: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(226, 232, 240, 0.8)",
                        color: isDark ? "#64748b" : "#94a3b8",
                      };
                    } else if (isSelected) {
                      chipStyle = {
                        backgroundColor: theme.primary,
                        borderColor: theme.primary,
                        color: "#ffffff",
                      };
                    } else {
                      chipStyle = {
                        backgroundColor: isDark ? theme.innerCardBgDark : "#ffffff",
                        borderColor: isDark ? theme.cardBorderDark : theme.cardBorderLight,
                        color: isDark ? "#f1f5f9" : "#0f172a",
                      };
                    }

                    return (
                      <button
                        key={day.dateStr}
                        type="button"
                        disabled={isClosed}
                        onClick={() => setPreferredDate(day.dateStr)}
                        className={cn(
                          "p-2 sm:p-2 rounded-xl border text-left transition-all text-xs flex flex-col justify-between select-none",
                          isClosed && "cursor-not-allowed opacity-60 line-through",
                          isSelected && "font-bold shadow-md scale-[1.02]",
                          !isClosed && !isSelected && "hover:border-[var(--theme-primary)] hover:scale-[1.01]"
                        )}
                        style={chipStyle}
                        title={isClosed ? `Clinic is closed (${day.closedReason || "Weekly Off"})` : day.dayLabel}
                      >
                        <span className="font-semibold truncate block">
                          {day.diffDays === 0
                            ? "Today"
                            : day.diffDays === 1
                            ? "Tomorrow"
                            : day.dayOfWeek.slice(0, 3)}
                        </span>
                        <span className={cn("text-[10px] mt-0.5 block truncate", isSelected ? "text-white/90" : "opacity-75")}>
                          {day.displayDate.slice(0, 5)}
                        </span>
                        {isClosed && (
                          <span className="text-[9px] font-bold text-rose-500 dark:text-rose-400 no-underline block mt-0.5">
                            Closed
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Real-time schedule error alert */}
                {dateValidation && !dateValidation.isValid && (
                  <div
                    className="p-2 sm:p-2.5 rounded-xl border text-xs flex items-start gap-2 animate-in fade-in-50"
                    style={{
                      backgroundColor: isDark ? "rgba(159, 18, 57, 0.25)" : "#fff1f2",
                      borderColor: isDark ? "rgba(244, 63, 94, 0.35)" : "#fecdd3",
                      color: isDark ? "#fda4af" : "#be123c",
                    }}
                  >
                    <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-rose-500" />
                    <span className="leading-tight font-medium text-[11px]">{dateValidation.errorMessage}</span>
                  </div>
                )}
              </div>

              {/* Live Time Slot Selection with Seat Availability */}
              {(!dateValidation || dateValidation.isValid) && (
                <div className="space-y-1">
                  <Label
                    htmlFor="appointment-slot-select"
                    className={cn("text-xs font-semibold h-5 flex items-center justify-between", isDark ? "text-slate-200" : "text-slate-700")}
                  >
                    <span className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 shrink-0" style={{ color: isDark ? theme.primaryLight : theme.primary }} />
                      <span>Select Time Slot *</span>
                    </span>
                    {slotsLoading && (
                      <span className="text-[10px] font-normal opacity-75">Checking seats...</span>
                    )}
                  </Label>
                  {liveSlots.length > 0 ? (
                    <select
                      id="appointment-slot-select"
                      value={selectedTimeSlot}
                      onChange={(e) => setSelectedTimeSlot(e.target.value)}
                      className={cn(
                        "w-full rounded-xl border text-xs sm:text-sm px-3 h-10 outline-hidden transition-all shadow-2xs font-medium cursor-pointer",
                        "focus:border-[var(--theme-primary)] focus:ring-2 focus:ring-[var(--theme-primary)]/30"
                      )}
                      style={{
                        backgroundColor: isDark ? theme.innerCardBgDark : "#ffffff",
                        borderColor: isDark ? theme.cardBorderDark : theme.cardBorderLight,
                        color: isDark ? "#ffffff" : "#0f172a",
                      }}
                      required
                    >
                      {liveSlots.map((sl) => (
                        <option
                          key={sl.slotKey}
                          value={sl.displayLabel}
                          disabled={sl.isFull}
                          className={isDark ? "bg-slate-900 text-white" : "bg-white text-slate-900"}
                        >
                          {formatSlotSelectLabel(sl)}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div
                      className={cn(
                        "rounded-xl border px-3 py-2 text-xs",
                        isDark ? "border-white/10 text-slate-300" : "border-slate-200 text-slate-600 bg-slate-50"
                      )}
                    >
                      {slotsLoading ? "Loading consultation slots..." : "Regular Consultation"}
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-1">
                <Label htmlFor="patient-notes" className={cn("text-xs font-semibold h-5 flex items-center", isDark ? "text-slate-200" : "text-slate-700")}>
                  Medical Concern / Reason for Visit *
                </Label>
                <Input
                  id="patient-notes"
                  placeholder="Enter reason for visit / symptoms"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className={inputClass}
                  style={inputStyle}
                  required
                />
              </div>

              <Button
                type="submit"
                disabled={isSubmitting || Boolean(dateValidation && !dateValidation.isValid)}
                className="w-full mt-1.5 sm:mt-2 h-9.5 sm:h-10 rounded-xl font-bold text-xs sm:text-sm text-white shadow-md hover:shadow-lg transition-all"
                style={{
                  backgroundColor: theme.primary,
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.backgroundColor = theme.primaryHover;
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.backgroundColor = theme.primary;
                }}
              >
                {isSubmitting ? "Booking Appointment..." : "Confirm & Book Appointment"}
              </Button>
            </form>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
