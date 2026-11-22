"use client";

import * as React from "react";
import { toast } from "sonner";
import { apiClient } from "@/lib/api-client";

export interface StoredDraft<T> {
  formData: Partial<T>;
  currentStep: number;
  lastSavedAt: string;
  version: number;
}

export interface DraftInfo {
  step: number;
  lastSavedAt: string;
  formattedDate: string;
  previewTitle?: string;
}

export interface UseFormDraftOptions<T> {
  key: string;
  formValues: T;
  currentStep?: number;
  formType?: "ONLY_DOCTOR" | "HOSPITAL" | "HOSPITAL_DOCTOR";
  getEmail?: (values: T) => string | undefined;
  getName?: (values: T) => string | undefined;
  hasContent?: (values: T, step?: number) => boolean;
  debounceMs?: number;
  onRestore: (savedData: Partial<T>, savedStep: number) => void;
  onDiscard?: () => void;
}

export function formatDraftDate(isoString: string): string {
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return "Recently";

    const now = new Date();
    const isToday =
      date.getDate() === now.getDate() &&
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear();

    const timeStr = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    if (isToday) {
      return `Today at ${timeStr}`;
    }

    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const isYesterday =
      date.getDate() === yesterday.getDate() &&
      date.getMonth() === yesterday.getMonth() &&
      date.getFullYear() === yesterday.getFullYear();

    if (isYesterday) {
      return `Yesterday at ${timeStr}`;
    }

    const dateStr = date.toLocaleDateString([], { day: "numeric", month: "short" });
    return `${dateStr} at ${timeStr}`;
  } catch {
    return "Recently";
  }
}

export function useFormDraft<T extends Record<string, any>>({
  key,
  formValues,
  currentStep = 1,
  formType,
  getEmail,
  getName,
  hasContent,
  debounceMs = 800,
  onRestore,
  onDiscard,
}: UseFormDraftOptions<T>) {
  const [hasDraftToResume, setHasDraftToResume] = React.useState(false);
  const [draftInfo, setDraftInfo] = React.useState<DraftInfo | null>(null);
  const [saveStatus, setSaveStatus] = React.useState<"idle" | "saving" | "saved">("idle");
  const [lastSavedText, setLastSavedText] = React.useState<string | null>(null);

  // Store callbacks in refs to prevent infinite render loops
  const hasContentRef = React.useRef(hasContent);
  hasContentRef.current = hasContent;

  const getNameRef = React.useRef(getName);
  getNameRef.current = getName;

  const getEmailRef = React.useRef(getEmail);
  getEmailRef.current = getEmail;

  const onRestoreRef = React.useRef(onRestore);
  onRestoreRef.current = onRestore;

  const onDiscardRef = React.useRef(onDiscard);
  onDiscardRef.current = onDiscard;

  const rawSavedDraftRef = React.useRef<StoredDraft<T> | null>(null);
  const isInitializedRef = React.useRef(false);
  const isDiscardedRef = React.useRef(false);
  const isCompletedRef = React.useRef(false);
  const autosaveTimerRef = React.useRef<NodeJS.Timeout | null>(null);
  const mountCheckedRef = React.useRef(false);

  // Check if form values actually have non-empty user content
  const checkHasContent = React.useCallback((values: T, step?: number): boolean => {
    if (hasContentRef.current) return hasContentRef.current(values, step);
    if (step && step > 1) return true;
    return Object.values(values).some((v) => {
      if (typeof v === "string" && v.trim().length > 0) return true;
      if (typeof v === "number" && v > 0) return true;
      if (Array.isArray(v) && v.length > 0) return true;
      if (typeof v === "object" && v !== null && Object.keys(v).length > 0) return true;
      return false;
    });
  }, []);

  // 1. Check for existing draft on initial mount - RUNS EXACTLY ONCE
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    if (mountCheckedRef.current) return;
    mountCheckedRef.current = true;

    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) {
        isInitializedRef.current = true;
        return;
      }

      const parsed: StoredDraft<T> = JSON.parse(raw);
      if (parsed && parsed.formData && checkHasContent(parsed.formData as T, parsed.currentStep)) {
        rawSavedDraftRef.current = parsed;
        const nameGetter = getNameRef.current;
        const namePreview = nameGetter ? nameGetter(parsed.formData as T) : undefined;

        setDraftInfo({
          step: parsed.currentStep || 1,
          lastSavedAt: parsed.lastSavedAt,
          formattedDate: formatDraftDate(parsed.lastSavedAt),
          previewTitle: namePreview
            ? formType === "HOSPITAL"
              ? namePreview
              : `Dr. ${namePreview.replace(/^dr\.\s*/i, "")}`
            : undefined,
        });
        setHasDraftToResume(true);
      } else {
        isInitializedRef.current = true;
      }
    } catch {
      isInitializedRef.current = true;
    }
  }, [key, checkHasContent]);

  // 2. Perform write to localStorage & optional backend sync
  const writeDraft = React.useCallback(
    (values: T, step: number, notify = false) => {
      if (typeof window === "undefined") return;
      if (isDiscardedRef.current) return;

      try {
        setSaveStatus("saving");
        const now = new Date().toISOString();
        const payload: StoredDraft<T> = {
          formData: values,
          currentStep: step,
          lastSavedAt: now,
          version: 1,
        };

        window.localStorage.setItem(key, JSON.stringify(payload));
        setSaveStatus("saved");
        setLastSavedText(`Saved at ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`);

        if (notify) {
          toast.success("Progress saved as draft!", {
            description: "You can safely close this page and resume anytime from this browser.",
          });
        }

        // Non-blocking background sync to server
        if (formType) {
          const email = getEmailRef.current ? getEmailRef.current(values) : values.email;
          const name = getNameRef.current ? getNameRef.current(values) : values.doctorName || values.hospitalName;
          apiClient
            .post("/onboarding/draft", {
              formType,
              currentStep: step,
              formData: values,
              email: email || undefined,
              name: name || undefined,
            })
            .catch(() => {});
        }
      } catch (err) {
        console.warn("Could not save form draft:", err);
        setSaveStatus("idle");
        if (notify) {
          toast.error("Could not save draft to local storage");
        }
      }
    },
    [key, formType]
  );

  // 3. Debounced Autosave
  React.useEffect(() => {
    // If not initialized, or resume banner is active, or user explicitly discarded or completed: DO NOT AUTOSAVE
    if (!isInitializedRef.current || hasDraftToResume || isDiscardedRef.current || isCompletedRef.current) return;

    // Do not save completely empty initial states
    if (!checkHasContent(formValues, currentStep)) return;

    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
    }

    autosaveTimerRef.current = setTimeout(() => {
      writeDraft(formValues, currentStep, false);
    }, debounceMs);

    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
      }
    };
  }, [formValues, currentStep, hasDraftToResume, checkHasContent, debounceMs, writeDraft]);

  // 4. Resume Draft handler
  const resumeDraft = React.useCallback(() => {
    const saved = rawSavedDraftRef.current;
    if (saved && saved.formData) {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);

      isDiscardedRef.current = false;
      isInitializedRef.current = true;
      setHasDraftToResume(false);

      if (onRestoreRef.current) {
        onRestoreRef.current(saved.formData, saved.currentStep || 1);
      }

      setLastSavedText(`Restored from ${formatDraftDate(saved.lastSavedAt)}`);
      toast.success("Draft restored!", {
        description: `Continued from Step 0${saved.currentStep || 1}.`,
      });
    }
  }, []);

  // 5. Discard / Start Fresh handler
  const discardDraft = React.useCallback(() => {
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);

    // Mark as discarded so autosave WILL NOT save old state back!
    isDiscardedRef.current = true;
    isInitializedRef.current = true;
    rawSavedDraftRef.current = null;
    setHasDraftToResume(false);
    setDraftInfo(null);
    setLastSavedText(null);
    setSaveStatus("idle");

    if (typeof window !== "undefined") {
      try {
        window.localStorage.removeItem(key);
      } catch {}
    }

    // Call onDiscard so parent resets all fields to clean initial state and step 1
    if (onDiscardRef.current) {
      onDiscardRef.current();
    }

    // Purge backend draft record and any unattached uploaded draft images from Cloudinary
    if (formType) {
      const email = getEmailRef.current ? getEmailRef.current(formValues) : formValues.email;
      apiClient
        .delete("/onboarding/draft", {
          params: { formType, email: email || undefined },
        })
        .catch(() => {});
    }

    toast.info("Draft discarded. Starting fresh with clean form.");
  }, [key, formType, formValues]);

  // 6. Explicit Save Draft Now (Button Click)
  const saveDraftNow = React.useCallback(() => {
    isDiscardedRef.current = false;
    writeDraft(formValues, currentStep, true);
    return true;
  }, [writeDraft, formValues, currentStep]);

  // 7. Clear draft completely (used after successful publish)
  const clearDraft = React.useCallback(() => {
    isCompletedRef.current = true;
    isDiscardedRef.current = true;
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }
    if (typeof window !== "undefined") {
      try {
        window.localStorage.removeItem(key);
        // Clean all onboarding draft keys from localStorage
        window.localStorage.removeItem("doczeno_only_doctor_draft_v1");
        window.localStorage.removeItem("doczeno_hospital_creation_draft_v1");
        window.localStorage.removeItem("doczeno_hospital_doctor_draft_v1");
      } catch {}
    }
    rawSavedDraftRef.current = null;
    setHasDraftToResume(false);
    setDraftInfo(null);
    setLastSavedText(null);
    setSaveStatus("idle");

    if (formType) {
      const email = getEmailRef.current ? getEmailRef.current(formValues) : formValues.email;
      apiClient
        .delete("/onboarding/draft", {
          params: { formType, email: email || undefined },
        })
        .catch(() => {});
    }
  }, [key, formType, formValues]);

  return {
    hasDraftToResume,
    draftInfo,
    saveStatus,
    lastSavedText,
    resumeDraft,
    discardDraft,
    saveDraftNow,
    clearDraft,
  };
}
