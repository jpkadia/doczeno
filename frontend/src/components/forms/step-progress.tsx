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
  return (
    <div className={cn("w-full py-4", className)}>
      <ol className="flex items-center justify-between w-full relative">
        {/* Background Connecting Bar */}
        <div
          className="absolute top-4 left-0 h-0.5 w-full bg-border -z-0"
          aria-hidden="true"
        />

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
                  "w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold z-10 transition-colors shadow-sm",
                  isCompleted
                    ? "bg-primary text-primary-foreground"
                    : isCurrent
                    ? "bg-primary text-primary-foreground ring-4 ring-primary/20"
                    : "bg-muted text-muted-foreground border border-border group-hover:border-foreground/30"
                )}
                aria-current={isCurrent ? "step" : undefined}
              >
                {isCompleted ? <Check className="w-4 h-4 stroke-[3]" /> : step.id}
              </div>

              <span
                className={cn(
                  "mt-2 text-xs font-medium text-center hidden md:block",
                  isCurrent
                    ? "text-primary font-semibold"
                    : isCompleted
                    ? "text-foreground"
                    : "text-muted-foreground"
                )}
              >
                {step.label}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
