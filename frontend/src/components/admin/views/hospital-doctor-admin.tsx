import * as React from "react";
import Link from "next/link";
import {
  LayoutDashboard,
  User,
  GraduationCap,
  Clock,
  CalendarCheck,
  Camera,
  Building2,
  Lock,
  Settings,
  CheckCircle,
  ExternalLink,
  Info,
  QrCode,
  MessageSquare,
  Trash2,
  Globe,
  Save,
  CalendarPlus,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AdminShell, NavItem } from "../admin-shell";
import { LiveOpdQueueCard } from "../live-opd-queue-card";
import { ClinicQrCard } from "../clinic-qr-dialog";
import { fetchDoctorLiveSlots, LiveSlotOption, formatSlotSelectLabel } from "@/lib/appointment-slots";
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { DataTable, ColumnDef } from "@/components/ui/data-table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { FormField } from "@/components/forms/form-field";
import { PhoneInput } from "@/components/ui/phone-input";
import { AIContentPanel } from "../ai-content-panel";
import { AIChatHistoryView } from "../ai-chat-history-view";
import { ImageUploader } from "@/components/forms/image-uploader";
import { SlugInput } from "@/components/forms/slug-input";
import { ConsultationHoursBuilder, DEFAULT_WEEK_SCHEDULE, DaySchedule } from "@/components/forms/consultation-hours-builder";
import { AccountSettingsCard } from "../account-settings-card";
import { AdminLogView } from "../admin-log-view";
import { MediaAsset } from "@/types";
import { apiClient } from "@/lib/api-client";
import { toast } from "sonner";

export interface InheritedHospitalInfo {
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  organizationType: string;
  address: {
    street?: string;
    city: string;
    state: string;
    pincode: string;
    country: string;
  };
  logo?: { url: string };
  galleryPhotos: Array<{ url: string }>;
  selectedTheme: string;
  faviconUrl?: string;
  browserTabTitle?: string;
  workingHours?: string;
  weeklyOff?: string;
  isLocked: boolean;
  lockMessage: string;
}

export interface HospitalDoctorData {
  id: string;
  slug: string;
  doctorName: string;
  gender: string;
  degree: string;
  specialization: string;
  yearsOfExperience: number;
  newCaseFee?: number;
  oldCaseFee?: number;
  whatsApp?: string;
  email: string;
  phone?: string;
  bio?: string;
  doctorPhoto?: MediaAsset;
  consultationHours?: string;
  weeklyOff?: string;
  appointmentRequired?: boolean;
  status: "ACTIVE" | "INACTIVE";
  inheritedHospitalData: InheritedHospitalInfo;
  tagline?: string;
  shortIntro?: string;
  services?: Array<{ title: string; description: string }>;
  faqs?: Array<{ question: string; answer: string }>;
  publishStatus?: "PUBLISHED" | "DRAFT";
  isWebsiteChatbotEnabled?: boolean;
  isAdminChatbotEnabled?: boolean;
}

function parseSchedules(raw?: string): DaySchedule[] {
  if (!raw) return DEFAULT_WEEK_SCHEDULE;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].day) {
      return parsed;
    }
  } catch {
    // fallback
  }
  return DEFAULT_WEEK_SCHEDULE;
}

export interface DoctorAppointmentItem {
  id: string;
  appointmentId?: string;
  tokenNumber?: number;
  source?: string;
  patientName: string;
  patientAge?: number;
  patientPhone: string;
  appointmentDate: string;
  timeSlot: string;
  status: "PENDING" | "CONFIRMED" | "CANCELLED" | "COMPLETED" | "PATIENT_NOT_COME";
  notes?: string;
}

interface HospitalDoctorAdminProps {
  initialData: HospitalDoctorData;
  initialAppointments?: DoctorAppointmentItem[];
  onSave?: (updatedData: Partial<HospitalDoctorData>) => Promise<void>;
  onUpdateAppointmentStatus?: (appointmentId: string, status: string) => Promise<void>;
  onLogout?: () => void;
}

export function HospitalDoctorAdmin({
  initialData,
  initialAppointments = [],
  onSave,
  onUpdateAppointmentStatus,
  onLogout,
}: HospitalDoctorAdminProps) {
  const [activeTab, setActiveTab] = React.useState("dashboard");
  const [data, setData] = React.useState<HospitalDoctorData>(initialData);
  const [appointments, setAppointments] = React.useState<DoctorAppointmentItem[]>(initialAppointments);
  const [isSaving, setIsSaving] = React.useState(false);
  const [saveSuccess, setSaveSuccess] = React.useState(false);
  const [slugValue, setSlugValue] = React.useState("");
  const [isSavingSlug, setIsSavingSlug] = React.useState(false);

  React.useEffect(() => {
    setAppointments(initialAppointments);
  }, [initialAppointments]);

  const [schedules, setSchedules] = React.useState<DaySchedule[]>(() =>
    parseSchedules(initialData.consultationHours)
  );

  React.useEffect(() => {
    setData(initialData);
    if (initialData.consultationHours) {
      setSchedules(parseSchedules(initialData.consultationHours));
    }
  }, [initialData]);

  const parentHospital = data.inheritedHospitalData;

  const hospitalOffDays = React.useMemo(() => {
    if (!parentHospital) return [];
    const off = new Set<string>();
    if (parentHospital.weeklyOff) {
      parentHospital.weeklyOff
        .split(",")
        .map((d) => d.trim())
        .filter(Boolean)
        .forEach((d) => off.add(d));
    }
    if (parentHospital.workingHours) {
      try {
        const parsed = JSON.parse(parentHospital.workingHours);
        if (Array.isArray(parsed)) {
          parsed.forEach((s: any) => {
            if (s.isClosed && s.day) off.add(s.day);
          });
        }
      } catch {}
    }
    return Array.from(off);
  }, [parentHospital]);

  const navItems: NavItem[] = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "profile", label: "Doctor Profile", icon: User },
    { id: "professional", label: "Professional Info", icon: GraduationCap },
    { id: "schedule", label: "Consultation Hours", icon: Clock },
    { id: "appointments", label: "Appointments", icon: CalendarCheck, badge: String(appointments.length) },
    { id: "aichats", label: "AI Patient Chats", icon: MessageSquare },
    { id: "ai", label: "Live Website Content", icon: Globe },
    { id: "qrcode", label: "Doctor QR Code", icon: QrCode },
    { id: "photo", label: "Doctor Photo", icon: Camera },
    { id: "inherited", label: "Hospital Facility & Brand", icon: Building2, isLocked: true },
    { id: "admin-logs", label: "Admin Log", icon: ShieldCheck },
    { id: "settings", label: "Account Settings", icon: Settings },
  ];

  const handleUpdate = async (field: Partial<HospitalDoctorData>) => {
    const updated = { ...data, ...field };
    setData(updated);
    if (onSave) {
      setIsSaving(true);
      try {
        await onSave(field);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2500);
      } finally {
        setIsSaving(false);
      }
    }
  };

  const handleUpdateDoctorSlug = async () => {
    const clean = slugValue.trim().toLowerCase().replace(/^-+|-+$/g, "");
    if (!clean || clean === data.slug) return;
    setIsSavingSlug(true);
    try {
      const res = await apiClient.patch<{ success: boolean; message?: string }>("/doctors/me", { slug: clean });
      if (res.success) {
        toast.success("Doctor website URL slug updated successfully! Redirecting to your new admin portal...");
        setTimeout(() => {
          const orgSlug = parentHospital?.organizationSlug || "";
          const isCustomDomain =
            typeof window !== "undefined" &&
            (window.location.pathname === "/admin" || window.location.pathname.startsWith("/admin/"));
          window.location.replace(isCustomDomain ? "/admin" : `/${orgSlug}/${clean}/admin`);
        }, 1200);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update doctor URL slug";
      toast.error(msg);
      setIsSavingSlug(false);
    }
  };

  const [queueRefreshTick, setQueueRefreshTick] = React.useState(0);
  const [liveSlots, setLiveSlots] = React.useState<LiveSlotOption[]>([]);

  const handleStatusChange = async (
    appointmentId: string,
    status: "PENDING" | "CONFIRMED" | "CANCELLED" | "COMPLETED" | "PATIENT_NOT_COME"
  ) => {
    try {
      await apiClient.patch(`/appointments/${appointmentId}/status`, { status });
      setAppointments((prev) =>
        prev.map((a) => (a.id === appointmentId ? { ...a, status } : a))
      );
      setQueueRefreshTick((t) => t + 1);
      toast.success(`Appointment status updated to ${status === "PATIENT_NOT_COME" ? "Patient Not Come" : status}`);
      if (onUpdateAppointmentStatus) {
        await onUpdateAppointmentStatus(appointmentId, status);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update status";
      toast.error(msg);
    }
  };

  const [deleteApptId, setDeleteApptId] = React.useState<string | null>(null);
  const [isDeletingAppt, setIsDeletingAppt] = React.useState(false);

  const confirmDeleteAppointment = async () => {
    if (!deleteApptId) return;
    setIsDeletingAppt(true);
    try {
      await apiClient.delete(`/appointments/${deleteApptId}`);
      setAppointments((prev) => prev.filter((a) => a.id !== deleteApptId));
      setQueueRefreshTick((t) => t + 1);
      toast.success("Appointment permanently deleted from database");
      setDeleteApptId(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to delete appointment";
      toast.error(msg);
    } finally {
      setIsDeletingAppt(false);
    }
  };

  // Manual Appointment Booking from Hospital Doctor Admin
  const [bookModalOpen, setBookModalOpen] = React.useState(false);
  const [bookName, setBookName] = React.useState("");
  const [bookAge, setBookAge] = React.useState("");
  const [bookPhone, setBookPhone] = React.useState("");
  const [bookDate, setBookDate] = React.useState(() => new Date().toISOString().split("T")[0] || "");
  const [bookSlot, setBookSlot] = React.useState("Regular Consultation");
  const [bookNotes, setBookNotes] = React.useState("");
  const [isBookingSubmitting, setIsBookingSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (!bookModalOpen || !data.id || !bookDate) return;
    let cancelled = false;
    fetchDoctorLiveSlots({
      doctorId: data.id,
      organizationId: parentHospital.organizationId,
      date: bookDate,
    }).then((res) => {
      if (cancelled || !res) return;
      setLiveSlots(res.slots || []);
      const firstOpen = res.slots.find((s) => !s.isFull) || res.slots[0];
      if (firstOpen) {
        setBookSlot(firstOpen.displayLabel);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [bookModalOpen, data.id, parentHospital.organizationId, bookDate]);

  const handleAdminBookDoctorAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookName.trim() || !bookPhone.trim() || !bookDate) {
      toast.error("Please fill in patient name, phone number, and appointment date.");
      return;
    }
    setIsBookingSubmitting(true);
    try {
      const res: any = await apiClient.post("/appointments", {
        doctorId: data.id,
        organizationId: parentHospital.organizationId,
        patientName: bookName.trim(),
        patientAge: Number(bookAge) || 30,
        patientPhone: bookPhone.trim(),
        appointmentDate: new Date(bookDate),
        timeSlot: bookSlot,
        notes: bookNotes.trim() || "Doctor walk-in consultation",
        source: "SLUG_ADMIN",
      });

      const newAppt = res?.data?.appointment || res?.data;
      const genId = res?.data?.appointmentId || newAppt?.appointmentId;
      const genToken = res?.data?.tokenNumber ?? newAppt?.tokenNumber;
      const resolvedSlot = res?.data?.timeSlot || bookSlot;
      if (newAppt) {
        setAppointments((prev) => [
          {
            id: newAppt._id || newAppt.id || String(Date.now()),
            appointmentId: genId || "",
            tokenNumber: typeof genToken === "number" ? genToken : undefined,
            patientName: bookName.trim(),
            patientAge: Number(bookAge) || 30,
            patientPhone: bookPhone.trim(),
            appointmentDate: bookDate,
            timeSlot: resolvedSlot,
            status: "CONFIRMED",
            notes: bookNotes.trim() || "Doctor walk-in consultation",
            source: "SLUG_ADMIN",
          },
          ...prev,
        ]);
      }
      setQueueRefreshTick((t) => t + 1);
      toast.success(
        `Appointment booked! ID: ${genId || ""}${typeof genToken === "number" ? ` • Token #${genToken}` : ""}`
      );
      setBookModalOpen(false);
      setBookName("");
      setBookAge("");
      setBookPhone("");
      setBookNotes("");
    } catch (err: any) {
      toast.error(err?.response?.data?.error || err?.message || "Failed to book appointment");
    } finally {
      setIsBookingSubmitting(false);
    }
  };

  const appointmentColumns = React.useMemo<ColumnDef<DoctorAppointmentItem>[]>(
    () => [
      {
        key: "appointmentId",
        header: "Appointment ID & Token",
        accessorFn: (appt) => `${appt.appointmentId || appt.id} ${appt.tokenNumber || ""}`,
        cell: (appt) => (
          <div className="flex flex-col gap-1 items-start">
            <span className="font-mono text-[11px] font-bold text-[#1a76d1] bg-blue-50 dark:bg-blue-950/40 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-900/60 inline-block">
              {appt.appointmentId || (appt.id ? appt.id.slice(-6).toUpperCase() : "—")}
            </span>
            {typeof appt.tokenNumber === "number" && (
              <span className="font-mono text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                Token #{appt.tokenNumber}
              </span>
            )}
          </div>
        ),
      },
      {
        key: "patientName",
        header: "Patient",
        cell: (appt) => (
          <div>
            <span className="font-medium text-xs text-slate-900 block">{appt.patientName}</span>
            {appt.notes && (
              <span className="block text-[10px] text-slate-500 truncate max-w-xs font-normal">
                Note: {appt.notes}
              </span>
            )}
          </div>
        ),
      },
      {
        key: "patientAge",
        header: "Age",
        cell: (appt) => (
          <span className="text-xs text-slate-700 font-medium">
            {appt.patientAge ? `${appt.patientAge} yrs` : "—"}
          </span>
        ),
      },
      {
        key: "patientPhone",
        header: "Phone",
        cell: (appt) => <span className="text-xs text-slate-700 font-mono">{appt.patientPhone}</span>,
      },
      {
        key: "dateAndSlot",
        header: "Date & Slot",
        accessorFn: (appt) => `${appt.appointmentDate?.split("T")[0] || ""} ${appt.timeSlot}`,
        cell: (appt) => (
          <div className="text-xs text-slate-700">
            <span className="font-semibold block">{appt.appointmentDate ? appt.appointmentDate.split("T")[0] : "—"}</span>
            <span className="text-[11px] text-slate-500">{appt.timeSlot}</span>
          </div>
        ),
      },
      {
        key: "source",
        header: "Booked Via",
        accessorFn: (appt) => appt.source || "WEBSITE_FORM",
        cell: (appt) => {
          const src = appt.source || "WEBSITE_FORM";
          let label = "Website";
          let badgeClass = "bg-slate-100 text-slate-700 border-slate-300";
          if (src === "AI_CHATBOT") {
            label = "AI Chatbot";
            badgeClass = "bg-purple-100 text-purple-800 border-purple-300";
          } else if (src === "SLUG_ADMIN" || src === "WALK_IN") {
            label = "Admin / Walk-in";
            badgeClass = "bg-emerald-100 text-emerald-800 border-emerald-300";
          }
          return (
            <Badge variant="outline" className={cn("text-[10px] font-semibold", badgeClass)}>
              {label}
            </Badge>
          );
        },
      },
      {
        key: "status",
        header: "Status",
        cell: (appt) => {
          const status = appt.status;
          return (
            <Badge
              className={`text-[10px] font-semibold ${
                status === "COMPLETED"
                  ? "bg-blue-100 text-blue-800 border-blue-200"
                  : status === "PATIENT_NOT_COME"
                  ? "bg-rose-100 text-rose-800 border-rose-200"
                  : status === "PENDING"
                  ? "bg-amber-100 text-amber-800 border-amber-200"
                  : status === "CONFIRMED"
                  ? "bg-sky-100 text-sky-800 border-sky-200"
                  : "bg-slate-100 text-slate-800 border-slate-200"
              }`}
              variant="outline"
            >
              {status === "PATIENT_NOT_COME" ? "Patient Not Come" : status}
            </Badge>
          );
        },
      },
      {
        key: "actions",
        header: "Actions",
        sortable: false,
        headerClassName: "text-right",
        cell: (appt) => (
          <div className="flex items-center justify-end gap-1 whitespace-nowrap">
            {appt.status === "CANCELLED" ? (
              <span className="inline-flex items-center text-xs text-rose-600 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded font-medium mr-1">
                Cancelled (Permanent)
              </span>
            ) : (
              <>
                {appt.status !== "COMPLETED" && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleStatusChange(appt.id, "COMPLETED")}
                    className="text-[10px] h-7 px-2 border-blue-200 text-[#1560aa] hover:bg-blue-50"
                  >
                    Completed
                  </Button>
                )}
                {appt.status !== "PATIENT_NOT_COME" && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleStatusChange(appt.id, "PATIENT_NOT_COME")}
                    className="text-[10px] h-7 px-2 border-rose-300 text-rose-700 hover:bg-rose-50"
                  >
                    Not Come
                  </Button>
                )}
                {appt.status !== "COMPLETED" && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      if (window.confirm("Cancel this appointment? Slot capacity will open up for other patients.")) {
                        handleStatusChange(appt.id, "CANCELLED");
                      }
                    }}
                    className="text-[10px] h-7 px-2 border-rose-300 text-rose-700 hover:bg-rose-50"
                  >
                    <XCircle className="h-3 w-3 mr-1" />
                    Cancel
                  </Button>
                )}
              </>
            )}
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setDeleteApptId(appt.id)}
              className="text-[10px] h-7 px-2 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
              title="Permanently delete from database"
            >
              <Trash2 className="h-3 w-3 mr-1" />
              Delete
            </Button>
          </div>
        ),
      },
    ],
    []
  );

  const publicUrl = `/${parentHospital.organizationSlug}/${data.slug}`;

  return (
    <AdminShell
      title={`Dr. ${data.doctorName} — Administration`}
      subtitle={`Affiliated with ${parentHospital.organizationName}`}
      roleBadge="Hospital Doctor"
      publicWebsiteUrl={publicUrl}
      logoUrl={data.doctorPhoto?.url || parentHospital.logo?.url}
      navItems={navItems}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      userEmail={data.email}
      onLogout={onLogout}
      isAdminChatbotEnabled={data.isAdminChatbotEnabled !== false}
    >
      {saveSuccess && (
        <div className="bg-blue-50 border border-blue-200 text-[#1560aa] text-xs px-4 py-2.5 rounded-xl flex items-center justify-between animate-in fade-in shadow-2xs">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-[#1a76d1]" />
            <span>Changes successfully saved and updated on your public website.</span>
          </div>
          <Badge variant="outline" className="text-[10px] bg-white text-[#1560aa] border-blue-300">
            Synchronized
          </Badge>
        </div>
      )}

      {/* Centralized Hospital Lock Notice */}
      <div className="bg-blue-50/70 border border-blue-200 text-blue-900 rounded-xl p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs shadow-2xs">
        <div className="flex items-center gap-2.5">
          <Lock className="h-4 w-4 text-[#1a76d1] shrink-0" />
          <div>
            <span className="font-semibold text-blue-950">Affiliated with {parentHospital.organizationName}</span>
            <span className="text-[#1560aa] text-xs block sm:inline sm:ml-2">
              Hospital branding, themes, address, and facility photos are centrally managed.
            </span>
          </div>
        </div>

        <Button asChild size="sm" variant="outline" className="text-xs bg-white border-blue-200 text-[#1560aa] hover:bg-blue-50 shrink-0 h-7 px-2.5 rounded-lg font-semibold">
          <Link href={publicUrl} target="_blank">
            <ExternalLink className="h-3 w-3 mr-1 text-[#1a76d1]" />
            View Public Page
          </Link>
        </Button>
      </div>

      {/* TAB 1: DASHBOARD */}
      {activeTab === "dashboard" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="bg-white border-blue-100 rounded-2xl shadow-xs">
              <CardHeader className="p-4 pb-2">
                <CardDescription className="text-xs">Website Status</CardDescription>
                <CardTitle className="text-xl font-bold flex items-center gap-2 text-slate-900">
                  <span
                    className={`h-2.5 w-2.5 rounded-full ${
                      data.status === "ACTIVE" ? "bg-[#1a76d1] animate-pulse" : "bg-slate-400"
                    }`}
                  />
                  {data.status || "ACTIVE"}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0 text-xs text-slate-500">
                Live at <Link href={publicUrl} className="font-mono text-[#1a76d1] font-semibold underline">{publicUrl}</Link>
              </CardContent>
            </Card>

            <Card className="bg-white border-slate-200 shadow-2xs">
              <CardHeader className="p-4 pb-2">
                <CardDescription className="text-xs">Total Inquiries</CardDescription>
                <CardTitle className="text-2xl font-bold text-slate-900">{appointments.length}</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0 text-xs text-slate-500">
                Appointments requested
              </CardContent>
            </Card>

            <Card className="bg-white border-slate-200 shadow-2xs">
              <CardHeader className="p-4 pb-2">
                <CardDescription className="text-xs">Pending Appointments</CardDescription>
                <CardTitle className="text-2xl font-bold text-amber-600">
                  {appointments.filter((a) => a.status === "PENDING").length}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0 text-xs text-slate-500">
                Requires confirmation
              </CardContent>
            </Card>
          </div>

          {/* Recent Appointments */}
          <Card className="bg-white border-slate-200 shadow-2xs">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="text-base font-bold">Recent Consultation Requests</CardTitle>
                <CardDescription className="text-xs">Direct patient requests from your website booking CTA.</CardDescription>
              </div>
              <Button size="sm" variant="outline" onClick={() => setActiveTab("appointments")}>
                View All
              </Button>
            </CardHeader>
            <CardContent>
              {appointments.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-500">
                  No appointment requests received yet.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Patient</TableHead>
                      <TableHead>Age</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Slot</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {appointments.slice(0, 5).map((appt) => (
                      <TableRow key={appt.id}>
                        <TableCell className="font-semibold text-slate-900 text-xs">{appt.patientName}</TableCell>
                        <TableCell className="text-xs text-slate-700 font-medium">
                          {appt.patientAge ? `${appt.patientAge} yrs` : "—"}
                        </TableCell>
                        <TableCell className="text-slate-600 font-mono text-xs">{appt.patientPhone}</TableCell>
                        <TableCell className="text-xs text-slate-500">{appt.timeSlot}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              appt.status === "COMPLETED"
                                ? "success"
                                : appt.status === "PATIENT_NOT_COME"
                                ? "destructive"
                                : appt.status === "PENDING"
                                ? "warning"
                                : appt.status === "CONFIRMED"
                                ? "outline"
                                : "secondary"
                            }
                            className="text-[10px]"
                          >
                            {appt.status === "PATIENT_NOT_COME" ? "Patient Not Come" : appt.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right space-x-1 whitespace-nowrap">
                          {appt.status === "CANCELLED" ? (
                            <span className="text-[11px] text-rose-600 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded font-medium">
                              Cancelled
                            </span>
                          ) : (
                            <>
                              {appt.status !== "COMPLETED" && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs text-[#1560aa] hover:bg-blue-50 border-blue-200"
                                  onClick={() => handleStatusChange(appt.id, "COMPLETED")}
                                >
                                  Completed
                                </Button>
                              )}
                              {appt.status !== "PATIENT_NOT_COME" && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs text-amber-700 hover:bg-amber-50"
                                  onClick={() => handleStatusChange(appt.id, "PATIENT_NOT_COME")}
                                >
                                  Not Come
                                </Button>
                              )}
                            </>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* TAB 2: DOCTOR PROFILE */}
      {activeTab === "profile" && (
        <div className="space-y-6 max-w-xl">
          {/* Custom Doctor URL Slug Card */}
          <Card className="bg-white border-slate-200">
            <CardHeader>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Globe className="h-4 w-4 text-[#1a76d1]" />
                Doctor Website URL Slug
              </CardTitle>
              <CardDescription className="text-xs">
                Customize your dedicated website URL slug under {parentHospital?.organizationName || "Hospital"}.
                The hospital prefix <code className="bg-slate-100 text-slate-800 font-semibold px-1 py-0.5 rounded">/{parentHospital?.organizationSlug}/</code> is locked, and your personal handle is customizable.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <SlugInput
                id="hospitalDoctorSlug"
                label="Your Doctor URL Slug"
                value={slugValue}
                onChange={setSlugValue}
                prefix={`/${parentHospital?.organizationSlug || "hospital"}/`}
                type="HOSPITAL_DOCTOR"
                orgId={parentHospital?.organizationId}
                excludeId={data.id}
                placeholder="Enter new doctor slug (e.g. dr-priya-sharma)"
                hint={
                  slugValue
                    ? `Live website address will be: /${parentHospital?.organizationSlug || "hospital"}/${slugValue}`
                    : "Enter a new slug to change your doctor URL handle."
                }
                required={false}
              />
            </CardContent>
            <CardFooter className="flex justify-between items-center border-t border-slate-100 pt-4">
              <span className="text-xs text-slate-500">
                Current URL: <code className="bg-slate-100 text-slate-800 font-semibold px-1 py-0.5 rounded">/{parentHospital?.organizationSlug}/{data.slug}</code>
              </span>
              <Button
                onClick={handleUpdateDoctorSlug}
                disabled={isSavingSlug || !slugValue.trim() || slugValue.trim() === data.slug}
                className="bg-[#1a76d1] hover:bg-[#1560aa] text-white font-semibold text-xs rounded-xl shadow-xs"
              >
                {isSavingSlug ? "Updating Slug..." : "Save Doctor Slug"}
              </Button>
            </CardFooter>
          </Card>

          <Card className="bg-white border-slate-200">
            <CardHeader>
              <CardTitle className="text-base font-bold text-slate-900">Doctor Profile</CardTitle>
              <CardDescription className="text-xs">
                Personal credentials, contact information, and clinical biography displayed on your website.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Dr. Prefix fixed input */}
              <FormField id="doctorName" label="Doctor Name" required>
                <div className="flex rounded-md shadow-xs">
                  <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-slate-300 bg-slate-100 text-slate-600 text-xs font-semibold">
                    Dr.
                  </span>
                  <Input
                    id="doctorName"
                    value={data.doctorName}
                    onChange={(e) => {
                      const cleaned = e.target.value.replace(/^Dr\.\s*/i, "");
                      setData({ ...data, doctorName: cleaned });
                    }}
                    className="rounded-l-none"
                    placeholder="First Last"
                  />
                </div>
              </FormField>

              <FormField id="gender" label="Gender" required>
                <div className="flex items-center gap-4 pt-1">
                  {["Male", "Female"].map((g) => (
                    <label key={g} className="flex items-center gap-1.5 text-xs font-medium cursor-pointer">
                      <input
                        type="radio"
                        name="gender"
                        value={g}
                        checked={data.gender === g}
                        onChange={() => setData({ ...data, gender: g })}
                        className="text-[#1a76d1] focus:ring-[#1a76d1]"
                      />
                      {g}
                    </label>
                  ))}
                </div>
              </FormField>

              <FormField id="email" label="Contact Email" required>
                <Input
                  id="email"
                  type="email"
                  value={data.email}
                  onChange={(e) => setData({ ...data, email: e.target.value })}
                />
              </FormField>

              <FormField id="whatsApp" label="WhatsApp Number">
                <PhoneInput
                  id="whatsApp"
                  value={data.whatsApp || ""}
                  onChange={(val) => setData({ ...data, whatsApp: val })}
                />
              </FormField>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField id="newCaseFee" label="Consultation Fee - New Case (₹)">
                  <Input
                    id="newCaseFee"
                    type="number"
                    min={0}
                    placeholder="e.g. 500"
                    value={data.newCaseFee ?? ""}
                    onChange={(e) => setData({ ...data, newCaseFee: e.target.value === "" ? undefined : Number(e.target.value) })}
                  />
                </FormField>

                <FormField id="oldCaseFee" label="Consultation Fee - Follow-up / Old Case (₹)">
                  <Input
                    id="oldCaseFee"
                    type="number"
                    min={0}
                    placeholder="e.g. 300"
                    value={data.oldCaseFee ?? ""}
                    onChange={(e) => setData({ ...data, oldCaseFee: e.target.value === "" ? undefined : Number(e.target.value) })}
                  />
                </FormField>
              </div>

              <FormField id="bio" label="About / Clinical Biography">
                <textarea
                  id="bio"
                  rows={4}
                  value={data.bio || ""}
                  onChange={(e) => setData({ ...data, bio: e.target.value })}
                  className="w-full rounded-md border border-slate-300 bg-white p-2.5 text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-[#1a76d1] focus:border-[#1a76d1]"
                  placeholder="Share your clinical background, clinical philosophy, and patient care approach..."
                />
              </FormField>
            </CardContent>
            <CardFooter className="border-t border-slate-100 pt-4">
              <Button
                size="sm"
                disabled={isSaving}
                onClick={() =>
                  handleUpdate({
                    doctorName: data.doctorName,
                    gender: data.gender,
                    email: data.email,
                    whatsApp: data.whatsApp,
                    newCaseFee: data.newCaseFee,
                    oldCaseFee: data.oldCaseFee,
                    bio: data.bio,
                  })
                }
                className="bg-[#1a76d1] hover:bg-[#1560aa] text-white font-semibold text-xs rounded-xl shadow-xs"
              >
                {isSaving ? "Saving..." : "Save Profile Changes"}
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}

      {/* TAB 3: PROFESSIONAL INFO */}
      {activeTab === "professional" && (
        <Card className="bg-white border-slate-200">
          <CardHeader>
            <CardTitle className="text-base font-bold text-slate-900">Professional Credentials</CardTitle>
            <CardDescription className="text-xs">
              Medical qualifications, specializations, and clinical experience.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 max-w-xl">
            <FormField id="degree" label="Degree / Medical Qualifications" required>
              <Input
                id="degree"
                value={data.degree}
                onChange={(e) => setData({ ...data, degree: e.target.value })}
                placeholder="e.g. MBBS, MD, MS"
              />
            </FormField>

            <FormField id="specialization" label="Primary Specialization" required>
              <Input
                id="specialization"
                value={data.specialization}
                onChange={(e) => setData({ ...data, specialization: e.target.value })}
                placeholder="e.g. Cardiology, Neurology, Orthopedics"
              />
            </FormField>

            <FormField id="yearsOfExperience" label="Years of Experience" required>
              <Input
                id="yearsOfExperience"
                type="number"
                min="0"
                max="70"
                placeholder="e.g. 10"
                value={data.yearsOfExperience}
                onChange={(e) => setData({ ...data, yearsOfExperience: parseInt(e.target.value, 10) || 0 })}
              />
            </FormField>

            {/* Read-only Affiliation Notice */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1">
              <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                <Building2 className="h-4 w-4 text-slate-600" />
                Affiliated Department & Hospital
              </div>
              <p className="text-slate-600 text-[11px]">
                Hospital: <strong className="text-slate-900">{parentHospital.organizationName}</strong>
              </p>
              <p className="text-slate-500 text-[11px]">
                Department affiliations and appointments are synchronized under hospital administration.
              </p>
            </div>
          </CardContent>
          <CardFooter className="border-t border-slate-100 pt-4">
            <Button
              size="sm"
              disabled={isSaving}
              onClick={() =>
                handleUpdate({
                  degree: data.degree,
                  specialization: data.specialization,
                  yearsOfExperience: data.yearsOfExperience,
                })
              }
              className="bg-[#1a76d1] hover:bg-[#1560aa] text-white font-semibold text-xs rounded-xl shadow-xs"
            >
              {isSaving ? "Saving..." : "Save Professional Details"}
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* TAB 4: CONSULTATION HOURS */}
      {activeTab === "schedule" && (
        <Card className="bg-white border-slate-200">
          <CardHeader>
            <CardTitle className="text-base font-bold text-slate-900">Consultation Hours & Schedule</CardTitle>
            <CardDescription className="text-xs">
              Configure your weekly consultation schedule, time slots, and closed days using the interactive builder below.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 max-w-2xl">
            <ConsultationHoursBuilder
              value={schedules}
              showCapacityControls={true}
              hospitalWeeklyOff={hospitalOffDays}
              hospitalName={parentHospital?.organizationName}
              onChange={(newSchedules) => {
                setSchedules(newSchedules);
              }}
              onClosedDaysChange={(closedDays) => {
                setData((prev) => ({ ...prev, weeklyOff: closedDays.join(", ") }));
              }}
            />

            <FormField id="appointmentRequired" label="Appointment Required Policy">
              <div className="flex items-center gap-4 pt-1">
                <label className="flex items-center gap-1.5 text-xs font-medium cursor-pointer">
                  <input
                    type="radio"
                    name="appointmentRequired"
                    checked={data.appointmentRequired === true}
                    onChange={() => setData({ ...data, appointmentRequired: true })}
                    className="text-[#1a76d1] focus:ring-[#1a76d1]"
                  />
                  Yes, prior appointment mandatory
                </label>
                <label className="flex items-center gap-1.5 text-xs font-medium cursor-pointer">
                  <input
                    type="radio"
                    name="appointmentRequired"
                    checked={data.appointmentRequired === false}
                    onChange={() => setData({ ...data, appointmentRequired: false })}
                    className="text-[#1a76d1] focus:ring-[#1a76d1]"
                  />
                  No, walk-in consultation allowed
                </label>
              </div>
            </FormField>
          </CardContent>
          <CardFooter className="border-t border-slate-100 pt-4">
            <Button
              size="sm"
              disabled={isSaving}
              onClick={() => {
                if (hospitalOffDays.length > 0) {
                  const lowerOff = hospitalOffDays.map((d) => d.toLowerCase());
                  const violating = schedules.find((s) => !s.isClosed && lowerOff.includes(s.day.toLowerCase()));
                  if (violating) {
                    toast.error(`Cannot save schedule: ${parentHospital?.organizationName || "Hospital"} is closed on ${violating.day}.`);
                    return;
                  }
                }
                const serialized = JSON.stringify(schedules);
                setData((prev) => ({ ...prev, consultationHours: serialized }));
                handleUpdate({
                  consultationHours: serialized,
                  weeklyOff: data.weeklyOff,
                  appointmentRequired: data.appointmentRequired,
                });
              }}
              className="bg-[#1a76d1] hover:bg-[#1560aa] text-white font-semibold text-xs rounded-xl shadow-xs"
            >
              {isSaving ? "Saving..." : "Save Schedule & Policies"}
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* TAB 5: APPOINTMENTS */}
      {activeTab === "appointments" && (
        <div className="space-y-4">
          <LiveOpdQueueCard
            doctorId={data.id}
            refreshTrigger={queueRefreshTick}
            onQueueAdvanced={async () => {
              try {
                const res = await apiClient.get<{ success: boolean; data?: { appointments?: any[] } }>("/appointments");
                if (res?.success && res.data?.appointments) {
                  setAppointments(
                    res.data.appointments.map((a: any) => ({
                      id: a._id || a.id,
                      appointmentId: a.appointmentId || "",
                      tokenNumber: typeof a.tokenNumber === "number" ? a.tokenNumber : undefined,
                      source: a.source || "WEBSITE_FORM",
                      patientName: a.patientName,
                      patientPhone: a.patientPhone,
                      patientAge: a.patientAge,
                      appointmentDate: a.appointmentDate ? (new Date(a.appointmentDate).toISOString().split("T")[0] || "") : "",
                      timeSlot: a.timeSlot || "Regular Consultation",
                      status: a.status,
                      notes: a.notes,
                    }))
                  );
                }
              } catch {
                // Keep existing state
              }
            }}
          />
          <Card className="bg-white border-slate-200">
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base font-bold text-slate-900">Appointments</CardTitle>
                <CardDescription className="text-xs">
                  Direct patient requests from your website booking CTA and walk-in consultations.
                </CardDescription>
              </div>
              <div className="flex items-center gap-2 self-start sm:self-auto">
                <Button
                  type="button"
                  onClick={() => setBookModalOpen(true)}
                  className="bg-[#1a76d1] hover:bg-[#1560aa] text-white text-xs font-semibold h-8.5 px-3 rounded-lg shadow-xs flex items-center gap-1.5 shrink-0"
                >
                  <CalendarPlus className="h-4 w-4" />
                  <span>Book Appointment</span>
                </Button>
                <Badge variant="outline" className="text-xs font-mono">
                  {appointments.length} Appointments
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <DataTable
              columns={appointmentColumns}
              data={appointments}
              searchPlaceholder="Search patient, phone, slot..."
              pageSize={10}
              exportFileName="doctor_appointments"
              emptyMessage="No appointment requests received yet."
            />
          </CardContent>
        </Card>
        </div>
      )}

      {/* Manual Walk-in Appointment Booking Dialog for Hospital Doctor */}
      <Dialog open={bookModalOpen} onOpenChange={setBookModalOpen}>
        <DialogContent className="max-w-md bg-white">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <CalendarPlus className="h-5 w-5 text-[#1a76d1]" />
              <span>Book Walk-in Appointment</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Schedule an in-clinic consultation with Dr. {data.doctorName} at {parentHospital.organizationName}.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleAdminBookDoctorAppointment} className="space-y-3.5 pt-2">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Patient Full Name *</label>
              <Input
                placeholder="e.g. Ramesh Patel"
                value={bookName}
                onChange={(e) => setBookName(e.target.value)}
                required
                className="h-9 text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Patient Age *</label>
                <Input
                  type="number"
                  placeholder="e.g. 35"
                  value={bookAge}
                  onChange={(e) => setBookAge(e.target.value)}
                  min={1}
                  max={120}
                  required
                  className="h-9 text-xs"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Phone Number *</label>
                <Input
                  type="tel"
                  placeholder="10-digit mobile"
                  value={bookPhone}
                  onChange={(e) => setBookPhone(e.target.value)}
                  required
                  className="h-9 text-xs font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Appointment Date *</label>
                <Input
                  type="date"
                  value={bookDate}
                  onChange={(e) => setBookDate(e.target.value)}
                  required
                  className="h-9 text-xs font-mono"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Time Slot *</label>
                <select
                  value={bookSlot}
                  onChange={(e) => setBookSlot(e.target.value)}
                  className="w-full h-9 rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-800 outline-none focus:border-[#1a76d1]"
                >
                  {liveSlots.length > 0 ? (
                    liveSlots.map((sl) => (
                      <option key={sl.slotKey} value={sl.displayLabel} disabled={sl.isFull}>
                        {formatSlotSelectLabel(sl)}
                      </option>
                    ))
                  ) : (
                    <>
                      <option value="Morning (09:00 AM - 01:00 PM)">Morning (09:00 AM - 01:00 PM)</option>
                      <option value="Evening (05:00 PM - 08:00 PM)">Evening (05:00 PM - 08:00 PM)</option>
                      <option value="Regular Consultation">Regular Consultation</option>
                    </>
                  )}
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Reason for Visit / Symptoms *</label>
              <Input
                placeholder="e.g. Follow-up consultation, routine checkup, symptoms"
                value={bookNotes}
                onChange={(e) => setBookNotes(e.target.value)}
                required
                className="h-9 text-xs"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setBookModalOpen(false)}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isBookingSubmitting}
                className="bg-[#1a76d1] hover:bg-[#1560aa] text-white text-xs font-semibold"
              >
                {isBookingSubmitting ? "Booking..." : "Confirm Booking"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* TAB: AI PATIENT CHATS */}
      {activeTab === "aichats" && (
        <AIChatHistoryView
          portalType="HOSPITAL_DOCTOR"
          currentDoctorId={data.id}
        />
      )}

      {/* TAB: AI CONTENT & CLINICAL BIO */}
      {activeTab === "ai" && (
        <div className="max-w-4xl">
          <AIContentPanel
            targetType="HOSPITAL_DOCTOR"
            targetId={data.id}
            practiceName={data.doctorName}
            galleryPhotos={parentHospital.galleryPhotos || []}
            isGalleryInherited={true}
            inheritedHospitalName={parentHospital.organizationName}
            onPublished={() => {
              handleUpdate({});
            }}
          />
        </div>
      )}

      {/* TAB: QR CODE */}
      {activeTab === "qrcode" && (
        <div className="max-w-3xl space-y-4">
          <ClinicQrCard
            title={`Dr. ${data.doctorName}`}
            subtitle={`${data.specialization} • ${parentHospital.organizationName}`}
            pathOrSlug={publicUrl}
            logoUrl={data.doctorPhoto?.url || parentHospital.logo?.url}
          />
        </div>
      )}

      {/* TAB 6: DOCTOR PHOTO */}
      {activeTab === "photo" && (
        <Card className="bg-white border-slate-200 max-w-xl">
          <CardHeader>
            <CardTitle className="text-base font-bold text-slate-900">Doctor Photo</CardTitle>
            <CardDescription className="text-xs">
              Upload or update your professional headshot image shown on your page. Connected to Cloudinary.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <ImageUploader
              label="Doctor Profile Photo"
              category="DOCTOR_PHOTO"
              replaceOnly={true}
              value={data.doctorPhoto}
              onChange={(asset) => {
                if (asset) {
                  setData((prev) => ({ ...prev, doctorPhoto: asset }));
                }
              }}
            />
          </CardContent>
          <CardFooter className="border-t border-slate-100 flex justify-end">
            <Button
              onClick={() => handleUpdate({ doctorPhoto: data.doctorPhoto })}
              disabled={isSaving}
              className="bg-[#1a76d1] hover:bg-[#1560aa] text-white font-semibold rounded-xl shadow-xs"
            >
              <Save className="h-4 w-4 mr-2" /> {isSaving ? "Saving..." : "Save Doctor Photo"}
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* TAB 7: HOSPITAL FACILITY & BRANDING (READ-ONLY VISUAL LOCKED STATE) */}
      {activeTab === "inherited" && (
        <div className="space-y-6">
          {/* Prominent Visual Locked Header */}
          <div className="bg-amber-500/10 border-2 border-amber-400 rounded-xl p-5 text-slate-900 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-amber-400 text-amber-950 flex items-center justify-center font-bold">
                  <Lock className="h-4 w-4" />
                </div>
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-amber-900 block">
                    Hospital Facility & Organization Branding
                  </span>
                  <h3 className="text-base font-extrabold text-slate-950">
                    {parentHospital.organizationName}
                  </h3>
                </div>
              </div>
              <Badge className="bg-amber-500 text-amber-950 font-mono font-bold text-xs px-2.5 py-1 hover:bg-amber-500">
                🔒 Managed by Hospital Admin
              </Badge>
            </div>

            <p className="text-xs text-amber-950/80 leading-relaxed">
              As an affiliated doctor at <strong>{parentHospital.organizationName}</strong>, your website layout,
              theme design, facility address, hospital logo, and gallery are centrally managed by hospital administration.
              Individual doctors do NOT have edit controls for these shared organization assets.
            </p>
          </div>

          {/* Read-Only Grid Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Card 1: Hospital Identity & Theme */}
            <Card className="bg-white border-slate-200">
              <CardHeader className="pb-3 border-b border-slate-100">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-slate-600" />
                    Organization Identity & Theme
                  </CardTitle>
                  <span className="text-[11px] font-medium text-amber-700 flex items-center gap-1">
                    <Lock className="h-3 w-3" /> Locked
                  </span>
                </div>
              </CardHeader>
              <CardContent className="pt-4 space-y-3 text-xs">
                <div>
                  <span className="text-[11px] font-semibold text-slate-400 block uppercase">
                    Hospital Legal Name
                  </span>
                  <p className="text-sm font-bold text-slate-900 mt-0.5">
                    {parentHospital.organizationName}
                  </p>
                </div>

                <div>
                  <span className="text-[11px] font-semibold text-slate-400 block uppercase">
                    Facility Type
                  </span>
                  <Badge variant="secondary" className="mt-1 text-xs">
                    {parentHospital.organizationType}
                  </Badge>
                </div>

                <div>
                  <span className="text-[11px] font-semibold text-slate-400 block uppercase">
                    Active Website Theme
                  </span>
                  <div className="mt-1 p-2 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-slate-900 capitalize block">
                        {parentHospital.selectedTheme.replace("-", " ")}
                      </span>
                      <span className="text-[10px] text-slate-500">
                        Theme is centrally applied to all hospital doctors
                      </span>
                    </div>
                    <Badge variant="outline" className="text-[10px] bg-white text-slate-700">
                      Enforced
                    </Badge>
                  </div>
                </div>

                <div>
                  <span className="text-[11px] font-semibold text-slate-400 block uppercase">
                    Hospital Browser Tab Title & Favicon
                  </span>
                  <p className="text-xs text-slate-700 mt-1 font-medium">
                    {parentHospital.browserTabTitle || `${parentHospital.organizationName} | Healthcare Services`}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Card 2: Hospital Physical Address & Location */}
            <Card className="bg-white border-slate-200">
              <CardHeader className="pb-3 border-b border-slate-100">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Info className="h-4 w-4 text-slate-600" />
                    Physical Location & Facility Address
                  </CardTitle>
                  <span className="text-[11px] font-medium text-amber-700 flex items-center gap-1">
                    <Lock className="h-3 w-3" /> Locked
                  </span>
                </div>
              </CardHeader>
              <CardContent className="pt-4 space-y-3 text-xs">
                <div>
                  <span className="text-[11px] font-semibold text-slate-400 block uppercase">
                    Street Address
                  </span>
                  <p className="text-xs text-slate-800 mt-0.5">
                    {parentHospital.address.street || "Main Medical Campus"}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-[11px] font-semibold text-slate-400 block uppercase">
                      City
                    </span>
                    <p className="text-xs font-semibold text-slate-900 mt-0.5">
                      {parentHospital.address.city}
                    </p>
                  </div>
                  <div>
                    <span className="text-[11px] font-semibold text-slate-400 block uppercase">
                      State
                    </span>
                    <p className="text-xs font-semibold text-slate-900 mt-0.5">
                      {parentHospital.address.state}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-[11px] font-semibold text-slate-400 block uppercase">
                      Pincode
                    </span>
                    <p className="text-xs font-mono text-slate-900 mt-0.5">
                      {parentHospital.address.pincode}
                    </p>
                  </div>
                  <div>
                    <span className="text-[11px] font-semibold text-slate-400 block uppercase">
                      Country
                    </span>
                    <p className="text-xs text-slate-900 mt-0.5">
                      {parentHospital.address.country}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Card 3: Hospital Logo */}
            <Card className="bg-white border-slate-200">
              <CardHeader className="pb-3 border-b border-slate-100">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-bold text-slate-900">
                    Hospital Brand Logo
                  </CardTitle>
                  <span className="text-[11px] font-medium text-amber-700 flex items-center gap-1">
                    <Lock className="h-3 w-3" /> Locked
                  </span>
                </div>
              </CardHeader>
              <CardContent className="pt-4 text-xs">
                {parentHospital.logo?.url ? (
                  <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={parentHospital.logo.url}
                      alt={parentHospital.organizationName}
                      className="max-h-20 max-w-full object-contain"
                    />
                  </div>
                ) : (
                  <div className="p-6 bg-slate-50 text-center text-slate-500 rounded-lg border border-dashed border-slate-300">
                    No hospital logo uploaded by administrator.
                  </div>
                )}
                <p className="text-[11px] text-slate-500 mt-2">
                  This logo renders on your doctor navigation bar and appointment vouchers.
                </p>
              </CardContent>
            </Card>

            {/* Card 4: Hospital Campus Gallery */}
            <Card className="bg-white border-slate-200">
              <CardHeader className="pb-3 border-b border-slate-100">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-bold text-slate-900">
                    Hospital Campus Gallery Photos
                  </CardTitle>
                  <span className="text-[11px] font-medium text-amber-700 flex items-center gap-1">
                    <Lock className="h-3 w-3" /> Locked
                  </span>
                </div>
              </CardHeader>
              <CardContent className="pt-4 text-xs">
                {parentHospital.galleryPhotos && parentHospital.galleryPhotos.length > 0 ? (
                  <div className="grid grid-cols-3 gap-2">
                    {parentHospital.galleryPhotos.map((photo, idx) => (
                      <div key={idx} className="aspect-square bg-slate-100 rounded-lg overflow-hidden border border-slate-200">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={photo.url}
                          alt={`Campus ${idx + 1}`}
                          className="h-full w-full object-cover"
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-6 bg-slate-50 text-center text-slate-500 rounded-lg border border-dashed border-slate-300">
                    No hospital gallery photos uploaded by administrator.
                  </div>
                )}
                <p className="text-[11px] text-slate-500 mt-2">
                  Campus photos are shared across all hospital doctor pages.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* TAB: ADMIN LOGS */}
      {activeTab === "admin-logs" && (
        <AdminLogView
          title="Doctor Admin Login & Session Logs"
          description="Monitor your admin portal login history in IST, device, browser, IP address, active sessions, and logout reason."
        />
      )}

      {/* TAB 8: SETTINGS */}
      {activeTab === "settings" && (
        <AccountSettingsCard
          email={data.email}
          contactEmail={data.email}
          onUpdateContactEmail={async (newContactEmail) => {
            if (onSave) {
              await onSave({ email: newContactEmail });
            } else {
              await apiClient.patch("/doctors/me", { email: newContactEmail });
            }
            setData((prev) => ({ ...prev, email: newContactEmail }));
          }}
          roleTitle="Hospital Doctor Account"
          slug={`${parentHospital.organizationSlug}/${data.slug}`}
          publishStatus="PUBLISHED"
        />
      )}

      {/* Delete Appointment Confirmation Modal */}
      <Dialog
        open={!!deleteApptId}
        onOpenChange={(open) => {
          if (!open && !isDeletingAppt) {
            setDeleteApptId(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-md bg-white border border-slate-200 shadow-2xl rounded-2xl p-6">
          <DialogHeader className="space-y-3">
            <div className="mx-auto sm:mx-0 flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 text-rose-600 ring-8 ring-rose-50">
              <Trash2 className="h-6 w-6" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-slate-900">
                Delete Appointment
              </DialogTitle>
              <DialogDescription className="text-sm text-slate-600 mt-1">
                Are you sure you want to permanently delete this appointment from the database? This action cannot be undone.
              </DialogDescription>
            </div>
          </DialogHeader>

          <DialogFooter className="flex flex-row justify-end gap-2.5 mt-4">
            <Button
              type="button"
              variant="outline"
              disabled={isDeletingAppt}
              onClick={() => setDeleteApptId(null)}
              className="text-slate-700 hover:bg-slate-100 text-xs h-9 px-4 rounded-lg font-medium"
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={isDeletingAppt}
              onClick={confirmDeleteAppointment}
              className="bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs h-9 px-4 rounded-lg shadow-sm"
            >
              {isDeletingAppt ? "Deleting..." : "Delete Appointment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}
