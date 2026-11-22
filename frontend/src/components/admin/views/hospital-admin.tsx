import * as React from "react";
import Link from "next/link";
import {
  LayoutDashboard,
  Building2,
  MapPin,
  Clock,
  Users,
  CalendarCheck,
  Image as ImageIcon,
  Palette,
  Settings,
  Plus,
  Trash2,
  CheckCircle,
  Stethoscope,
  QrCode,
  MessageSquare,
  MessageSquareQuote,
  Globe,
  ExternalLink,
  Edit3,
  FileText,
  AlertTriangle,
} from "lucide-react";
import { AdminShell, NavItem } from "../admin-shell";
import { ClinicQrCard } from "../clinic-qr-dialog";
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { DataTable, ColumnDef } from "@/components/ui/data-table";
import { FormField } from "@/components/forms/form-field";
import { PhoneInput } from "@/components/ui/phone-input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { AIContentPanel } from "../ai-content-panel";
import { AIChatHistoryView } from "../ai-chat-history-view";
import { TestimonialsManagementView } from "./testimonials-management-view";
import { ImageUploader } from "@/components/forms/image-uploader";
import { GalleryUploader } from "@/components/forms/gallery-uploader";
import { SlugInput } from "@/components/forms/slug-input";
import { ThemeColorSelector } from "@/components/forms/theme-color-selector";
import { AccountSettingsCard } from "../account-settings-card";
import { MediaAsset } from "@/types";
import { apiClient } from "@/lib/api-client";
import { toast } from "sonner";

export interface HospitalDoctorItem {
  id: string;
  doctorName: string;
  slug: string;
  gender: string;
  degree: string;
  specialization: string;
  yearsOfExperience: number;
  newCaseFee?: number;
  oldCaseFee?: number;
  whatsApp?: string;
  email: string;
  doctorPhoto?: MediaAsset;
  status: "ACTIVE" | "INACTIVE";
  consultationHours?: string;
  weeklyOff?: string;
  appointmentRequired?: boolean;
}

export interface HospitalData {
  id: string;
  name: string;
  slug: string;
  type: "HOSPITAL" | "CLINIC";
  about?: string;
  phone: string;
  whatsApp?: string;
  email: string;
  address: {
    street?: string;
    city: string;
    state: string;
    pincode: string;
    country: string;
  };
  workingHours?: string;
  weeklyOff?: string;
  appointmentRequired?: boolean;
  selectedTheme: string;
  logo?: MediaAsset;
  buildingPhoto?: MediaAsset;
  galleryPhotos?: MediaAsset[];
  faviconUrl?: string;
  browserTabTitle?: string;
  departments?: string[];
  departmentsDetailed?: Array<{ name: string; description: string }>;
  tagline?: string;
  hospitalIntro?: string;
  services?: Array<{ title: string; description: string }>;
  faqs?: Array<{ question: string; answer: string }>;
  publishStatus?: "PUBLISHED" | "DRAFT";
}

export interface AppointmentItem {
  id: string;
  patientName: string;
  patientAge?: number;
  patientPhone: string;
  appointmentDate: string;
  timeSlot: string;
  status: "PENDING" | "CONFIRMED" | "CANCELLED" | "COMPLETED" | "PATIENT_NOT_COME";
  notes?: string;
  doctorName?: string;
}

export type HospitalAppointmentItem = AppointmentItem;

interface HospitalAdminProps {
  initialHospital: HospitalData;
  initialDoctors?: HospitalDoctorItem[];
  initialAppointments?: AppointmentItem[];
  onSaveHospital?: (updated: Partial<HospitalData>) => Promise<void>;
  onAddDoctor?: (doctorData: Partial<HospitalDoctorItem>) => Promise<void>;
  onUpdateDoctor?: (id: string, updated: Partial<HospitalDoctorItem>) => Promise<void>;
  onToggleDoctorStatus?: (id: string, newStatus: "ACTIVE" | "INACTIVE") => Promise<void>;
  onUpdateAppointmentStatus?: (id: string, status: string) => Promise<void>;
  onLogout?: () => void;
}

export function HospitalAdmin({
  initialHospital,
  initialDoctors = [],
  initialAppointments = [],
  onSaveHospital,
  onAddDoctor,
  onUpdateDoctor,
  onToggleDoctorStatus,
  onUpdateAppointmentStatus,
  onLogout,
}: HospitalAdminProps) {
  // Suppress unused param if not referenced yet
  void onUpdateDoctor;
  const [activeTab, setActiveTab] = React.useState("dashboard");
  const [hospital, setHospital] = React.useState<HospitalData>(initialHospital);
  const [doctors, setDoctors] = React.useState<HospitalDoctorItem[]>(initialDoctors);
  const [appointments, setAppointments] = React.useState<AppointmentItem[]>(initialAppointments);
  const [isSaving, setIsSaving] = React.useState(false);
  const [saveSuccess, setSaveSuccess] = React.useState(false);

  const [hospitalSlugValue, setHospitalSlugValue] = React.useState("");
  const [isSavingHospitalSlug, setIsSavingHospitalSlug] = React.useState(false);

  const [editingDoctor, setEditingDoctor] = React.useState<HospitalDoctorItem | null>(null);
  const [editDoctorForm, setEditDoctorForm] = React.useState<Partial<HospitalDoctorItem>>({});
  const [isUpdatingDoctor, setIsUpdatingDoctor] = React.useState(false);

  const [deletingDoctor, setDeletingDoctor] = React.useState<HospitalDoctorItem | null>(null);
  const [isDeletingDoctor, setIsDeletingDoctor] = React.useState(false);

  const [aiTargetDocId, setAiTargetDocId] = React.useState<string | null>(null);

  const handleStartEditDoctor = (doc: HospitalDoctorItem) => {
    setEditingDoctor(doc);
    setEditDoctorForm({
      doctorName: doc.doctorName,
      slug: doc.slug,
      degree: doc.degree,
      specialization: doc.specialization,
      yearsOfExperience: doc.yearsOfExperience,
      email: doc.email,
      whatsApp: doc.whatsApp || "",
      consultationHours: doc.consultationHours || "",
      weeklyOff: doc.weeklyOff || "",
      newCaseFee: doc.newCaseFee,
      oldCaseFee: doc.oldCaseFee,
      doctorPhoto: doc.doctorPhoto,
    });
  };

  const handleUpdateHospitalSlug = async () => {
    const clean = hospitalSlugValue.trim().toLowerCase().replace(/^-+|-+$/g, "");
    if (!clean || clean === hospital.slug) return;
    setIsSavingHospitalSlug(true);
    try {
      const res = await apiClient.patch<{ success: boolean; message?: string }>("/organizations/me", { slug: clean });
      if (res.success) {
        toast.success("Hospital website URL slug updated successfully! Redirecting to new portal...");
        setTimeout(() => {
          window.location.replace(`/${clean}/admin`);
        }, 1200);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update hospital URL slug";
      toast.error(msg);
      setIsSavingHospitalSlug(false);
    }
  };

  const handleSaveEditedDoctor = async () => {
    if (!editingDoctor) return;
    setIsUpdatingDoctor(true);
    try {
      await apiClient.put(`/doctors/${editingDoctor.id}`, editDoctorForm);
      setDoctors((prev) =>
        prev.map((d) => (d.id === editingDoctor.id ? { ...d, ...editDoctorForm } : d))
      );
      toast.success(`Dr. ${editDoctorForm.doctorName || editingDoctor.doctorName} profile updated successfully.`);
      if (onUpdateDoctor) {
        await onUpdateDoctor(editingDoctor.id, editDoctorForm);
      }
      setEditingDoctor(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update doctor profile";
      toast.error(msg);
    } finally {
      setIsUpdatingDoctor(false);
    }
  };

  const handleConfirmDeleteDoctor = async () => {
    if (!deletingDoctor) return;
    setIsDeletingDoctor(true);
    try {
      await apiClient.delete(`/doctors/${deletingDoctor.id}?permanent=true`);
      setDoctors((prev) => prev.filter((d) => d.id !== deletingDoctor.id));
      if (aiTargetDocId === deletingDoctor.id) {
        setAiTargetDocId(null);
      }
      toast.success(`Dr. ${deletingDoctor.doctorName} and affiliated website have been permanently deleted.`);
      setDeletingDoctor(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to permanently delete doctor";
      toast.error(msg);
    } finally {
      setIsDeletingDoctor(false);
    }
  };

  React.useEffect(() => {
    setAppointments(initialAppointments);
  }, [initialAppointments]);

  React.useEffect(() => {
    setDoctors(initialDoctors);
  }, [initialDoctors]);

  React.useEffect(() => {
    setHospital(initialHospital);
  }, [initialHospital]);

  const handleApptStatusChange = async (id: string, status: string) => {
    try {
      await apiClient.patch(`/appointments/${id}/status`, { status });
      setAppointments((prev) =>
        prev.map((a) => (a.id === id ? { ...a, status: status as AppointmentItem["status"] } : a))
      );
      toast.success(`Appointment status updated to ${status === "PATIENT_NOT_COME" ? "Patient Not Come" : status}`);
      if (onUpdateAppointmentStatus) {
        await onUpdateAppointmentStatus(id, status);
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
      toast.success("Appointment permanently deleted from database");
      setDeleteApptId(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to delete appointment";
      toast.error(msg);
    } finally {
      setIsDeletingAppt(false);
    }
  };

  const doctorColumns = React.useMemo<ColumnDef<HospitalDoctorItem>[]>(
    () => [
      {
        key: "doctorName",
        header: "Doctor",
        cell: (doc) => (
          <div>
            <div className="font-bold text-slate-900 text-xs">Dr. {doc.doctorName}</div>
            <div className="text-[11px] text-slate-500 font-mono">/{hospital.slug}/{doc.slug}</div>
          </div>
        ),
      },
      {
        key: "specialization",
        header: "Specialization",
        cell: (doc) => <span className="text-xs text-slate-700">{doc.specialization}</span>,
      },
      {
        key: "degree",
        header: "Qualifications",
        cell: (doc) => <span className="text-xs text-slate-600">{doc.degree || "—"}</span>,
      },
      {
        key: "yearsOfExperience",
        header: "Experience",
        cell: (doc) => <span className="text-xs text-slate-700">{doc.yearsOfExperience ? `${doc.yearsOfExperience}y` : "—"}</span>,
      },
      {
        key: "status",
        header: "Status",
        cell: (doc) => (
          <Badge variant={doc.status === "ACTIVE" ? "success" : "secondary"} className="text-[10px]">
            {doc.status}
          </Badge>
        ),
      },
      {
        key: "actions",
        header: "Actions",
        sortable: false,
        headerClassName: "text-right",
        cell: (doc) => (
          <div className="flex items-center justify-end gap-1.5 flex-wrap">
            <a
              href={`/${hospital.slug}/${doc.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex"
            >
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-[11px] text-[#1a76d1] hover:text-[#1560aa] hover:bg-blue-50"
                title="View Doctor Website"
              >
                <ExternalLink className="h-3 w-3 mr-1" />
                View
              </Button>
            </a>

            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2 text-[11px] text-slate-700 hover:bg-slate-50"
              onClick={() => handleStartEditDoctor(doc)}
              title="Edit Profile, Schedule & Fees"
            >
              <Edit3 className="h-3 w-3 mr-1 text-slate-500" />
              Edit
            </Button>

            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2 text-[11px] text-indigo-700 hover:text-indigo-800 hover:bg-indigo-50 border-indigo-200"
              onClick={() => {
                setAiTargetDocId(doc.id);
                setActiveTab("ai");
              }}
              title="Manage Doctor Website Content"
            >
              <FileText className="h-3 w-3 mr-1 text-indigo-600" />
              Content
            </Button>

            <Button
              size="sm"
              variant="outline"
              className={`h-7 px-2 text-[11px] ${
                doc.status === "ACTIVE"
                  ? "text-amber-700 border-amber-200 hover:bg-amber-50"
                  : "text-[#1560aa] border-blue-200 hover:bg-blue-50"
              }`}
              onClick={() => handleToggleDoc(doc.id, doc.status)}
            >
              {doc.status === "ACTIVE" ? "Deactivate" : "Activate"}
            </Button>

            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2 text-[11px] text-rose-600 border-rose-200 hover:bg-rose-50"
              onClick={() => setDeletingDoctor(doc)}
              title="Permanently Delete Doctor"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        ),
      },
    ],
    [hospital.slug, doctors]
  );

  const appointmentColumns = React.useMemo<ColumnDef<HospitalAppointmentItem>[]>(
    () => [
      {
        key: "patientName",
        header: "Patient",
        cell: (appt) => <span className="font-semibold text-xs text-slate-900">{appt.patientName}</span>,
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
        cell: (appt) => <span className="text-slate-600 font-mono text-xs">{appt.patientPhone}</span>,
      },
      {
        key: "doctorName",
        header: "Assigned Doctor",
        cell: (appt) => (
          <span className="text-xs font-medium text-slate-800">{appt.doctorName || "General OPD"}</span>
        ),
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
                    onClick={() => handleApptStatusChange(appt.id, "COMPLETED")}
                  >
                    Completed
                  </Button>
                )}
                {appt.status !== "PATIENT_NOT_COME" && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 px-2 text-[11px] text-amber-700 hover:bg-amber-50"
                    onClick={() => handleApptStatusChange(appt.id, "PATIENT_NOT_COME")}
                  >
                    Not Come
                  </Button>
                )}
                {appt.status !== "PENDING" && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 px-2 text-[11px] text-slate-700 hover:bg-slate-50"
                    onClick={() => handleApptStatusChange(appt.id, "PENDING")}
                  >
                    Pending
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

  // Add Doctor Dialog State
  const [addDoctorOpen, setAddDoctorOpen] = React.useState(false);
  const [newDoctor, setNewDoctor] = React.useState<Partial<HospitalDoctorItem>>({
    doctorName: "",
    gender: "MALE",
    degree: "",
    specialization: "General Medicine",
    yearsOfExperience: 5,
    newCaseFee: undefined,
    oldCaseFee: undefined,
    email: "",
    whatsApp: "",
    consultationHours: "10:00 - 16:00",
    weeklyOff: "Sunday",
    appointmentRequired: true,
  });

  // Department input
  const [newDepartmentName, setNewDepartmentName] = React.useState("");

  const navItems: NavItem[] = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "profile", label: "Hospital Profile", icon: Building2 },
    { id: "location", label: "Location & Address", icon: MapPin },
    { id: "hours", label: "Working Hours", icon: Clock },
    { id: "doctors", label: "Specialist Doctors", icon: Users, badge: String(doctors.length) },
    { id: "departments", label: "Departments", icon: Stethoscope },
    { id: "appointments", label: "Appointments", icon: CalendarCheck, badge: String(appointments.length) },
    { id: "testimonials", label: "Testimonials", icon: MessageSquareQuote },
    { id: "aichats", label: "AI Patient Chats", icon: MessageSquare },
    { id: "ai", label: "Live Website Content", icon: Globe },
    { id: "qrcode", label: "Hospital QR Code", icon: QrCode },
    { id: "gallery", label: "Facility Gallery", icon: ImageIcon },
    { id: "branding", label: "Branding & SEO", icon: Palette },
    { id: "settings", label: "Account Settings", icon: Settings },
  ];

  const handleUpdateHospital = async (field: Partial<HospitalData>) => {
    const updated = { ...hospital, ...field };
    setHospital(updated);
    if (onSaveHospital) {
      setIsSaving(true);
      try {
        await onSaveHospital(field);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2500);
      } finally {
        setIsSaving(false);
      }
    }
  };

  const handleCreateDoctorSubmit = async () => {
    if (!newDoctor.doctorName || !newDoctor.email || !newDoctor.degree) return;
    const docSlug = newDoctor.slug
      ? newDoctor.slug.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")
      : newDoctor.doctorName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

    const docToCreate = {
      ...newDoctor,
      slug: docSlug,
      status: "ACTIVE" as const,
    };

    if (onAddDoctor) {
      await onAddDoctor(docToCreate);
    }
    setDoctors((prev) => [...prev, { ...docToCreate, id: `doc-${Date.now()}` } as HospitalDoctorItem]);
    setAddDoctorOpen(false);
    setNewDoctor({
      doctorName: "",
      gender: "MALE",
      degree: "",
      specialization: "General Medicine",
      yearsOfExperience: 5,
      newCaseFee: undefined,
      oldCaseFee: undefined,
      email: "",
      whatsApp: "",
      consultationHours: "10:00 - 16:00",
      weeklyOff: "Sunday",
      appointmentRequired: true,
    });
  };

  const handleToggleDoc = async (id: string, currentStatus: "ACTIVE" | "INACTIVE") => {
    const newStatus = currentStatus === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    setDoctors((prev) => prev.map((d) => (d.id === id ? { ...d, status: newStatus } : d)));
    if (onToggleDoctorStatus) {
      await onToggleDoctorStatus(id, newStatus);
    }
  };

  const handleAddDept = () => {
    if (!newDepartmentName.trim()) return;
    const current = hospital.departments || [];
    if (current.includes(newDepartmentName.trim())) return;
    const updated = [...current, newDepartmentName.trim()];
    handleUpdateHospital({ departments: updated });
    setNewDepartmentName("");
  };

  const handleRemoveDept = (deptName: string) => {
    const current = hospital.departments || [];
    const updated = current.filter((d) => d !== deptName);
    handleUpdateHospital({ departments: updated });
  };

  return (
    <AdminShell
      title={`${hospital.name} — Administration`}
      subtitle={hospital.type ? `${hospital.type} Management` : "Hospital Administration"}
      roleBadge="Hospital Admin"
      publicWebsiteUrl={`/${hospital.slug}`}
      logoUrl={hospital.logo?.url}
      navItems={navItems}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      userEmail={hospital.email}
      onLogout={onLogout}
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
                  {hospital.publishStatus || "PUBLISHED"}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0 text-xs text-slate-500">
                Live at <Link href={`/${hospital.slug}`} className="font-mono text-[#1a76d1] font-semibold underline">/{hospital.slug}</Link>
              </CardContent>
            </Card>

            <Card className="bg-white border-slate-200 shadow-2xs">
              <CardHeader className="p-4 pb-2">
                <CardDescription className="text-xs">Specialist Doctors</CardDescription>
                <CardTitle className="text-2xl font-bold text-slate-900">{doctors.length}</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0 text-xs text-slate-500">
                {doctors.filter((d) => d.status === "ACTIVE").length} Active specialists
              </CardContent>
            </Card>

            <Card className="bg-white border-slate-200 shadow-2xs">
              <CardHeader className="p-4 pb-2">
                <CardDescription className="text-xs">Total Inquiries</CardDescription>
                <CardTitle className="text-2xl font-bold text-slate-900">{appointments.length}</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0 text-xs text-slate-500">
                {appointments.filter((a) => a.status === "PENDING").length} Requires confirmation
              </CardContent>
            </Card>
          </div>

          {/* Quick Doctor Roster Preview */}
          <Card className="bg-white border-slate-200 shadow-2xs">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="text-base font-bold">Specialist Doctors</CardTitle>
                <CardDescription className="text-xs">Affiliated doctors registered under this hospital entity.</CardDescription>
              </div>
              <Button size="sm" variant="outline" onClick={() => setActiveTab("doctors")} className="text-xs">
                View All
              </Button>
            </CardHeader>
            <CardContent>
              {doctors.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-500">
                  No doctors registered yet.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Doctor</TableHead>
                      <TableHead>Specialization</TableHead>
                      <TableHead>Experience</TableHead>
                      <TableHead>Website Link</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {doctors.slice(0, 5).map((doc) => (
                      <TableRow key={doc.id}>
                        <TableCell className="font-semibold text-slate-900 text-xs">Dr. {doc.doctorName}</TableCell>
                        <TableCell className="text-xs text-slate-700">{doc.specialization}</TableCell>
                        <TableCell className="text-xs text-slate-700">{doc.yearsOfExperience ? `${doc.yearsOfExperience}y` : "—"}</TableCell>
                        <TableCell className="font-mono text-xs text-slate-600">
                          /{hospital.slug}/{doc.slug}
                        </TableCell>
                        <TableCell>
                          <Badge variant={doc.status === "ACTIVE" ? "success" : "secondary"} className="text-[10px]">
                            {doc.status}
                          </Badge>
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

      {/* TAB 2: HOSPITAL PROFILE */}
      {activeTab === "profile" && (
        <Card className="bg-white border-slate-200 max-w-3xl">
          <CardHeader>
            <CardTitle className="text-base font-bold">Hospital Profile</CardTitle>
            <CardDescription className="text-xs">Institutional name, facility type, and public overview narrative.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField id="name" label="Hospital / Clinic Name">
              <Input
                id="name"
                value={hospital.name}
                onChange={(e) => setHospital({ ...hospital, name: e.target.value })}
              />
            </FormField>

            <FormField id="type" label="Institution Type">
              <div className="flex gap-4 pt-1">
                <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                  <input
                    type="radio"
                    name="hospitalType"
                    checked={hospital.type === "HOSPITAL"}
                    onChange={() => setHospital({ ...hospital, type: "HOSPITAL" })}
                  />
                  <span>Hospital</span>
                </label>
                <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                  <input
                    type="radio"
                    name="hospitalType"
                    checked={hospital.type === "CLINIC"}
                    onChange={() => setHospital({ ...hospital, type: "CLINIC" })}
                  />
                  <span>Clinic</span>
                </label>
              </div>
            </FormField>

            <FormField id="about" label="About Hospital / Mission Statement">
              <textarea
                id="about"
                rows={5}
                value={hospital.about || ""}
                onChange={(e) => setHospital({ ...hospital, about: e.target.value })}
                className="w-full text-sm rounded-md border border-input p-3 shadow-xs"
              />
            </FormField>
          </CardContent>
          <CardFooter className="flex justify-end">
            <Button
              onClick={() => handleUpdateHospital({ name: hospital.name, type: hospital.type, about: hospital.about })}
              disabled={isSaving}
              className="bg-[#1a76d1] hover:bg-[#1560aa] text-white font-semibold rounded-xl shadow-xs"
            >
              {isSaving ? "Saving..." : "Save Hospital Profile"}
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* TAB 3: LOCATION & ADDRESS */}
      {activeTab === "location" && (
        <Card className="bg-white border-slate-200 max-w-3xl">
          <CardHeader>
            <CardTitle className="text-base font-bold">Location & Address</CardTitle>
            <CardDescription className="text-xs">
              Contact channels and physical facility address inherited across all doctor pages.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField id="phone" label="Hospital Reception Phone">
                <PhoneInput
                  id="phone"
                  value={hospital.phone}
                  onChange={(val) => setHospital({ ...hospital, phone: val })}
                />
              </FormField>

              <FormField id="whatsApp" label="Official WhatsApp Number">
                <PhoneInput
                  id="whatsApp"
                  value={hospital.whatsApp || ""}
                  onChange={(val) => setHospital({ ...hospital, whatsApp: val })}
                />
              </FormField>

              <FormField id="email" label="Hospital Inquiry Email">
                <Input
                  id="email"
                  type="email"
                  value={hospital.email}
                  onChange={(e) => setHospital({ ...hospital, email: e.target.value })}
                />
              </FormField>

              <FormField id="street" label="Street / Campus Address">
                <Input
                  id="street"
                  value={hospital.address.street || ""}
                  onChange={(e) =>
                    setHospital({
                      ...hospital,
                      address: { ...hospital.address, street: e.target.value },
                    })
                  }
                />
              </FormField>

              <FormField id="city" label="City">
                <Input
                  id="city"
                  value={hospital.address.city}
                  onChange={(e) =>
                    setHospital({
                      ...hospital,
                      address: { ...hospital.address, city: e.target.value },
                    })
                  }
                />
              </FormField>

              <FormField id="state" label="State">
                <Input
                  id="state"
                  value={hospital.address.state}
                  onChange={(e) =>
                    setHospital({
                      ...hospital,
                      address: { ...hospital.address, state: e.target.value },
                    })
                  }
                />
              </FormField>

              <FormField id="pincode" label="Pincode">
                <Input
                  id="pincode"
                  value={hospital.address.pincode}
                  placeholder="Enter PIN code"
                  onChange={(e) =>
                    setHospital({
                      ...hospital,
                      address: { ...hospital.address, pincode: e.target.value },
                    })
                  }
                />
              </FormField>
            </div>
          </CardContent>
          <CardFooter className="flex justify-end">
            <Button
              onClick={() =>
                handleUpdateHospital({
                  phone: hospital.phone,
                  whatsApp: hospital.whatsApp,
                  email: hospital.email,
                  address: hospital.address,
                })
              }
              disabled={isSaving}
              className="bg-[#1a76d1] hover:bg-[#1560aa] text-white font-semibold rounded-xl shadow-xs"
            >
              {isSaving ? "Saving..." : "Save Location Details"}
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* TAB 4: WORKING HOURS */}
      {activeTab === "hours" && (
        <Card className="bg-white border-slate-200 max-w-3xl">
          <CardHeader>
            <CardTitle className="text-base font-bold">Working Hours</CardTitle>
            <CardDescription className="text-xs">Hospital-level OPD and Emergency operating schedule.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField id="workingHours" label="Operating / Working Hours Description">
              <Input
                id="workingHours"
                value={hospital.workingHours || "24 Hours Emergency & Regular OPD 09:00 - 18:00"}
                onChange={(e) => setHospital({ ...hospital, workingHours: e.target.value })}
              />
            </FormField>

            <FormField id="weeklyOff" label="Weekly Off (if any)">
              <Input
                id="weeklyOff"
                value={hospital.weeklyOff || "None (Open 24/7)"}
                onChange={(e) => setHospital({ ...hospital, weeklyOff: e.target.value })}
              />
            </FormField>
          </CardContent>
          <CardFooter className="flex justify-end">
            <Button
              onClick={() =>
                handleUpdateHospital({
                  workingHours: hospital.workingHours,
                  weeklyOff: hospital.weeklyOff,
                })
              }
              disabled={isSaving}
              className="bg-[#1a76d1] hover:bg-[#1560aa] text-white font-semibold rounded-xl shadow-xs"
            >
              {isSaving ? "Saving..." : "Save Working Hours"}
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* TAB 5: SPECIALIST DOCTORS */}
      {activeTab === "doctors" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900">Specialist Doctors</h2>
              <p className="text-xs text-slate-500">Manage affiliated doctors, credentials, custom web slugs, and website visibility.</p>
            </div>

            <Dialog open={addDoctorOpen} onOpenChange={setAddDoctorOpen}>
              <DialogTrigger asChild>
                <Button className="bg-[#1a76d1] hover:bg-[#1560aa] text-white text-xs font-semibold rounded-xl shadow-xs">
                  <Plus className="h-4 w-4 mr-1.5" />
                  Add Doctor
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Register Specialist Doctor</DialogTitle>
                  <DialogDescription>
                    The doctor will be registered under {hospital.name} with custom URL slug and inherited branding.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-3 py-2 text-xs">
                  <FormField id="newDocName" label="Doctor Name" required>
                    <div className="flex">
                      <span className="inline-flex items-center px-2.5 rounded-l-md border border-r-0 border-slate-300 bg-slate-100 text-slate-600 font-semibold">
                        Dr.
                      </span>
                      <Input
                        id="newDocName"
                        value={newDoctor.doctorName || ""}
                        onChange={(e) => {
                          const name = e.target.value;
                          const autoSlug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
                          setNewDoctor((prev) => ({
                            ...prev,
                            doctorName: name,
                            slug: prev.slug ? prev.slug : autoSlug ? `dr-${autoSlug}` : "",
                          }));
                        }}
                        placeholder="Doctor Full Name"
                        className="rounded-l-none"
                      />
                    </div>
                  </FormField>

                  <div className="pt-1">
                    <SlugInput
                      id="newDocSlug"
                      label="Doctor Website URL Slug"
                      value={newDoctor.slug || ""}
                      onChange={(val) => setNewDoctor({ ...newDoctor, slug: val })}
                      prefix={`/${hospital.slug}/`}
                      type="HOSPITAL_DOCTOR"
                      orgId={hospital.id}
                      placeholder="dr-priya-sharma"
                      hint={`Live public URL will be: /${hospital.slug}/${newDoctor.slug || "dr-name"}`}
                      required={false}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <FormField id="newSpecialization" label="Specialization" required>
                      <Input
                        id="newSpecialization"
                        value={newDoctor.specialization || ""}
                        onChange={(e) => setNewDoctor({ ...newDoctor, specialization: e.target.value })}
                      />
                    </FormField>

                    <FormField id="newDegree" label="Degree / Qualifications" required>
                      <Input
                        id="newDegree"
                        value={newDoctor.degree || ""}
                        onChange={(e) => setNewDoctor({ ...newDoctor, degree: e.target.value })}
                      />
                    </FormField>

                    <FormField id="newExp" label="Experience (Years)" required>
                      <Input
                        id="newExp"
                        type="number"
                        placeholder="e.g. 10"
                        value={newDoctor.yearsOfExperience || 0}
                        onChange={(e) => setNewDoctor({ ...newDoctor, yearsOfExperience: Number(e.target.value) })}
                      />
                    </FormField>

                    <FormField id="newEmail" label="Doctor Email" required>
                      <Input
                        id="newEmail"
                        type="email"
                        value={newDoctor.email || ""}
                        onChange={(e) => setNewDoctor({ ...newDoctor, email: e.target.value })}
                      />
                    </FormField>
                  </div>

                  <FormField id="newWhatsApp" label="WhatsApp Number">
                    <PhoneInput
                      id="newWhatsApp"
                      value={newDoctor.whatsApp || ""}
                      onChange={(val) => setNewDoctor({ ...newDoctor, whatsApp: val })}
                    />
                  </FormField>

                  <div className="grid grid-cols-2 gap-3">
                    <FormField id="newCaseFee" label="New Case Fee (₹)">
                      <Input
                        id="newCaseFee"
                        type="number"
                        min={0}
                        placeholder="e.g. 500"
                        value={newDoctor.newCaseFee ?? ""}
                        onChange={(e) => setNewDoctor({ ...newDoctor, newCaseFee: e.target.value === "" ? undefined : Number(e.target.value) })}
                      />
                    </FormField>

                    <FormField id="oldCaseFee" label="Old Case Fee (₹)">
                      <Input
                        id="oldCaseFee"
                        type="number"
                        min={0}
                        placeholder="e.g. 300"
                        value={newDoctor.oldCaseFee ?? ""}
                        onChange={(e) => setNewDoctor({ ...newDoctor, oldCaseFee: e.target.value === "" ? undefined : Number(e.target.value) })}
                      />
                    </FormField>
                  </div>

                  <FormField id="newHours" label="Consultation Hours">
                    <Input
                      id="newHours"
                      value={newDoctor.consultationHours || ""}
                      onChange={(e) => setNewDoctor({ ...newDoctor, consultationHours: e.target.value })}
                    />
                  </FormField>
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={() => setAddDoctorOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreateDoctorSubmit} className="bg-[#1a76d1] hover:bg-[#1560aa] text-white font-semibold rounded-xl shadow-xs">
                    Save & Register Doctor
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <Card className="bg-white border-slate-200">
            <CardContent className="p-6">
              <DataTable
                columns={doctorColumns}
                data={doctors}
                searchPlaceholder="Search doctor, specialization, slug..."
                pageSize={10}
                emptyMessage='No doctors registered yet. Click "Add Doctor" above.'
              />
            </CardContent>
          </Card>

          {/* Edit Doctor Dialog */}
          <Dialog open={Boolean(editingDoctor)} onOpenChange={(open) => !open && setEditingDoctor(null)}>
            <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Edit Doctor Profile — Dr. {editingDoctor?.doctorName}</DialogTitle>
                <DialogDescription>
                  Update doctor credentials, schedule, fee structure, and profile details under {hospital.name}.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3 py-2 text-xs">
                <FormField id="editDocName" label="Doctor Name" required>
                  <div className="flex">
                    <span className="inline-flex items-center px-2.5 rounded-l-md border border-r-0 border-slate-300 bg-slate-100 text-slate-600 font-semibold">
                      Dr.
                    </span>
                    <Input
                      id="editDocName"
                      value={editDoctorForm.doctorName || ""}
                      onChange={(e) => setEditDoctorForm({ ...editDoctorForm, doctorName: e.target.value })}
                      placeholder="Doctor Full Name"
                      className="rounded-l-none"
                    />
                  </div>
                </FormField>

                <div className="pt-1">
                  <SlugInput
                    id="editDocSlug"
                    label="Doctor Website URL Slug"
                    value={editDoctorForm.slug || ""}
                    onChange={(val) => setEditDoctorForm({ ...editDoctorForm, slug: val })}
                    prefix={`/${hospital.slug}/`}
                    type="HOSPITAL_DOCTOR"
                    orgId={hospital.id}
                    excludeId={editingDoctor?.id}
                    placeholder="dr-priya-sharma"
                    hint={`Live public URL will be: /${hospital.slug}/${editDoctorForm.slug || "dr-name"}`}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <FormField id="editSpecialization" label="Specialization" required>
                    <Input
                      id="editSpecialization"
                      value={editDoctorForm.specialization || ""}
                      onChange={(e) => setEditDoctorForm({ ...editDoctorForm, specialization: e.target.value })}
                    />
                  </FormField>

                  <FormField id="editDegree" label="Degree / Qualifications" required>
                    <Input
                      id="editDegree"
                      value={editDoctorForm.degree || ""}
                      onChange={(e) => setEditDoctorForm({ ...editDoctorForm, degree: e.target.value })}
                    />
                  </FormField>

                  <FormField id="editExp" label="Experience (Years)" required>
                    <Input
                      id="editExp"
                      type="number"
                      placeholder="e.g. 10"
                      value={editDoctorForm.yearsOfExperience || 0}
                      onChange={(e) => setEditDoctorForm({ ...editDoctorForm, yearsOfExperience: Number(e.target.value) })}
                    />
                  </FormField>

                  <FormField id="editEmail" label="Doctor Email">
                    <Input
                      id="editEmail"
                      type="email"
                      value={editDoctorForm.email || ""}
                      onChange={(e) => setEditDoctorForm({ ...editDoctorForm, email: e.target.value })}
                    />
                  </FormField>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <FormField id="editWhatsApp" label="WhatsApp Number">
                    <PhoneInput
                      id="editWhatsApp"
                      value={editDoctorForm.whatsApp || ""}
                      onChange={(val) => setEditDoctorForm({ ...editDoctorForm, whatsApp: val })}
                    />
                  </FormField>

                  <FormField id="editWeeklyOff" label="Weekly Off Day">
                    <Input
                      id="editWeeklyOff"
                      placeholder="e.g. Sunday"
                      value={editDoctorForm.weeklyOff || ""}
                      onChange={(e) => setEditDoctorForm({ ...editDoctorForm, weeklyOff: e.target.value })}
                    />
                  </FormField>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <FormField id="editNewCaseFee" label="New Case Fee (₹)">
                    <Input
                      id="editNewCaseFee"
                      type="number"
                      min={0}
                      placeholder="e.g. 500"
                      value={editDoctorForm.newCaseFee ?? ""}
                      onChange={(e) => setEditDoctorForm({ ...editDoctorForm, newCaseFee: e.target.value === "" ? undefined : Number(e.target.value) })}
                    />
                  </FormField>

                  <FormField id="editOldCaseFee" label="Old Case Fee (₹)">
                    <Input
                      id="editOldCaseFee"
                      type="number"
                      min={0}
                      placeholder="e.g. 300"
                      value={editDoctorForm.oldCaseFee ?? ""}
                      onChange={(e) => setEditDoctorForm({ ...editDoctorForm, oldCaseFee: e.target.value === "" ? undefined : Number(e.target.value) })}
                    />
                  </FormField>
                </div>

                <FormField id="editHours" label="Consultation Hours">
                  <Input
                    id="editHours"
                    placeholder="e.g. 10:00 - 14:00, 17:00 - 20:00"
                    value={editDoctorForm.consultationHours || ""}
                    onChange={(e) => setEditDoctorForm({ ...editDoctorForm, consultationHours: e.target.value })}
                  />
                </FormField>

                <div className="pt-2">
                  <ImageUploader
                    category="DOCTOR_PHOTO"
                    replaceOnly={true}
                    value={editDoctorForm.doctorPhoto}
                    onChange={(asset) => {
                      if (asset) {
                        setEditDoctorForm({ ...editDoctorForm, doctorPhoto: asset });
                      }
                    }}
                    label="Doctor Photo"
                  />
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setEditingDoctor(null)} disabled={isUpdatingDoctor}>
                  Cancel
                </Button>
                <Button onClick={handleSaveEditedDoctor} disabled={isUpdatingDoctor} className="bg-[#1a76d1] hover:bg-[#1560aa] text-white font-semibold rounded-xl shadow-xs">
                  {isUpdatingDoctor ? "Saving Changes..." : "Save Changes"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Delete Doctor Permanent Confirmation Dialog */}
          <Dialog open={Boolean(deletingDoctor)} onOpenChange={(open) => !open && setDeletingDoctor(null)}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <div className="flex items-center gap-2 text-rose-600 mb-1">
                  <AlertTriangle className="h-5 w-5" />
                  <DialogTitle className="text-rose-700">Permanently Delete Doctor?</DialogTitle>
                </div>
                <DialogDescription className="text-xs text-slate-600 space-y-2">
                  <p>
                    Are you sure you want to permanently delete <strong>Dr. {deletingDoctor?.doctorName}</strong> from {hospital.name}?
                  </p>
                  <p className="text-rose-600 font-medium">
                    This will permanently delete their doctor profile, child website (/{hospital.slug}/{deletingDoctor?.slug}), doctor admin login account, and appointment history. This action cannot be undone.
                  </p>
                </DialogDescription>
              </DialogHeader>

              <DialogFooter className="gap-2 sm:gap-0">
                <Button variant="outline" onClick={() => setDeletingDoctor(null)} disabled={isDeletingDoctor}>
                  Cancel
                </Button>
                <Button
                  onClick={handleConfirmDeleteDoctor}
                  disabled={isDeletingDoctor}
                  className="bg-rose-600 hover:bg-rose-700 text-white"
                >
                  {isDeletingDoctor ? "Deleting..." : "Permanently Delete Doctor"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      )}

      {/* TAB 6: DEPARTMENTS */}
      {activeTab === "departments" && (
        <Card className="bg-white border-slate-200 max-w-3xl">
          <CardHeader>
            <CardTitle className="text-base font-bold">Departments</CardTitle>
            <CardDescription className="text-xs">Configure clinical specialties and departments displayed on your public website.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="e.g. Interventional Cardiology, Pediatric ICU"
                value={newDepartmentName}
                onChange={(e) => setNewDepartmentName(e.target.value)}
              />
              <Button onClick={handleAddDept} size="sm" className="bg-slate-900 text-white shrink-0">
                <Plus className="h-4 w-4 mr-1" />
                Add Department
              </Button>
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              {(hospital.departments || []).map((dept) => (
                <span
                  key={dept}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-800"
                >
                  <span>{dept}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveDept(dept)}
                    className="text-slate-400 hover:text-rose-600 transition-colors"
                    title="Remove department"
                  >
                    &times;
                  </button>
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* TAB 7: APPOINTMENTS (DATA TABLE) */}
      {activeTab === "appointments" && (
        <Card className="bg-white border-slate-200">
          <CardHeader className="border-b border-slate-100 pb-4">
            <CardTitle className="text-base font-bold">Appointments</CardTitle>
            <CardDescription className="text-xs">Manage patient consultations across all hospital doctors.</CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            <DataTable
              columns={appointmentColumns}
              data={appointments}
              searchPlaceholder="Search patient, phone, doctor, slot..."
              pageSize={10}
              emptyMessage="No appointments booked at this hospital yet."
            />
          </CardContent>
        </Card>
      )}

      {/* TAB: TESTIMONIALS */}
      {activeTab === "testimonials" && (
        <TestimonialsManagementView
          portalType="HOSPITAL"
          practiceName={hospital.name}
        />
      )}

      {/* TAB: AI CHAT MANAGEMENT */}
      {activeTab === "aichats" && (
        <AIChatHistoryView
          portalType="HOSPITAL"
          doctorList={doctors.map((d) => ({
            id: d.id,
            name: d.doctorName,
            specialization: d.specialization,
          }))}
        />
      )}

      {/* TAB: AI CONTENT & COPY */}
      {activeTab === "ai" && (
        <div className="max-w-4xl space-y-4">
          <Card className="bg-white border-slate-200 p-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Website Content Management
                </h3>
                <p className="text-xs text-slate-500">
                  Switch between Hospital Main Website and Affiliated Doctor websites to view and customize all sections.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-600">Website:</span>
                <select
                  value={aiTargetDocId || "hospital"}
                  onChange={(e) => {
                    const val = e.target.value;
                    setAiTargetDocId(val === "hospital" ? null : val);
                  }}
                  className="text-xs border border-slate-300 rounded-md px-3 py-1.5 bg-white text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-[#1a76d1]"
                >
                  <option value="hospital">🏥 {hospital.name} (Hospital Facility Website)</option>
                  {doctors.map((d) => (
                    <option key={d.id} value={d.id}>
                      👨‍⚕️ Dr. {d.doctorName} ({d.specialization})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {aiTargetDocId && (
              <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-blue-50 text-[#1560aa] border-blue-200">
                    Affiliated Doctor Website
                  </Badge>
                  <span>
                    Path: <strong className="font-mono">/{hospital.slug}/{doctors.find((d) => d.id === aiTargetDocId)?.slug}</strong>
                  </span>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 text-xs text-slate-500 hover:text-slate-800"
                  onClick={() => setAiTargetDocId(null)}
                >
                  Switch to Hospital Website
                </Button>
              </div>
            )}
          </Card>

          {aiTargetDocId ? (
            <AIContentPanel
              key={aiTargetDocId}
              targetType="HOSPITAL_DOCTOR"
              targetId={aiTargetDocId}
              onPublished={() => {
                toast.success("Doctor website content published successfully.");
              }}
            />
          ) : (
            <AIContentPanel
              key="hospital-main"
              targetType="HOSPITAL"
              targetId={hospital.id}
              onPublished={() => {
                handleUpdateHospital({});
              }}
            />
          )}
        </div>
      )}

      {/* TAB: QR CODE */}
      {activeTab === "qrcode" && (
        <div className="max-w-3xl space-y-4">
          <ClinicQrCard
            title={hospital.name}
            subtitle={`${hospital.type} • ${hospital.address?.city || ""}, ${hospital.address?.state || ""}`}
            pathOrSlug={`/${hospital.slug}`}
            logoUrl={hospital.logo?.url}
          />
        </div>
      )}

      {/* TAB 8: FACILITY GALLERY */}
      {activeTab === "gallery" && (
        <Card className="bg-white border-slate-200 max-w-3xl">
          <CardHeader>
            <CardTitle className="text-base font-bold">Facility Gallery</CardTitle>
            <CardDescription className="text-xs">
              Upload up to 6 facility photos displayed on the hospital page and all affiliated doctor websites.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <GalleryUploader
              label="Hospital Facility & Campus Photos"
              value={hospital.galleryPhotos || []}
              onChange={(assets) => {
                setHospital((prev) => ({ ...prev, galleryPhotos: assets }));
                handleUpdateHospital({ galleryPhotos: assets });
              }}
              maxFiles={6}
            />
          </CardContent>
        </Card>
      )}

      {/* TAB 9: BRANDING & SEO */}
      {activeTab === "branding" && (
        <div className="space-y-6 max-w-3xl">
          {/* Hospital URL Slug Card */}
          <Card className="bg-white border-slate-200">
            <CardHeader>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Globe className="h-4 w-4 text-[#1a76d1]" />
                Hospital Website URL Slug
              </CardTitle>
              <CardDescription className="text-xs">
                Customize your hospital portal URL slug. Changing this will automatically update your hospital website address and cascade to all affiliated doctor website URLs.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <SlugInput
                id="hospitalSlug"
                label="Hospital Website Address"
                value={hospitalSlugValue}
                onChange={setHospitalSlugValue}
                type="HOSPITAL"
                excludeId={hospital.id}
                placeholder="Enter new hospital slug (e.g. city-care-hospital)"
                hint={
                  hospitalSlugValue
                    ? `Your new hospital website address will be: /${hospitalSlugValue}`
                    : "Only lowercase alphanumeric characters and single hyphens. Enter a new slug to change your URL."
                }
                required={false}
              />
            </CardContent>
            <CardFooter className="flex justify-between items-center border-t border-slate-100 pt-4">
              <span className="text-xs text-slate-500">
                Current URL: <code className="bg-slate-100 text-slate-800 font-semibold px-1.5 py-0.5 rounded">/{hospital.slug}</code>
              </span>
              <Button
                onClick={handleUpdateHospitalSlug}
                disabled={isSavingHospitalSlug || !hospitalSlugValue.trim() || hospitalSlugValue.trim() === hospital.slug}
                className="bg-[#1a76d1] hover:bg-[#1560aa] text-white font-semibold text-xs rounded-xl shadow-xs"
              >
                {isSavingHospitalSlug ? "Updating Slug..." : "Save Hospital Slug"}
              </Button>
            </CardFooter>
          </Card>

          <Card className="bg-white border-slate-200">
            <CardHeader>
              <CardTitle className="text-base font-bold">Branding & SEO</CardTitle>
              <CardDescription className="text-xs">
                Upload your hospital logo, favicon, and browser title. All affiliated doctors inherit your hospital branding.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-6">
                <ImageUploader
                  label="Hospital Brand Logo"
                  category="CLINIC_LOGO"
                  value={hospital.logo}
                  onChange={(asset) => {
                    setHospital((prev) => ({ ...prev, logo: asset }));
                  }}
                />

                <ImageUploader
                  label="Hospital Building Exterior Photo (3:4 Vertical)"
                  category="BUILDING_PHOTO"
                  cropAspect={3 / 4}
                  aspect={3 / 4}
                  cropDescription="Reposition, zoom, and adjust within the 3:4 vertical frame for the website homepage."
                  maxSizeBytes={5 * 1024 * 1024}
                  value={hospital.buildingPhoto}
                  onChange={(asset) => {
                    setHospital((prev) => ({ ...prev, buildingPhoto: asset }));
                  }}
                />

                <ImageUploader
                  label="Browser Tab Favicon (.png / .ico)"
                  category="CLINIC_LOGO"
                  value={hospital.faviconUrl ? { url: hospital.faviconUrl } : undefined}
                  onChange={(asset) => {
                    const url = asset?.url || "";
                    setHospital((prev) => ({ ...prev, faviconUrl: url }));
                  }}
                  enableCrop={false}
                />

                <FormField id="hospTab" label="Browser Tab Title">
                  <Input
                    id="hospTab"
                    value={hospital.browserTabTitle || ""}
                    onChange={(e) => setHospital({ ...hospital, browserTabTitle: e.target.value })}
                  />
                </FormField>

                <div className="pt-4 border-t border-slate-100">
                  <ThemeColorSelector
                    value={hospital.selectedTheme || "blue"}
                    onChange={(themeId) => {
                      setHospital((prev) => ({ ...prev, selectedTheme: themeId }));
                    }}
                  />
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex justify-end">
              <Button
                onClick={() =>
                  handleUpdateHospital({
                    selectedTheme: hospital.selectedTheme || "blue",
                    logo: hospital.logo,
                    buildingPhoto: hospital.buildingPhoto,
                    faviconUrl: hospital.faviconUrl,
                    browserTabTitle: hospital.browserTabTitle,
                  })
                }
                disabled={isSaving}
                className="bg-[#1a76d1] hover:bg-[#1560aa] text-white font-semibold rounded-xl shadow-xs"
              >
                Save Hospital Branding
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}

      {/* TAB 10: SETTINGS */}
      {activeTab === "settings" && (
        <AccountSettingsCard
          email={hospital.email}
          roleTitle="Hospital Account"
          slug={hospital.slug}
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
