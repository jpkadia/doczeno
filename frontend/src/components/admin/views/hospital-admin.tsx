import * as React from "react";
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
} from "lucide-react";
import { AdminShell, NavItem } from "../admin-shell";
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { FormField } from "@/components/forms/form-field";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";

export interface HospitalDoctorItem {
  id: string;
  doctorName: string;
  slug: string;
  gender: string;
  degree: string;
  specialization: string;
  yearsOfExperience: number;
  whatsApp?: string;
  email: string;
  doctorPhoto?: { url: string };
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
  selectedTheme: "clinical-editorial" | "modern-minimal" | "vital-compact" | string;
  logo?: { url: string };
  galleryPhotos?: Array<{ url: string }>;
  faviconUrl?: string;
  browserTabTitle?: string;
  departments?: string[];
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
}: HospitalAdminProps) {
  // Suppress unused param if not referenced yet
  void onUpdateDoctor;
  const [activeTab, setActiveTab] = React.useState("dashboard");
  const [hospital, setHospital] = React.useState<HospitalData>(initialHospital);
  const [doctors, setDoctors] = React.useState<HospitalDoctorItem[]>(initialDoctors);
  const [appointments, setAppointments] = React.useState<AppointmentItem[]>(initialAppointments);
  const [isSaving, setIsSaving] = React.useState(false);
  const [saveSuccess, setSaveSuccess] = React.useState(false);

  const handleApptStatusChange = async (id: string, status: string) => {
    setAppointments((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status: status as AppointmentItem["status"] } : a))
    );
    if (onUpdateAppointmentStatus) {
      await onUpdateAppointmentStatus(id, status);
    }
  };

  // Add Doctor Dialog State
  const [addDoctorOpen, setAddDoctorOpen] = React.useState(false);
  const [newDoctor, setNewDoctor] = React.useState<Partial<HospitalDoctorItem>>({
    doctorName: "",
    gender: "MALE",
    degree: "",
    specialization: "General Medicine",
    yearsOfExperience: 5,
    email: "",
    whatsApp: "",
    consultationHours: "10:00 - 16:00",
    weeklyOff: "Sunday",
    appointmentRequired: true,
  });

  // Department input
  const [newDepartmentName, setNewDepartmentName] = React.useState("");
  // Gallery photo input
  const [newGalleryPhotoUrl, setNewGalleryPhotoUrl] = React.useState("");

  const navItems: NavItem[] = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "profile", label: "Hospital Profile", icon: Building2 },
    { id: "location", label: "Contact & Location", icon: MapPin },
    { id: "hours", label: "Working Hours", icon: Clock },
    { id: "doctors", label: "Doctor Management", icon: Users, badge: String(doctors.length) },
    { id: "departments", label: "Departments", icon: Stethoscope },
    { id: "appointments", label: "Appointments", icon: CalendarCheck, badge: String(appointments.length) },
    { id: "gallery", label: "Facility Gallery", icon: ImageIcon },
    { id: "branding", label: "Theme & Branding", icon: Palette },
    { id: "settings", label: "Settings", icon: Settings },
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
    const docToCreate = {
      ...newDoctor,
      slug: newDoctor.doctorName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, ""),
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

  const handleAddGalleryPhoto = () => {
    if (!newGalleryPhotoUrl.trim()) return;
    const current = hospital.galleryPhotos || [];
    const updated = [...current, { url: newGalleryPhotoUrl.trim() }];
    handleUpdateHospital({ galleryPhotos: updated });
    setNewGalleryPhotoUrl("");
  };

  const handleRemoveGalleryPhoto = (idx: number) => {
    const current = hospital.galleryPhotos || [];
    const updated = current.filter((_, i) => i !== idx);
    handleUpdateHospital({ galleryPhotos: updated });
  };

  return (
    <AdminShell
      title={`${hospital.name} — Hospital Administration`}
      subtitle={`${hospital.type} Management Console`}
      roleBadge="Hospital Admin"
      publicWebsiteUrl={`/${hospital.slug}`}
      navItems={navItems}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      userEmail={hospital.email}
    >
      {saveSuccess && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs px-4 py-2.5 rounded-lg flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-emerald-600" />
            <span>Hospital updates saved. All affiliated doctor websites reflect updates dynamically.</span>
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
                <CardDescription className="text-xs">Affiliated Doctors</CardDescription>
                <CardTitle className="text-2xl font-bold text-slate-900">{doctors.length}</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0 text-xs text-slate-500">
                {doctors.filter((d) => d.status === "ACTIVE").length} Active on Public Site
              </CardContent>
            </Card>

            <Card className="bg-white border-slate-200 shadow-2xs">
              <CardHeader className="p-4 pb-2">
                <CardDescription className="text-xs">Clinical Departments</CardDescription>
                <CardTitle className="text-2xl font-bold text-slate-900">
                  {hospital.departments?.length || 0}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0 text-xs text-slate-500">
                Specialties configured
              </CardContent>
            </Card>

            <Card className="bg-white border-slate-200 shadow-2xs">
              <CardHeader className="p-4 pb-2">
                <CardDescription className="text-xs">Total Inquiries</CardDescription>
                <CardTitle className="text-2xl font-bold text-slate-900">{appointments.length}</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0 text-xs text-slate-500">
                Hospital-wide appointments
              </CardContent>
            </Card>

            <Card className="bg-white border-slate-200 shadow-2xs">
              <CardHeader className="p-4 pb-2">
                <CardDescription className="text-xs">Active Theme</CardDescription>
                <CardTitle className="text-base font-bold text-sky-800 font-mono">
                  {hospital.selectedTheme}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0 text-xs text-slate-500">
                Inherited by all doctors
              </CardContent>
            </Card>
          </div>

          {/* Quick Doctor Roster Preview */}
          <Card className="bg-white border-slate-200">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="text-base font-bold">Medical Faculty Overview</CardTitle>
                <CardDescription className="text-xs">Doctors registered under this hospital entity.</CardDescription>
              </div>
              <Button size="sm" onClick={() => setActiveTab("doctors")} className="bg-slate-900 text-white text-xs">
                Manage Doctors
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Doctor Name</TableHead>
                    <TableHead>Specialization</TableHead>
                    <TableHead>Experience</TableHead>
                    <TableHead>Public URL</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {doctors.slice(0, 5).map((doc) => (
                    <TableRow key={doc.id}>
                      <TableCell className="font-semibold text-slate-900">Dr. {doc.doctorName}</TableCell>
                      <TableCell>{doc.specialization}</TableCell>
                      <TableCell>{doc.yearsOfExperience}y</TableCell>
                      <TableCell className="font-mono text-xs text-slate-600">
                        /{hospital.slug}/{doc.slug}
                      </TableCell>
                      <TableCell>
                        <Badge variant={doc.status === "ACTIVE" ? "success" : "secondary"}>
                          {doc.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}

      {/* TAB 2: HOSPITAL PROFILE */}
      {activeTab === "profile" && (
        <Card className="bg-white border-slate-200 max-w-3xl">
          <CardHeader>
            <CardTitle className="text-base font-bold">Hospital Identity & Information</CardTitle>
            <CardDescription className="text-xs">Institutional name and public overview narrative.</CardDescription>
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
              className="bg-slate-900 text-white"
            >
              {isSaving ? "Saving..." : "Save Hospital Profile"}
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* TAB 3: CONTACT & LOCATION */}
      {activeTab === "location" && (
        <Card className="bg-white border-slate-200 max-w-3xl">
          <CardHeader>
            <CardTitle className="text-base font-bold">Contact Channels & Hospital Facility Address</CardTitle>
            <CardDescription className="text-xs">
              This address is dynamically inherited by all doctors practicing at this hospital.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField id="phone" label="Hospital Reception Phone">
                <Input
                  id="phone"
                  value={hospital.phone}
                  onChange={(e) => setHospital({ ...hospital, phone: e.target.value })}
                />
              </FormField>

              <FormField id="whatsApp" label="Official WhatsApp Number">
                <Input
                  id="whatsApp"
                  value={hospital.whatsApp || ""}
                  onChange={(e) => setHospital({ ...hospital, whatsApp: e.target.value })}
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
              className="bg-slate-900 text-white"
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
            <CardTitle className="text-base font-bold">Hospital Operating Hours</CardTitle>
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
              className="bg-slate-900 text-white"
            >
              Save Working Hours
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* TAB 5: DOCTOR MANAGEMENT */}
      {activeTab === "doctors" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900">Hospital Medical Faculty Management</h2>
              <p className="text-xs text-slate-500">Add, edit, or deactivate doctors practicing at this hospital.</p>
            </div>

            <Dialog open={addDoctorOpen} onOpenChange={setAddDoctorOpen}>
              <DialogTrigger asChild>
                <Button className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs">
                  <Plus className="h-4 w-4 mr-1.5" />
                  Add Doctor to Hospital
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Register Affiliated Doctor</DialogTitle>
                  <DialogDescription>
                    The doctor will be registered under {hospital.name} and automatically inherit its theme, address, and branding.
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
                        onChange={(e) => setNewDoctor({ ...newDoctor, doctorName: e.target.value })}
                        placeholder="Rajiv Shah"
                        className="rounded-l-none"
                      />
                    </div>
                  </FormField>

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
                    <Input
                      id="newWhatsApp"
                      value={newDoctor.whatsApp || ""}
                      onChange={(e) => setNewDoctor({ ...newDoctor, whatsApp: e.target.value })}
                    />
                  </FormField>

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
                  <Button onClick={handleCreateDoctorSubmit} className="bg-emerald-600 text-white">
                    Confirm & Register Doctor
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <Card className="bg-white border-slate-200">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Doctor</TableHead>
                    <TableHead>Specialization</TableHead>
                    <TableHead>Qualifications</TableHead>
                    <TableHead>Experience</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {doctors.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-xs text-slate-500">
                        No doctors registered yet. Click &quot;Add Doctor to Hospital&quot; above.
                      </TableCell>
                    </TableRow>
                  ) : (
                    doctors.map((doc) => (
                      <TableRow key={doc.id}>
                        <TableCell>
                          <div className="font-bold text-slate-900">Dr. {doc.doctorName}</div>
                          <div className="text-[11px] text-slate-500 font-mono">/{hospital.slug}/{doc.slug}</div>
                        </TableCell>
                        <TableCell>{doc.specialization}</TableCell>
                        <TableCell className="text-xs text-slate-600">{doc.degree}</TableCell>
                        <TableCell>{doc.yearsOfExperience}y</TableCell>
                        <TableCell>
                          <Badge variant={doc.status === "ACTIVE" ? "success" : "secondary"}>
                            {doc.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right space-x-1">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={() => handleToggleDoc(doc.id, doc.status)}
                          >
                            {doc.status === "ACTIVE" ? "Deactivate" : "Activate"}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}

      {/* TAB 6: DEPARTMENTS */}
      {activeTab === "departments" && (
        <Card className="bg-white border-slate-200 max-w-3xl">
          <CardHeader>
            <CardTitle className="text-base font-bold">Clinical Departments & Specialties</CardTitle>
            <CardDescription className="text-xs">Configure the services displayed in the public hospital directory.</CardDescription>
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

      {/* TAB 7: APPOINTMENTS */}
      {activeTab === "appointments" && (
        <Card className="bg-white border-slate-200">
          <CardHeader>
            <CardTitle className="text-base font-bold">Hospital-Wide Appointments</CardTitle>
            <CardDescription className="text-xs">Manage patient consultations across all hospital doctors.</CardDescription>
          </CardHeader>
          <CardContent>
            {appointments.length === 0 ? (
              <div className="text-center py-12 text-xs text-slate-500">
                No appointments booked at this hospital yet.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Patient</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Assigned Doctor</TableHead>
                    <TableHead>Date & Slot</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {appointments.map((appt) => (
                    <TableRow key={appt.id}>
                      <TableCell className="font-semibold">{appt.patientName}</TableCell>
                      <TableCell className="text-slate-600">{appt.patientPhone}</TableCell>
                      <TableCell className="text-xs font-medium text-slate-800">{appt.doctorName || "General OPD"}</TableCell>
                      <TableCell className="text-xs">{appt.appointmentDate.split("T")[0]} • {appt.timeSlot}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            appt.status === "CONFIRMED"
                              ? "success"
                              : appt.status === "PENDING"
                              ? "warning"
                              : "secondary"
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
                            onClick={() => handleApptStatusChange(appt.id, "CONFIRMED")}
                          >
                            Confirm
                          </Button>
                        )}
                        {appt.status !== "CANCELLED" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs text-rose-600 hover:bg-rose-50"
                            onClick={() => handleApptStatusChange(appt.id, "CANCELLED")}
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

      {/* TAB 8: FACILITY GALLERY */}
      {activeTab === "gallery" && (
        <Card className="bg-white border-slate-200 max-w-3xl">
          <CardHeader>
            <CardTitle className="text-base font-bold">Hospital Facility Photos</CardTitle>
            <CardDescription className="text-xs">
              These photos are inherited at render time on all affiliated doctor websites.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Image URL (https://...)"
                value={newGalleryPhotoUrl}
                onChange={(e) => setNewGalleryPhotoUrl(e.target.value)}
              />
              <Button onClick={handleAddGalleryPhoto} size="sm" className="bg-slate-900 text-white shrink-0">
                <Plus className="h-4 w-4 mr-1" />
                Add Image
              </Button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-2">
              {(hospital.galleryPhotos || []).map((photo, idx) => (
                <div key={idx} className="relative group rounded-xl overflow-hidden border border-slate-200 aspect-[4/3]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photo.url} alt={`Facility photo ${idx + 1}`} className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => handleRemoveGalleryPhoto(idx)}
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

      {/* TAB 9: THEME & BRANDING */}
      {activeTab === "branding" && (
        <Card className="bg-white border-slate-200 max-w-3xl">
          <CardHeader>
            <CardTitle className="text-base font-bold">Theme Selection & Master Hospital Branding</CardTitle>
            <CardDescription className="text-xs">
              The hospital selects a theme. All affiliated doctors automatically inherit this theme at render time.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* 3 Theme Selector Cards */}
            <div>
              <span className="text-xs font-bold text-slate-900 block mb-2">
                Choose Website Theme (Propagates to all child doctor pages)
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  {
                    id: "clinical-editorial",
                    title: "Theme 01: Clinical Editorial",
                    desc: "Authoritative editorial style, dark utility header, serif typography, quote block.",
                  },
                  {
                    id: "modern-minimal",
                    title: "Theme 02: Modern Minimal",
                    desc: "Geometric center hero, floating stats ribbon, frameless cards, teal accents.",
                  },
                  {
                    id: "vital-compact",
                    title: "Theme 03: Vital Compact",
                    desc: "High-density card stack, segmented tabs, mobile-first, sticky bottom bar.",
                  },
                ].map((th) => {
                  const isSelected = hospital.selectedTheme === th.id;
                  return (
                    <div
                      key={th.id}
                      onClick={() => setHospital({ ...hospital, selectedTheme: th.id as HospitalData["selectedTheme"] })}
                      className={`cursor-pointer rounded-xl border p-4 space-y-2 transition-all ${
                        isSelected
                          ? "border-emerald-600 bg-emerald-50/40 ring-2 ring-emerald-500/20 shadow-xs"
                          : "border-slate-200 hover:border-slate-300 bg-white"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-slate-900">{th.title}</span>
                        {isSelected && <CheckCircle className="h-4 w-4 text-emerald-600" />}
                      </div>
                      <p className="text-[11px] text-slate-500 leading-relaxed">{th.desc}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="space-y-4 pt-2 border-t border-slate-100">
              <FormField id="hospLogo" label="Hospital Logo URL">
                <Input
                  id="hospLogo"
                  value={hospital.logo?.url || ""}
                  onChange={(e) => setHospital({ ...hospital, logo: { url: e.target.value } })}
                />
              </FormField>

              <FormField id="hospFav" label="Favicon URL (.ico / .png)">
                <Input
                  id="hospFav"
                  value={hospital.faviconUrl || ""}
                  onChange={(e) => setHospital({ ...hospital, faviconUrl: e.target.value })}
                />
              </FormField>

              <FormField id="hospTab" label="Browser Tab Title">
                <Input
                  id="hospTab"
                  value={hospital.browserTabTitle || ""}
                  onChange={(e) => setHospital({ ...hospital, browserTabTitle: e.target.value })}
                />
              </FormField>
            </div>
          </CardContent>
          <CardFooter className="flex justify-end">
            <Button
              onClick={() =>
                handleUpdateHospital({
                  selectedTheme: hospital.selectedTheme,
                  logo: hospital.logo,
                  faviconUrl: hospital.faviconUrl,
                  browserTabTitle: hospital.browserTabTitle,
                })
              }
              disabled={isSaving}
              className="bg-slate-900 text-white"
            >
              Save Branding & Apply to Doctors
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* TAB 10: SETTINGS */}
      {activeTab === "settings" && (
        <Card className="bg-white border-slate-200 max-w-2xl">
          <CardHeader>
            <CardTitle className="text-base font-bold">Hospital Account Settings</CardTitle>
            <CardDescription className="text-xs">Hospital credentials and status.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-xs">
            <div className="p-3 rounded-lg border border-slate-200 bg-slate-50 space-y-1">
              <span className="font-bold text-slate-900 block">Organization Unique Slug</span>
              <span className="font-mono text-slate-700">/{hospital.slug}</span>
            </div>
            <div className="p-3 rounded-lg border border-slate-200 space-y-1">
              <span className="font-bold text-slate-900 block">Registered Hospital Admin Email</span>
              <span className="font-mono text-slate-700">{hospital.email}</span>
            </div>
          </CardContent>
        </Card>
      )}
    </AdminShell>
  );
}
