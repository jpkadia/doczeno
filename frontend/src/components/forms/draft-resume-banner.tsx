"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { FileText, ArrowRight, Trash2, X } from "lucide-react";

interface DraftResumeBannerProps {
  step: number;
  stepTitle?: string;
  totalSteps?: number;
  formattedDate: string;
  previewTitle?: string;
  onResume: () => void;
  onDiscard: () => void;
  onDismiss?: () => void;
}

export function DraftResumeBanner({
  step,
  stepTitle,
  totalSteps = 8,
  formattedDate,
  previewTitle,
  onResume,
  onDiscard,
  onDismiss,
}: DraftResumeBannerProps) {
  const [isDismissed, setIsDismissed] = React.useState(false);

  if (isDismissed) return null;

  return (
    <div className="relative overflow-hidden rounded-xl border border-primary/25 bg-primary/5 p-4 sm:p-5 shadow-sm transition-all animate-in fade-in slide-in-from-top-2 duration-300">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="rounded-lg bg-primary/10 p-2.5 text-primary shrink-0 mt-0.5 sm:mt-0">
            <FileText className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-sm text-foreground">
                Unfinished Application Found
              </span>
              {previewTitle && (
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium border border-primary/20">
                  {previewTitle}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              You have a saved draft from <span className="font-medium text-foreground">{formattedDate}</span> at{" "}
              <span className="font-medium text-primary">
                Step 0{step} {stepTitle ? `(${stepTitle})` : ""}
              </span> of 0{totalSteps}. Would you like to resume where you left off?
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 pt-2 sm:pt-0">
          <Button
            type="button"
            size="sm"
            onClick={onResume}
            className="flex-1 sm:flex-initial text-xs h-8 bg-primary text-primary-foreground hover:bg-primary/90 font-medium shadow-sm"
          >
            Resume Draft
            <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onDiscard}
            className="text-xs h-8 text-muted-foreground hover:text-destructive hover:border-destructive/40"
          >
            <Trash2 className="h-3.5 w-3.5 mr-1" />
            Start Fresh
          </Button>

          {onDismiss && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => {
                setIsDismissed(true);
                onDismiss();
              }}
              className="h-8 w-8 text-muted-foreground hover:text-foreground hidden sm:inline-flex"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
