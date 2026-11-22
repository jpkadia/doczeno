import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface StepItem {
  id: number;
  label: string;
  description?: string;
}

export interface StepProgressProps {
  steps: StepItem[];
  currentStep: number;
  onStepClick?: (step: number) => void;
  className?: string;
}

export function StepProgress({
  steps,
  currentStep,
  onStepClick,
  className,
}: StepProgressProps) {
  const halfStepWidth = `${100 / (steps.length * 2)}%`;
  const progressRatio = Math.max(
    0,
    Math.min(1, (currentStep - 1) / Math.max(1, steps.length - 1))
  );

  const currentStepObj = steps.find((s) => s.id === currentStep);

  return (
    <div className={cn("w-full py-2 sm:py-4", className)}>
      <ol className="flex items-start justify-between w-full relative">
        {/* Background Connecting Bar - strictly between first and last circle centers */}
        <div
          className="absolute top-4 -translate-y-1/2 h-0.5 bg-slate-200 z-0"
          style={{
            left: halfStepWidth,
            right: halfStepWidth,
          }}
          aria-hidden="true"
        />

        {/* Active Connecting Bar */}
        {progressRatio > 0 && (
          <div
            className="absolute top-4 -translate-y-1/2 h-0.5 bg-[#1a76d1] transition-all duration-300 z-0"
            style={{
              left: halfStepWidth,
              width: `calc(${progressRatio} * (100% - ${100 / steps.length}%))`,
            }}
            aria-hidden="true"
          />
        )}

        {steps.map((step) => {
          const isCompleted = step.id < currentStep;
          const isCurrent = step.id === currentStep;

          return (
            <li
              key={step.id}
              className="relative flex flex-col items-center flex-1 cursor-pointer group"
              onClick={() => {
                if (onStepClick && (isCompleted || isCurrent)) {
                  onStepClick(step.id);
                }
              }}
            >
              <div
                className={cn(
                  "w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs font-semibold z-10 transition-colors shadow-2xs",
                  isCompleted
                    ? "bg-[#1a76d1] text-white"
                    : isCurrent
                    ? "bg-[#1a76d1] text-white ring-4 ring-[#1a76d1]/20 font-bold"
                    : "bg-white text-slate-400 border-2 border-slate-200 group-hover:border-slate-400"
                )}
                aria-current={isCurrent ? "step" : undefined}
              >
                {isCompleted ? <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[3]" /> : step.id}
              </div>

              <span
                className={cn(
                  "mt-2 text-xs font-medium text-center hidden md:block max-w-[120px] leading-tight select-none",
                  isCurrent
                    ? "text-[#1a76d1] font-bold"
                    : isCompleted
                    ? "text-slate-800"
                    : "text-slate-400"
                )}
              >
                {step.label}
              </span>
            </li>
          );
        })}
      </ol>

      {/* Mobile-Friendly Active Step Description */}
      {currentStepObj && (
        <div className="mt-3.5 px-3 py-1.5 rounded-lg bg-blue-50/80 border border-blue-100 text-center md:hidden flex items-center justify-center gap-1.5 shadow-2xs">
          <span className="text-[11px] font-bold text-[#1560aa] uppercase tracking-wider">
            Step {currentStep} of {steps.length}:
          </span>
          <span className="text-xs font-bold text-slate-900">
            {currentStepObj.label}
          </span>
        </div>
      )}
    </div>
  );
}
