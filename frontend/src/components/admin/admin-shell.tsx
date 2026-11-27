import * as React from "react";
import Link from "next/link";
import {
  ExternalLink,
  LogOut,
  Lock,
  Menu,
  X,
  Bot,
  QrCode,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DoczenoLogo, DoczenoIconMark } from "@/components/brand/doczeno-logo";
import { AdminAssistantDrawer } from "./admin-assistant-drawer";
import { ClinicQrDialog } from "./clinic-qr-dialog";
import { apiClient } from "@/lib/api-client";
import { toast } from "sonner";

export interface NavItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  isLocked?: boolean;
}

interface AdminShellProps {
  title: string;
  subtitle?: string;
  roleBadge: string;
  publicWebsiteUrl?: string;
  logoUrl?: string;
  navItems: NavItem[];
  activeTab: string;
  onTabChange: (id: string) => void;
  children: React.ReactNode;
  userEmail?: string;
  onLogout?: () => void;
  hideHeader?: boolean;
  isAdminChatbotEnabled?: boolean;
}

export function AdminShell({
  title,
  subtitle,
  roleBadge,
  publicWebsiteUrl,
  logoUrl,
  navItems,
  activeTab,
  onTabChange,
  children,
  userEmail: _userEmail = "doctor@doczeno.vercel.app",
  onLogout,
  hideHeader = false,
  isAdminChatbotEnabled = true,
}: AdminShellProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const [copilotOpen, setCopilotOpen] = React.useState(false);
  const [qrOpen, setQrOpen] = React.useState(false);
  const [effectivePublicUrl, setEffectivePublicUrl] = React.useState(publicWebsiteUrl);

  React.useEffect(() => {
    if (
      publicWebsiteUrl &&
      typeof window !== "undefined" &&
      (window.location.pathname === "/admin" || window.location.pathname.startsWith("/admin/"))
    ) {
      setEffectivePublicUrl("/");
    } else {
      setEffectivePublicUrl(publicWebsiteUrl);
    }
  }, [publicWebsiteUrl]);

  const handleLogout = async () => {
    if (onLogout) {
      onLogout();
      return;
    }

    try {
      await apiClient.post("/auth/logout");
      toast.success("Logged out successfully.");
    } catch {
      // Ignore
    } finally {
      if (typeof window !== "undefined") {
        window.location.replace("/admin/login");
      }
    }
  };

  const renderNavList = () => (
    <nav className="p-3 space-y-1 flex-1 overflow-y-auto min-h-0">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = activeTab === item.id;

        return (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              onTabChange(item.id);
              setMobileMenuOpen(false);
            }}
            className={cn(
              "w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all text-left",
              isActive
                ? "bg-[#1a76d1] text-white shadow-xs font-bold"
                : "text-slate-600 hover:bg-blue-50/80 hover:text-[#1a76d1]"
            )}
          >
            <div className="flex items-center gap-3 min-w-0">
              <Icon className={cn("h-4 w-4 shrink-0 transition-colors", isActive ? "text-white" : "text-slate-400")} />
              <span className="truncate">{item.label}</span>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {item.isLocked && (
                <Lock className={cn("h-3 w-3", isActive ? "text-white" : "text-amber-500")} />
              )}
              {item.badge && (
                <span
                  className={cn(
                    "text-[10px] px-1.5 py-0.5 rounded-full font-mono font-bold",
                    isActive ? "bg-white/20 text-white" : "bg-blue-100 text-[#1560aa]"
                  )}
                >
                  {item.badge}
                </span>
              )}
            </div>
          </button>
        );
      })}
    </nav>
  );

  return (
    <>
      <div className="min-h-screen md:h-screen md:overflow-hidden bg-[#f0f7ff]/40 flex flex-col md:flex-row text-slate-900 font-sans">
        {/* 1. Desktop Fixed-Height Sidebar - Light Theme */}
        <aside className="w-64 bg-white text-slate-800 border-r border-blue-100/90 flex-col shrink-0 hidden md:flex md:h-full z-40 shadow-xs">
          {/* Brand Header */}
          <div className="h-16 px-6 flex items-center border-b border-blue-100/80 bg-white shrink-0">
            <div className="flex items-center gap-3">
              <div className="relative flex items-center justify-center shrink-0 bg-white rounded-xl shadow-2xs border border-blue-100 p-1.5">
                <DoczenoIconMark className="h-8 w-8" />
              </div>
              <div className="flex flex-col">
                <span className="font-extrabold tracking-tight text-[#0F2E4A] text-lg leading-tight">
                  Doczeno
                </span>
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-50 text-[#1560aa] border border-blue-200 uppercase tracking-wider mt-0.5 w-fit">
                  {roleBadge}
                </span>
              </div>
            </div>
          </div>

          {/* Navigation Item List */}
          {renderNavList()}

          {/* Sidebar Footer */}
          <div className="p-4 border-t border-blue-100 bg-slate-50/60 shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleLogout}
              className="w-full h-9 px-3 text-slate-700 hover:text-rose-600 hover:bg-rose-50 border-slate-200 hover:border-rose-200 gap-2 font-semibold text-xs shadow-2xs transition-colors rounded-lg"
              title="Sign Out"
            >
              <LogOut className="h-4 w-4 text-rose-500" />
              <span>Logout</span>
            </Button>
          </div>
        </aside>

        {/* Mobile Slide-in Drawer with Backdrop */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 md:hidden flex">
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
              onClick={() => setMobileMenuOpen(false)}
            />

            {/* Slide-over Menu Content */}
            <div className="relative w-72 max-w-[85vw] bg-white h-full shadow-2xl flex flex-col z-50 animate-in slide-in-from-left duration-200">
              <div className="h-16 px-5 flex items-center justify-between border-b border-blue-100 bg-white shrink-0">
                <div className="flex items-center gap-2.5">
                  <DoczenoIconMark className="h-7 w-7" />
                  <div className="flex flex-col">
                    <span className="font-bold text-[#0F2E4A] text-base leading-tight">
                      Doczeno
                    </span>
                    <span className="text-[9px] font-bold text-[#1560aa] uppercase">
                      {roleBadge}
                    </span>
                  </div>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setMobileMenuOpen(false)}
                  className="h-8 w-8 p-0 text-slate-500 hover:text-slate-800"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>

              {renderNavList()}

              <div className="p-4 border-t border-blue-100 bg-slate-50/60 shrink-0">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleLogout}
                  className="w-full h-9 px-3 text-slate-700 hover:text-rose-600 hover:bg-rose-50 border-slate-200 hover:border-rose-200 gap-2 font-semibold text-xs shadow-2xs transition-colors rounded-lg"
                >
                  <LogOut className="h-4 w-4 text-rose-500" />
                  <span>Logout</span>
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* 2. Main Content Container */}
        <div className="flex-1 flex flex-col min-w-0 md:h-full md:overflow-hidden">
          {/* Top Header */}
          {!hideHeader ? (
            <header className="h-16 bg-white border-b border-blue-100 px-4 sm:px-8 flex items-center justify-between sticky top-0 z-30 shadow-2xs">
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                  className="md:hidden h-8 w-8 p-0 text-slate-700 hover:text-[#1a76d1] hover:bg-blue-50"
                  aria-label="Toggle navigation"
                >
                  <Menu className="h-5 w-5" />
                </Button>
                <div>
                  <h1 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight leading-tight">
                    {title}
                  </h1>
                  {subtitle && (
                    <p className="text-xs text-slate-500 hidden sm:block">
                      {subtitle}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 sm:gap-2.5">
                {publicWebsiteUrl && (
                  <>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setQrOpen(true)}
                      className="h-8 gap-1.5 border-blue-200 text-[#1560aa] hover:bg-blue-50 hover:border-blue-300 text-xs font-semibold rounded-lg"
                      title="View & Export Clinic Website QR Code"
                    >
                      <QrCode className="h-3.5 w-3.5 text-[#1a76d1]" />
                      <span className="hidden sm:inline">QR Code</span>
                    </Button>

                    <Button asChild size="sm" variant="default" className="bg-[#1a76d1] hover:bg-[#1560aa] text-white text-xs h-8 font-semibold rounded-lg shadow-xs">
                      <Link href={effectivePublicUrl || publicWebsiteUrl} target="_blank">
                        <ExternalLink className="h-3 w-3 mr-1.5" />
                        Live Preview
                      </Link>
                    </Button>
                  </>
                )}
              </div>
            </header>
          ) : (
            <div className="md:hidden flex items-center justify-between p-3 bg-white border-b border-blue-100 sticky top-0 z-30 shadow-2xs">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="h-8 w-8 p-0 text-slate-700 hover:text-[#1a76d1]"
                aria-label="Toggle navigation"
              >
                <Menu className="h-5 w-5" />
              </Button>
              <DoczenoLogo variant="horizontal" size="xs" textClassName="text-slate-900" />
              <div className="w-8" />
            </div>
          )}

          {/* Dynamic Admin Body Content */}
          <main className="p-3.5 sm:p-6 lg:p-8 flex-1 overflow-y-auto w-full">
            <div className="max-w-7xl w-full mx-auto space-y-6">
              {children}
            </div>
          </main>
        </div>
      </div>

      {/* Floating AI Copilot Trigger for All Admin Panels */}
      {!copilotOpen && isAdminChatbotEnabled !== false && (
        <div className="fixed bottom-5 right-5 sm:bottom-6 sm:right-6 z-50 font-sans print:hidden">
          <button
            type="button"
            onClick={() => setCopilotOpen(true)}
            className="group relative flex items-center justify-center h-12 w-12 bg-[#1a76d1] hover:bg-[#1560aa] text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-300 focus:outline-none focus:ring-4 focus:ring-blue-400/30 animate-ai-breathe"
            aria-label="Open AI Copilot Assistant"
          >
            <div className="relative flex items-center justify-center">
              <Bot className="h-5 w-5" />
              <span className="absolute -top-1 -right-1 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-300 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-200" />
              </span>
            </div>
          </button>
        </div>
      )}

      {/* Slide-over Admin Assistant Copilot */}
      {isAdminChatbotEnabled !== false && (
        <AdminAssistantDrawer
          isOpen={copilotOpen}
          onClose={() => setCopilotOpen(false)}
          roleBadge={roleBadge}
          portalTitle={title}
        />
      )}

      {/* Clinic Website QR Code Modal */}
      {publicWebsiteUrl && (
        <ClinicQrDialog
          isOpen={qrOpen}
          onClose={() => setQrOpen(false)}
          title={title}
          subtitle={subtitle}
          pathOrSlug={publicWebsiteUrl}
          logoUrl={logoUrl}
        />
      )}
    </>
  );
}
