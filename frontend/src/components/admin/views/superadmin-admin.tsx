"use client";

import * as React from "react";
import Link from "next/link";
import {
  LayoutDashboard,
  Building2,
  Stethoscope,
  Globe,
  ExternalLink,
  Link2,
  QrCode,
  Cpu,
  Trash2,
  AlertTriangle,
  CheckCircle,
  Info,
  Download,
  Loader2,
  UserCheck,
  Power,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AdminShell, NavItem } from "../admin-shell";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { DataTable, ColumnDef } from "@/components/ui/data-table";
import { usePlatformDomain } from "@/hooks/use-platform-domain";
import { GeminiAnalyticsView } from "./gemini-analytics-view";
import { AdminLogView } from "../admin-log-view";
import { CustomDomainsView, CustomDomainTargetSelection } from "./custom-domains-view";
import { apiClient } from "@/lib/api-client";
import { toast } from "sonner";

export interface SuperadminStats {
  totalOrganizations: number;
  totalDoctors: number;
  totalWebsites: number;
  activeWebsitesCount?: number;
  deactiveWebsitesCount?: number;
  totalUsers: number;
  totalAppointments: number;
  pendingAppointments: number;
  deletedDoctorsCount?: number;
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
  phone?: string;
  isWebsiteChatbotEnabled?: boolean;
  isAdminChatbotEnabled?: boolean;
  isChatbotBookingEnabled?: boolean;
  isAiRegenerateEnabled?: boolean;
  isVisibleInDoctorOnboarding?: boolean;
  createdAt: string;
}

export interface SuperadminDoctorItem {
  id: string;
  doctorName: string;
  slug: string;
  specialization: string;
  yearsOfExperience: number;
  status: "ACTIVE" | "INACTIVE" | "SUSPENDED";
  deactivatedByRole?: "SUPERADMIN" | "HOSPITAL_ADMIN" | null;
  isWebsiteChatbotEnabled?: boolean;
  isAdminChatbotEnabled?: boolean;
  isChatbotBookingEnabled?: boolean;
  isAiRegenerateEnabled?: boolean;
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
  onLogout?: () => void;
}

export function SuperadminAdmin({
  initialStats,
  initialOrganizations = [],
  initialDoctors = [],
  initialWebsites: _initialWebsites = [],
  initialUsers: _initialUsers = [],
  initialAppointments: _initialAppointments = [],
  initialAuditLogs: _initialAuditLogs = [],
  onToggleOrgStatus,
  onSafeDeleteOrg: _onSafeDeleteOrg,
  onToggleDoctorStatus,
  onToggleWebsitePublish: _onToggleWebsitePublish,
  onToggleUserStatus: _onToggleUserStatus,
  onUpdateAppointmentStatus: _onUpdateAppointmentStatus,
  onLogout,
}: SuperadminAdminProps) {
  const [activeTab, setActiveTab] = React.useState("dashboard");

  // State collections
  const [stats, setStats] = React.useState<SuperadminStats>(initialStats);
  const [organizations, setOrganizations] = React.useState<SuperadminOrgItem[]>(initialOrganizations);
  const [doctors, setDoctors] = React.useState<SuperadminDoctorItem[]>(initialDoctors);

  React.useEffect(() => { setStats(initialStats); }, [initialStats]);
  React.useEffect(() => { setOrganizations(initialOrganizations); }, [initialOrganizations]);
  React.useEffect(() => { setDoctors(initialDoctors); }, [initialDoctors]);

  // Filters
  const [orgTypeFilter, setOrgTypeFilter] = React.useState("ALL");
  const [doctorAffiliationFilter, setDoctorAffiliationFilter] = React.useState("ALL");

  // Notification / Alert
  const [feedbackMessage, setFeedbackMessage] = React.useState<{ text: string; type: "success" | "error" } | null>(null);

  const showNotification = (text: string, type: "success" | "error" = "success") => {
    setFeedbackMessage({ text, type });
    setTimeout(() => setFeedbackMessage(null), 3500);
  };

  // Platform Domain State (Fixed to doczeno.vercel.app)
  const { formatUrl } = usePlatformDomain();

  // Starting Page Onboarding Categories Toggle State
  const [onboardingCategories, setOnboardingCategories] = React.useState<{
    portalEnabled: boolean;
    onlyDoctor: boolean;
    hospital: boolean;
    hospitalDoctor: boolean;
  }>({
    portalEnabled: true,
    onlyDoctor: true,
    hospital: true,
    hospitalDoctor: true,
  });
  const [loadingCategories, setLoadingCategories] = React.useState(false);
  const [savingCategoryKey, setSavingCategoryKey] = React.useState<string | null>(null);

  React.useEffect(() => {
    async function loadCategories() {
      setLoadingCategories(true);
      try {
        const res = await apiClient.get<{
          success: boolean;
          data?: {
            onboardingCategories?: {
              portalEnabled?: boolean;
              onlyDoctor?: boolean;
              hospital?: boolean;
              hospitalDoctor?: boolean;
            };
          };
        }>("/superadmin/settings/onboarding-categories");
        if (res.success && res.data?.onboardingCategories) {
          const cats = res.data.onboardingCategories;
          setOnboardingCategories({
            portalEnabled: cats.portalEnabled !== false,
            onlyDoctor: cats.onlyDoctor !== false,
            hospital: cats.hospital !== false,
            hospitalDoctor: cats.hospitalDoctor !== false,
          });
        }
      } catch {
        // Fallback defaults
      } finally {
        setLoadingCategories(false);
      }
    }
    loadCategories();
  }, []);

  const handleToggleOnboardingCategory = async (
    key: "portalEnabled" | "onlyDoctor" | "hospital" | "hospitalDoctor",
    label: string,
    checked: boolean
  ) => {
    const previous = onboardingCategories;
    const next = { ...onboardingCategories, [key]: checked };
    setOnboardingCategories(next);
    setSavingCategoryKey(key);
    try {
      await apiClient.patch("/superadmin/settings/onboarding-categories", { [key]: checked });
      toast.success(`${label} onboarding ${checked ? "enabled" : "disabled"} on the starting page.`);
    } catch (err: unknown) {
      setOnboardingCategories(previous);
      const msg = err instanceof Error ? err.message : "Failed to update category setting";
      toast.error(msg);
    } finally {
      setSavingCategoryKey(null);
    }
  };

  const [usedCustomDomainsCount, setUsedCustomDomainsCount] = React.useState<number>(0);
  const [customDomainTarget, setCustomDomainTarget] =
    React.useState<CustomDomainTargetSelection | null>(null);

  React.useEffect(() => {
    apiClient
      .get<{ success: boolean; data?: { usedCount?: number } }>("/superadmin/custom-domains")
      .then((res) => {
        if (res.success && typeof res.data?.usedCount === "number") {
          setUsedCustomDomainsCount(res.data.usedCount);
        }
      })
      .catch(() => {});
  }, []);

  const navItems: NavItem[] = [
    { id: "dashboard", label: "Overview & Stats", icon: LayoutDashboard },
    { id: "organizations", label: "Hospitals & Clinics", icon: Building2, badge: String(organizations.length) },
    { id: "doctors", label: "All Doctors", icon: Stethoscope, badge: String(doctors.length) },
    { id: "custom-domains", label: "Custom Domains", icon: Globe, badge: `${usedCustomDomainsCount}/50` },
    { id: "settings", label: "Platform Information", icon: Info },
    { id: "admin-logs", label: "Admin Log", icon: ShieldCheck },
    { id: "gemini-api", label: "Gemini AI Analytics", icon: Cpu },
  ];

  // Handlers
  const handleToggleOrg = async (orgId: string, currentStatus: string) => {
    const nextStatus = currentStatus === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    const nextDeactivatedBy = nextStatus === "ACTIVE" ? null : "SUPERADMIN";

    setOrganizations((prev) =>
      prev.map((o) => (o.id === orgId ? { ...o, status: nextStatus as "ACTIVE" | "INACTIVE" } : o))
    );
    setDoctors((prev) =>
      prev.map((d) =>
        d.organizationId?.id === orgId
          ? { ...d, status: nextStatus as "ACTIVE" | "INACTIVE", deactivatedByRole: nextDeactivatedBy }
          : d
      )
    );
    if (onToggleOrgStatus) {
      try {
        await onToggleOrgStatus(orgId, nextStatus);
        const statsRes = await apiClient
          .get<{ success: boolean; data?: SuperadminStats }>("/superadmin/stats")
          .catch(() => null);
        if (statsRes?.success && statsRes.data) {
          setStats(statsRes.data);
        }
        showNotification(
          `Hospital and connected doctors marked as ${nextStatus}`
        );
      } catch (e: unknown) {
        showNotification(e instanceof Error ? e.message : "Failed to update organization status", "error");
      }
    }
  };

  const handleToggleDoctor = async (docId: string, currentStatus: string) => {
    const nextStatus = currentStatus === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    const nextDeactivatedBy = nextStatus === "ACTIVE" ? null : "SUPERADMIN";

    setDoctors((prev) =>
      prev.map((d) =>
        d.id === docId
          ? { ...d, status: nextStatus as "ACTIVE" | "INACTIVE", deactivatedByRole: nextDeactivatedBy }
          : d
      )
    );
    setStats((prev) => {
      const delta = nextStatus === "ACTIVE" ? 1 : -1;
      return {
        ...prev,
        activeWebsitesCount: Math.max(0, (prev.activeWebsitesCount ?? 0) + delta),
        deactiveWebsitesCount: Math.max(0, (prev.deactiveWebsitesCount ?? 0) - delta),
      };
    });
    if (onToggleDoctorStatus) {
      try {
        await onToggleDoctorStatus(docId, nextStatus);
        showNotification(`Doctor status updated to ${nextStatus}`);
      } catch (e: unknown) {
        showNotification(e instanceof Error ? e.message : "Failed to toggle doctor status", "error");
      }
    }
  };

  const handleToggleOrgChatbot = React.useCallback(
    async (
      orgId: string,
      field: "isWebsiteChatbotEnabled" | "isAdminChatbotEnabled" | "isChatbotBookingEnabled",
      currentVal: boolean
    ) => {
      const newVal = !currentVal;
      setOrganizations((prev) =>
        prev.map((o) => (o.id === orgId ? { ...o, [field]: newVal } : o))
      );
      try {
        await apiClient.patch(`/superadmin/organizations/${orgId}/chatbot-settings`, {
          [field]: newVal,
        });
        const label =
          field === "isWebsiteChatbotEnabled"
            ? "Website Chatbot"
            : field === "isAdminChatbotEnabled"
            ? "Admin AI Copilot"
            : "Book Appointment on Chatbot";
        toast.success(
          `${label} has been ${newVal ? "enabled" : "disabled"}${
            !newVal ? " (also disabled for affiliated hospital doctors)" : ""
          }.`
        );
      } catch (err: any) {
        setOrganizations((prev) =>
          prev.map((o) => (o.id === orgId ? { ...o, [field]: currentVal } : o))
        );
        toast.error(err?.response?.data?.error || "Failed to update chatbot settings");
      }
    },
    []
  );

  const handleToggleOrgOnboardingVisibility = React.useCallback(
    async (orgId: string, currentVal: boolean) => {
      const newVal = !currentVal;
      setOrganizations((prev) =>
        prev.map((o) =>
          o.id === orgId ? { ...o, isVisibleInDoctorOnboarding: newVal } : o
        )
      );
      try {
        await apiClient.patch(
          `/superadmin/organizations/${orgId}/doctor-onboarding-visibility`,
          { isVisibleInDoctorOnboarding: newVal }
        );
        toast.success(
          `Hospital ${newVal ? "is now visible" : "is now hidden"} in the Hospital Doctor onboarding form.`
        );
      } catch (err: any) {
        setOrganizations((prev) =>
          prev.map((o) =>
            o.id === orgId ? { ...o, isVisibleInDoctorOnboarding: currentVal } : o
          )
        );
        toast.error(err?.response?.data?.error || "Failed to update doctor form visibility");
      }
    },
    []
  );

  const handleToggleOrgAiRegenerate = React.useCallback(
    async (orgId: string, currentVal: boolean) => {
      const newVal = !currentVal;
      setOrganizations((prev) =>
        prev.map((o) =>
          o.id === orgId ? { ...o, isAiRegenerateEnabled: newVal } : o
        )
      );
      setDoctors((prev) =>
        prev.map((d) =>
          d.organizationId?.id === orgId ? { ...d, isAiRegenerateEnabled: newVal } : d
        )
      );
      try {
        await apiClient.patch(
          `/superadmin/organizations/${orgId}/ai-regenerate-settings`,
          { isAiRegenerateEnabled: newVal }
        );
        toast.success(
          `AI Content Regeneration ${newVal ? "enabled" : "disabled"} for hospital and its affiliated doctors.`
        );
      } catch (err: any) {
        setOrganizations((prev) =>
          prev.map((o) =>
            o.id === orgId ? { ...o, isAiRegenerateEnabled: currentVal } : o
          )
        );
        setDoctors((prev) =>
          prev.map((d) =>
            d.organizationId?.id === orgId ? { ...d, isAiRegenerateEnabled: currentVal } : d
          )
        );
        toast.error(err?.response?.data?.error || "Failed to update AI Regeneration setting");
      }
    },
    []
  );

  const handleToggleDoctorAiRegenerate = React.useCallback(
    async (doctorId: string, currentVal: boolean) => {
      const newVal = !currentVal;
      setDoctors((prev) =>
        prev.map((d) =>
          d.id === doctorId ? { ...d, isAiRegenerateEnabled: newVal } : d
        )
      );
      try {
        await apiClient.patch(
          `/superadmin/doctors/${doctorId}/ai-regenerate-settings`,
          { isAiRegenerateEnabled: newVal }
        );
        toast.success(
          `AI Content Regeneration ${newVal ? "enabled" : "disabled"} for doctor.`
        );
      } catch (err: any) {
        setDoctors((prev) =>
          prev.map((d) =>
            d.id === doctorId ? { ...d, isAiRegenerateEnabled: currentVal } : d
          )
        );
        toast.error(err?.response?.data?.error || err?.message || "Failed to update AI Regeneration setting");
      }
    },
    []
  );

  const handleToggleDoctorChatbot = React.useCallback(
    async (
      doctorId: string,
      field: "isWebsiteChatbotEnabled" | "isAdminChatbotEnabled" | "isChatbotBookingEnabled",
      currentVal: boolean
    ) => {
      const newVal = !currentVal;
      setDoctors((prev) =>
        prev.map((d) => (d.id === doctorId ? { ...d, [field]: newVal } : d))
      );
      try {
        await apiClient.patch(`/superadmin/doctors/${doctorId}/chatbot-settings`, {
          [field]: newVal,
        });
        const label =
          field === "isWebsiteChatbotEnabled"
            ? "Website Chatbot"
            : field === "isAdminChatbotEnabled"
            ? "Admin AI Copilot"
            : "Book Appointment on Chatbot";
        toast.success(`${label} has been ${newVal ? "enabled" : "disabled"}.`);
      } catch (err: any) {
        setDoctors((prev) =>
          prev.map((d) => (d.id === doctorId ? { ...d, [field]: currentVal } : d))
        );
        toast.error(err?.response?.data?.error || err?.message || "Failed to update chatbot settings");
      }
    },
    []
  );

  // Superadmin Authority: Permanent Delete Modal State & Handler
  const [deleteTarget, setDeleteTarget] = React.useState<{
    type: "org" | "doctor";
    id: string;
    name: string;
  } | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);

  const confirmPermanentDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      if (deleteTarget.type === "org") {
        await apiClient.delete(`/superadmin/organizations/${deleteTarget.id}`);
        setOrganizations((prev) => prev.filter((o) => o.id !== deleteTarget.id));
        setDoctors((prev) => prev.filter((d) => d.organizationId?.id !== deleteTarget.id));
        toast.success(`Organization "${deleteTarget.name}" and all media files permanently deleted.`);
      } else {
        await apiClient.delete(`/superadmin/doctors/${deleteTarget.id}`);
        setDoctors((prev) => prev.filter((d) => d.id !== deleteTarget.id));
        toast.success(`Dr. "${deleteTarget.name}" and associated media permanently deleted.`);
      }
      setDeleteTarget(null);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to delete");
    } finally {
      setIsDeleting(false);
    }
  };

  // Superadmin Static Website Source Code Export State & Handler
  const [downloadingTarget, setDownloadingTarget] = React.useState<string | null>(null);

  const handleDownloadStaticSite = async (slug: string, doctorSlug?: string, targetName?: string) => {
    const targetKey = doctorSlug ? `${slug}/${doctorSlug}` : slug;
    setDownloadingTarget(targetKey);
    const toastId = toast.loading(`Packing static website source code for ${targetName || targetKey}...`);
    try {
      const url = `/superadmin/export-website/${slug}${doctorSlug ? `?doctorSlug=${doctorSlug}` : ""}`;
      const blob = await apiClient.getBlob(url);

      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      const safeName = (doctorSlug ? `${slug}-${doctorSlug}` : slug).replace(/[^a-z0-9_-]/gi, "_");
      link.href = downloadUrl;
      link.setAttribute("download", `${safeName}-static-site.zip`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);

      toast.success(`Static source code package for "${targetName || targetKey}" downloaded!`, { id: toastId });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to download static site bundle";
      toast.error(msg, { id: toastId });
    } finally {
      setDownloadingTarget(null);
    }
  };

  // Data Table Columns: Hospitals & Clinics
  const organizationColumns = React.useMemo<ColumnDef<SuperadminOrgItem>[]>(
    () => [
      {
        key: "name",
        header: "Hospital / Clinic",
        cell: (org) => (
          <div>
            <span className="font-semibold text-slate-900 block text-xs">{org.name}</span>
            <span className="text-[11px] text-slate-500 font-mono">/{org.slug}</span>
          </div>
        ),
      },
      {
        key: "slug",
        header: "Public URL",
        cell: (org) => (
          <Link
            href={`/${org.slug}`}
            target="_blank"
            className="hover:underline text-[#1a76d1] flex items-center gap-1 font-mono text-xs font-semibold"
          >
            {formatUrl(org.slug)}
            <ExternalLink className="h-3 w-3 shrink-0" />
          </Link>
        ),
      },
      {
        key: "type",
        header: "Type",
        cell: (org) => (
          <Badge variant="secondary" className="text-[10px]">
            {org.type}
          </Badge>
        ),
      },
      {
        key: "location",
        header: "Location",
        accessorFn: (org) => `${org.address?.city || ""}, ${org.address?.state || ""}`,
        cell: (org) => (
          <span className="text-xs text-slate-600">
            {org.address?.city ? `${org.address.city}, ${org.address.state || ""}` : "—"}
          </span>
        ),
      },
      {
        key: "status",
        header: "Status",
        cell: (org) => (
          <Badge
            variant="outline"
            className={`text-[10px] font-semibold ${
              org.status === "ACTIVE"
                ? "bg-blue-100 text-[#1560aa] border-blue-300"
                : "bg-slate-100 text-slate-800 border-slate-300"
            }`}
          >
            {org.status}
          </Badge>
        ),
      },
      {
        key: "isWebsiteChatbotEnabled",
        header: "Web Chatbot",
        sortable: false,
        cell: (org) => {
          const isEnabled = org.isWebsiteChatbotEnabled !== false;
          return (
            <div className="flex items-center gap-1.5">
              <Switch
                checked={isEnabled}
                onCheckedChange={() =>
                  handleToggleOrgChatbot(org.id, "isWebsiteChatbotEnabled", isEnabled)
                }
                title={`Click to ${isEnabled ? "turn OFF" : "turn ON"} Website AI Chatbot`}
              />
              <span
                className={cn(
                  "text-[10px] font-bold uppercase",
                  isEnabled ? "text-emerald-600" : "text-slate-400"
                )}
              >
                {isEnabled ? "ON" : "OFF"}
              </span>
            </div>
          );
        },
      },
      {
        key: "isAdminChatbotEnabled",
        header: "Admin Copilot",
        sortable: false,
        cell: (org) => {
          const isEnabled = org.isAdminChatbotEnabled !== false;
          return (
            <div className="flex items-center gap-1.5">
              <Switch
                checked={isEnabled}
                onCheckedChange={() =>
                  handleToggleOrgChatbot(org.id, "isAdminChatbotEnabled", isEnabled)
                }
                title={`Click to ${isEnabled ? "turn OFF" : "turn ON"} Admin AI Copilot`}
              />
              <span
                className={cn(
                  "text-[10px] font-bold uppercase",
                  isEnabled ? "text-emerald-600" : "text-slate-400"
                )}
              >
                {isEnabled ? "ON" : "OFF"}
              </span>
            </div>
          );
        },
      },
      {
        key: "isChatbotBookingEnabled",
        header: "Chat Booking",
        sortable: false,
        cell: (org) => {
          const isEnabled = org.isChatbotBookingEnabled !== false;
          return (
            <div className="flex items-center gap-1.5">
              <Switch
                checked={isEnabled}
                onCheckedChange={() =>
                  handleToggleOrgChatbot(org.id, "isChatbotBookingEnabled", isEnabled)
                }
                title={`Click to ${isEnabled ? "turn OFF" : "turn ON"} Book Appointment on Chatbot (also affects hospital doctors)`}
              />
              <span
                className={cn(
                  "text-[10px] font-bold uppercase",
                  isEnabled ? "text-emerald-600" : "text-rose-500"
                )}
              >
                {isEnabled ? "ON" : "OFF"}
              </span>
            </div>
          );
        },
      },
      {
        key: "isAiRegenerateEnabled",
        header: "AI Regen",
        sortable: false,
        cell: (org) => {
          const isEnabled = Boolean(org.isAiRegenerateEnabled);
          return (
            <div
              className="flex items-center gap-1.5"
              title={`Click to ${isEnabled ? "turn OFF" : "turn ON"} AI Content Regeneration for this hospital & its doctors`}
            >
              <Switch
                checked={isEnabled}
                onCheckedChange={() =>
                  handleToggleOrgAiRegenerate(org.id, isEnabled)
                }
              />
              <span
                className={cn(
                  "text-[10px] font-bold uppercase",
                  isEnabled ? "text-emerald-600" : "text-slate-400"
                )}
              >
                {isEnabled ? "ON" : "OFF"}
              </span>
            </div>
          );
        },
      },
      {
        key: "isVisibleInDoctorOnboarding",
        header: "Doc Form",
        sortable: false,
        cell: (org) => {
          const isVisible = org.isVisibleInDoctorOnboarding !== false;
          return (
            <div
              className="flex items-center gap-1.5"
              title={`Click to ${isVisible ? "HIDE from" : "SHOW in"} Hospital Doctor website creation form`}
            >
              <Switch
                checked={isVisible}
                onCheckedChange={() =>
                  handleToggleOrgOnboardingVisibility(org.id, isVisible)
                }
              />
              <span
                className={cn(
                  "text-[10px] font-bold uppercase",
                  isVisible ? "text-emerald-600" : "text-amber-600"
                )}
              >
                {isVisible ? "Visible" : "Hidden"}
              </span>
            </div>
          );
        },
      },
      {
        key: "actions",
        header: "Actions",
        sortable: false,
        headerClassName: "text-right",
        cell: (org) => (
          <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setCustomDomainTarget({
                  targetType: "ORGANIZATION",
                  targetId: org.id,
                  entityName: org.name,
                  doczenoPath: `/${org.slug}`,
                });
                setActiveTab("custom-domains");
              }}
              className="text-[10px] h-7 px-2 font-medium rounded-lg text-[#1560aa] border-blue-200 hover:bg-blue-50 flex items-center gap-1 shadow-2xs"
              title="Connect or Manage Custom Domain"
            >
              <Globe className="h-3 w-3" />
              <span>Domain</span>
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleDownloadStaticSite(org.slug, undefined, org.name)}
              disabled={downloadingTarget === org.slug}
              className="text-[10px] h-7 px-2 font-medium rounded-lg text-emerald-700 border-emerald-300 hover:bg-emerald-50 flex items-center gap-1 shadow-2xs"
              title="Download Complete Static Source Code (HTML, CSS, JS & Media ZIP)"
            >
              {downloadingTarget === org.slug ? (
                <Loader2 className="h-3 w-3 animate-spin text-emerald-600" />
              ) : (
                <Download className="h-3 w-3 text-emerald-600" />
              )}
              <span>Static Site</span>
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleToggleOrg(org.id, org.status)}
              className={cn(
                "text-[10px] h-7 px-2 font-medium rounded-lg",
                org.status === "ACTIVE"
                  ? "text-amber-700 border-amber-300 hover:bg-amber-50"
                  : "text-[#1560aa] border-blue-300 hover:bg-blue-50"
              )}
            >
              {org.status === "ACTIVE" ? "Deactivate" : "Activate"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setDeleteTarget({ type: "org", id: org.id, name: org.name })}
              className="text-[10px] h-7 px-2 text-rose-600 hover:bg-rose-100 font-semibold"
            >
              <Trash2 className="h-3 w-3 mr-1" />
              Delete
            </Button>
          </div>
        ),
      },
    ],
    [formatUrl, handleToggleOrgChatbot, handleToggleOrgOnboardingVisibility, handleToggleOrgAiRegenerate, downloadingTarget]
  );

  // Data Table Columns: Doctors
  const doctorColumns = React.useMemo<ColumnDef<SuperadminDoctorItem>[]>(
    () => [
      {
        key: "doctorName",
        header: "Doctor Name",
        cell: (doc) => {
          const urlPath = doc.organizationId
            ? `${doc.organizationId.slug}/${doc.slug}`
            : doc.slug;
          return (
            <div>
              <span className="font-semibold text-slate-900 block text-xs">Dr. {doc.doctorName}</span>
              <Link
                href={`/${urlPath}`}
                target="_blank"
                className="font-mono text-[10px] text-[#1a76d1] font-semibold hover:underline flex items-center gap-1 truncate max-w-xs"
              >
                {formatUrl(urlPath)}
                <ExternalLink className="h-2.5 w-2.5 shrink-0" />
              </Link>
            </div>
          );
        },
      },
      {
        key: "specialization",
        header: "Specialization",
        cell: (doc) => (
          <span className="text-xs text-slate-700">
            {doc.specialization} {doc.yearsOfExperience ? `(${doc.yearsOfExperience} yrs)` : ""}
          </span>
        ),
      },
      {
        key: "affiliation",
        header: "Affiliation",
        accessorFn: (doc) => doc.organizationId?.name || "Only Doctor",
        cell: (doc) =>
          doc.organizationId ? (
            <span className="flex items-center gap-1 text-slate-800 text-xs">
              <Building2 className="h-3 w-3 text-slate-400 shrink-0" />
              {doc.organizationId.name}
            </span>
          ) : (
            <Badge variant="outline" className="text-[10px] bg-slate-50 text-slate-700 border-slate-300">
              Only Doctor
            </Badge>
          ),
      },
      {
        key: "status",
        header: "Status",
        cell: (doc) => (
          <Badge
            variant="outline"
            className={`text-[10px] font-semibold ${
              doc.status === "ACTIVE"
                ? "bg-blue-100 text-[#1560aa] border-blue-300"
                : doc.deactivatedByRole === "HOSPITAL_ADMIN"
                ? "bg-amber-100 text-amber-800 border-amber-300"
                : "bg-rose-100 text-rose-800 border-rose-300"
            }`}
          >
            {doc.status === "ACTIVE"
              ? "ACTIVE"
              : doc.deactivatedByRole === "HOSPITAL_ADMIN"
              ? "DEACTIVE (Hospital Admin)"
              : "DEACTIVE (Superadmin)"}
          </Badge>
        ),
      },
      {
        key: "isWebsiteChatbotEnabled",
        header: "Web Chatbot",
        sortable: false,
        cell: (doc) => {
          const parentOrg = doc.organizationId?.id
            ? organizations.find((o) => o.id === doc.organizationId?.id)
            : undefined;
          const isParentDisabled = Boolean(parentOrg && parentOrg.isWebsiteChatbotEnabled === false);
          const isOwnEnabled = doc.isWebsiteChatbotEnabled !== false;
          const effectiveEnabled = !isParentDisabled && isOwnEnabled;
          return (
            <div
              className="flex items-center gap-1.5"
              title={
                isParentDisabled
                  ? `Disabled by parent hospital (${parentOrg?.name || "Hospital"})`
                  : `Click to ${isOwnEnabled ? "turn OFF" : "turn ON"} Website AI Chatbot`
              }
            >
              <Switch
                checked={effectiveEnabled}
                disabled={isParentDisabled}
                onCheckedChange={() =>
                  handleToggleDoctorChatbot(doc.id, "isWebsiteChatbotEnabled", isOwnEnabled)
                }
              />
              <span
                className={cn(
                  "text-[10px] font-bold uppercase",
                  effectiveEnabled
                    ? "text-emerald-600"
                    : isParentDisabled
                    ? "text-amber-600"
                    : "text-slate-400"
                )}
              >
                {effectiveEnabled ? "ON" : isParentDisabled ? "OFF (Hospital)" : "OFF"}
              </span>
            </div>
          );
        },
      },
      {
        key: "isChatbotBookingEnabled",
        header: "Chat Booking",
        sortable: false,
        cell: (doc) => {
          const parentOrg = doc.organizationId?.id
            ? organizations.find((o) => o.id === doc.organizationId?.id)
            : undefined;
          const isParentDisabled = Boolean(
            parentOrg && parentOrg.isChatbotBookingEnabled === false
          );
          const isOwnEnabled = doc.isChatbotBookingEnabled !== false;
          const effectiveEnabled = !isParentDisabled && isOwnEnabled;
          return (
            <div
              className="flex items-center gap-1.5"
              title={
                isParentDisabled
                  ? `Disabled by parent hospital (${parentOrg?.name || "Hospital"})`
                  : `Click to ${isOwnEnabled ? "turn OFF" : "turn ON"} Book Appointment on Chatbot`
              }
            >
              <Switch
                checked={effectiveEnabled}
                disabled={isParentDisabled}
                onCheckedChange={() =>
                  handleToggleDoctorChatbot(doc.id, "isChatbotBookingEnabled", isOwnEnabled)
                }
              />
              <span
                className={cn(
                  "text-[10px] font-bold uppercase",
                  effectiveEnabled
                    ? "text-emerald-600"
                    : isParentDisabled
                    ? "text-amber-600"
                    : "text-rose-500"
                )}
              >
                {effectiveEnabled ? "ON" : isParentDisabled ? "OFF (Hospital)" : "OFF"}
              </span>
            </div>
          );
        },
      },
      {
        key: "isAdminChatbotEnabled",
        header: "Admin Copilot",
        sortable: false,
        cell: (doc) => {
          const parentOrg = doc.organizationId?.id
            ? organizations.find((o) => o.id === doc.organizationId?.id)
            : undefined;
          const isParentDisabled = Boolean(parentOrg && parentOrg.isAdminChatbotEnabled === false);
          const isOwnEnabled = doc.isAdminChatbotEnabled !== false;
          const effectiveEnabled = !isParentDisabled && isOwnEnabled;
          return (
            <div
              className="flex items-center gap-1.5"
              title={
                isParentDisabled
                  ? `Disabled by parent hospital (${parentOrg?.name || "Hospital"})`
                  : `Click to ${isOwnEnabled ? "turn OFF" : "turn ON"} Admin AI Copilot`
              }
            >
              <Switch
                checked={effectiveEnabled}
                disabled={isParentDisabled}
                onCheckedChange={() =>
                  handleToggleDoctorChatbot(doc.id, "isAdminChatbotEnabled", isOwnEnabled)
                }
              />
              <span
                className={cn(
                  "text-[10px] font-bold uppercase",
                  effectiveEnabled
                    ? "text-emerald-600"
                    : isParentDisabled
                    ? "text-amber-600"
                    : "text-slate-400"
                )}
              >
                {effectiveEnabled ? "ON" : isParentDisabled ? "OFF (Hospital)" : "OFF"}
              </span>
            </div>
          );
        },
      },
      {
        key: "isAiRegenerateEnabled",
        header: "AI Regen",
        sortable: false,
        cell: (doc) => {
          const parentOrg = doc.organizationId?.id
            ? organizations.find((o) => o.id === doc.organizationId?.id)
            : undefined;
          const isParentDisabled = Boolean(parentOrg && parentOrg.isAiRegenerateEnabled !== true);
          const isOwnEnabled = Boolean(doc.isAiRegenerateEnabled);
          const effectiveEnabled = !isParentDisabled && isOwnEnabled;
          return (
            <div
              className="flex items-center gap-1.5"
              title={
                isParentDisabled
                  ? `Disabled by parent hospital (${parentOrg?.name || "Hospital"})`
                  : `Click to ${isOwnEnabled ? "turn OFF" : "turn ON"} AI Content Regeneration`
              }
            >
              <Switch
                checked={effectiveEnabled}
                disabled={isParentDisabled}
                onCheckedChange={() =>
                  handleToggleDoctorAiRegenerate(doc.id, isOwnEnabled)
                }
              />
              <span
                className={cn(
                  "text-[10px] font-bold uppercase",
                  effectiveEnabled
                    ? "text-emerald-600"
                    : isParentDisabled
                    ? "text-amber-600"
                    : "text-slate-400"
                )}
              >
                {effectiveEnabled ? "ON" : isParentDisabled ? "OFF (Hospital)" : "OFF"}
              </span>
            </div>
          );
        },
      },
      {
        key: "actions",
        header: "Actions",
        sortable: false,
        headerClassName: "text-right",
        cell: (doc) => {
          const isHospitalDoc = Boolean(doc.organizationId);
          const orgSlug = doc.organizationId?.slug || "";
          const docSlug = doc.slug;
          const downloadKey = isHospitalDoc ? `${orgSlug}/${docSlug}` : docSlug;

          return (
            <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  handleDownloadStaticSite(
                    isHospitalDoc ? orgSlug : docSlug,
                    isHospitalDoc ? docSlug : undefined,
                    `Dr. ${doc.doctorName}`
                  )
                }
                disabled={downloadingTarget === downloadKey}
                className="text-[10px] h-7 px-2 font-medium rounded-lg text-emerald-700 border-emerald-300 hover:bg-emerald-50 flex items-center gap-1 shadow-2xs"
                title="Download Complete Static Source Code (HTML, CSS, JS & Media ZIP)"
              >
                {downloadingTarget === downloadKey ? (
                  <Loader2 className="h-3 w-3 animate-spin text-emerald-600" />
                ) : (
                  <Download className="h-3 w-3 text-emerald-600" />
                )}
                <span>Static Site</span>
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const fullPath = isHospitalDoc ? `/${orgSlug}/${docSlug}` : `/${docSlug}`;
                  setCustomDomainTarget({
                    targetType: "DOCTOR",
                    targetId: doc.id,
                    entityName: `Dr. ${doc.doctorName}`,
                    doczenoPath: fullPath,
                  });
                  setActiveTab("custom-domains");
                }}
                className="text-[10px] h-7 px-2 font-medium rounded-lg text-[#1560aa] border-blue-200 hover:bg-blue-50 flex items-center gap-1 shadow-2xs"
                title="Connect or Manage Custom Domain"
              >
                <Globe className="h-3 w-3" />
                <span>Domain</span>
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleToggleDoctor(doc.id, doc.status)}
                className={cn(
                  "text-[10px] h-7 px-2 font-medium rounded-lg",
                  doc.status === "ACTIVE"
                    ? "text-amber-700 border-amber-300 hover:bg-amber-50"
                    : "text-[#1560aa] border-blue-300 hover:bg-blue-50"
                )}
              >
                {doc.status === "ACTIVE" ? "Deactivate" : "Activate"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setDeleteTarget({ type: "doctor", id: doc.id, name: doc.doctorName })}
                className="text-[10px] h-7 px-2 text-rose-600 hover:bg-rose-100 font-semibold"
              >
                <Trash2 className="h-3 w-3 mr-1" />
                Delete Doctor
              </Button>
            </div>
          );
        },
      },
    ],
    [formatUrl, handleToggleDoctorChatbot, handleToggleDoctorAiRegenerate, downloadingTarget, organizations]
  );

  // Filtered datasets for Data Tables
  const filteredOrgsData = React.useMemo(() => {
    return orgTypeFilter === "ALL"
      ? organizations
      : organizations.filter((o) => o.type === orgTypeFilter);
  }, [organizations, orgTypeFilter]);

  const filteredDoctorsData = React.useMemo(() => {
    return doctorAffiliationFilter === "ALL"
      ? doctors
      : doctorAffiliationFilter === "ONLY_DOCTOR"
      ? doctors.filter((d) => !d.organizationId)
      : doctors.filter((d) => Boolean(d.organizationId));
  }, [doctors, doctorAffiliationFilter]);

  // Doctor Breakdown Statistics for Overview
  const soloDoctorsCount = React.useMemo(() => {
    return doctors.filter((d) => !d.organizationId).length;
  }, [doctors]);

  const hospitalDoctorsCount = React.useMemo(() => {
    return doctors.filter((d) => Boolean(d.organizationId)).length;
  }, [doctors]);

  const totalDoctorsCount = React.useMemo(() => {
    return Math.max(doctors.length, stats.totalDoctors || 0);
  }, [doctors, stats.totalDoctors]);

  const activeWebsitesCount = React.useMemo(() => {
    if (typeof stats.activeWebsitesCount === "number") {
      return stats.activeWebsitesCount;
    }
    return _initialWebsites.filter((w) => w.publishStatus === "PUBLISHED").length;
  }, [stats.activeWebsitesCount, _initialWebsites]);

  const deactiveWebsitesCount = React.useMemo(() => {
    if (typeof stats.deactiveWebsitesCount === "number") {
      return stats.deactiveWebsitesCount;
    }
    return _initialWebsites.filter((w) => w.publishStatus !== "PUBLISHED").length;
  }, [stats.deactiveWebsitesCount, _initialWebsites]);

  return (
    <AdminShell
      title="Platform Superadmin Console"
      subtitle="Doczeno Multi-Tenant Control Authority"
      roleBadge="SUPERADMIN"
      hideHeader={true}
      navItems={navItems}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      userEmail="superadmin@doczeno.com"
      onLogout={onLogout}
    >
      {/* Toast / Notification */}
      {feedbackMessage && (
        <div
          className={`border text-xs px-4 py-2.5 rounded-xl flex items-center justify-between animate-in fade-in shadow-2xs ${
            feedbackMessage.type === "success"
              ? "bg-blue-50 border-blue-200 text-[#1560aa]"
              : "bg-rose-50 border-rose-200 text-rose-800"
          }`}
        >
          <div className="flex items-center gap-2">
            {feedbackMessage.type === "success" ? (
              <CheckCircle className="h-4 w-4 text-[#1a76d1]" />
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            {/* Total Doctors */}
            <Card className="bg-white border-blue-100 rounded-2xl shadow-xs">
              <CardHeader className="p-4 pb-2">
                <CardDescription className="text-xs font-medium text-slate-500">Total Registered Doctors</CardDescription>
                <CardTitle className="text-2xl font-bold text-slate-900">{totalDoctorsCount}</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0 text-xs text-slate-500">
                All platform physicians
              </CardContent>
            </Card>

            {/* Solo / Only Doctors */}
            <Card className="bg-white border-blue-100 rounded-2xl shadow-xs">
              <CardHeader className="p-4 pb-2">
                <CardDescription className="text-xs font-medium text-[#1560aa]">Only Doctors</CardDescription>
                <CardTitle className="text-2xl font-bold text-[#1a76d1]">{soloDoctorsCount}</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0 text-xs text-slate-500">
                Independent private clinics
              </CardContent>
            </Card>

            {/* Hospital-Affiliated Doctors */}
            <Card className="bg-white border-slate-200 shadow-2xs">
              <CardHeader className="p-4 pb-2">
                <CardDescription className="text-xs font-medium text-sky-700">Hospital / Clinic Doctors</CardDescription>
                <CardTitle className="text-2xl font-bold text-sky-700">{hospitalDoctorsCount}</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0 text-xs text-slate-500">
                Affiliated with hospital entities
              </CardContent>
            </Card>

            {/* Hospitals & Clinics */}
            <Card className="bg-white border-slate-200 shadow-2xs">
              <CardHeader className="p-4 pb-2">
                <CardDescription className="text-xs font-medium text-slate-500">Hospitals & Clinics</CardDescription>
                <CardTitle className="text-2xl font-bold text-slate-900">{stats.totalOrganizations}</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0 text-xs text-slate-500">
                Managed healthcare facilities
              </CardContent>
            </Card>

            {/* Permanently Deleted Accounts */}
            <Card className="bg-white border-slate-200 shadow-2xs">
              <CardHeader className="p-4 pb-2">
                <CardDescription className="text-xs font-medium text-rose-700">Permanently Deleted</CardDescription>
                <CardTitle className="text-2xl font-bold text-rose-600">
                  {stats.deletedDoctorsCount || 0}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0 text-xs text-slate-500">
                Purged DB & media files
              </CardContent>
            </Card>

            {/* Active Websites */}
            <Card className="bg-white border-emerald-200 rounded-2xl shadow-xs">
              <CardHeader className="p-4 pb-2">
                <CardDescription className="text-xs font-medium text-emerald-700">Active Websites</CardDescription>
                <CardTitle className="text-2xl font-bold text-emerald-700">
                  {activeWebsitesCount}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0 text-xs text-slate-500">
                Live & published portals
              </CardContent>
            </Card>

            {/* Deactive Websites */}
            <Card className="bg-white border-rose-200 rounded-2xl shadow-xs">
              <CardHeader className="p-4 pb-2">
                <CardDescription className="text-xs font-medium text-rose-700">Deactive Websites</CardDescription>
                <CardTitle className="text-2xl font-bold text-rose-600">
                  {deactiveWebsitesCount}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0 text-xs text-slate-500">
                Suspended or draft portals
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* TAB 2: HOSPITALS & CLINICS (DATA TABLE) */}
      {activeTab === "organizations" && (
        <Card className="bg-white border-slate-200">
          <CardHeader className="border-b border-slate-100 pb-4">
            <div>
              <CardTitle className="text-lg font-bold text-slate-900">Hospitals & Clinics Directory</CardTitle>
              <CardDescription className="text-xs text-slate-500 mt-1">
                Manage all hospital and clinic facilities on Doczeno
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <DataTable
              columns={organizationColumns}
              data={filteredOrgsData}
              searchPlaceholder="Search name, slug, city..."
              pageSize={10}
              exportFileName="superadmin_hospitals"
              toolbarExtra={
                <select
                  aria-label="Filter by type"
                  value={orgTypeFilter}
                  onChange={(e) => setOrgTypeFilter(e.target.value)}
                  className="text-xs h-9 border border-slate-200 rounded-lg px-2.5 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="ALL">All Types</option>
                  <option value="HOSPITAL">Hospitals</option>
                  <option value="CLINIC">Clinics</option>
                </select>
              }
            />
          </CardContent>
        </Card>
      )}

      {/* TAB 3: ALL DOCTORS (DATA TABLE) */}
      {activeTab === "doctors" && (
        <Card className="bg-white border-slate-200">
          <CardHeader className="border-b border-slate-100 pb-4">
            <div>
              <CardTitle className="text-lg font-bold text-slate-900">All Doctors Directory</CardTitle>
              <CardDescription className="text-xs text-slate-500 mt-1">
                Verified physicians across Only Doctor and Hospital practices
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <DataTable
              columns={doctorColumns}
              data={filteredDoctorsData}
              searchPlaceholder="Search doctor, specialization, slug..."
              pageSize={10}
              exportFileName="superadmin_doctors"
              toolbarExtra={
                <select
                  aria-label="Filter by affiliation"
                  value={doctorAffiliationFilter}
                  onChange={(e) => setDoctorAffiliationFilter(e.target.value)}
                  className="text-xs h-9 border border-slate-200 rounded-lg px-2.5 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="ALL">All Affiliations</option>
                  <option value="ONLY_DOCTOR">Only Doctor</option>
                  <option value="HOSPITAL">Hospital Doctor</option>
                </select>
              }
            />
          </CardContent>
        </Card>
      )}

      {/* TAB: CUSTOM DOMAINS */}
      {activeTab === "custom-domains" && (
        <CustomDomainsView
          organizations={organizations}
          doctors={doctors}
          onCountChange={setUsedCustomDomainsCount}
          externalTarget={customDomainTarget}
          onClearExternalTarget={() => setCustomDomainTarget(null)}
        />
      )}

      {/* TAB 4: PLATFORM INFORMATION (FORMERLY PLATFORM SETTINGS) */}
      {activeTab === "settings" && (
        <div className="space-y-6">
          {/* Starting Page Onboarding Categories Control */}
          <Card className="bg-white border-slate-200 shadow-xs">
            <CardHeader className="border-b bg-slate-50/50 pb-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <Power className="h-5 w-5 text-primary" />
                    Starting Page Onboarding Categories
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-600 mt-1">
                    Enable or disable any of the 3 setup categories on the Doczeno home page. Disabled buttons remain visible but inactive with a tooltip notice.
                  </CardDescription>
                </div>
                {loadingCategories && (
                  <Badge variant="outline" className="text-[11px] gap-1.5">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Syncing...
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-5">
              {/* Master Switch: Starting Page & All Onboarding Forms */}
              <div
                className={cn(
                  "p-4 rounded-xl border-2 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4",
                  onboardingCategories.portalEnabled
                    ? "border-emerald-300 bg-emerald-50/40"
                    : "border-rose-300 bg-rose-50/50"
                )}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Power
                      className={cn(
                        "h-4 w-4",
                        onboardingCategories.portalEnabled ? "text-emerald-700" : "text-rose-600"
                      )}
                    />
                    <span className="text-sm font-bold text-slate-900">
                      Starting Main Page &amp; All Onboarding Forms (Master Switch)
                    </span>
                    <Badge
                      variant={onboardingCategories.portalEnabled ? "success" : "secondary"}
                      className={cn(
                        "text-[10px]",
                        !onboardingCategories.portalEnabled &&
                          "bg-rose-100 text-rose-700 border border-rose-200"
                      )}
                    >
                      {onboardingCategories.portalEnabled ? "Live" : "Off by Admin"}
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-600">
                    When turned OFF, the starting main page (<code>/</code>) and all onboarding form links (<code>/onboarding/*</code>) will show only <strong>&ldquo;This Services is off by admin...&rdquo;</strong> with no background or UI. Live doctor/hospital websites &amp; admin panels remain unaffected.
                  </p>
                </div>
                <Switch
                  checked={onboardingCategories.portalEnabled}
                  disabled={loadingCategories || savingCategoryKey === "portalEnabled"}
                  onCheckedChange={(checked) =>
                    handleToggleOnboardingCategory(
                      "portalEnabled",
                      "Starting Page & All Onboarding Forms",
                      checked
                    )
                  }
                  aria-label="Toggle Starting Main Page and All Onboarding Forms"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  {
                    key: "onlyDoctor" as const,
                    title: "Only Doctor",
                    subtitle: "Solo Doctor (/onboarding/doctor)",
                    icon: Stethoscope,
                    enabled: onboardingCategories.onlyDoctor,
                  },
                  {
                    key: "hospital" as const,
                    title: "Hospital or Clinic",
                    subtitle: "Healthcare Facility (/onboarding/hospital)",
                    icon: Building2,
                    enabled: onboardingCategories.hospital,
                  },
                  {
                    key: "hospitalDoctor" as const,
                    title: "Hospital-Affiliated Doctor",
                    subtitle: "Affiliated Doctor (/onboarding/hospital-doctor)",
                    icon: UserCheck,
                    enabled: onboardingCategories.hospitalDoctor,
                  },
                ].map((cat) => {
                  const Icon = cat.icon;
                  return (
                    <div
                      key={cat.key}
                      className={cn(
                        "p-4 rounded-xl border transition-all flex items-start justify-between gap-3",
                        cat.enabled
                          ? "border-emerald-200/80 bg-emerald-50/30"
                          : "border-rose-200/80 bg-rose-50/30"
                      )}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Icon className={cn("h-4 w-4", cat.enabled ? "text-emerald-700" : "text-rose-600")} />
                          <span className="text-sm font-bold text-slate-900">{cat.title}</span>
                        </div>
                        <p className="text-[11px] text-slate-500">{cat.subtitle}</p>
                        <div className="pt-1">
                          <Badge
                            variant={cat.enabled ? "success" : "secondary"}
                            className={cn(
                              "text-[10px]",
                              !cat.enabled && "bg-rose-100 text-rose-700 border border-rose-200"
                            )}
                          >
                            {cat.enabled ? "Enabled (Live)" : "Disabled"}
                          </Badge>
                        </div>
                      </div>
                      <Switch
                        checked={cat.enabled}
                        disabled={loadingCategories || savingCategoryKey === cat.key}
                        onCheckedChange={(checked) =>
                          handleToggleOnboardingCategory(cat.key, cat.title, checked)
                        }
                        aria-label={`Toggle ${cat.title}`}
                      />
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white border-slate-200 shadow-xs">
            <CardHeader className="border-b bg-slate-50/50 pb-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <Globe className="h-5 w-5 text-primary" />
                    Platform Information
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-600 mt-1">
                    Website domain & public healthcare URL address structure
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              {/* Dynamic Live Link Preview Grid */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
                    <Link2 className="h-4 w-4 text-primary" />
                    Live Link Previews with Configured Domain
                  </h4>
                  <span className="text-[11px] text-slate-500">Live preview of how links appear to patients</span>
                </div>

                {(() => {
                  const previewDomain = "doczeno.vercel.app";
                  return (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Doctor Website Link */}
                      <div className="p-4 rounded-lg border border-slate-200 bg-slate-50/60 space-y-1.5">
                        <div className="flex items-center gap-2 text-xs font-semibold text-slate-800">
                          <Stethoscope className="h-4 w-4 text-[#1a76d1]" />
                          Autonomous Doctor Website
                        </div>
                        <p className="text-[11px] text-slate-500">
                          Format: <code>/{'{doctor-slug}'}</code>
                        </p>
                        <div className="p-2 bg-white rounded border border-slate-200 font-mono text-xs text-[#1a76d1] font-semibold select-all break-all">
                          https://{previewDomain}/dr-name
                        </div>
                      </div>

                      {/* Hospital Website Link */}
                      <div className="p-4 rounded-lg border border-slate-200 bg-slate-50/60 space-y-1.5">
                        <div className="flex items-center gap-2 text-xs font-semibold text-slate-800">
                          <Building2 className="h-4 w-4 text-sky-600" />
                          Hospital & Clinic Website
                        </div>
                        <p className="text-[11px] text-slate-500">
                          Format: <code>/{'{hospital-slug}'}</code>
                        </p>
                        <div className="p-2 bg-white rounded border border-slate-200 font-mono text-xs text-sky-700 font-medium select-all break-all">
                          https://{previewDomain}/hospital-name
                        </div>
                      </div>

                      {/* Hospital-Affiliated Doctor */}
                      <div className="p-4 rounded-lg border border-slate-200 bg-slate-50/60 space-y-1.5">
                        <div className="flex items-center gap-2 text-xs font-semibold text-slate-800">
                          <Link2 className="h-4 w-4 text-indigo-600" />
                          Hospital-Affiliated Doctor Link
                        </div>
                        <p className="text-[11px] text-slate-500">
                          Format: <code>/{'{hospital-slug}'}/{'{doctor-slug}'}</code>
                        </p>
                        <div className="p-2 bg-white rounded border border-slate-200 font-mono text-xs text-indigo-700 font-medium select-all break-all">
                          https://{previewDomain}/hospital-name/dr-name
                        </div>
                      </div>

                      {/* Patient Reception QR Code */}
                      <div className="p-4 rounded-lg border border-slate-200 bg-slate-50/60 space-y-1.5">
                        <div className="flex items-center gap-2 text-xs font-semibold text-slate-800">
                          <QrCode className="h-4 w-4 text-amber-600" />
                          Patient Reception QR Code Link
                        </div>
                        <p className="text-[11px] text-slate-500">
                          Target URL embedded into desk standees & flyers
                        </p>
                        <div className="p-2 bg-white rounded border border-slate-200 font-mono text-xs text-amber-700 font-medium select-all break-all">
                          https://{previewDomain}/dr-name
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* TAB 5: ADMIN LOGS */}
      {activeTab === "admin-logs" && (
        <AdminLogView
          isSuperadmin={true}
          title="Platform-Wide Admin Login & Session Logs"
          description="Track all Superadmin, Hospital Admin, and Doctor Admin logins in IST, device, browser, IP address, and logout reason."
        />
      )}

      {/* TAB 6: GEMINI AI OBSERVABILITY & USAGE (LAST TAB) */}
      {activeTab === "gemini-api" && <GeminiAnalyticsView />}

      {/* Website Modal Popup for Permanent Delete */}
      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open && !isDeleting) {
            setDeleteTarget(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-md bg-white border border-slate-200 shadow-2xl rounded-2xl p-6">
          <DialogHeader className="space-y-3">
            <div className="mx-auto sm:mx-0 flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 text-rose-600 ring-8 ring-rose-50">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-slate-900 tracking-tight">
                Permanent Delete: {deleteTarget?.type === "doctor" ? `Dr. ${deleteTarget?.name}` : deleteTarget?.name}
              </DialogTitle>
              <DialogDescription className="text-sm text-slate-600 mt-1">
                Are you sure you want to permanently delete{" "}
                <span className="font-semibold text-slate-900">
                  {deleteTarget?.type === "doctor" ? `Dr. ${deleteTarget?.name}` : deleteTarget?.name}
                </span>
                ?
              </DialogDescription>
            </div>
          </DialogHeader>

          <div className="rounded-xl bg-rose-50/80 border border-rose-200/80 p-4 text-xs text-rose-900 space-y-2 my-2">
            <p className="font-semibold flex items-center gap-1.5 text-rose-700">
              <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
              This action CANNOT be undone.
            </p>
            <p className="leading-relaxed text-slate-700">
              {deleteTarget?.type === "org"
                ? "This will permanently purge the hospital/clinic, all affiliated doctors, websites, appointments, reviews, user accounts, and media files from the database and Cloudinary."
                : "This will permanently purge the doctor profile, website, appointments, reviews, user account, and media files from the database and Cloudinary."}
            </p>
          </div>

          <DialogFooter className="flex flex-row justify-end gap-2.5 mt-4">
            <Button
              type="button"
              variant="outline"
              disabled={isDeleting}
              onClick={() => setDeleteTarget(null)}
              className="text-slate-700 hover:bg-slate-100 text-xs h-9 px-4 rounded-lg font-medium"
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={isDeleting}
              onClick={confirmPermanentDelete}
              className="bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs h-9 px-4 rounded-lg shadow-sm transition-all"
            >
              {isDeleting ? (
                "Deleting..."
              ) : (
                <span className="flex items-center gap-1.5">
                  <Trash2 className="h-3.5 w-3.5" />
                  Permanently Delete
                </span>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}
