import * as React from "react";
import Link from "next/link";
import {
  LayoutDashboard,
  User,
  Building2,
  Clock,
  CalendarCheck,
  Image as ImageIcon,
  Sparkles,
  Palette,
  Settings,
  Plus,
  Trash2,
  CheckCircle,
} from "lucide-react";
import { AdminShell, NavItem } from "../admin-shell";
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { FormField } from "@/components/forms/form-field";

export interface IndependentDoctorData {
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
  clinicName?: string;
  address?: {
    street?: string;
    city: string;
    state: string;
    pincode: string;
    country: string;
  };
  clinicLogo?: { url: string };
  clinicPhotos?: Array<{ url: string }>;
  consultationHours?: string;
  weeklyOff?: string;
  appointmentRequired?: boolean;
  selectedTheme?: string;
  faviconUrl?: string;
  browserTabTitle?: string;
  publishStatus?: "PUBLISHED" | "DRAFT";
}

export interface AppointmentItem {
  id: string;
  patientName: string;
  patientPhone: string;
  appointmentDate: string;
  timeSlot: string;
  status: "PENDING" | "CONFIRMED" | "CANCELLED" | "COMPLETED";
  notes?: string;
}

interface IndependentDoctorAdminProps {
  initialData: IndependentDoctorData;
  initialAppointments?: AppointmentItem[];
  onSave?: (updatedData: Partial<IndependentDoctorData>) => Promise<void>;
  onUpdateAppointmentStatus?: (appointmentId: string, status: string) => Promise<void>;
}

export function IndependentDoctorAdmin({
  initialData,
  initialAppointments = [],
  onSave,
  onUpdateAppointmentStatus,
}: IndependentDoctorAdminProps) {
  const [activeTab, setActiveTab] = React.useState("dashboard");
  const [data, setData] = React.useState<IndependentDoctorData>(initialData);
  const [appointments, setAppointments] = React.useState<AppointmentItem[]>(initialAppointments);
  const [isSaving, setIsSaving] = React.useState(false);
  const [saveSuccess, setSaveSuccess] = React.useState(false);

  // New photo input state
  const [newPhotoUrl, setNewPhotoUrl] = React.useState("");

  const navItems: NavItem[] = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "profile", label: "Doctor Profile", icon: User },
    { id: "clinic", label: "Clinic & Address", icon: Building2 },
    { id: "schedule", label: "Consultation Hours", icon: Clock },
    { id: "appointments", label: "Appointments", icon: CalendarCheck, badge: String(appointments.length) },
    { id: "gallery", label: "Clinic Gallery", icon: ImageIcon },
    { id: "ai", label: "AI Content & Bio", icon: Sparkles },
    { id: "seo", label: "SEO & Branding", icon: Palette },
    { id: "settings", label: "Account Settings", icon: Settings },
  ];

  const handleUpdate = async (field: Partial<IndependentDoctorData>) => {
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

  const handleStatusChange = async (appointmentId: string, status: "PENDING" | "CONFIRMED" | "CANCELLED" | "COMPLETED") => {
    setAppointments((prev) =>
      prev.map((a) => (a.id === appointmentId ? { ...a, status } : a))
    );
    if (onUpdateAppointmentStatus) {
      await onUpdateAppointmentStatus(appointmentId, status);
    }
  };

  const handleAddClinicPhoto = () => {
    if (!newPhotoUrl.trim()) return;
    const current = data.clinicPhotos || [];
    if (current.length >= 6) return;
    const updated = [...current, { url: newPhotoUrl.trim() }];
    handleUpdate({ clinicPhotos: updated });
    setNewPhotoUrl("");
  };

  const handleRemoveClinicPhoto = (idx: number) => {
    const current = data.clinicPhotos || [];
    const updated = current.filter((_, i) => i !== idx);
    handleUpdate({ clinicPhotos: updated });
  };

  return (
    <AdminShell
      title={`Dr. ${data.doctorName} — Administration`}
      subtitle={data.clinicName || "Independent Practice"}
      roleBadge="Independent Doctor"
      publicWebsiteUrl={`/${data.slug}`}
      navItems={navItems}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      userEmail={data.email}
    >
      {saveSuccess && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs px-4 py-2.5 rounded-lg flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-emerald-600" />
            <span>Changes successfully saved and updated on your public website.</span>
          </div>
          <Badge variant="outline" className="text-[10px] bg-white border-emerald-300">Synchronized</Badge>
        </div>
      )}

      {/* TAB 1: DASHBOARD */}
      {activeTab === "dashboard" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="bg-white border-slate-200 shadow-2xs">
              <CardHeader className="p-4 pb-2">
                <CardDescription className="text-xs">Website Status</CardDescription>
                <CardTitle className="text-xl font-bold flex items-center gap-2 text-slate-900">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  {data.publishStatus || "PUBLISHED"}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0 text-xs text-slate-500">
                Live at <Link href={`/${data.slug}`} className="font-mono text-emerald-700 underline">/{data.slug}</Link>
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

            <Card className="bg-white border-slate-200 shadow-2xs">
              <CardHeader className="p-4 pb-2">
                <CardDescription className="text-xs">Specialization</CardDescription>
                <CardTitle className="text-lg font-bold text-slate-900 truncate">
                  {data.specialization}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0 text-xs text-slate-500">
                {data.degree} • {data.yearsOfExperience}y exp
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
                        <TableCell className="text-slate-600">{appt.patientPhone}</TableCell>
                        <TableCell className="text-xs text-slate-500">{appt.timeSlot}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              appt.status === "CONFIRMED"
                                ? "success"
                                : appt.status === "PENDING"
                                ? "warning"
                                : "outline"
                            }
                          >
                            {appt.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right space-x-1">
                          {appt.status === "PENDING" && (
                            <Button
                              size="sm"
                              className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700"
                              onClick={() => handleStatusChange(appt.id, "CONFIRMED")}
                            >
                              Confirm
                            </Button>
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
                  value={data.yearsOfExperience}
                  onChange={(e) => setData({ ...data, yearsOfExperience: Number(e.target.value) })}
                />
              </FormField>

              <FormField id="whatsApp" label="WhatsApp Number">
                <Input
                  id="whatsApp"
                  value={data.whatsApp || ""}
                  onChange={(e) => setData({ ...data, whatsApp: e.target.value })}
                />
              </FormField>

              <FormField id="doctorPhoto" label="Doctor Photo URL">
                <Input
                  id="doctorPhoto"
                  value={data.doctorPhoto?.url || ""}
                  onChange={(e) => setData({ ...data, doctorPhoto: { url: e.target.value } })}
                />
              </FormField>
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
                  whatsApp: data.whatsApp,
                  doctorPhoto: data.doctorPhoto,
                  bio: data.bio,
                })
              }
              disabled={isSaving}
              className="bg-slate-900 text-white"
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
            <CardTitle className="text-base font-bold">Clinic Practice Information & Location</CardTitle>
            <CardDescription className="text-xs">Location and facility branding for your independent practice.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField id="clinicName" label="Clinic / Practice Name">
              <Input
                id="clinicName"
                value={data.clinicName || ""}
                onChange={(e) => setData({ ...data, clinicName: e.target.value })}
              />
            </FormField>

            <FormField id="clinicLogo" label="Clinic Logo URL">
              <Input
                id="clinicLogo"
                value={data.clinicLogo?.url || ""}
                onChange={(e) => setData({ ...data, clinicLogo: { url: e.target.value } })}
              />
            </FormField>

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
              className="bg-slate-900 text-white"
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
            <CardDescription className="text-xs">Configure your active consultation schedule and appointment settings.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField id="weeklyOff" label="Weekly Off Day(s)">
              <Input
                id="weeklyOff"
                value={data.weeklyOff || "Sunday"}
                onChange={(e) => setData({ ...data, weeklyOff: e.target.value })}
                placeholder="e.g. Sunday"
              />
            </FormField>

            <FormField id="consultationHours" label="Consultation Schedule (JSON or text)">
              <textarea
                id="consultationHours"
                rows={5}
                value={data.consultationHours || ""}
                onChange={(e) => setData({ ...data, consultationHours: e.target.value })}
                className="w-full font-mono text-xs rounded-md border border-input bg-transparent px-3 py-2 shadow-xs"
              />
            </FormField>

            <div className="flex items-center gap-3 pt-2">
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
              onClick={() =>
                handleUpdate({
                  weeklyOff: data.weeklyOff,
                  consultationHours: data.consultationHours,
                  appointmentRequired: data.appointmentRequired,
                })
              }
              disabled={isSaving}
              className="bg-slate-900 text-white"
            >
              {isSaving ? "Saving..." : "Save Schedule Settings"}
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* TAB 5: APPOINTMENTS */}
      {activeTab === "appointments" && (
        <Card className="bg-white border-slate-200">
          <CardHeader>
            <CardTitle className="text-base font-bold">Patient Appointments & Booking Requests</CardTitle>
            <CardDescription className="text-xs">Manage patient consultation requests and update their confirmation status.</CardDescription>
          </CardHeader>
          <CardContent>
            {appointments.length === 0 ? (
              <div className="text-center py-12 text-xs text-slate-500">
                No appointment records found.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Patient Name</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Date & Slot</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {appointments.map((appt) => (
                    <TableRow key={appt.id}>
                      <TableCell className="font-semibold">{appt.patientName}</TableCell>
                      <TableCell className="text-slate-600">{appt.patientPhone}</TableCell>
                      <TableCell className="text-xs">
                        {appt.appointmentDate.split("T")[0]} • {appt.timeSlot}
                      </TableCell>
                      <TableCell className="text-xs text-slate-500 max-w-xs truncate">
                        {appt.notes || "—"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            appt.status === "CONFIRMED"
                              ? "success"
                              : appt.status === "PENDING"
                              ? "warning"
                              : appt.status === "COMPLETED"
                              ? "secondary"
                              : "destructive"
                          }
                        >
                          {appt.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right space-x-1">
                        {appt.status !== "CONFIRMED" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs text-emerald-700 hover:bg-emerald-50"
                            onClick={() => handleStatusChange(appt.id, "CONFIRMED")}
                          >
                            Confirm
                          </Button>
                        )}
                        {appt.status !== "COMPLETED" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs text-slate-700"
                            onClick={() => handleStatusChange(appt.id, "COMPLETED")}
                          >
                            Complete
                          </Button>
                        )}
                        {appt.status !== "CANCELLED" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs text-rose-600 hover:bg-rose-50"
                            onClick={() => handleStatusChange(appt.id, "CANCELLED")}
                          >
                            Cancel
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* TAB 6: GALLERY */}
      {activeTab === "gallery" && (
        <Card className="bg-white border-slate-200 max-w-3xl">
          <CardHeader>
            <CardTitle className="text-base font-bold">Clinic Photo Gallery</CardTitle>
            <CardDescription className="text-xs">Upload up to 6 facility or clinic photos displayed on your website gallery.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Paste photo image URL (https://...)"
                value={newPhotoUrl}
                onChange={(e) => setNewPhotoUrl(e.target.value)}
              />
              <Button onClick={handleAddClinicPhoto} size="sm" className="bg-slate-900 text-white shrink-0">
                <Plus className="h-4 w-4 mr-1" />
                Add Photo
              </Button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-2">
              {(data.clinicPhotos || []).map((photo, idx) => (
                <div key={idx} className="relative group rounded-xl overflow-hidden border border-slate-200 aspect-[4/3]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photo.url} alt={`Clinic photo ${idx + 1}`} className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => handleRemoveClinicPhoto(idx)}
                    className="absolute top-2 right-2 p-1.5 rounded-full bg-rose-600 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Remove photo"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* TAB 7: AI CONTENT */}
      {activeTab === "ai" && (
        <Card className="bg-white border-slate-200 max-w-3xl">
          <CardHeader>
            <CardTitle className="text-base font-bold">Clinical Bio & Content Editor</CardTitle>
            <CardDescription className="text-xs">Fine-tune the narrative copy presented to patients on your public page.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField id="aiBio" label="Full Clinical Overview">
              <textarea
                id="aiBio"
                rows={6}
                value={data.bio || ""}
                onChange={(e) => setData({ ...data, bio: e.target.value })}
                className="w-full text-sm rounded-md border border-input p-3"
              />
            </FormField>
          </CardContent>
          <CardFooter className="flex justify-end">
            <Button onClick={() => handleUpdate({ bio: data.bio })} disabled={isSaving} className="bg-slate-900 text-white">
              Save Content
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* TAB 8: SEO & BRANDING */}
      {activeTab === "seo" && (
        <Card className="bg-white border-slate-200 max-w-3xl">
          <CardHeader>
            <CardTitle className="text-base font-bold">SEO & Practice Branding</CardTitle>
            <CardDescription className="text-xs">Customize browser tab title, favicon, and search engine metadata.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField id="browserTabTitle" label="Browser Tab Title">
              <Input
                id="browserTabTitle"
                value={data.browserTabTitle || ""}
                onChange={(e) => setData({ ...data, browserTabTitle: e.target.value })}
                placeholder="Dr. Parth Kadiya — Cardiology Specialist"
              />
            </FormField>

            <FormField id="faviconUrl" label="Favicon URL (.ico / .png)">
              <Input
                id="faviconUrl"
                value={data.faviconUrl || ""}
                onChange={(e) => setData({ ...data, faviconUrl: e.target.value })}
                placeholder="https://..."
              />
            </FormField>
          </CardContent>
          <CardFooter className="flex justify-end">
            <Button
              onClick={() => handleUpdate({ browserTabTitle: data.browserTabTitle, faviconUrl: data.faviconUrl })}
              disabled={isSaving}
              className="bg-slate-900 text-white"
            >
              Save Branding
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* TAB 9: SETTINGS */}
      {activeTab === "settings" && (
        <Card className="bg-white border-slate-200 max-w-2xl">
          <CardHeader>
            <CardTitle className="text-base font-bold">Account & Website Settings</CardTitle>
            <CardDescription className="text-xs">Control public visibility and account credentials.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-xs">
            <div className="flex items-center justify-between p-3 rounded-lg border border-slate-200 bg-slate-50">
              <div>
                <span className="font-bold text-slate-900 block">Website Publication State</span>
                <span className="text-slate-500">Toggle whether your website is publicly accessible</span>
              </div>
              <Badge variant={data.publishStatus === "PUBLISHED" ? "success" : "secondary"}>
                {data.publishStatus || "PUBLISHED"}
              </Badge>
            </div>

            <div className="p-3 rounded-lg border border-slate-200 space-y-1">
              <span className="font-bold text-slate-900 block">Registered Doctor Email</span>
              <span className="text-slate-600 font-mono">{data.email}</span>
            </div>
          </CardContent>
        </Card>
      )}
    </AdminShell>
  );
}
