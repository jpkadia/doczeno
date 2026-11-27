import * as React from "react";
import Link from "next/link";
import {
  LayoutDashboard,
  User,
  Building2,
  Clock,
  CalendarCheck,
  Palette,
  Settings,
  Trash2,
  CheckCircle,
  QrCode,
  MessageSquare,
  Globe,
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
import { ThemeColorSelector } from "@/components/forms/theme-color-selector";
import { ConsultationHoursBuilder, DEFAULT_WEEK_SCHEDULE, DaySchedule } from "@/components/forms/consultation-hours-builder";
import { MediaAsset } from "@/types";
import { apiClient } from "@/lib/api-client";
import { AccountSettingsCard } from "../account-settings-card";
import { AdminLogView } from "../admin-log-view";
import { toast } from "sonner";

export interface OnlyDoctorData {
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
  clinicName?: string;
  address?: {
    street?: string;
    city: string;
    state: string;
    pincode: string;
    country: string;
  };
  clinicLogo?: MediaAsset;
  clinicPhotos?: MediaAsset[];
  galleryPhotos?: MediaAsset[];
  tagline?: string;
  shortIntro?: string;
  services?: { title: string; description: string }[];
  faqs?: { question: string; answer: string }[];
  consultationHours?: string;
  weeklyOff?: string;
  appointmentRequired?: boolean;
  selectedTheme?: string;
  faviconUrl?: string;
  browserTabTitle?: string;
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
    // If not json, use default
  }
  return DEFAULT_WEEK_SCHEDULE;
}

export interface AppointmentItem {
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

interface OnlyDoctorAdminProps {
  initialData: OnlyDoctorData;
  initialAppointments?: AppointmentItem[];
  onSave?: (updatedData: Partial<OnlyDoctorData>) => Promise<void>;
  onUpdateAppointmentStatus?: (appointmentId: string, status: string) => Promise<void>;
  onLogout?: () => void;
}

export function OnlyDoctorAdmin({
  initialData,
  initialAppointments = [],
  onSave,
  onUpdateAppointmentStatus,
  onLogout,
}: OnlyDoctorAdminProps) {
  const [activeTab, setActiveTab] = React.useState("dashboard");
  const [data, setData] = React.useState<OnlyDoctorData>(initialData);
  const [appointments, setAppointments] = React.useState<AppointmentItem[]>(initialAppointments);
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

  const navItems: NavItem[] = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "profile", label: "Doctor Profile", icon: User },
    { id: "clinic", label: "Clinic & Address", icon: Building2 },
    { id: "schedule", label: "Consultation Hours", icon: Clock },
    { id: "appointments", label: "Appointments", icon: CalendarCheck, badge: String(appointments.length) },
    { id: "aichats", label: "AI Patient Chats", icon: MessageSquare },
    { id: "ai", label: "Live Website Content", icon: Globe },
    { id: "qrcode", label: "Clinic QR Code", icon: QrCode },
    { id: "branding", label: "Branding & SEO", icon: Palette },
    { id: "admin-logs", label: "Admin Log", icon: ShieldCheck },
    { id: "settings", label: "Account Settings", icon: Settings },
  ];

  const handleUpdate = async (field: Partial<OnlyDoctorData>) => {
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

  const handleUpdateSlug = async () => {
    const clean = slugValue.trim().toLowerCase().replace(/^-+|-+$/g, "");
    if (!clean || clean === data.slug) return;
    setIsSavingSlug(true);
    try {
      const res = await apiClient.patch<{ success: boolean; message?: string }>("/doctors/me", { slug: clean });
      if (res.success) {
        toast.success("Website URL slug updated successfully! Redirecting to your new admin portal...");
        setTimeout(() => {
          const isCustomDomain =
            typeof window !== "undefined" &&
            (window.location.pathname === "/admin" || window.location.pathname.startsWith("/admin/"));
          window.location.replace(isCustomDomain ? "/admin" : `/${clean}/admin`);
        }, 1200);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update URL slug";
      toast.error(msg);
      setIsSavingSlug(false);
    }
  };

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
      toast.success(
        `Appointment status updated to ${
          status === "PATIENT_NOT_COME" ? "Patient Not Come" : status
        }`
      );
      if (onUpdateAppointmentStatus) {
        await onUpdateAppointmentStatus(appointmentId, status);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update status";
      toast.error(msg);
    }
  };

  const [queueRefreshTick, setQueueRefreshTick] = React.useState(0);
  const [liveSlots, setLiveSlots] = React.useState<LiveSlotOption[]>([]);
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

  // State & Handler for Manual Appointment Booking from Slug Admin
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
    fetchDoctorLiveSlots({ doctorId: data.id, date: bookDate }).then((res) => {
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
  }, [bookModalOpen, data.id, bookDate]);

  const handleAdminBookAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookName.trim() || !bookPhone.trim() || !bookDate) {
      toast.error("Please fill in patient name, phone number, and date.");
      return;
    }
    setIsBookingSubmitting(true);
    try {
      const res: any = await apiClient.post("/appointments", {
        doctorId: data.id,
        patientName: bookName.trim(),
        patientAge: Number(bookAge) || 30,
        patientPhone: bookPhone.trim(),
        appointmentDate: new Date(bookDate),
        timeSlot: bookSlot,
        notes: bookNotes.trim() || "Walk-in consultation",
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
            notes: bookNotes.trim() || "Walk-in consultation",
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

  const appointmentColumns = React.useMemo<ColumnDef<AppointmentItem>[]>(
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
        header: "Patient Name",
        cell: (appt) => (
          <div>
            <span className="font-semibold text-slate-900 block text-xs">{appt.patientName}</span>
            {appt.notes && (
              <span className="text-[11px] text-slate-500 block truncate max-w-xs">{appt.notes}</span>
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
        cell: (appt) => <span className="font-mono text-xs text-slate-600">{appt.patientPhone}</span>,
      },
      {
        key: "dateAndSlot",
        header: "Date & Slot",
        accessorFn: (appt) => `${appt.appointmentDate?.split("T")[0] || ""} ${appt.timeSlot}`,
        cell: (appt) => (
          <div className="text-xs">
            <span className="font-medium text-slate-800 block">
              {appt.appointmentDate ? appt.appointmentDate.split("T")[0] : "—"}
            </span>
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
              variant={
                status === "COMPLETED"
                  ? "success"
                  : status === "PATIENT_NOT_COME"
                  ? "destructive"
                  : status === "PENDING"
                  ? "warning"
                  : status === "CONFIRMED"
                  ? "outline"
                  : "secondary"
              }
              className="text-[10px]"
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
              <span className="inline-flex items-center text-[10px] text-rose-600 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded font-medium mr-1">
                Cancelled
              </span>
            ) : (
              <>
                {appt.status !== "COMPLETED" && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 px-2 text-[11px] text-[#1560aa] hover:bg-blue-50 border-blue-200"
                    onClick={() => handleStatusChange(appt.id, "COMPLETED")}
                  >
                    Completed
                  </Button>
                )}
                {appt.status !== "PATIENT_NOT_COME" && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 px-2 text-[11px] text-amber-700 hover:bg-amber-50"
                    onClick={() => handleStatusChange(appt.id, "PATIENT_NOT_COME")}
                  >
                    Not Come
                  </Button>
                )}
                {appt.status !== "COMPLETED" && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 px-2 text-[11px] text-rose-700 border-rose-200 hover:bg-rose-50"
                    onClick={() => {
                      if (window.confirm("Cancel this appointment? Slot capacity will open up for other patients.")) {
                        handleStatusChange(appt.id, "CANCELLED");
                      }
                    }}
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
              className="h-7 px-2 text-[11px] text-rose-600 hover:bg-rose-50 hover:text-rose-700"
              onClick={() => setDeleteApptId(appt.id)}
              title="Permanently delete from database"
            >
              <Trash2 className="h-3.5 w-3.5 mr-1" />
              Delete
            </Button>
          </div>
        ),
      },
    ],
    []
  );

  return (
    <AdminShell
      title={`Dr. ${data.doctorName} — Administration`}
      subtitle={data.clinicName || "Doctor Clinic"}
      roleBadge="Only Doctor"
      publicWebsiteUrl={`/${data.slug}`}
      logoUrl={data.clinicLogo?.url || data.doctorPhoto?.url}
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
          <Badge variant="outline" className="text-[10px] bg-white text-[#1560aa] border-blue-300">Synchronized</Badge>
        </div>
      )}

      {/* TAB 1: DASHBOARD */}
      {activeTab === "dashboard" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="bg-white border-blue-100 rounded-2xl shadow-xs">
              <CardHeader className="p-4 pb-2">
                <CardDescription className="text-xs">Website Status</CardDescription>
                <CardTitle className="text-xl font-bold flex items-center gap-2 text-slate-900">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#1a76d1] animate-pulse" />
                  {data.publishStatus || "PUBLISHED"}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0 text-xs text-slate-500">
                Live at <Link href={`/${data.slug}`} className="font-mono text-[#1a76d1] font-semibold underline">/{data.slug}</Link>
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
            <CardContent className="p-0 sm:p-6">
              {appointments.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-500">
                  No appointment requests received yet.
                </div>
              ) : (
                <div className="overflow-x-auto w-full">
                  <Table className="min-w-[620px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Patient</TableHead>
                        <TableHead>Age</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead>Requested Time</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {appointments.slice(0, 5).map((appt) => (
                        <TableRow key={appt.id}>
                          <TableCell className="font-semibold text-slate-900">{appt.patientName}</TableCell>
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
                                    className="h-7 text-xs text-amber-700 hover:bg-amber-50 border-amber-200"
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
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* TAB 2: PROFILE */}
      {activeTab === "profile" && (
        <Card className="bg-white border-slate-200 max-w-3xl">
          <CardHeader>
            <CardTitle className="text-base font-bold">Doctor Identity & Credentials</CardTitle>
            <CardDescription className="text-xs">Update your professional information displayed on your public medical site.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField id="doctorName" label="Doctor Name (Dr. prefix displayed automatically)">
                <div className="flex">
                  <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-slate-300 bg-slate-100 text-slate-600 text-sm font-semibold">
                    Dr.
                  </span>
                  <Input
                    id="doctorName"
                    value={data.doctorName}
                    onChange={(e) => setData({ ...data, doctorName: e.target.value })}
                    className="rounded-l-none"
                  />
                </div>
              </FormField>

              <FormField id="specialization" label="Specialization">
                <Input
                  id="specialization"
                  value={data.specialization}
                  onChange={(e) => setData({ ...data, specialization: e.target.value })}
                />
              </FormField>

              <FormField id="degree" label="Degrees & Qualifications">
                <Input
                  id="degree"
                  value={data.degree}
                  onChange={(e) => setData({ ...data, degree: e.target.value })}
                />
              </FormField>

              <FormField id="yearsOfExperience" label="Years of Clinical Experience">
                <Input
                  id="yearsOfExperience"
                  type="number"
                  placeholder="e.g. 10"
                  value={data.yearsOfExperience}
                  onChange={(e) => setData({ ...data, yearsOfExperience: Number(e.target.value) })}
                />
              </FormField>

              <FormField id="newCaseFee" label="Consultation Fee - New Patient / New Case (₹)">
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

              <FormField id="whatsApp" label="WhatsApp Number">
                <PhoneInput
                  id="whatsApp"
                  value={data.whatsApp || ""}
                  onChange={(val) => setData({ ...data, whatsApp: val })}
                />
              </FormField>

              <FormField id="email" label="Public Inquiries & Contact Email">
                <Input
                  id="email"
                  type="email"
                  value={data.email || ""}
                  onChange={(e) => setData({ ...data, email: e.target.value })}
                  placeholder="contact@doctorclinic.com"
                />
              </FormField>

              <div className="col-span-1 sm:col-span-2 pt-2">
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
              </div>
            </div>

            <FormField id="bio" label="Clinical Biography / About You">
              <textarea
                id="bio"
                rows={4}
                value={data.bio || ""}
                onChange={(e) => setData({ ...data, bio: e.target.value })}
                className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </FormField>
          </CardContent>
          <CardFooter className="border-t border-slate-100 flex justify-end">
            <Button
              onClick={() =>
                handleUpdate({
                  doctorName: data.doctorName,
                  specialization: data.specialization,
                  degree: data.degree,
                  yearsOfExperience: data.yearsOfExperience,
                  newCaseFee: data.newCaseFee,
                  oldCaseFee: data.oldCaseFee,
                  whatsApp: data.whatsApp,
                  email: data.email,
                  doctorPhoto: data.doctorPhoto,
                  bio: data.bio,
                })
              }
              disabled={isSaving}
              className="bg-[#1a76d1] hover:bg-[#1560aa] text-white font-semibold rounded-xl shadow-xs"
            >
              {isSaving ? "Saving..." : "Save Profile"}
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* TAB 3: CLINIC & ADDRESS */}
      {activeTab === "clinic" && (
        <Card className="bg-white border-slate-200 max-w-3xl">
          <CardHeader>
            <CardTitle className="text-base font-bold">Clinic Information & Location</CardTitle>
            <CardDescription className="text-xs">Location and facility branding for your clinic.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField id="clinicName" label="Clinic Name">
              <Input
                id="clinicName"
                value={data.clinicName || ""}
                onChange={(e) => setData({ ...data, clinicName: e.target.value })}
              />
            </FormField>

            <div className="pt-1">
              <ImageUploader
                label="Clinic Brand Logo"
                category="CLINIC_LOGO"
                value={data.clinicLogo}
                onChange={(asset) => {
                  setData((prev) => ({ ...prev, clinicLogo: asset }));
                }}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField id="street" label="Street / Landmark">
                <Input
                  id="street"
                  value={data.address?.street || ""}
                  onChange={(e) =>
                    setData({
                      ...data,
                      address: {
                        street: e.target.value,
                        city: data.address?.city || "",
                        state: data.address?.state || "",
                        pincode: data.address?.pincode || "",
                        country: data.address?.country || "India",
                      },
                    })
                  }
                />
              </FormField>

              <FormField id="city" label="City">
                <Input
                  id="city"
                  value={data.address?.city || ""}
                  onChange={(e) =>
                    setData({
                      ...data,
                      address: {
                        street: data.address?.street || "",
                        city: e.target.value,
                        state: data.address?.state || "",
                        pincode: data.address?.pincode || "",
                        country: data.address?.country || "India",
                      },
                    })
                  }
                />
              </FormField>

              <FormField id="state" label="State">
                <Input
                  id="state"
                  value={data.address?.state || ""}
                  onChange={(e) =>
                    setData({
                      ...data,
                      address: {
                        street: data.address?.street || "",
                        city: data.address?.city || "",
                        state: e.target.value,
                        pincode: data.address?.pincode || "",
                        country: data.address?.country || "India",
                      },
                    })
                  }
                />
              </FormField>

              <FormField id="pincode" label="Pincode">
                <Input
                  id="pincode"
                  value={data.address?.pincode || ""}
                  placeholder="Enter PIN code"
                  onChange={(e) =>
                    setData({
                      ...data,
                      address: {
                        street: data.address?.street || "",
                        city: data.address?.city || "",
                        state: data.address?.state || "",
                        pincode: e.target.value,
                        country: data.address?.country || "India",
                      },
                    })
                  }
                />
              </FormField>
            </div>
          </CardContent>
          <CardFooter className="border-t border-slate-100 flex justify-end">
            <Button
              onClick={() =>
                handleUpdate({
                  clinicName: data.clinicName,
                  clinicLogo: data.clinicLogo,
                  address: data.address,
                })
              }
              disabled={isSaving}
              className="bg-[#1a76d1] hover:bg-[#1560aa] text-white font-semibold rounded-xl shadow-xs"
            >
              {isSaving ? "Saving..." : "Save Clinic Info"}
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* TAB 4: SCHEDULE */}
      {activeTab === "schedule" && (
        <Card className="bg-white border-slate-200 max-w-3xl">
          <CardHeader>
            <CardTitle className="text-base font-bold">Consultation Timings & Weekly Off</CardTitle>
            <CardDescription className="text-xs">
              Configure your weekly consultation schedule, time slots, and closed days using the interactive builder below.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <ConsultationHoursBuilder
              value={schedules}
              showCapacityControls={true}
              onChange={(newSchedules) => {
                setSchedules(newSchedules);
              }}
              onClosedDaysChange={(closedDays) => {
                setData((prev) => ({ ...prev, weeklyOff: closedDays.join(", ") }));
              }}
            />

            <div className="flex items-center gap-3 pt-2 border-t border-slate-100">
              <input
                type="checkbox"
                id="appointmentRequired"
                checked={data.appointmentRequired ?? true}
                onChange={(e) => setData({ ...data, appointmentRequired: e.target.checked })}
                className="h-4 w-4 rounded border-slate-300 text-slate-900"
              />
              <label htmlFor="appointmentRequired" className="text-xs font-medium text-slate-700 cursor-pointer">
                Prior Appointment Required (displays appointment CTA and badge on public site)
              </label>
            </div>
          </CardContent>
          <CardFooter className="border-t border-slate-100 flex justify-end">
            <Button
              onClick={() => {
                const serialized = JSON.stringify(schedules);
                setData((prev) => ({ ...prev, consultationHours: serialized }));
                handleUpdate({
                  weeklyOff: data.weeklyOff,
                  consultationHours: serialized,
                  appointmentRequired: data.appointmentRequired,
                });
              }}
              disabled={isSaving}
              className="bg-[#1a76d1] hover:bg-[#1560aa] text-white font-semibold rounded-xl shadow-xs"
            >
              {isSaving ? "Saving..." : "Save Schedule Settings"}
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* TAB 5: APPOINTMENTS (DATA TABLE) */}
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
          <CardHeader className="border-b border-slate-100 pb-4 flex flex-row items-center justify-between gap-4">
            <div>
              <CardTitle className="text-base font-bold">Patient Appointments & Booking Requests</CardTitle>
              <CardDescription className="text-xs">Manage patient consultation requests and update their confirmation status.</CardDescription>
            </div>
            <Button
              type="button"
              onClick={() => setBookModalOpen(true)}
              className="bg-[#1a76d1] hover:bg-[#1560aa] text-white text-xs font-semibold h-8.5 px-3 rounded-lg shadow-xs flex items-center gap-1.5 shrink-0"
            >
              <CalendarPlus className="h-4 w-4" />
              <span>Book Appointment</span>
            </Button>
          </CardHeader>
          <CardContent className="p-6">
            <DataTable
              columns={appointmentColumns}
              data={appointments}
              searchPlaceholder="Search patient name, phone, slot..."
              pageSize={10}
              exportFileName="clinic_appointments"
              emptyMessage="No appointment records found."
            />
          </CardContent>
        </Card>
        </div>
      )}

      {/* Manual Walk-in Appointment Booking Dialog */}
      <Dialog open={bookModalOpen} onOpenChange={setBookModalOpen}>
        <DialogContent className="max-w-md bg-white">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <CalendarPlus className="h-5 w-5 text-[#1a76d1]" />
              <span>Book Manual / Walk-in Appointment</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Schedule an in-clinic consultation for Dr. {data.doctorName}.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleAdminBookAppointment} className="space-y-3.5 pt-2">
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
                placeholder="e.g. Routine consultation, fever, follow-up"
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
          portalType="ONLY_DOCTOR"
          currentDoctorId={data.id}
        />
      )}

      {/* TAB 7: AI CONTENT */}
      {activeTab === "ai" && (
        <div className="max-w-4xl">
          <AIContentPanel
            targetType="ONLY_DOCTOR"
            targetId={data.id}
            practiceName={data.doctorName}
            galleryPhotos={data.clinicPhotos || []}
            onGalleryChange={(assets) => {
              setData((prev) => ({ ...prev, clinicPhotos: assets }));
              handleUpdate({ clinicPhotos: assets });
            }}
            onPublished={() => {
              // Refresh doctor data after publishing
              handleUpdate({});
            }}
          />
        </div>
      )}

      {/* TAB: QR CODE & CLINIC SHARING */}
      {activeTab === "qrcode" && (
        <div className="max-w-3xl space-y-4">
          <ClinicQrCard
            title={`Dr. ${data.doctorName}`}
            subtitle={data.specialization ? `${data.specialization} • ${data.clinicName || "Clinic"}` : data.clinicName}
            pathOrSlug={`/${data.slug}`}
            logoUrl={data.clinicLogo?.url || data.doctorPhoto?.url}
          />
        </div>
      )}

      {/* TAB 8: BRANDING & SEO */}
      {(activeTab === "branding" || activeTab === "seo") && (
        <div className="space-y-6 max-w-3xl">
          {/* Custom URL Slug Card */}
          <Card className="bg-white border-slate-200">
            <CardHeader>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Globe className="h-4 w-4 text-[#1a76d1]" />
                Website URL Slug (Handle)
              </CardTitle>
              <CardDescription className="text-xs">
                Customize your public website link address (similar to an Instagram username). Modifying this immediately updates your live public website URL.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <SlugInput
                id="doctorSlug"
                label="Public Website Address"
                value={slugValue}
                onChange={setSlugValue}
                type="ONLY_DOCTOR"
                excludeId={data.id}
                placeholder="Enter new website slug (e.g. dr-priya-sharma)"
                hint={
                  slugValue
                    ? `Your new website address will be: /${slugValue}`
                    : "Only lowercase alphanumeric characters and single hyphens. Enter a new slug to change your URL."
                }
                required={false}
              />
            </CardContent>
            <CardFooter className="flex justify-between items-center border-t border-slate-100 pt-4">
              <span className="text-xs text-slate-500">
                Current URL: <code className="bg-slate-100 text-slate-800 font-semibold px-1.5 py-0.5 rounded">/{data.slug}</code>
              </span>
              <Button
                onClick={handleUpdateSlug}
                disabled={isSavingSlug || !slugValue.trim() || slugValue.trim() === data.slug}
                className="bg-[#1a76d1] hover:bg-[#1560aa] text-white font-semibold text-xs rounded-xl shadow-xs"
              >
                {isSavingSlug ? "Updating Slug..." : "Save Website Slug"}
              </Button>
            </CardFooter>
          </Card>

          <Card className="bg-white border-slate-200">
            <CardHeader>
              <CardTitle className="text-base font-bold">Clinic Branding & Colors</CardTitle>
              <CardDescription className="text-xs">
                Customize browser tab title, favicon, and branding theme for your public website.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <FormField id="browserTabTitle" label="Browser Tab Title">
                  <Input
                    id="browserTabTitle"
                    value={data.browserTabTitle || ""}
                    onChange={(e) => setData({ ...data, browserTabTitle: e.target.value })}
                    placeholder="Doctor / Clinic Name — Specialty"
                  />
                </FormField>

                <div className="pt-2">
                  <ImageUploader
                    label="Browser Tab Favicon (.png / .ico)"
                    category="CLINIC_LOGO"
                    value={data.faviconUrl ? { url: data.faviconUrl } : undefined}
                    onChange={(asset) => {
                      const url = asset?.url || "";
                      setData((prev) => ({ ...prev, faviconUrl: url }));
                    }}
                    enableCrop={false}
                  />
                </div>

                <div className="pt-4 border-t border-slate-100">
                  <ThemeColorSelector
                    value={data.selectedTheme || "blue"}
                    onChange={(themeId) => {
                      setData((prev) => ({ ...prev, selectedTheme: themeId }));
                    }}
                  />
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex justify-between items-center border-t border-slate-100 pt-4">
              <span className="text-xs text-slate-500">
                {saveSuccess ? (
                  <span className="text-[#1a76d1] font-semibold flex items-center gap-1">
                    <CheckCircle className="h-3.5 w-3.5" /> Saved successfully
                  </span>
                ) : (
                  "Branding changes reflect instantly on your public website"
                )}
              </span>
              <Button
                onClick={() =>
                  handleUpdate({
                    selectedTheme: data.selectedTheme || "blue",
                    browserTabTitle: data.browserTabTitle,
                    faviconUrl: data.faviconUrl,
                  })
                }
                disabled={isSaving}
                className="bg-[#1a76d1] hover:bg-[#1560aa] text-white font-semibold rounded-xl shadow-xs"
              >
                {isSaving ? "Saving..." : "Save Branding"}
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}

      {/* TAB: ADMIN LOGS */}
      {activeTab === "admin-logs" && (
        <AdminLogView
          title="Doctor Admin Login & Session Logs"
          description="Monitor your admin portal login history in IST, device, browser, IP address, active sessions, and logout reason."
        />
      )}

      {/* TAB 9: SETTINGS */}
      {activeTab === "settings" && (
        <AccountSettingsCard
          email={data.email}
          contactEmail={data.email}
          onUpdateContactEmail={async (newContactEmail) => {
            await handleUpdate({ email: newContactEmail });
            setData((prev) => ({ ...prev, email: newContactEmail }));
          }}
          roleTitle="Only Doctor Account"
          slug={data.slug}
          publishStatus={data.publishStatus || "PUBLISHED"}
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
