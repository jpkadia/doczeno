"use client";

import * as React from "react";
import { CheckCircle2, XCircle, Loader2, Globe } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiClient } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { usePlatformDomain } from "@/hooks/use-platform-domain";

interface SlugInputProps {
  id?: string;
  label?: string;
  value?: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  error?: string;
  disabled?: boolean;
  prefix?: string;
  type?: "ONLY_DOCTOR" | "HOSPITAL" | "HOSPITAL_DOCTOR";
  orgId?: string;
  excludeId?: string;
  placeholder?: string;
  hint?: string;
  required?: boolean;
}

export function SlugInput({
  id = "slug",
  label = "Choose Website URL / Slug",
  value = "",
  onChange,
  onBlur,
  error,
  disabled = false,
  prefix,
  type = "ONLY_DOCTOR",
  orgId,
  excludeId,
  placeholder = "dr-priya-sharma",
  hint = "Public website link identifier. You can customize this now.",
  required = true,
}: SlugInputProps) {
  const { platformDomain } = usePlatformDomain();
  const effectivePrefix = prefix || `${platformDomain}/`;
  const [checking, setChecking] = React.useState(false);
  const [status, setStatus] = React.useState<"idle" | "available" | "taken">("idle");
  const [statusMsg, setStatusMsg] = React.useState<string | null>(null);

  const debounceTimerRef = React.useRef<NodeJS.Timeout | null>(null);
  const latestRequestedSlugRef = React.useRef<string>("");

  const sanitizeSlug = (input: string) => {
    return input
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "")
      .replace(/-+/g, "-");
  };

  const checkAvailability = React.useCallback(
    async (slugToCheck: string) => {
      const clean = slugToCheck.trim().replace(/^-+|-+$/g, "");
      if (!clean || clean.length < 2) {
        setStatus("idle");
        setStatusMsg(null);
        setChecking(false);
        return;
      }

      latestRequestedSlugRef.current = clean;

      try {
        setChecking(true);
        const res = await apiClient.get<{
          available: boolean;
          error?: string;
          message?: string;
        }>("/onboarding/check-slug", {
          params: {
            slug: clean,
            type,
            ...(orgId ? { orgId } : {}),
            ...(excludeId ? { excludeId } : {}),
          },
        });

        // Discard stale out-of-order response
        if (latestRequestedSlugRef.current !== clean) return;

        if (res.available) {
          setStatus("available");
          setStatusMsg("URL is available!");
        } else {
          setStatus("taken");
          setStatusMsg(res.error || "This URL is already taken.");
        }
      } catch {
        if (latestRequestedSlugRef.current === clean) {
          setStatus("idle");
          setStatusMsg(null);
        }
      } finally {
        if (latestRequestedSlugRef.current === clean) {
          setChecking(false);
        }
      }
    },
    [type, orgId, excludeId]
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const sanitized = sanitizeSlug(raw);
    onChange(sanitized);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (sanitized.length >= 2) {
      setChecking(true);
      debounceTimerRef.current = setTimeout(() => {
        checkAvailability(sanitized);
      }, 400);
    } else {
      setStatus("idle");
      setStatusMsg(null);
      setChecking(false);
    }
  };

  const handleBlur = () => {
    const trimmed = value.replace(/^-+|-+$/g, "");
    if (trimmed !== value) {
      onChange(trimmed);
      if (trimmed.length >= 2) {
        checkAvailability(trimmed);
      }
    }
    if (onBlur) {
      onBlur();
    }
  };

  // Re-check on mount or when external value changes while idle
  React.useEffect(() => {
    if (value && value.length >= 2 && status === "idle") {
      checkAvailability(value);
    }
  }, [value, status, checkAvailability]);

  // Re-check if orgId changes for hospital doctor
  React.useEffect(() => {
    if (orgId && value && value.length >= 2) {
      checkAvailability(value);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  return (
    <div className="space-y-1.5 w-full">
      <div className="flex items-center justify-between">
        <Label htmlFor={id} className="text-sm font-medium flex items-center gap-1.5">
          <Globe className="h-4 w-4 text-[#1a76d1]" />
          {label} {required && <span className="text-destructive">*</span>}
        </Label>
        <span className="text-[11px] text-muted-foreground">Unique web address</span>
      </div>

      <div className="relative flex flex-col sm:flex-row rounded-md shadow-xs">
        <span className="inline-flex items-center px-3 py-1.5 sm:py-0 rounded-t-md sm:rounded-t-none sm:rounded-l-md border border-input sm:border-r-0 border-b-0 sm:border-b bg-muted/70 text-muted-foreground text-xs font-mono select-none break-all">
          {effectivePrefix}
        </span>

        <div className="relative flex-1 min-w-0">
          <Input
            id={id}
            value={value}
            onChange={handleChange}
            onBlur={handleBlur}
            placeholder={placeholder}
            disabled={disabled}
            className={cn(
              "rounded-t-none sm:rounded-t-md sm:rounded-l-none rounded-b-md lowercase font-mono text-sm tracking-tight pr-24 w-full",
              error || status === "taken" ? "border-destructive focus-visible:ring-destructive" : "",
              status === "available" ? "border-[#1a76d1] focus-visible:ring-[#1a76d1]" : ""
            )}
          />

          {/* Live status badge inside the input */}
          <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1 text-xs select-none pointer-events-none">
            {checking ? (
              <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-[#1a76d1]" />
                Checking...
              </span>
            ) : status === "available" ? (
              <span className="inline-flex items-center gap-1 text-[11px] text-[#1a76d1] font-semibold">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Available
              </span>
            ) : status === "taken" ? (
              <span className="inline-flex items-center gap-1 text-[11px] text-destructive font-semibold">
                <XCircle className="h-3.5 w-3.5" />
                Taken
              </span>
            ) : null}
          </div>
        </div>
      </div>

      {/* Helper text or error message */}
      {error || (status === "taken" && statusMsg) ? (
        <p className="text-xs text-destructive font-medium">{error || statusMsg}</p>
      ) : status === "available" ? (
        <p className="text-[11px] text-[#1560aa] font-medium">
          Your live address will be: <strong className="font-mono">{effectivePrefix}{value}</strong>
        </p>
      ) : hint ? (
        <p className="text-[11px] text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}
