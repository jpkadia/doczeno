import * as React from "react";
import Link from "next/link";
import {
  LayoutDashboard,
  Building2,
  Stethoscope,
  Globe,
  Users,
  CalendarCheck,
  Search,
  CheckCircle,
  AlertTriangle,
  ExternalLink,
  Palette,
  Sliders,
  History,
} from "lucide-react";
import { AdminShell, NavItem } from "../admin-shell";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";

export interface SuperadminStats {
  totalOrganizations: number;
  totalDoctors: number;
  totalWebsites: number;
  totalUsers: number;
  totalAppointments: number;
  pendingAppointments: number;
}

export interface SuperadminOrgItem {
  id: string;
  name: string;
  slug: string;
  type: "HOSPITAL" | "CLINIC";
  status: "ACTIVE" | "INACTIVE" | "SUSPENDED";
  address: {
    city: string;
    state: string;
  };
  createdAt: string;
}

export interface SuperadminDoctorItem {
  id: string;
  doctorName: string;
  slug: string;
  specialization: string;
  yearsOfExperience: number;
  status: "ACTIVE" | "INACTIVE" | "SUSPENDED";
  organizationId?: {
    id: string;
    name: string;
    slug: string;
  } | null;
  createdAt: string;
}

export interface SuperadminWebsiteItem {
  id: string;
  slug: string;
  websiteType: "INDEPENDENT_DOCTOR" | "HOSPITAL" | "HOSPITAL_DOCTOR";
  publishStatus: "PUBLISHED" | "DRAFT";
  selectedTheme: string;
  organizationId?: { name: string; slug: string } | null;
  doctorId?: { doctorName: string; slug: string } | null;
}

export interface SuperadminUserItem {
  id: string;
  name: string;
  email: string;
  role: "SUPERADMIN" | "HOSPITAL_ADMIN" | "INDEPENDENT_DOCTOR" | "HOSPITAL_DOCTOR";
  isActive: boolean;
  createdAt: string;
}

export interface SuperadminAppointmentItem {
  id: string;
  patientName: string;
  patientPhone: string;
  appointmentDate: string;
  timeSlot: string;
  status: "PENDING" | "CONFIRMED" | "CANCELLED" | "COMPLETED";
  doctorId?: { doctorName: string; specialization: string } | null;
  organizationId?: { name: string } | null;
}

export interface AuditLogItem {
  id: string;
  action: string;
  userEmail: string;
  userRole: string;
  entityType: string;
  timestamp: string;
  details?: Record<string, unknown>;
}

interface SuperadminAdminProps {
  initialStats: SuperadminStats;
  initialOrganizations?: SuperadminOrgItem[];
  initialDoctors?: SuperadminDoctorItem[];
  initialWebsites?: SuperadminWebsiteItem[];
  initialUsers?: SuperadminUserItem[];
  initialAppointments?: SuperadminAppointmentItem[];
  initialAuditLogs?: AuditLogItem[];
  onToggleOrgStatus?: (orgId: string, newStatus: string) => Promise<void>;
  onSafeDeleteOrg?: (orgId: string) => Promise<{ success: boolean; message?: string }>;
  onToggleDoctorStatus?: (doctorId: string, newStatus: string) => Promise<void>;
  onToggleWebsitePublish?: (websiteId: string, newStatus: string) => Promise<void>;
  onToggleUserStatus?: (userId: string, newStatus: string) => Promise<void>;
  onUpdateAppointmentStatus?: (appointmentId: string, newStatus: string) => Promise<void>;
}

export function SuperadminAdmin({
  initialStats,
  initialOrganizations = [],
  initialDoctors = [],
  initialWebsites = [],
  initialUsers = [],
  initialAppointments = [],
  initialAuditLogs = [],
  onToggleOrgStatus,
  onSafeDeleteOrg,
  onToggleDoctorStatus,
  onToggleWebsitePublish,
  onToggleUserStatus,
  onUpdateAppointmentStatus,
}: SuperadminAdminProps) {
  const [activeTab, setActiveTab] = React.useState("dashboard");

  // State collections
  const [stats] = React.useState<SuperadminStats>(initialStats);
  const [organizations, setOrganizations] = React.useState<SuperadminOrgItem[]>(initialOrganizations);
  const [doctors, setDoctors] = React.useState<SuperadminDoctorItem[]>(initialDoctors);
  const [websites, setWebsites] = React.useState<SuperadminWebsiteItem[]>(initialWebsites);
  const [users, setUsers] = React.useState<SuperadminUserItem[]>(initialUsers);
  const [appointments, setAppointments] = React.useState<SuperadminAppointmentItem[]>(initialAppointments);
  const [auditLogs] = React.useState<AuditLogItem[]>(initialAuditLogs);

  // Filters & searches
  const [orgSearch, setOrgSearch] = React.useState("");
  const [orgTypeFilter, setOrgTypeFilter] = React.useState("ALL");
  const [doctorSearch, setDoctorSearch] = React.useState("");
  const [doctorAffiliationFilter, setDoctorAffiliationFilter] = React.useState("ALL");
  const [websiteSearch, setWebsiteSearch] = React.useState("");
  const [userSearch, setUserSearch] = React.useState("");
  const [appointmentSearch, setAppointmentSearch] = React.useState("");

  // Notification / Alert
  const [feedbackMessage, setFeedbackMessage] = React.useState<{ text: string; type: "success" | "error" } | null>(null);

  const showNotification = (text: string, type: "success" | "error" = "success") => {
    setFeedbackMessage({ text, type });
    setTimeout(() => setFeedbackMessage(null), 3500);
  };

  const navItems: NavItem[] = [
    { id: "dashboard", label: "Overview & Stats", icon: LayoutDashboard },
    { id: "organizations", label: "Organizations", icon: Building2, badge: String(organizations.length) },
    { id: "doctors", label: "All Doctors", icon: Stethoscope, badge: String(doctors.length) },
    { id: "websites", label: "Websites Directory", icon: Globe, badge: String(websites.length) },
    { id: "users", label: "Users & Accounts", icon: Users, badge: String(users.length) },
    { id: "appointments", label: "Appointments", icon: CalendarCheck, badge: String(stats.pendingAppointments) },
    { id: "audit", label: "Security & Audit", icon: History },
    { id: "templates", label: "Design Templates", icon: Palette },
    { id: "settings", label: "Platform Settings", icon: Sliders },
  ];

  // Handlers
  const handleToggleOrg = async (orgId: string, currentStatus: string) => {
    const nextStatus = currentStatus === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    setOrganizations((prev) =>
      prev.map((o) => (o.id === orgId ? { ...o, status: nextStatus as "ACTIVE" | "INACTIVE" } : o))
    );
    if (onToggleOrgStatus) {
      try {
        await onToggleOrgStatus(orgId, nextStatus);
        showNotification(`Organization marked as ${nextStatus}`);
      } catch (e: unknown) {
        showNotification(e instanceof Error ? e.message : "Failed to update organization status", "error");
      }
    }
  };

  const handleSafeDeleteOrg = async (orgId: string) => {
    if (!confirm("Are you sure you want to deactivate and soft-delete this organization? Affiliated websites will be moved to DRAFT.")) {
      return;
    }
    if (onSafeDeleteOrg) {
      try {
        const res = await onSafeDeleteOrg(orgId);
        if (res.success) {
          setOrganizations((prev) =>
            prev.map((o) => (o.id === orgId ? { ...o, status: "INACTIVE" } : o))
          );
          showNotification(res.message || "Organization safely deactivated");
        }
      } catch (e: unknown) {
        showNotification(e instanceof Error ? e.message : "Cannot delete organization: active dependencies exist.", "error");
      }
    }
  };

  const handleToggleDoctor = async (docId: string, currentStatus: string) => {
    const nextStatus = currentStatus === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    setDoctors((prev) =>
      prev.map((d) => (d.id === docId ? { ...d, status: nextStatus as "ACTIVE" | "INACTIVE" } : d))
    );
    if (onToggleDoctorStatus) {
      try {
        await onToggleDoctorStatus(docId, nextStatus);
        showNotification(`Doctor status updated to ${nextStatus}`);
      } catch (e: unknown) {
        showNotification(e instanceof Error ? e.message : "Failed to toggle doctor status", "error");
      }
    }
  };

  const handleToggleWebsite = async (siteId: string, currentStatus: string) => {
    const nextStatus = currentStatus === "PUBLISHED" ? "DRAFT" : "PUBLISHED";
    setWebsites((prev) =>
      prev.map((w) => (w.id === siteId ? { ...w, publishStatus: nextStatus as "PUBLISHED" | "DRAFT" } : w))
    );
    if (onToggleWebsitePublish) {
      try {
        await onToggleWebsitePublish(siteId, nextStatus);
        showNotification(`Website publish status changed to ${nextStatus}`);
      } catch (e: unknown) {
        showNotification(e instanceof Error ? e.message : "Failed to update publish status", "error");
      }
    }
  };

  const handleToggleUser = async (userId: string, currentActive: boolean) => {
    const nextStatus = currentActive ? "INACTIVE" : "ACTIVE";
    setUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, isActive: !currentActive } : u))
    );
    if (onToggleUserStatus) {
      try {
        await onToggleUserStatus(userId, nextStatus);
        showNotification(`User account marked as ${nextStatus}`);
      } catch (e: unknown) {
        showNotification(e instanceof Error ? e.message : "Failed to update user status", "error");
      }
    }
  };

  const handleUpdateAppt = async (apptId: string, newStatus: string) => {
    setAppointments((prev) =>
      prev.map((a) =>
        a.id === apptId ? { ...a, status: newStatus as SuperadminAppointmentItem["status"] } : a
      )
    );
    if (onUpdateAppointmentStatus) {
      try {
        await onUpdateAppointmentStatus(apptId, newStatus);
        showNotification(`Appointment status marked as ${newStatus}`);
      } catch (e: unknown) {
        showNotification(e instanceof Error ? e.message : "Failed to update appointment", "error");
      }
    }
  };

  // Filtered queries
  const filteredOrgs = organizations.filter((org) => {
    const matchesSearch =
      org.name.toLowerCase().includes(orgSearch.toLowerCase()) ||
      org.slug.toLowerCase().includes(orgSearch.toLowerCase()) ||
      (org.address?.city && org.address.city.toLowerCase().includes(orgSearch.toLowerCase()));
    const matchesType = orgTypeFilter === "ALL" || org.type === orgTypeFilter;
    return matchesSearch && matchesType;
  });

  const filteredDoctors = doctors.filter((doc) => {
    const matchesSearch =
      doc.doctorName.toLowerCase().includes(doctorSearch.toLowerCase()) ||
      doc.specialization.toLowerCase().includes(doctorSearch.toLowerCase()) ||
      doc.slug.toLowerCase().includes(doctorSearch.toLowerCase());
    const matchesAffil =
      doctorAffiliationFilter === "ALL" ||
      (doctorAffiliationFilter === "HOSPITAL" && Boolean(doc.organizationId)) ||
      (doctorAffiliationFilter === "INDEPENDENT" && !doc.organizationId);
    return matchesSearch && matchesAffil;
  });

  const filteredWebsites = websites.filter((site) =>
    site.slug.toLowerCase().includes(websiteSearch.toLowerCase())
  );

  const filteredUsers = users.filter(
    (u) =>
      u.name.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.email.toLowerCase().includes(userSearch.toLowerCase())
  );

  const filteredAppointments = appointments.filter(
    (a) =>
      a.patientName.toLowerCase().includes(appointmentSearch.toLowerCase()) ||
      a.patientPhone.includes(appointmentSearch)
  );

  return (
    <AdminShell
      title="Platform Superadmin Console"
      subtitle="Doczeno Multi-Tenant Control Authority"
      roleBadge="SUPERADMIN"
      navItems={navItems}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      userEmail="superadmin@doczeno.com"
    >
      {/* Toast / Notification */}
      {feedbackMessage && (
        <div
          className={`border text-xs px-4 py-2.5 rounded-lg flex items-center justify-between animate-in fade-in ${
            feedbackMessage.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-rose-50 border-rose-200 text-rose-800"
          }`}
        >
          <div className="flex items-center gap-2">
            {feedbackMessage.type === "success" ? (
              <CheckCircle className="h-4 w-4 text-emerald-600" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-rose-600" />
            )}
            <span>{feedbackMessage.text}</span>
          </div>
        </div>
      )}

      {/* TAB 1: DASHBOARD / OVERVIEW */}
      {activeTab === "dashboard" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Card className="bg-white border-slate-200 shadow-2xs">
              <CardHeader className="p-4 pb-2">
                <CardDescription className="text-xs">Organizations (Hospitals & Clinics)</CardDescription>
                <CardTitle className="text-2xl font-bold text-slate-900">{stats.totalOrganizations}</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0 text-xs text-slate-500">
                Managed healthcare facilities
              </CardContent>
            </Card>

            <Card className="bg-white border-slate-200 shadow-2xs">
              <CardHeader className="p-4 pb-2">
                <CardDescription className="text-xs">Doctors Registered</CardDescription>
                <CardTitle className="text-2xl font-bold text-slate-900">{stats.totalDoctors}</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0 text-xs text-slate-500">
                Independent and hospital-affiliated
              </CardContent>
            </Card>

            <Card className="bg-white border-slate-200 shadow-2xs">
              <CardHeader className="p-4 pb-2">
                <CardDescription className="text-xs">Live Websites</CardDescription>
                <CardTitle className="text-2xl font-bold text-slate-900">{stats.totalWebsites}</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0 text-xs text-slate-500">
                Deterministic theme rendering sites
              </CardContent>
            </Card>

            <Card className="bg-white border-slate-200 shadow-2xs">
              <CardHeader className="p-4 pb-2">
                <CardDescription className="text-xs">Platform Users</CardDescription>
                <CardTitle className="text-2xl font-bold text-slate-900">{stats.totalUsers}</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0 text-xs text-slate-500">
                Superadmins, hospital admins, doctors
              </CardContent>
            </Card>

            <Card className="bg-white border-slate-200 shadow-2xs">
              <CardHeader className="p-4 pb-2">
                <CardDescription className="text-xs">Total Patient Appointments</CardDescription>
                <CardTitle className="text-2xl font-bold text-slate-900">{stats.totalAppointments}</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0 text-xs text-slate-500">
                Platform-wide booking requests
              </CardContent>
            </Card>

            <Card className="bg-white border-slate-200 shadow-2xs">
              <CardHeader className="p-4 pb-2">
                <CardDescription className="text-xs">Pending Appointments</CardDescription>
                <CardTitle className="text-2xl font-bold text-amber-600">{stats.pendingAppointments}</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0 text-xs text-slate-500">
                Awaiting clinic confirmation
              </CardContent>
            </Card>
          </div>

          {/* Quick Actions & Platform Health */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="bg-white border-slate-200">
              <CardHeader>
                <CardTitle className="text-sm font-bold text-slate-900">Platform System Health</CardTitle>
                <CardDescription className="text-xs">Multi-tenant architecture status</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-xs">
                <div className="flex justify-between items-center py-1 border-b border-slate-100">
                  <span className="text-slate-600">Database Engine</span>
                  <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300">
                    MongoDB ReplicaSet Connected
                  </Badge>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-slate-100">
                  <span className="text-slate-600">Authentication Authority</span>
                  <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300">
                    JWT Session & RBAC Verified
                  </Badge>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-slate-100">
                  <span className="text-slate-600">Renderer Engine</span>
                  <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300">
                    Deterministic 3 Themes Active
                  </Badge>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="text-slate-600">Inheritance Guard</span>
                  <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300">
                    Hospital Doctor Lock Active (HTTP 403 Enforced)
                  </Badge>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white border-slate-200">
              <CardHeader>
                <CardTitle className="text-sm font-bold text-slate-900">Recent Security Activity</CardTitle>
                <CardDescription className="text-xs">Audit log summary</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-xs">
                {auditLogs.slice(0, 4).map((log, idx) => (
                  <div key={idx} className="p-2 rounded-md bg-slate-50 border border-slate-200 flex justify-between items-center">
                    <div>
                      <span className="font-semibold text-slate-800 block text-[11px]">{log.action}</span>
                      <span className="text-[10px] text-slate-500">{log.userEmail} ({log.userRole})</span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono">{log.timestamp.slice(11, 19)}</span>
                  </div>
                ))}
                {auditLogs.length === 0 && (
                  <p className="text-slate-400 text-center py-4">No security events recorded yet.</p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* TAB 2: ORGANIZATIONS */}
      {activeTab === "organizations" && (
        <Card className="bg-white border-slate-200">
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-lg font-bold text-slate-900">Organizations Directory</CardTitle>
                <CardDescription className="text-xs">
                  Manage all hospital and clinic tenants on Doczeno
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative w-48 sm:w-64">
                  <Search className="h-3.5 w-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                  <Input
                    placeholder="Search name, slug, city..."
                    value={orgSearch}
                    onChange={(e) => setOrgSearch(e.target.value)}
                    className="pl-8 text-xs h-8"
                  />
                </div>
                <select
                  value={orgTypeFilter}
                  onChange={(e) => setOrgTypeFilter(e.target.value)}
                  className="text-xs h-8 border border-slate-300 rounded-md px-2 bg-white text-slate-700"
                >
                  <option value="ALL">All Types</option>
                  <option value="HOSPITAL">Hospitals</option>
                  <option value="CLINIC">Clinics</option>
                </select>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs font-semibold">Name</TableHead>
                    <TableHead className="text-xs font-semibold">Slug</TableHead>
                    <TableHead className="text-xs font-semibold">Type</TableHead>
                    <TableHead className="text-xs font-semibold">Location</TableHead>
                    <TableHead className="text-xs font-semibold">Status</TableHead>
                    <TableHead className="text-xs font-semibold text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOrgs.map((org) => (
                    <TableRow key={org.id}>
                      <TableCell className="font-semibold text-xs text-slate-900">
                        {org.name}
                      </TableCell>
                      <TableCell className="text-xs font-mono text-slate-600">
                        <Link href={`/${org.slug}`} target="_blank" className="hover:underline text-emerald-700">
                          /{org.slug}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-[10px]">
                          {org.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-slate-600">
                        {org.address?.city}, {org.address?.state}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`text-[10px] font-semibold ${
                            org.status === "ACTIVE"
                              ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                              : "bg-slate-100 text-slate-800 border-slate-300"
                          }`}
                        >
                          {org.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right space-x-1.5 whitespace-nowrap">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleToggleOrg(org.id, org.status)}
                          className="text-[10px] h-7 px-2"
                        >
                          {org.status === "ACTIVE" ? "Deactivate" : "Activate"}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleSafeDeleteOrg(org.id)}
                          className="text-[10px] h-7 px-2 text-rose-600 hover:bg-rose-50"
                        >
                          Safe Delete
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredOrgs.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-6 text-slate-400 text-xs">
                        No organizations match your query.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* TAB 3: DOCTORS */}
      {activeTab === "doctors" && (
        <Card className="bg-white border-slate-200">
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-lg font-bold text-slate-900">All Doctors Platform Directory</CardTitle>
                <CardDescription className="text-xs">
                  Manage independent and hospital-affiliated medical practitioners
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative w-48 sm:w-64">
                  <Search className="h-3.5 w-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                  <Input
                    placeholder="Search doctor, specialization..."
                    value={doctorSearch}
                    onChange={(e) => setDoctorSearch(e.target.value)}
                    className="pl-8 text-xs h-8"
                  />
                </div>
                <select
                  value={doctorAffiliationFilter}
                  onChange={(e) => setDoctorAffiliationFilter(e.target.value)}
                  className="text-xs h-8 border border-slate-300 rounded-md px-2 bg-white text-slate-700"
                >
                  <option value="ALL">All Affiliations</option>
                  <option value="INDEPENDENT">Independent</option>
                  <option value="HOSPITAL">Hospital Doctor</option>
                </select>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs font-semibold">Doctor Name</TableHead>
                    <TableHead className="text-xs font-semibold">Specialization</TableHead>
                    <TableHead className="text-xs font-semibold">Affiliation</TableHead>
                    <TableHead className="text-xs font-semibold">Status</TableHead>
                    <TableHead className="text-xs font-semibold text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDoctors.map((doc) => (
                    <TableRow key={doc.id}>
                      <TableCell className="font-semibold text-xs text-slate-900">
                        Dr. {doc.doctorName}
                        <span className="block font-mono text-[10px] text-slate-500">
                          {doc.organizationId ? `/${doc.organizationId.slug}/${doc.slug}` : `/${doc.slug}`}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs text-slate-700">
                        {doc.specialization} ({doc.yearsOfExperience} yrs)
                      </TableCell>
                      <TableCell className="text-xs">
                        {doc.organizationId ? (
                          <span className="flex items-center gap-1 text-slate-800">
                            <Building2 className="h-3 w-3 text-slate-400" />
                            {doc.organizationId.name}
                          </span>
                        ) : (
                          <Badge variant="outline" className="text-[10px] bg-slate-50">
                            Independent Practice
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`text-[10px] font-semibold ${
                            doc.status === "ACTIVE"
                              ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                              : "bg-slate-100 text-slate-800 border-slate-300"
                          }`}
                        >
                          {doc.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right space-x-1.5 whitespace-nowrap">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleToggleDoctor(doc.id, doc.status)}
                          className="text-[10px] h-7 px-2"
                        >
                          {doc.status === "ACTIVE" ? "Deactivate" : "Activate"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredDoctors.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-6 text-slate-400 text-xs">
                        No doctors match your query.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* TAB 4: WEBSITES DIRECTORY */}
      {activeTab === "websites" && (
        <Card className="bg-white border-slate-200">
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-lg font-bold text-slate-900">Websites Directory</CardTitle>
                <CardDescription className="text-xs">
                  Manage website publication states across the multi-tenant engine
                </CardDescription>
              </div>
              <div className="relative w-48 sm:w-64">
                <Search className="h-3.5 w-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                <Input
                  placeholder="Search slug..."
                  value={websiteSearch}
                  onChange={(e) => setWebsiteSearch(e.target.value)}
                  className="pl-8 text-xs h-8"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs font-semibold">Slug URL</TableHead>
                    <TableHead className="text-xs font-semibold">Website Type</TableHead>
                    <TableHead className="text-xs font-semibold">Assigned Theme</TableHead>
                    <TableHead className="text-xs font-semibold">Publish Status</TableHead>
                    <TableHead className="text-xs font-semibold text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredWebsites.map((site) => (
                    <TableRow key={site.id}>
                      <TableCell className="font-mono text-xs text-emerald-800 font-semibold">
                        <Link href={`/${site.slug}`} target="_blank" className="hover:underline flex items-center gap-1">
                          /{site.slug}
                          <ExternalLink className="h-3 w-3" />
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-[10px]">
                          {site.websiteType}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs capitalize text-slate-700">
                        {site.selectedTheme.replace("-", " ")}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`text-[10px] font-semibold ${
                            site.publishStatus === "PUBLISHED"
                              ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                              : "bg-amber-100 text-amber-800 border-amber-300"
                          }`}
                        >
                          {site.publishStatus}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right space-x-1.5 whitespace-nowrap">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleToggleWebsite(site.id, site.publishStatus)}
                          className="text-[10px] h-7 px-2"
                        >
                          {site.publishStatus === "PUBLISHED" ? "Unpublish to Draft" : "Publish Live"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredWebsites.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-6 text-slate-400 text-xs">
                        No websites found.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* TAB 5: USERS & ACCOUNTS */}
      {activeTab === "users" && (
        <Card className="bg-white border-slate-200">
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-lg font-bold text-slate-900">User Accounts & Roles</CardTitle>
                <CardDescription className="text-xs">
                  Manage user authentication status and authorization access
                </CardDescription>
              </div>
              <div className="relative w-48 sm:w-64">
                <Search className="h-3.5 w-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                <Input
                  placeholder="Search name or email..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="pl-8 text-xs h-8"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs font-semibold">User</TableHead>
                    <TableHead className="text-xs font-semibold">Email</TableHead>
                    <TableHead className="text-xs font-semibold">Role</TableHead>
                    <TableHead className="text-xs font-semibold">Account State</TableHead>
                    <TableHead className="text-xs font-semibold text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-semibold text-xs text-slate-900">
                        {user.name}
                      </TableCell>
                      <TableCell className="text-xs font-mono text-slate-600">
                        {user.email}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={`text-[10px] font-mono ${
                            user.role === "SUPERADMIN" ? "bg-slate-900 text-white" : ""
                          }`}
                        >
                          {user.role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`text-[10px] ${
                            user.isActive
                              ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                              : "bg-rose-50 text-rose-800 border-rose-300"
                          }`}
                        >
                          {user.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right space-x-1.5 whitespace-nowrap">
                        {user.role !== "SUPERADMIN" ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleToggleUser(user.id, user.isActive)}
                            className="text-[10px] h-7 px-2"
                          >
                            {user.isActive ? "Deactivate" : "Activate"}
                          </Button>
                        ) : (
                          <span className="text-[10px] text-slate-400 italic">Protected</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredUsers.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-6 text-slate-400 text-xs">
                        No users match your query.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* TAB 6: APPOINTMENTS */}
      {activeTab === "appointments" && (
        <Card className="bg-white border-slate-200">
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-lg font-bold text-slate-900">Platform-Wide Patient Appointments</CardTitle>
                <CardDescription className="text-xs">
                  All bookings across hospitals, clinics, and independent doctors
                </CardDescription>
              </div>
              <div className="relative w-48 sm:w-64">
                <Search className="h-3.5 w-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                <Input
                  placeholder="Search patient name, phone..."
                  value={appointmentSearch}
                  onChange={(e) => setAppointmentSearch(e.target.value)}
                  className="pl-8 text-xs h-8"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs font-semibold">Patient</TableHead>
                    <TableHead className="text-xs font-semibold">Phone</TableHead>
                    <TableHead className="text-xs font-semibold">Doctor / Practice</TableHead>
                    <TableHead className="text-xs font-semibold">Date & Slot</TableHead>
                    <TableHead className="text-xs font-semibold">Status</TableHead>
                    <TableHead className="text-xs font-semibold text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAppointments.map((appt) => (
                    <TableRow key={appt.id}>
                      <TableCell className="font-semibold text-xs text-slate-900">
                        {appt.patientName}
                      </TableCell>
                      <TableCell className="text-xs font-mono text-slate-600">
                        {appt.patientPhone}
                      </TableCell>
                      <TableCell className="text-xs text-slate-700">
                        {appt.doctorId?.doctorName ? `Dr. ${appt.doctorId.doctorName}` : "—"}
                        {appt.organizationId?.name && (
                          <span className="block text-[10px] text-slate-500">
                            {appt.organizationId.name}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-slate-700">
                        <span className="font-semibold block">{appt.appointmentDate}</span>
                        <span className="text-[11px] text-slate-500">{appt.timeSlot}</span>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`text-[10px] ${
                            appt.status === "CONFIRMED"
                              ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                              : appt.status === "PENDING"
                              ? "bg-amber-50 text-amber-800 border-amber-300"
                              : appt.status === "COMPLETED"
                              ? "bg-sky-50 text-sky-800 border-sky-300"
                              : "bg-rose-50 text-rose-800 border-rose-300"
                          }`}
                        >
                          {appt.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right space-x-1.5 whitespace-nowrap">
                        {appt.status === "PENDING" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleUpdateAppt(appt.id, "CONFIRMED")}
                            className="text-[10px] h-7 px-2 border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                          >
                            Confirm
                          </Button>
                        )}
                        {appt.status !== "CANCELLED" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleUpdateAppt(appt.id, "CANCELLED")}
                            className="text-[10px] h-7 px-2 text-rose-600 hover:bg-rose-50"
                          >
                            Cancel
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredAppointments.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-6 text-slate-400 text-xs">
                        No appointments found.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* TAB 7: SECURITY & AUDIT TRAIL */}
      {activeTab === "audit" && (
        <Card className="bg-white border-slate-200">
          <CardHeader>
            <CardTitle className="text-lg font-bold text-slate-900">Security Audit Trail</CardTitle>
            <CardDescription className="text-xs">
              Immutable chronological record of administrative actions and status updates
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs font-semibold">Action</TableHead>
                    <TableHead className="text-xs font-semibold">Actor Email</TableHead>
                    <TableHead className="text-xs font-semibold">Role</TableHead>
                    <TableHead className="text-xs font-semibold">Entity Type</TableHead>
                    <TableHead className="text-xs font-semibold">Timestamp</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {auditLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="font-mono text-xs font-bold text-slate-900">
                        {log.action}
                      </TableCell>
                      <TableCell className="text-xs font-mono text-slate-600">
                        {log.userEmail}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-[10px]">
                          {log.userRole}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-slate-700">
                        {log.entityType}
                      </TableCell>
                      <TableCell className="text-xs text-slate-500 font-mono">
                        {new Date(log.timestamp).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                  {auditLogs.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-6 text-slate-400 text-xs">
                        No audit events recorded yet.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* TAB 8: DESIGN TEMPLATES PREVIEW */}
      {activeTab === "templates" && (
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Prebuilt Website Themes</h3>
            <p className="text-xs text-slate-500">
              Deterministic, non-AI templates powering all healthcare websites on Doczeno
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="bg-white border-slate-200">
              <CardHeader>
                <Badge variant="secondary" className="w-fit text-[10px] mb-1">Theme 01</Badge>
                <CardTitle className="text-base font-bold text-slate-900">Clinical Editorial</CardTitle>
                <CardDescription className="text-xs">
                  Academic, authoritative, serif accents, structured multi-column hero.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-xs text-slate-600">
                <div className="p-2 bg-slate-50 rounded border text-[11px]">
                  <strong>Layout:</strong> Split hero with clinical credentials & badge highlights.
                </div>
                <div className="p-2 bg-slate-50 rounded border text-[11px]">
                  <strong>Target:</strong> Senior specialists, teaching hospitals, research clinics.
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white border-slate-200">
              <CardHeader>
                <Badge variant="secondary" className="w-fit text-[10px] mb-1">Theme 02</Badge>
                <CardTitle className="text-base font-bold text-slate-900">Modern Minimal</CardTitle>
                <CardDescription className="text-xs">
                  Clean sans-serif, high whitespace, centered hero with quick appointment modal.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-xs text-slate-600">
                <div className="p-2 bg-slate-50 rounded border text-[11px]">
                  <strong>Layout:</strong> Centered minimal hero with floating consultation stats.
                </div>
                <div className="p-2 bg-slate-50 rounded border text-[11px]">
                  <strong>Target:</strong> Contemporary clinics, wellness centers, urban practices.
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white border-slate-200">
              <CardHeader>
                <Badge variant="secondary" className="w-fit text-[10px] mb-1">Theme 03</Badge>
                <CardTitle className="text-base font-bold text-slate-900">Vital Compact</CardTitle>
                <CardDescription className="text-xs">
                  High-contrast density, immediate emergency and booking CTA ribbon.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-xs text-slate-600">
                <div className="p-2 bg-slate-50 rounded border text-[11px]">
                  <strong>Layout:</strong> Full-width quick action bar, tabbed departments.
                </div>
                <div className="p-2 bg-slate-50 rounded border text-[11px]">
                  <strong>Target:</strong> Multi-specialty hospitals, emergency centers, polyclinics.
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* TAB 9: PLATFORM SETTINGS */}
      {activeTab === "settings" && (
        <Card className="bg-white border-slate-200">
          <CardHeader>
            <CardTitle className="text-lg font-bold text-slate-900">Platform Settings</CardTitle>
            <CardDescription className="text-xs">
              Global Doczeno healthcare configuration and operational policies
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 max-w-xl text-xs">
            <div>
              <span className="font-semibold text-slate-700 block">Platform Version</span>
              <p className="font-mono text-slate-900 mt-1">Doczeno 2.0 (Strict Frontend / Backend Separation)</p>
            </div>
            <div>
              <span className="font-semibold text-slate-700 block">Backend Authority API</span>
              <p className="font-mono text-slate-900 mt-1">Express API on port 5000 with JWT Auth</p>
            </div>
            <div>
              <span className="font-semibold text-slate-700 block">Frontend Rendering System</span>
              <p className="font-mono text-slate-900 mt-1">Next.js App Router on port 3000</p>
            </div>
            <div>
              <span className="font-semibold text-slate-700 block">Doctor Name Prefix Standard</span>
              <p className="text-slate-900 mt-1">Strict `Dr.` prefix normalization enforced across UI & API</p>
            </div>
          </CardContent>
        </Card>
      )}
    </AdminShell>
  );
}
