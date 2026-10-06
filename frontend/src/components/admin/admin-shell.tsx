import * as React from "react";
import Link from "next/link";
import {
  ExternalLink,
  LogOut,
  Lock,
  Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

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
  navItems: NavItem[];
  activeTab: string;
  onTabChange: (id: string) => void;
  children: React.ReactNode;
  userEmail?: string;
  onLogout?: () => void;
}

export function AdminShell({
  title,
  subtitle,
  roleBadge,
  publicWebsiteUrl,
  navItems,
  activeTab,
  onTabChange,
  children,
  userEmail = "doctor@doczeno.com",
  onLogout,
}: AdminShellProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row text-slate-900 font-sans">
      {/* 1. Desktop & Mobile Sidebar */}
      <aside
        className={cn(
          "w-full md:w-64 bg-slate-900 text-slate-200 border-r border-slate-800 flex flex-col shrink-0 transition-all",
          mobileMenuOpen ? "block" : "hidden md:flex"
        )}
      >
        {/* Brand Header */}
        <div className="h-16 px-6 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-emerald-500 text-slate-950 flex items-center justify-center font-bold text-sm">
              DZ
            </div>
            <div>
              <span className="font-extrabold text-sm text-white tracking-tight block">
                Doczeno
              </span>
              <span className="text-[10px] text-slate-400 block tracking-wider uppercase font-medium">
                Admin Console
              </span>
            </div>
          </div>
          <Badge variant="outline" className="text-[10px] bg-slate-800 text-slate-300 border-slate-700">
            {roleBadge}
          </Badge>
        </div>

        {/* Navigation Item List */}
        <nav className="p-3 space-y-1 flex-1 overflow-y-auto">
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
                  "w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-colors text-left",
                  isActive
                    ? "bg-emerald-500 text-slate-950 font-bold shadow-xs"
                    : "text-slate-300 hover:bg-slate-800/80 hover:text-white"
                )}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Icon className={cn("h-4 w-4 shrink-0", isActive ? "text-slate-950" : "text-slate-400")} />
                  <span className="truncate">{item.label}</span>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {item.isLocked && (
                    <Lock className={cn("h-3 w-3", isActive ? "text-slate-950" : "text-amber-400")} />
                  )}
                  {item.badge && (
                    <span
                      className={cn(
                        "text-[10px] px-1.5 py-0.5 rounded-full font-mono font-bold",
                        isActive ? "bg-slate-900 text-white" : "bg-slate-800 text-slate-300"
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

        {/* Sidebar Footer / User Profile */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/40 space-y-3">
          {publicWebsiteUrl && (
            <Button
              asChild
              variant="outline"
              size="sm"
              className="w-full bg-slate-800/80 border-slate-700 text-slate-200 hover:bg-slate-800 hover:text-white text-xs h-8"
            >
              <Link href={publicWebsiteUrl} target="_blank">
                <ExternalLink className="h-3 w-3 mr-1.5 text-emerald-400" />
                View Public Site
              </Link>
            </Button>
          )}

          <div className="flex items-center justify-between pt-1">
            <div className="truncate mr-2">
              <span className="text-[11px] font-medium text-slate-300 block truncate">
                {userEmail}
              </span>
              <span className="text-[9px] text-slate-500 block uppercase">
                {roleBadge}
              </span>
            </div>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onLogout}
              className="h-7 px-2 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10"
              title="Logout"
            >
              <LogOut className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </aside>

      {/* 2. Main Content Container */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-8 flex items-center justify-between sticky top-0 z-30 shadow-2xs">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden h-8 w-8 p-0"
              aria-label="Toggle navigation"
            >
              <Layers className="h-4 w-4" />
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

          <div className="flex items-center gap-3">
            <Badge variant="secondary" className="text-xs font-semibold">
              {roleBadge}
            </Badge>

            {publicWebsiteUrl && (
              <Button asChild size="sm" variant="default" className="bg-slate-900 hover:bg-slate-800 text-white text-xs h-8">
                <Link href={publicWebsiteUrl} target="_blank">
                  <ExternalLink className="h-3 w-3 mr-1.5" />
                  Live Preview
                </Link>
              </Button>
            )}
          </div>
        </header>

        {/* Dynamic Admin Body Content */}
        <main className="p-4 sm:p-8 flex-1 overflow-y-auto max-w-7xl w-full mx-auto space-y-6">
          {children}
        </main>
      </div>
    </div>
  );
}
