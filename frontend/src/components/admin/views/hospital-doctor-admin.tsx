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
  Sparkles,
} from "lucide-react";
import { AdminShell, NavItem } from "../admin-shell";
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { FormField } from "@/components/forms/form-field";
import { AIContentPanel } from "../ai-content-panel";

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
  whatsApp?: string;
  email: string;
  phone?: string;
  bio?: string;
  doctorPhoto?: { url: string };
  consultationHours?: string;
  weeklyOff?: string;
  appointmentRequired?: boolean;
  status: "ACTIVE" | "INACTIVE";
  inheritedHospitalData: InheritedHospitalInfo;
  publishStatus?: "PUBLISHED" | "DRAFT";
}

export interface DoctorAppointmentItem {
  id: string;
  patientName: string;
  patientPhone: string;
  appointmentDate: string;
  timeSlot: string;
  status: "PENDING" | "CONFIRMED" | "CANCELLED" | "COMPLETED";
  notes?: string;
}

interface HospitalDoctorAdminProps {
  initialData: HospitalDoctorData;
  initialAppointments?: DoctorAppointmentItem[];
  onSave?: (updatedData: Partial<HospitalDoctorData>) => Promise<void>;
  onUpdateAppointmentStatus?: (appointmentId: string, status: string) => Promise<void>;
}

export function HospitalDoctorAdmin({
  initialData,
  initialAppointments = [],
  onSave,
  onUpdateAppointmentStatus,
}: HospitalDoctorAdminProps) {
  const [activeTab, setActiveTab] = React.useState("dashboard");
  const [data, setData] = React.useState<HospitalDoctorData>(initialData);
  const [appointments, setAppointments] = React.useState<DoctorAppointmentItem[]>(initialAppointments);
  const [isSaving, setIsSaving] = React.useState(false);
  const [saveSuccess, setSaveSuccess] = React.useState(false);

  // New photo URL state
  const [photoUrlInput, setPhotoUrlInput] = React.useState(data.doctorPhoto?.url || "");

  const parentHospital = data.inheritedHospitalData;

  const navItems: NavItem[] = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "profile", label: "My Profile", icon: User },
    { id: "professional", label: "Professional Info", icon: GraduationCap },
    { id: "schedule", label: "Consultation & Hours", icon: Clock },
    { id: "appointments", label: "My Appointments", icon: CalendarCheck, badge: String(appointments.length) },
    { id: "ai", label: "AI Content & Bio", icon: Sparkles },
    { id: "photo", label: "My Photo", icon: Camera },
    { id: "inherited", label: "Hospital Facility & Brand", icon: Building2, isLocked: true },
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

  const handleStatusChange = async (
    appointmentId: string,
    status: "PENDING" | "CONFIRMED" | "CANCELLED" | "COMPLETED"
  ) => {
    setAppointments((prev) =>
      prev.map((a) => (a.id === appointmentId ? { ...a, status } : a))
    );
    if (onUpdateAppointmentStatus) {
      await onUpdateAppointmentStatus(appointmentId, status);
    }
  };

  const publicUrl = `/${parentHospital.organizationSlug}/${data.slug}`;

  return (
    <AdminShell
      title={`Dr. ${data.doctorName} — Administration`}
      subtitle={`Affiliated with ${parentHospital.organizationName}`}
      roleBadge="Hospital Doctor"
      publicWebsiteUrl={publicUrl}
      navItems={navItems}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      userEmail={data.email}
    >
      {saveSuccess && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs px-4 py-2.5 rounded-lg flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-emerald-600" />
            <span>Profile updates saved and synchronized with your hospital doctor page.</span>
          </div>
          <Badge variant="outline" className="text-[10px] bg-white border-emerald-300">
            Synchronized
          </Badge>
        </div>
      )}

      {/* Persistent Hospital Lock Banner Notice */}
      <div className="bg-amber-50/80 border border-amber-200 text-amber-900 rounded-lg p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2.5">
          <div className="h-7 w-7 rounded-md bg-amber-200 text-amber-950 flex items-center justify-center shrink-0">
            <Lock className="h-4 w-4" />
          </div>
          <div>
            <div className="font-bold flex items-center gap-2">
              <span>Hospital: {parentHospital.organizationName}</span>
              <span className="text-[11px] font-mono text-amber-800 bg-amber-100 px-1.5 py-0.2 rounded border border-amber-300">
                🔒 Managed by Hospital Admin
              </span>
            </div>
            <p className="text-[11px] text-amber-700">
              Hospital branding, themes, facility logos, and address are centralized and locked.
            </p>
          </div>
        </div>

        <Button asChild size="sm" variant="outline" className="text-xs bg-white border-amber-300 text-amber-900 hover:bg-amber-100 shrink-0">
          <Link href={publicUrl} target="_blank">
            <ExternalLink className="h-3.5 w-3.5 mr-1 text-amber-700" />
            View Public Profile
          </Link>
        </Button>
      </div>

      {/* TAB 1: DASHBOARD */}
      {activeTab === "dashboard" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="bg-white border-slate-200 shadow-2xs">
              <CardHeader className="p-4 pb-2">
                <CardDescription className="text-xs">Profile Status</CardDescription>
                <CardTitle className="text-xl font-bold flex items-center gap-2 text-slate-900">
                  <span
                    className={`h-2.5 w-2.5 rounded-full ${
                      data.status === "ACTIVE" ? "bg-emerald-500 animate-pulse" : "bg-slate-400"
                    }`}
                  />
                  {data.status}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0 text-xs text-slate-500">
                Live at <span className="font-mono text-emerald-700">{publicUrl}</span>
              </CardContent>
            </Card>

            <Card className="bg-white border-slate-200 shadow-2xs">
              <CardHeader className="p-4 pb-2">
                <CardDescription className="text-xs">Experience</CardDescription>
                <CardTitle className="text-xl font-bold text-slate-900">
                  {data.yearsOfExperience} Years
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0 text-xs text-slate-500">
                {data.specialization}
              </CardContent>
            </Card>

            <Card className="bg-white border-slate-200 shadow-2xs">
              <CardHeader className="p-4 pb-2">
                <CardDescription className="text-xs">My Appointments</CardDescription>
                <CardTitle className="text-xl font-bold text-slate-900">
                  {appointments.length} Total
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0 text-xs text-slate-500">
                {appointments.filter((a) => a.status === "PENDING").length} pending action
              </CardContent>
            </Card>

            <Card className="bg-white border-slate-200 shadow-2xs">
              <CardHeader className="p-4 pb-2">
                <CardDescription className="text-xs">Parent Organization</CardDescription>
                <CardTitle className="text-sm font-bold text-slate-900 truncate">
                  {parentHospital.organizationName}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0 text-[11px] text-amber-700 flex items-center gap-1 font-medium">
                <Lock className="h-3 w-3 text-amber-600" />
                Managed by Hospital Admin
              </CardContent>
            </Card>
          </div>

          {/* Quick Profile Summary Card */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="bg-white border-slate-200">
              <CardHeader>
                <CardTitle className="text-base font-bold text-slate-900">Doctor Profile Summary</CardTitle>
                <CardDescription className="text-xs">
                  Your credentials and patient consultation schedule
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-xs">
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">Full Name</span>
                  <span className="font-semibold text-slate-800">Dr. {data.doctorName}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">Degree</span>
                  <span className="font-semibold text-slate-800">{data.degree}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">Specialization</span>
                  <span className="font-semibold text-slate-800">{data.specialization}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">Consultation Hours</span>
                  <span className="font-medium text-slate-700">{data.consultationHours || "10:00 AM - 05:00 PM"}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">Weekly Off</span>
                  <span className="font-medium text-slate-700">{data.weeklyOff || "Sunday"}</span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-slate-500">Appointment Required</span>
                  <Badge variant={data.appointmentRequired ? "default" : "secondary"}>
                    {data.appointmentRequired ? "Yes (Mandatory)" : "Walk-in Welcome"}
                  </Badge>
                </div>
              </CardContent>
              <CardFooter className="pt-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setActiveTab("profile")}
                  className="w-full text-xs"
                >
                  Edit Doctor Profile
                </Button>
              </CardFooter>
            </Card>

            {/* Read-Only Hospital Affiliation Summary */}
            <Card className="bg-slate-50 border-amber-200">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-900 uppercase tracking-wider">
                    Parent Healthcare Facility
                  </span>
                  <Badge variant="outline" className="text-[10px] bg-amber-100 text-amber-900 border-amber-300">
                    <Lock className="h-3 w-3 mr-1" />
                    Read-Only
                  </Badge>
                </div>
                <CardTitle className="text-base font-bold text-slate-900">
                  {parentHospital.organizationName}
                </CardTitle>
                <CardDescription className="text-xs">
                  Centralized organization information inherited by your profile
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-xs">
                <div className="bg-white p-3 rounded-lg border border-slate-200 space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Facility Type</span>
                    <span className="font-medium text-slate-800">{parentHospital.organizationType}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Hospital City/State</span>
                    <span className="font-medium text-slate-800">
                      {parentHospital.address.city}, {parentHospital.address.state}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Design Theme</span>
                    <Badge variant="secondary" className="capitalize text-[10px]">
                      {parentHospital.selectedTheme.replace("-", " ")}
                    </Badge>
                  </div>
                </div>

                <div className="text-[11px] text-slate-600 bg-amber-100/50 p-2.5 rounded border border-amber-200">
                  <div className="font-semibold text-amber-900 mb-0.5">Hospital Admin Authority</div>
                  Hospital administration maintains exclusive authority over logo, theme, branding, address, and facility photos.
                </div>
              </CardContent>
              <CardFooter className="pt-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setActiveTab("inherited")}
                  className="w-full text-xs bg-white text-slate-700"
                >
                  View Inherited Facility Details
                </Button>
              </CardFooter>
            </Card>
          </div>
        </div>
      )}

      {/* TAB 2: MY PROFILE */}
      {activeTab === "profile" && (
        <Card className="bg-white border-slate-200">
          <CardHeader>
            <CardTitle className="text-lg font-bold text-slate-900">My Profile</CardTitle>
            <CardDescription className="text-xs">
              Update your personal doctor profile details shown on your page
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 max-w-xl">
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
                {["Male", "Female", "Other"].map((g) => (
                  <label key={g} className="flex items-center gap-1.5 text-xs font-medium cursor-pointer">
                    <input
                      type="radio"
                      name="gender"
                      value={g}
                      checked={data.gender === g}
                      onChange={() => setData({ ...data, gender: g })}
                      className="text-emerald-600 focus:ring-emerald-500"
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
              <Input
                id="whatsApp"
                value={data.whatsApp || ""}
                onChange={(e) => setData({ ...data, whatsApp: e.target.value })}
                placeholder="+91 9876543210"
              />
            </FormField>

            <FormField id="bio" label="About / Clinical Biography">
              <textarea
                id="bio"
                rows={4}
                value={data.bio || ""}
                onChange={(e) => setData({ ...data, bio: e.target.value })}
                className="w-full rounded-md border border-slate-300 bg-white p-2.5 text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
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
                  bio: data.bio,
                })
              }
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
            >
              {isSaving ? "Saving..." : "Save Profile Changes"}
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* TAB 3: PROFESSIONAL INFO */}
      {activeTab === "professional" && (
        <Card className="bg-white border-slate-200">
          <CardHeader>
            <CardTitle className="text-lg font-bold text-slate-900">My Professional Information</CardTitle>
            <CardDescription className="text-xs">
              Medical qualifications, specializations, and clinical experience
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 max-w-xl">
            <FormField id="degree" label="Degree / Medical Qualifications" required>
              <Input
                id="degree"
                value={data.degree}
                onChange={(e) => setData({ ...data, degree: e.target.value })}
                placeholder="e.g. MBBS, MD, DM (Cardiology)"
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
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
            >
              {isSaving ? "Saving..." : "Save Professional Details"}
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* TAB 4: CONSULTATION & HOURS */}
      {activeTab === "schedule" && (
        <Card className="bg-white border-slate-200">
          <CardHeader>
            <CardTitle className="text-lg font-bold text-slate-900">Consultation Hours & Schedule</CardTitle>
            <CardDescription className="text-xs">
              Configure your daily clinic timing, weekly off day, and appointment policy
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 max-w-xl">
            <FormField id="consultationHours" label="Consultation Hours" required>
              <Input
                id="consultationHours"
                value={data.consultationHours || ""}
                onChange={(e) => setData({ ...data, consultationHours: e.target.value })}
                placeholder="e.g. 10:00 AM - 01:00 PM, 05:00 PM - 08:00 PM"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Specify available patient consultation timing slots
              </p>
            </FormField>

            <FormField id="weeklyOff" label="Weekly Off Day(s)" required>
              <Input
                id="weeklyOff"
                value={data.weeklyOff || ""}
                onChange={(e) => setData({ ...data, weeklyOff: e.target.value })}
                placeholder="e.g. Sunday"
              />
            </FormField>

            <FormField id="appointmentRequired" label="Appointment Required Policy">
              <div className="flex items-center gap-4 pt-1">
                <label className="flex items-center gap-1.5 text-xs font-medium cursor-pointer">
                  <input
                    type="radio"
                    name="appointmentRequired"
                    checked={data.appointmentRequired === true}
                    onChange={() => setData({ ...data, appointmentRequired: true })}
                    className="text-emerald-600 focus:ring-emerald-500"
                  />
                  Yes, prior appointment mandatory
                </label>
                <label className="flex items-center gap-1.5 text-xs font-medium cursor-pointer">
                  <input
                    type="radio"
                    name="appointmentRequired"
                    checked={data.appointmentRequired === false}
                    onChange={() => setData({ ...data, appointmentRequired: false })}
                    className="text-emerald-600 focus:ring-emerald-500"
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
              onClick={() =>
                handleUpdate({
                  consultationHours: data.consultationHours,
                  weeklyOff: data.weeklyOff,
                  appointmentRequired: data.appointmentRequired,
                })
              }
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
            >
              {isSaving ? "Saving..." : "Save Schedule & Policies"}
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* TAB 5: MY APPOINTMENTS */}
      {activeTab === "appointments" && (
        <Card className="bg-white border-slate-200">
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <CardTitle className="text-lg font-bold text-slate-900">My Patient Appointments</CardTitle>
                <CardDescription className="text-xs">
                  Patients who booked consultation slots specifically for Dr. {data.doctorName}
                </CardDescription>
              </div>
              <Badge variant="outline" className="text-xs self-start sm:self-auto font-mono">
                {appointments.length} Appointments
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {appointments.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs">
                No appointment requests received yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs font-semibold">Patient</TableHead>
                      <TableHead className="text-xs font-semibold">Phone</TableHead>
                      <TableHead className="text-xs font-semibold">Date & Slot</TableHead>
                      <TableHead className="text-xs font-semibold">Status</TableHead>
                      <TableHead className="text-xs font-semibold text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {appointments.map((appt) => (
                      <TableRow key={appt.id}>
                        <TableCell className="font-medium text-xs text-slate-900">
                          {appt.patientName}
                          {appt.notes && (
                            <span className="block text-[10px] text-slate-500 truncate max-w-xs font-normal">
                              Note: {appt.notes}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-slate-700 font-mono">
                          {appt.patientPhone}
                        </TableCell>
                        <TableCell className="text-xs text-slate-700">
                          <span className="font-semibold block">{appt.appointmentDate}</span>
                          <span className="text-[11px] text-slate-500">{appt.timeSlot}</span>
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={`text-[10px] font-semibold ${
                              appt.status === "CONFIRMED"
                                ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                                : appt.status === "PENDING"
                                ? "bg-amber-100 text-amber-800 border-amber-200"
                                : appt.status === "COMPLETED"
                                ? "bg-sky-100 text-sky-800 border-sky-200"
                                : "bg-rose-100 text-rose-800 border-rose-200"
                            }`}
                            variant="outline"
                          >
                            {appt.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right space-x-1.5 whitespace-nowrap">
                          {appt.status === "PENDING" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleStatusChange(appt.id, "CONFIRMED")}
                              className="text-[10px] h-7 px-2 border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                            >
                              Confirm
                            </Button>
                          )}
                          {appt.status === "CONFIRMED" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleStatusChange(appt.id, "COMPLETED")}
                              className="text-[10px] h-7 px-2 border-sky-300 text-sky-700 hover:bg-sky-50"
                            >
                              Complete
                            </Button>
                          )}
                          {appt.status !== "CANCELLED" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleStatusChange(appt.id, "CANCELLED")}
                              className="text-[10px] h-7 px-2 text-rose-600 hover:bg-rose-50"
                            >
                              Cancel
                            </Button>
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
      )}

      {/* TAB: AI CONTENT & CLINICAL BIO */}
      {activeTab === "ai" && (
        <div className="max-w-4xl">
          <AIContentPanel
            targetType="HOSPITAL_DOCTOR"
            targetId={data.id}
            onPublished={() => {
              handleUpdate({});
            }}
          />
        </div>
      )}

      {/* TAB 6: MY PHOTO */}
      {activeTab === "photo" && (
        <Card className="bg-white border-slate-200">
          <CardHeader>
            <CardTitle className="text-lg font-bold text-slate-900">Doctor Profile Photo</CardTitle>
            <CardDescription className="text-xs">
              Upload or update your professional headshot image shown on your page
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 max-w-xl">
            {/* Current photo preview */}
            <div className="flex items-center gap-6">
              <div className="h-24 w-24 rounded-full bg-slate-100 border border-slate-300 overflow-hidden flex items-center justify-center shrink-0">
                {data.doctorPhoto?.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={data.doctorPhoto.url}
                    alt={data.doctorName}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <Camera className="h-8 w-8 text-slate-400" />
                )}
              </div>
              <div className="space-y-1">
                <h4 className="text-xs font-bold text-slate-900">Profile Photo Preview</h4>
                <p className="text-[11px] text-slate-500">
                  Recommended size: 600x600 px (Square). Format: JPG, PNG, or WEBP (Max 3 MB).
                </p>
              </div>
            </div>

            <FormField id="photoUrl" label="Photo Image URL">
              <div className="flex gap-2">
                <Input
                  id="photoUrl"
                  value={photoUrlInput}
                  onChange={(e) => setPhotoUrlInput(e.target.value)}
                  placeholder="https://images.unsplash.com/photo-..."
                  className="text-xs"
                />
                <Button
                  size="sm"
                  onClick={() => handleUpdate({ doctorPhoto: { url: photoUrlInput } })}
                  disabled={isSaving || !photoUrlInput.trim()}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs shrink-0"
                >
                  Save Photo
                </Button>
              </div>
            </FormField>
          </CardContent>
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

      {/* TAB 8: SETTINGS */}
      {activeTab === "settings" && (
        <Card className="bg-white border-slate-200">
          <CardHeader>
            <CardTitle className="text-lg font-bold text-slate-900">Account & Profile Settings</CardTitle>
            <CardDescription className="text-xs">
              Manage your doctor login credentials and public profile URL
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 max-w-xl text-xs">
            <div>
              <span className="font-semibold text-slate-700 block">Doctor Account Email</span>
              <p className="font-mono text-slate-900 mt-1">{data.email}</p>
            </div>

            <div>
              <span className="font-semibold text-slate-700 block">Doctor URL Slug</span>
              <p className="font-mono text-slate-900 mt-1">{data.slug}</p>
            </div>

            <div>
              <span className="font-semibold text-slate-700 block">Affiliated Organization</span>
              <p className="text-slate-900 mt-1">
                {parentHospital.organizationName} (<span className="font-mono">{parentHospital.organizationSlug}</span>)
              </p>
            </div>

            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-slate-600 text-[11px]">
              If you require changes to your assigned hospital organization or slug, please contact your hospital administrator.
            </div>
          </CardContent>
        </Card>
      )}
    </AdminShell>
  );
}
