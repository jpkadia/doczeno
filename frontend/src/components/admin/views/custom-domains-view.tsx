"use client";

import * as React from "react";
import {
  Globe,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Copy,
  RefreshCw,
  Trash2,
  ExternalLink,
  Plus,
  Loader2,
  ShieldCheck,
  BookOpen,
  ChevronDown,
  ChevronUp,
  MessageSquareText,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DataTable, ColumnDef } from "@/components/ui/data-table";
import { apiClient } from "@/lib/api-client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export interface DnsInstructionRecord {
  purpose: string;
  type: "A" | "CNAME" | "TXT";
  name: string;
  value: string;
}

export interface CustomDomainItem {
  websiteId: string;
  websiteType: string;
  entityName: string;
  doczenoPath: string;
  customDomain: string;
  customDomainStatus: "NONE" | "PENDING" | "VERIFIED" | "FAILED";
  customDomainRedirect: boolean;
  customDomainVerifiedAt?: string | null;
  customDomainLastCheckedAt?: string | null;
  customDomainLastError?: string | null;
  dnsInstructions: DnsInstructionRecord[];
}

export interface CustomDomainTargetSelection {
  targetType: "ORGANIZATION" | "DOCTOR";
  targetId: string;
  entityName: string;
  doczenoPath: string;
}

interface CustomDomainsViewProps {
  organizations: Array<{ id: string; name: string; slug: string }>;
  doctors: Array<{ id: string; doctorName: string; slug: string; organizationId?: { id: string; name: string; slug: string } | null }>;
  onCountChange?: (used: number) => void;
  externalTarget?: CustomDomainTargetSelection | null;
  onClearExternalTarget?: () => void;
}

export function CustomDomainsView({
  organizations,
  doctors,
  onCountChange,
  externalTarget,
  onClearExternalTarget,
}: CustomDomainsViewProps) {
  const [domains, setDomains] = React.useState<CustomDomainItem[]>([]);
  const [usedCount, setUsedCount] = React.useState<number>(0);
  const [maxLimit, setMaxLimit] = React.useState<number>(50);
  const [vercelConfigured, setVercelConfigured] = React.useState<boolean>(false);
  const [isLoading, setIsLoading] = React.useState<boolean>(true);

  // Modal state for adding / viewing DNS of a domain
  const [modalOpen, setModalOpen] = React.useState(false);
  const [selectedTargetType, setSelectedTargetType] = React.useState<"ORGANIZATION" | "DOCTOR">("DOCTOR");
  const [selectedTargetId, setSelectedTargetId] = React.useState<string>("");
  const [domainInput, setDomainInput] = React.useState<string>("");
  const [redirectEnabled, setRedirectEnabled] = React.useState<boolean>(true);
  const [isSaving, setIsSaving] = React.useState<boolean>(false);
  const [activeInstructionsItem, setActiveInstructionsItem] = React.useState<CustomDomainItem | null>(null);
  const [verifyingId, setVerifyingId] = React.useState<string | null>(null);
  const [removingId, setRemovingId] = React.useState<string | null>(null);
  const [confirmDeleteTarget, setConfirmDeleteTarget] = React.useState<CustomDomainItem | null>(null);
  const [isRunningHealthCheck, setIsRunningHealthCheck] = React.useState<boolean>(false);
  const [showSetupGuide, setShowSetupGuide] = React.useState<boolean>(true);

  const fetchCustomDomains = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await apiClient.get<{
        success: boolean;
        data?: {
          usedCount: number;
          maxLimit: number;
          vercelConfigured: boolean;
          domains: CustomDomainItem[];
        };
      }>("/superadmin/custom-domains");
      if (res.success && res.data) {
        setDomains(res.data.domains || []);
        setUsedCount(res.data.usedCount ?? 0);
        setMaxLimit(res.data.maxLimit ?? 50);
        setVercelConfigured(Boolean(res.data.vercelConfigured));
        onCountChange?.(res.data.usedCount ?? 0);
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to load custom domains");
    } finally {
      setIsLoading(false);
    }
  }, [onCountChange]);

  React.useEffect(() => {
    fetchCustomDomains();
  }, [fetchCustomDomains]);

  // Open modal automatically when triggered from Hospitals / Doctors table row
  React.useEffect(() => {
    if (!externalTarget) return;
    const existing = domains.find((d) => d.doczenoPath === externalTarget.doczenoPath);
    if (existing) {
      setActiveInstructionsItem(existing);
      setSelectedTargetType(externalTarget.targetType);
      setSelectedTargetId(externalTarget.targetId);
      setDomainInput(existing.customDomain);
      setRedirectEnabled(existing.customDomainRedirect);
    } else {
      setActiveInstructionsItem(null);
      setSelectedTargetType(externalTarget.targetType);
      setSelectedTargetId(externalTarget.targetId);
      setDomainInput("");
      setRedirectEnabled(true);
    }
    setModalOpen(true);
  }, [externalTarget, domains]);

  const handleCloseModal = () => {
    setModalOpen(false);
    setActiveInstructionsItem(null);
    onClearExternalTarget?.();
  };

  const handleAssignDomain = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTargetId || !domainInput.trim()) {
      toast.error("Please select a website and enter a custom domain.");
      return;
    }

    setIsSaving(true);
    try {
      const res = await apiClient.post<{
        success: boolean;
        message?: string;
        data?: {
          websiteId: string;
          customDomain: string;
          customDomainStatus: "PENDING" | "VERIFIED" | "FAILED";
          customDomainRedirect: boolean;
          dnsInstructions: DnsInstructionRecord[];
          usedCount: number;
        };
      }>("/superadmin/custom-domains", {
        targetType: selectedTargetType,
        targetId: selectedTargetId,
        customDomain: domainInput.trim(),
        redirectEnabled,
      });

      toast.success(res.message || "Custom domain saved! Share the DNS records below with the owner.");
      await fetchCustomDomains();

      if (res.data) {
        const entityName =
          selectedTargetType === "ORGANIZATION"
            ? organizations.find((o) => o.id === selectedTargetId)?.name || "Hospital"
            : `Dr. ${doctors.find((d) => d.id === selectedTargetId)?.doctorName || "Doctor"}`;
        setActiveInstructionsItem({
          websiteId: res.data.websiteId,
          websiteType: selectedTargetType === "ORGANIZATION" ? "HOSPITAL_CLINIC" : "DOCTOR",
          entityName,
          doczenoPath: externalTarget?.doczenoPath || "",
          customDomain: res.data.customDomain,
          customDomainStatus: res.data.customDomainStatus,
          customDomainRedirect: res.data.customDomainRedirect,
          dnsInstructions: res.data.dnsInstructions,
        });
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to connect custom domain");
    } finally {
      setIsSaving(false);
    }
  };

  const handleVerifyDomain = async (websiteId: string) => {
    setVerifyingId(websiteId);
    try {
      const res = await apiClient.post<{
        success: boolean;
        message?: string;
        data?: { verified?: boolean; status?: string; dnsInstructions?: DnsInstructionRecord[] };
      }>(`/superadmin/custom-domains/${websiteId}/verify`, {});

      if (res.data?.verified) {
        toast.success(res.message || "Domain verified & active with SSL!");
      } else {
        toast.warning(res.message || "DNS verification still pending.");
      }

      await fetchCustomDomains();
      if (activeInstructionsItem && activeInstructionsItem.websiteId === websiteId && res.data) {
        setActiveInstructionsItem((prev) =>
          prev
            ? {
                ...prev,
                customDomainStatus: (res.data?.status as any) || prev.customDomainStatus,
                dnsInstructions: res.data?.dnsInstructions || prev.dnsInstructions,
              }
            : null
        );
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Verification check failed");
    } finally {
      setVerifyingId(null);
    }
  };

  const handleToggleRedirect = async (item: CustomDomainItem) => {
    const nextVal = !item.customDomainRedirect;
    setDomains((prev) =>
      prev.map((d) =>
        d.websiteId === item.websiteId ? { ...d, customDomainRedirect: nextVal } : d
      )
    );
    try {
      await apiClient.patch(`/superadmin/custom-domains/${item.websiteId}`, {
        customDomainRedirect: nextVal,
      });
      toast.success(
        `Redirect from doczeno.vercel.app${item.doczenoPath} ${nextVal ? "enabled" : "disabled"}.`
      );
    } catch (err: unknown) {
      setDomains((prev) =>
        prev.map((d) =>
          d.websiteId === item.websiteId ? { ...d, customDomainRedirect: item.customDomainRedirect } : d
        )
      );
      toast.error(err instanceof Error ? err.message : "Failed to update redirect");
    }
  };

  const handleRemoveDomain = async (websiteId: string, domainName: string) => {
    setRemovingId(websiteId);
    try {
      await apiClient.delete(`/superadmin/custom-domains/${websiteId}`);
      toast.success(`Custom domain ${domainName} disconnected and slot freed.`);
      setConfirmDeleteTarget(null);
      if (activeInstructionsItem?.websiteId === websiteId) {
        handleCloseModal();
      }
      await fetchCustomDomains();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to remove custom domain");
    } finally {
      setRemovingId(null);
    }
  };

  const copyText = (val: string, label: string) => {
    navigator.clipboard.writeText(val);
    toast.success(`${label} copied!`);
  };

  const buildDoctorSetupMessage = (
    domainName = "yourdomain.com",
    records: DnsInstructionRecord[] = [
      { purpose: "Root Domain", type: "A", name: "@", value: "76.76.21.21" },
      { purpose: "WWW Subdomain", type: "CNAME", name: "www", value: "cname.vercel-dns.com" },
    ],
    practiceName?: string
  ) => {
    const recordLines = records
      .map(
        (rec, index) =>
          `${index + 1}) Type: ${rec.type}  |  Name/Host: ${rec.name}  |  Value: ${rec.value}`
      )
      .join("\n");

    return `Hello${practiceName ? ` ${practiceName}` : ""},
To connect your custom domain (${domainName}) to your Doczeno website, please follow these simple steps in your domain provider dashboard (GoDaddy / Hostinger / Namecheap / BigRock / Cloudflare):

Step 1: Log in to your domain account and open "My Domains" > "${domainName}" > "DNS / Manage DNS".
Step 2: If there is already an old "@" (A record) or "www" (CNAME record), please Edit or Delete it first (do not keep two "@" A records at the same time).
Step 3: Add the following new DNS records and click Save:
${recordLines}

Important Reminders:
- Do NOT delete or change your email "MX" or "TXT (SPF/DKIM)" records — your clinic emails will keep working normally.
- If you use Cloudflare, set the Proxy toggle to OFF ("DNS Only" / Grey Cloud).
- If an older website was hosted on this domain, it will automatically be replaced by your new Doczeno website once DNS updates.

Step 4: Wait 15-30 minutes after saving and let us know so we can verify DNS & activate HTTPS (SSL) for your website.`;
  };

  const handleRunHealthCheck = async () => {
    setIsRunningHealthCheck(true);
    try {
      const res = await apiClient.post<{
        success: boolean;
        message?: string;
        data?: { checked: number; healthy: number; disabled: number; skippedReason?: string };
      }>("/superadmin/custom-domains/health-check", {});

      if (res.data?.disabled && res.data.disabled > 0) {
        toast.warning(res.message || `${res.data.disabled} expired/broken domain(s) auto-disabled.`);
      } else {
        toast.success(res.message || "All verified custom domains are healthy.");
      }
      await fetchCustomDomains();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Health check failed");
    } finally {
      setIsRunningHealthCheck(false);
    }
  };

  const columns = React.useMemo<ColumnDef<CustomDomainItem>[]>(
    () => [
      {
        key: "entityName",
        header: "Website / Practice",
        cell: (item) => (
          <div>
            <div className="font-bold text-slate-900 text-xs">{item.entityName}</div>
            <div className="text-[11px] font-mono text-slate-500">
              doczeno.vercel.app{item.doczenoPath}
            </div>
          </div>
        ),
      },
      {
        key: "customDomain",
        header: "Custom Domain",
        cell: (item) => (
          <div className="flex items-center gap-1.5">
            <a
              href={`https://${item.customDomain}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-xs font-bold text-[#1a76d1] hover:underline flex items-center gap-1"
            >
              {item.customDomain}
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        ),
      },
      {
        key: "customDomainStatus",
        header: "DNS & SSL Status",
        cell: (item) =>
          item.customDomainStatus === "VERIFIED" ? (
            <Badge className="bg-emerald-100 text-emerald-800 border border-emerald-300 text-[10px] font-bold gap-1">
              <CheckCircle2 className="h-3 w-3" />
              Verified (SSL Active)
            </Badge>
          ) : item.customDomainStatus === "FAILED" ? (
            <Badge
              className="bg-rose-100 text-rose-800 border border-rose-300 text-[10px] font-bold gap-1"
              title={item.customDomainLastError || "DNS check failed or domain expired"}
            >
              <AlertTriangle className="h-3 w-3" />
              DNS Failed / Expired
            </Badge>
          ) : (
            <Badge className="bg-amber-100 text-amber-800 border border-amber-300 text-[10px] font-bold gap-1">
              <Clock className="h-3 w-3" />
              Pending DNS
            </Badge>
          ),
      },
      {
        key: "customDomainRedirect",
        header: "Slug Redirect",
        sortable: false,
        cell: (item) => (
          <div
            className="flex items-center gap-1.5"
            title="When Verified & ON, doczeno.vercel.app/<slug> automatically redirects to the custom domain (auto-disables if domain expires)"
          >
            <Switch
              checked={item.customDomainRedirect}
              onCheckedChange={() => handleToggleRedirect(item)}
            />
            <span className="text-[10px] font-bold text-slate-600 uppercase">
              {item.customDomainRedirect ? "ON" : "OFF"}
            </span>
          </div>
        ),
      },
      {
        key: "actions",
        header: "Actions",
        sortable: false,
        headerClassName: "text-right",
        cell: (item) => (
          <div className="flex items-center justify-end gap-1.5">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setActiveInstructionsItem(item);
                setDomainInput(item.customDomain);
                setModalOpen(true);
              }}
              className="h-7 px-2.5 text-[11px] text-[#1a76d1] border-blue-200 hover:bg-blue-50"
            >
              DNS Records
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={verifyingId === item.websiteId}
              onClick={() => handleVerifyDomain(item.websiteId)}
              className="h-7 px-2.5 text-[11px] text-emerald-700 border-emerald-200 hover:bg-emerald-50"
            >
              <RefreshCw className={cn("h-3 w-3 mr-1", verifyingId === item.websiteId && "animate-spin")} />
              Verify
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={removingId === item.websiteId}
              onClick={() => setConfirmDeleteTarget(item)}
              className="h-7 px-2 text-[11px] text-rose-600 hover:bg-rose-50"
              title="Disconnect & Free Slot"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ),
      },
    ],
    [verifyingId, removingId]
  );

  const isLimitReached = usedCount >= maxLimit;

  return (
    <div className="space-y-5">
      {/* Quota & Status Card */}
      <Card className="bg-white border-slate-200 shadow-xs">
        <CardContent className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <Globe className="h-5 w-5 text-[#1a76d1]" />
              <h2 className="text-base font-bold text-slate-900">
                Custom Domain Management (White-Label + /admin Routing)
              </h2>
              <Badge
                variant="outline"
                className={cn(
                  "text-[10px] font-bold",
                  vercelConfigured
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : "bg-amber-50 text-amber-800 border-amber-200"
                )}
              >
                {vercelConfigured ? "Vercel API Auto-Sync Ready" : "Vercel API Env Optional (Manual/DNS Mode)"}
              </Badge>
            </div>
            <p className="text-xs text-slate-600">
              Connect custom domains to any Doctor or Hospital website. Both public site (<code>/</code>) and <code>/admin</code> run directly on their domain, and Render CORS updates automatically.
            </p>
            <div className="pt-1 flex items-center gap-3 max-w-md">
              <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                <div
                  className={cn(
                    "h-full transition-all",
                    usedCount >= maxLimit ? "bg-rose-500" : usedCount >= 40 ? "bg-amber-500" : "bg-[#1a76d1]"
                  )}
                  style={{ width: `${Math.min(100, (usedCount / maxLimit) * 100)}%` }}
                />
              </div>
              <span className="text-xs font-extrabold text-slate-800 whitespace-nowrap">
                {usedCount} / {maxLimit} Domains Used
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <Button
              size="sm"
              variant="outline"
              onClick={handleRunHealthCheck}
              disabled={isRunningHealthCheck || isLoading}
              className="h-9 px-3 text-xs text-emerald-700 border-emerald-200 hover:bg-emerald-50"
              title="Checks DNS of all verified domains and auto-disables slug redirect for any expired/broken domain"
            >
              <ShieldCheck className={cn("h-3.5 w-3.5 mr-1.5", isRunningHealthCheck && "animate-pulse")} />
              {isRunningHealthCheck ? "Checking DNS..." : "Check All DNS"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={fetchCustomDomains}
              disabled={isLoading}
              className="h-9 px-3 text-xs"
            >
              <RefreshCw className={cn("h-3.5 w-3.5 mr-1.5", isLoading && "animate-spin")} />
              Refresh
            </Button>
            <Button
              size="sm"
              disabled={isLimitReached}
              onClick={() => {
                setActiveInstructionsItem(null);
                setSelectedTargetId(doctors[0]?.id || organizations[0]?.id || "");
                setSelectedTargetType(doctors.length > 0 ? "DOCTOR" : "ORGANIZATION");
                setDomainInput("");
                setRedirectEnabled(true);
                setModalOpen(true);
              }}
              className="h-9 px-4 text-xs bg-[#1a76d1] hover:bg-[#1560aa] text-white font-semibold"
            >
              <Plus className="h-4 w-4 mr-1" />
              {isLimitReached ? "50/50 Limit Reached" : "Connect New Domain"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Connected Domains DataTable */}
      <Card className="bg-white border-slate-200 shadow-xs">
        <CardContent className="p-6">
          <DataTable
            columns={columns}
            data={domains}
            searchPlaceholder="Search domain, doctor, hospital..."
            pageSize={10}
            exportFileName="doczeno_custom_domains"
            emptyMessage={isLoading ? "Loading custom domains..." : "No custom domains connected yet. Click 'Connect New Domain' or use the Domain button in Hospitals/Doctors tables."}
          />
        </CardContent>
      </Card>

      {/* How to Add Domain — Simple Step-by-Step Guide for Doctors */}
      <Card className="bg-white border-slate-200 shadow-xs overflow-hidden">
        <div className="px-5 py-4 bg-slate-50/80 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setShowSetupGuide((prev) => !prev)}
            className="flex items-center gap-2.5 text-left cursor-pointer"
          >
            <div className="h-8 w-8 rounded-lg bg-blue-100 text-[#1a76d1] flex items-center justify-center shrink-0">
              <BookOpen className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                How to Add Domain — Doctor Setup Guide
                {showSetupGuide ? (
                  <ChevronUp className="h-4 w-4 text-slate-500" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-slate-500" />
                )}
              </h3>
              <p className="text-xs text-slate-500">
                Simple step-by-step instructions for doctors to configure DNS in their GoDaddy / Hostinger / Namecheap dashboard.
              </p>
            </div>
          </button>

          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => copyText(buildDoctorSetupMessage(), "Doctor Setup Guide")}
            className="h-8 px-3 text-xs text-[#1a76d1] border-blue-200 hover:bg-blue-50 shrink-0 self-start sm:self-center"
          >
            <MessageSquareText className="h-3.5 w-3.5 mr-1.5" />
            Copy Guide for Doctor
          </Button>
        </div>

        {showSetupGuide && (
          <CardContent className="p-5 space-y-4 text-xs text-slate-700">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                <div className="inline-flex items-center px-2 py-0.5 rounded-md bg-blue-100 text-[#1560aa] font-bold text-[10px]">
                  STEP 1
                </div>
                <div className="font-bold text-slate-900">Open DNS Settings</div>
                <p className="text-slate-600 leading-relaxed">
                  Ask the doctor to log in to their domain provider (GoDaddy, Hostinger, Namecheap, BigRock, or Cloudflare) and open <strong>My Domains ➔ Manage DNS</strong>. (No domain password sharing is needed.)
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                <div className="inline-flex items-center px-2 py-0.5 rounded-md bg-blue-100 text-[#1560aa] font-bold text-[10px]">
                  STEP 2
                </div>
                <div className="font-bold text-slate-900">Remove Old A / CNAME</div>
                <p className="text-slate-600 leading-relaxed">
                  If an old <code>A</code> record (<code>@</code>) or <code>CNAME</code> record (<code>www</code>) already exists, <strong>Edit or Delete</strong> it first. Do not leave two different <code>A</code> records for <code>@</code>.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                <div className="inline-flex items-center px-2 py-0.5 rounded-md bg-blue-100 text-[#1560aa] font-bold text-[10px]">
                  STEP 3
                </div>
                <div className="font-bold text-slate-900">Add New DNS Records</div>
                <div className="text-slate-600 space-y-1">
                  <div>• <strong>A</strong> | Host: <code>@</code> | Value: <code>76.76.21.21</code></div>
                  <div>• <strong>CNAME</strong> | Host: <code>www</code> | Value: <code>cname.vercel-dns.com</code></div>
                  <div className="text-[11px] text-slate-500">
                    (Also add the <code>_vercel</code> TXT record if shown in the DNS modal.)
                  </div>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200 space-y-1.5">
                <div className="inline-flex items-center px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                  STEP 4
                </div>
                <div className="font-bold text-slate-900">Save & Verify</div>
                <p className="text-slate-600 leading-relaxed">
                  Wait <strong>15–30 minutes</strong> after saving (rarely up to 2 hours for global DNS propagation). Then click <strong>Verify</strong> in the table above — SSL (<code>https://</code>) and routing will activate automatically.
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-amber-50/80 border border-amber-200 space-y-1.5">
              <div className="font-bold text-amber-950 flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                Important Notes (Share With the Doctor):
              </div>
              <ul className="list-disc pl-5 space-y-1 text-amber-900">
                <li>
                  <strong>Emails Stay Safe:</strong> Do <strong>not</strong> delete or edit existing <code>MX</code> and email <code>TXT</code> records — clinic emails will continue working as usual.
                </li>
                <li>
                  <strong>If Another Website Was Hosted Earlier:</strong> Once the new DNS records are saved, the old site will stop showing on that domain and the new Doczeno website will go live instead.
                </li>
                <li>
                  <strong>Cloudflare Users:</strong> If the domain uses Cloudflare DNS, set the proxy status to <strong>OFF (&ldquo;DNS Only&rdquo; / Grey Cloud)</strong> so SSL verification succeeds.
                </li>
                <li>
                  <strong>Domain Renewal:</strong> The doctor must renew their domain on time with GoDaddy/Hostinger. If a domain ever expires, our daily health check automatically turns off slug redirect so the <code>doczeno.vercel.app</code> link stays working safely.
                </li>
              </ul>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Connect / DNS Instructions Modal */}
      <Dialog open={modalOpen} onOpenChange={(open) => !open && handleCloseModal()}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="h-5 w-5 text-[#1a76d1]" />
              {activeInstructionsItem
                ? `DNS & Verification — ${activeInstructionsItem.customDomain}`
                : "Connect Custom Domain"}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {activeInstructionsItem
                ? `Share these DNS records with ${activeInstructionsItem.entityName} to activate HTTPS & routing.`
                : `Strict Vercel Hobby Plan cap: ${usedCount} of ${maxLimit} slots currently used.`}
            </DialogDescription>
          </DialogHeader>

          {!activeInstructionsItem ? (
            <form onSubmit={handleAssignDomain} className="space-y-4 py-2 text-xs">
              {!externalTarget && (
                <>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Entity Category</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        type="button"
                        variant={selectedTargetType === "DOCTOR" ? "default" : "outline"}
                        size="sm"
                        onClick={() => {
                          setSelectedTargetType("DOCTOR");
                          setSelectedTargetId(doctors[0]?.id || "");
                        }}
                        className="text-xs"
                      >
                        Doctor Website
                      </Button>
                      <Button
                        type="button"
                        variant={selectedTargetType === "ORGANIZATION" ? "default" : "outline"}
                        size="sm"
                        onClick={() => {
                          setSelectedTargetType("ORGANIZATION");
                          setSelectedTargetId(organizations[0]?.id || "");
                        }}
                        className="text-xs"
                      >
                        Hospital / Clinic
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Select Website</Label>
                    <select
                      value={selectedTargetId}
                      onChange={(e) => setSelectedTargetId(e.target.value)}
                      className="w-full h-9 px-3 rounded-lg border border-slate-300 bg-white text-xs"
                      required
                    >
                      <option value="">-- Choose Website --</option>
                      {selectedTargetType === "DOCTOR"
                        ? doctors.map((d) => (
                            <option key={d.id} value={d.id}>
                              Dr. {d.doctorName} (/{d.organizationId ? `${d.organizationId.slug}/${d.slug}` : d.slug})
                            </option>
                          ))
                        : organizations.map((o) => (
                            <option key={o.id} value={o.id}>
                              {o.name} (/{o.slug})
                            </option>
                          ))}
                    </select>
                  </div>
                </>
              )}

              {externalTarget && (
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                  <div className="font-bold text-slate-900">{externalTarget.entityName}</div>
                  <div className="font-mono text-[11px] text-slate-500">
                    Current URL: doczeno.vercel.app{externalTarget.doczenoPath}
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="customDomainInput" className="text-xs font-semibold">
                  Doctor / Hospital Custom Domain *
                </Label>
                <Input
                  id="customDomainInput"
                  value={domainInput}
                  onChange={(e) => setDomainInput(e.target.value)}
                  placeholder="e.g. parthkadiya.com or www.clinic.in"
                  className="font-mono text-xs h-9"
                  required
                />
                <p className="text-[11px] text-slate-500">
                  Enter without <code>https://</code> (e.g. <code>parthkadiya.com</code>).
                </p>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-blue-50/70 border border-blue-200">
                <div className="space-y-0.5 pr-3">
                  <div className="font-semibold text-slate-900 text-xs">
                    Auto-Redirect doczeno.vercel.app URL to Custom Domain
                  </div>
                  <div className="text-[11px] text-slate-600">
                    Once verified, visiting the old doczeno slug will automatically redirect to their custom domain (auto-turns OFF if domain expires).
                  </div>
                </div>
                <Switch
                  checked={redirectEnabled}
                  onCheckedChange={setRedirectEnabled}
                />
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={handleCloseModal}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSaving || isLimitReached}
                  className="bg-[#1a76d1] hover:bg-[#1560aa] text-white"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    "Save & Get DNS Records"
                  )}
                </Button>
              </DialogFooter>
            </form>
          ) : (
            <div className="space-y-4 py-2 text-xs">
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200">
                <div>
                  <div className="font-bold text-slate-900">{activeInstructionsItem.entityName}</div>
                  <div className="font-mono text-[#1a76d1] font-semibold mt-0.5">
                    https://{activeInstructionsItem.customDomain}
                  </div>
                </div>
                <Badge
                  className={
                    activeInstructionsItem.customDomainStatus === "VERIFIED"
                      ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                      : activeInstructionsItem.customDomainStatus === "FAILED"
                      ? "bg-rose-100 text-rose-800 border-rose-300"
                      : "bg-amber-100 text-amber-800 border-amber-300"
                  }
                >
                  {activeInstructionsItem.customDomainStatus === "VERIFIED"
                    ? "VERIFIED & LIVE"
                    : activeInstructionsItem.customDomainStatus === "FAILED"
                    ? "DNS FAILED / EXPIRED"
                    : "PENDING DNS"}
                </Badge>
              </div>

              {activeInstructionsItem.customDomainLastError &&
                activeInstructionsItem.customDomainStatus !== "VERIFIED" && (
                  <div
                    className={cn(
                      "p-3 rounded-xl border flex items-start gap-2",
                      activeInstructionsItem.customDomainStatus === "FAILED"
                        ? "bg-rose-50 border-rose-200 text-rose-900"
                        : "bg-amber-50 border-amber-200 text-amber-900"
                    )}
                  >
                    <AlertTriangle
                      className={cn(
                        "h-4 w-4 shrink-0 mt-0.5",
                        activeInstructionsItem.customDomainStatus === "FAILED"
                          ? "text-rose-600"
                          : "text-amber-600"
                      )}
                    />
                    <span>{activeInstructionsItem.customDomainLastError}</span>
                  </div>
                )}

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="font-bold text-slate-900">
                    DNS Records to Add (GoDaddy / Namecheap / Hostinger / Cloudflare):
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 px-2.5 text-[11px] text-[#1a76d1] border-blue-200 hover:bg-blue-50"
                    onClick={() =>
                      copyText(
                        buildDoctorSetupMessage(
                          activeInstructionsItem.customDomain,
                          activeInstructionsItem.dnsInstructions,
                          activeInstructionsItem.entityName
                        ),
                        "Complete Doctor Instructions"
                      )
                    }
                  >
                    <MessageSquareText className="h-3 w-3 mr-1" />
                    Copy Guide + Records for Doctor
                  </Button>
                </div>
                <div className="border rounded-xl overflow-hidden border-slate-200">
                  <table className="w-full text-left text-[11px]">
                    <thead className="bg-slate-100 text-slate-700 font-semibold">
                      <tr>
                        <th className="p-2.5">Type</th>
                        <th className="p-2.5">Host / Name</th>
                        <th className="p-2.5">Value / Points To</th>
                        <th className="p-2.5 text-right">Copy</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {activeInstructionsItem.dnsInstructions.map((rec, idx) => (
                        <tr key={idx} className="bg-white">
                          <td className="p-2.5 font-bold text-[#1560aa]">{rec.type}</td>
                          <td className="p-2.5 font-mono font-semibold">{rec.name}</td>
                          <td className="p-2.5 font-mono break-all text-slate-800">{rec.value}</td>
                          <td className="p-2.5 text-right">
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="h-6 px-2 text-[10px]"
                              onClick={() => copyText(rec.value, `${rec.type} Value`)}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <DialogFooter className="flex-col sm:flex-row gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setConfirmDeleteTarget(activeInstructionsItem)}
                  disabled={removingId === activeInstructionsItem.websiteId}
                  className="text-rose-600 border-rose-200 hover:bg-rose-50 sm:mr-auto"
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                  Disconnect Domain
                </Button>
                <Button type="button" variant="outline" onClick={handleCloseModal}>
                  Close
                </Button>
                <Button
                  type="button"
                  disabled={verifyingId === activeInstructionsItem.websiteId}
                  onClick={() => handleVerifyDomain(activeInstructionsItem.websiteId)}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  <RefreshCw
                    className={cn(
                      "h-3.5 w-3.5 mr-1.5",
                      verifyingId === activeInstructionsItem.websiteId && "animate-spin"
                    )}
                  />
                  Verify DNS & SSL Now
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete / Disconnect Confirmation Dialog */}
      <Dialog
        open={Boolean(confirmDeleteTarget)}
        onOpenChange={(open) => {
          if (!open && !removingId) {
            setConfirmDeleteTarget(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base text-rose-700">
              <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0" />
              Disconnect Custom Domain?
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-600 pt-1">
              Are you sure you want to remove{" "}
              <strong className="font-mono text-slate-900">
                {confirmDeleteTarget?.customDomain}
              </strong>{" "}
              from <strong>{confirmDeleteTarget?.entityName}</strong>?
            </DialogDescription>
          </DialogHeader>

          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-900 space-y-1">
            <div>
              • This domain will be detached from Vercel and removed from Doczeno.
            </div>
            <div>
              • <strong>1 of {maxLimit}</strong> custom domain slots will be freed immediately.
            </div>
            <div>
              • The original URL (<code>doczeno.vercel.app{confirmDeleteTarget?.doczenoPath}</code>) will stay active.
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={Boolean(removingId)}
              onClick={() => setConfirmDeleteTarget(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={Boolean(removingId)}
              onClick={() =>
                confirmDeleteTarget &&
                handleRemoveDomain(
                  confirmDeleteTarget.websiteId,
                  confirmDeleteTarget.customDomain
                )
              }
              className="bg-rose-600 hover:bg-rose-700 text-white"
            >
              {removingId ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  Disconnecting...
                </>
              ) : (
                <>
                  <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                  Yes, Disconnect Domain
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
