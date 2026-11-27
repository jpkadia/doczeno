"use client";

import * as React from "react";
import {
  LayoutGrid,
  AlignLeft,
  ListChecks,
  Plus,
  Trash2,
  Ban,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  CustomSectionConfig,
  CustomSectionLayout,
  createDefaultCustomSection,
} from "@/constants/website-sections";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface DoctorCustomSectionEditorProps {
  value?: CustomSectionConfig | null;
  onChange: (next: CustomSectionConfig) => void;
}

const LAYOUT_OPTIONS: Array<{
  id: CustomSectionLayout;
  label: string;
  desc: string;
  limits: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  {
    id: "cards",
    label: "Feature Cards Grid",
    desc: "Responsive cards for achievements, special procedures, or clinic promises.",
    limits: "2 to 6 cards • Max 50 title / 160 desc chars",
    icon: LayoutGrid,
  },
  {
    id: "narrative",
    label: "Heading & Paragraph",
    desc: "Clean editorial message, clinical philosophy, or detailed patient guide.",
    limits: "1 structured story • Max 1000 chars",
    icon: AlignLeft,
  },
  {
    id: "highlights",
    label: "Key Points Checklist",
    desc: "Numbered 2-column checklist for visit steps, hygiene standards, or awards.",
    limits: "2 to 8 points • Max 55 heading / 140 detail chars",
    icon: ListChecks,
  },
];

export function DoctorCustomSectionEditor({
  value,
  onChange,
}: DoctorCustomSectionEditorProps) {
  const [confirmRemoveOpen, setConfirmRemoveOpen] = React.useState(false);

  const custom: CustomSectionConfig = React.useMemo(() => {
    const fallback = createDefaultCustomSection();
    if (!value) {
      return { ...fallback, enabled: false };
    }
    return {
      ...fallback,
      ...value,
      cards: Array.isArray(value.cards) && value.cards.length > 0 ? value.cards : fallback.cards,
      points: Array.isArray(value.points) && value.points.length > 0 ? value.points : fallback.points,
    };
  }, [value]);

  const handleEnable = () => {
    const base = createDefaultCustomSection();
    onChange({
      ...custom,
      ...base,
      title: custom.title || base.title,
      enabled: true,
    });
  };

  const handleRemove = () => {
    onChange({
      ...custom,
      enabled: false,
    });
    setConfirmRemoveOpen(false);
    toast.success("Custom section removed. Save changes to update your live website.");
  };

  const updateField = <K extends keyof CustomSectionConfig>(key: K, val: CustomSectionConfig[K]) => {
    onChange({
      ...custom,
      [key]: val,
    });
  };

  // Card layout handlers (Min 2, Max 6)
  const handleAddCard = () => {
    if (custom.cards.length >= 6) {
      toast.error("Maximum 6 cards allowed in Custom Section.");
      return;
    }
    updateField("cards", [...custom.cards, { title: "", description: "" }]);
  };

  const handleUpdateCard = (idx: number, field: "title" | "description", val: string) => {
    const next = [...custom.cards];
    if (!next[idx]) return;
    next[idx] = { ...next[idx], [field]: val };
    updateField("cards", next);
  };

  const handleDeleteCard = (idx: number) => {
    if (custom.cards.length <= 2) {
      toast.error("Cards layout requires at least 2 cards.");
      return;
    }
    const next = [...custom.cards];
    next.splice(idx, 1);
    updateField("cards", next);
  };

  // Highlights / Points layout handlers (Min 2, Max 8)
  const handleAddPoint = () => {
    if (custom.points.length >= 8) {
      toast.error("Maximum 8 highlight points allowed in Custom Section.");
      return;
    }
    updateField("points", [...custom.points, { heading: "", detail: "" }]);
  };

  const handleUpdatePoint = (idx: number, field: "heading" | "detail", val: string) => {
    const next = [...custom.points];
    if (!next[idx]) return;
    next[idx] = { ...next[idx], [field]: val };
    updateField("points", next);
  };

  const handleDeletePoint = (idx: number) => {
    if (custom.points.length <= 2) {
      toast.error("Key Points layout requires at least 2 points.");
      return;
    }
    const next = [...custom.points];
    next.splice(idx, 1);
    updateField("points", next);
  };

  if (!custom.enabled) {
    return (
      <div className="p-6 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/20 text-center space-y-4">
        <div className="mx-auto h-11 w-11 rounded-2xl bg-blue-50 text-[#1a76d1] border border-blue-100 flex items-center justify-center">
          <Sparkles className="h-5 w-5" />
        </div>
        <div className="space-y-1 max-w-md mx-auto">
          <h4 className="text-sm font-bold text-slate-900 dark:text-white">
            Add a Custom Website Section (Text &amp; Cards Only)
          </h4>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            Highlight awards, special procedures, consultation ethics, or patient instructions in your preferred structured layout without adding extra images.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2 text-[11px] text-slate-500">
          <Badge variant="outline" className="bg-white text-slate-600 font-medium gap-1">
            <LayoutGrid className="h-3 w-3 text-[#1a76d1]" /> Cards Grid
          </Badge>
          <Badge variant="outline" className="bg-white text-slate-600 font-medium gap-1">
            <AlignLeft className="h-3 w-3 text-[#1a76d1]" /> Heading &amp; Paragraph
          </Badge>
          <Badge variant="outline" className="bg-white text-slate-600 font-medium gap-1">
            <ListChecks className="h-3 w-3 text-[#1a76d1]" /> Key Points List
          </Badge>
          <Badge variant="outline" className="bg-slate-100 text-slate-600 font-medium gap-1">
            <Ban className="h-3 w-3 text-slate-500" /> No Images Allowed
          </Badge>
        </div>
        <div>
          <Button
            type="button"
            size="sm"
            onClick={handleEnable}
            className="bg-[#1a76d1] hover:bg-[#1560aa] text-white text-xs font-semibold px-4 h-9 rounded-lg shadow-xs"
          >
            <Plus className="h-4 w-4 mr-1.5" />
            Add Custom Section
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Text-Only Notice & Remove Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-lg bg-blue-50/70 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/40">
        <div className="flex items-center gap-2 text-[11px] text-[#1560aa] dark:text-blue-300 font-medium">
          <Ban className="h-3.5 w-3.5 shrink-0" />
          <span>Structured text-only section (images are disabled to keep your website clean and fast).</span>
        </div>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => setConfirmRemoveOpen(true)}
          className="h-7 px-2.5 text-[11px] text-rose-600 hover:text-rose-700 hover:bg-rose-50 self-start sm:self-auto shrink-0"
        >
          <Trash2 className="h-3.5 w-3.5 mr-1" />
          Remove Custom Section
        </Button>
      </div>

      {/* Step 1: Choose Layout Structure */}
      <div className="space-y-2">
        <Label className="text-xs font-semibold text-slate-800 dark:text-slate-200 block">
          1. Choose Section Layout Style
        </Label>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {LAYOUT_OPTIONS.map((opt) => {
            const Icon = opt.icon;
            const active = custom.layout === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => updateField("layout", opt.id)}
                className={cn(
                  "p-3.5 rounded-xl border text-left transition-all flex flex-col justify-between gap-2 cursor-pointer",
                  active
                    ? "border-[#1a76d1] bg-blue-50/60 dark:bg-blue-950/30 ring-2 ring-[#1a76d1]/15"
                    : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300"
                )}
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <div
                      className={cn(
                        "h-8 w-8 rounded-lg flex items-center justify-center",
                        active ? "bg-[#1a76d1] text-white" : "bg-slate-100 text-slate-600"
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    {active && (
                      <Badge className="bg-[#1a76d1] text-white text-[10px] hover:bg-[#1a76d1]">
                        Selected
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white pt-0.5">
                    {opt.label}
                  </div>
                  <p className="text-[11px] text-slate-500 leading-snug">
                    {opt.desc}
                  </p>
                </div>
                <span className="text-[10px] font-medium text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-800 block">
                  {opt.limits}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Step 2: Section Header Fields */}
      <div className="space-y-3 pt-1">
        <Label className="text-xs font-semibold text-slate-800 dark:text-slate-200 block">
          2. Section Heading &amp; Navigation Label
        </Label>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
          <div className="space-y-1">
            <div className="flex justify-between text-[11px]">
              <Label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                Top Menu Label
              </Label>
              <span className="text-[10px] text-slate-400">{(custom.navLabel || "").length}/18</span>
            </div>
            <Input
              maxLength={18}
              value={custom.navLabel || ""}
              onChange={(e) => updateField("navLabel", e.target.value)}
              placeholder="e.g. Highlights"
              className="text-xs h-9"
            />
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-[11px]">
              <Label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                Section Small Badge
              </Label>
              <span className="text-[10px] text-slate-400">{(custom.badge || "").length}/30</span>
            </div>
            <Input
              maxLength={30}
              value={custom.badge || ""}
              onChange={(e) => updateField("badge", e.target.value)}
              placeholder="e.g. Patient Focus"
              className="text-xs h-9"
            />
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-[11px]">
              <Label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                Section Title <span className="text-rose-500">*</span>
              </Label>
              <span className="text-[10px] text-slate-400">{(custom.title || "").length}/80</span>
            </div>
            <Input
              maxLength={80}
              value={custom.title || ""}
              onChange={(e) => updateField("title", e.target.value)}
              placeholder="e.g. Why Patients Trust Our Care"
              className="text-xs h-9"
            />
          </div>
        </div>

        <div className="space-y-1">
          <div className="flex justify-between text-[11px]">
            <Label className="text-xs font-medium text-slate-700 dark:text-slate-300">
              Section Subtitle / Short Intro
            </Label>
            <span className="text-[10px] text-slate-400">{(custom.subtitle || "").length}/200</span>
          </div>
          <Input
            maxLength={200}
            value={custom.subtitle || ""}
            onChange={(e) => updateField("subtitle", e.target.value)}
            placeholder="Brief supportive sentence shown right below the heading..."
            className="text-xs h-9"
          />
        </div>
      </div>

      {/* Step 3: Layout-Specific Structured Content */}
      <div className="space-y-3 pt-1">
        {custom.layout === "cards" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <Label className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                3. Custom Feature Cards ({custom.cards.length}/6) — Min 2, Max 6
              </Label>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleAddCard}
                disabled={custom.cards.length >= 6}
                className="text-xs h-7 gap-1 border-blue-200 text-[#1a76d1] hover:bg-blue-50 disabled:opacity-40"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Card ({custom.cards.length}/6)
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {custom.cards.map((card, idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-semibold text-slate-500">
                      Card #{idx + 1}
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDeleteCard(idx)}
                      disabled={custom.cards.length <= 2}
                      className={cn(
                        "h-6 w-6 p-0",
                        custom.cards.length <= 2
                          ? "text-slate-300 cursor-not-allowed"
                          : "text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                      )}
                      title={custom.cards.length <= 2 ? "Minimum 2 cards required" : "Remove card"}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  <div className="space-y-1">
                    <Input
                      maxLength={50}
                      value={card.title}
                      onChange={(e) => handleUpdateCard(idx, "title", e.target.value)}
                      placeholder="Card Heading (e.g. Modern Diagnostics)"
                      className="text-xs font-semibold h-8 bg-white dark:bg-slate-900"
                    />
                    <div className="text-right text-[10px] text-slate-400">
                      {card.title.length}/50 chars
                    </div>
                  </div>

                  <div className="space-y-1">
                    <textarea
                      maxLength={160}
                      rows={2}
                      value={card.description}
                      onChange={(e) => handleUpdateCard(idx, "description", e.target.value)}
                      placeholder="Concise, patient-friendly description (8-160 chars)..."
                      className="w-full text-xs rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2 focus:outline-none focus:ring-1 focus:ring-[#1a76d1]"
                    />
                    <div className="text-right text-[10px] text-slate-400">
                      {card.description.length}/160 chars
                    </div>
                  </div>
                </div>
              ))}

              {custom.cards.length < 6 && (
                <button
                  type="button"
                  onClick={handleAddCard}
                  className="min-h-[145px] rounded-xl border-2 border-dashed border-slate-200 hover:border-[#1a76d1] hover:bg-blue-50/40 transition-all flex flex-col items-center justify-center gap-1.5 p-4 text-center cursor-pointer"
                >
                  <Plus className="h-5 w-5 text-[#1a76d1]" />
                  <span className="text-xs font-semibold text-slate-700">Add Custom Card</span>
                  <span className="text-[10px] text-slate-400">{6 - custom.cards.length} remaining</span>
                </button>
              )}
            </div>
          </div>
        )}

        {custom.layout === "narrative" && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                3. Main Paragraph Content <span className="text-rose-500">*</span>
              </Label>
              <span className="text-[10px] text-slate-400">
                {(custom.paragraph || "").length}/1000 chars (min 20)
              </span>
            </div>
            <textarea
              maxLength={1000}
              rows={5}
              value={custom.paragraph || ""}
              onChange={(e) => updateField("paragraph", e.target.value)}
              placeholder="Write your detailed philosophy, pre-visit instructions, or clinical story..."
              className="w-full text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#1a76d1]/20 focus:border-[#1a76d1]"
            />
          </div>
        )}

        {custom.layout === "highlights" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <Label className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                3. Highlight Key Points ({custom.points.length}/8) — Min 2, Max 8
              </Label>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleAddPoint}
                disabled={custom.points.length >= 8}
                className="text-xs h-7 gap-1 border-blue-200 text-[#1a76d1] hover:bg-blue-50 disabled:opacity-40"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Point ({custom.points.length}/8)
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {custom.points.map((pt, idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-semibold text-slate-500">
                      Point #{idx + 1}
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDeletePoint(idx)}
                      disabled={custom.points.length <= 2}
                      className={cn(
                        "h-6 w-6 p-0",
                        custom.points.length <= 2
                          ? "text-slate-300 cursor-not-allowed"
                          : "text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                      )}
                      title={custom.points.length <= 2 ? "Minimum 2 points required" : "Remove point"}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  <div className="space-y-1">
                    <Input
                      maxLength={55}
                      value={pt.heading}
                      onChange={(e) => handleUpdatePoint(idx, "heading", e.target.value)}
                      placeholder="Point Heading (e.g. Strict Sterilization Protocol)"
                      className="text-xs font-semibold h-8 bg-white dark:bg-slate-900"
                    />
                    <div className="text-right text-[10px] text-slate-400">
                      {pt.heading.length}/55 chars
                    </div>
                  </div>

                  <div className="space-y-1">
                    <textarea
                      maxLength={140}
                      rows={2}
                      value={pt.detail}
                      onChange={(e) => handleUpdatePoint(idx, "detail", e.target.value)}
                      placeholder="Brief detail for patients (8-140 chars)..."
                      className="w-full text-xs rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2 focus:outline-none focus:ring-1 focus:ring-[#1a76d1]"
                    />
                    <div className="text-right text-[10px] text-slate-400">
                      {pt.detail.length}/140 chars
                    </div>
                  </div>
                </div>
              ))}

              {custom.points.length < 8 && (
                <button
                  type="button"
                  onClick={handleAddPoint}
                  className="min-h-[145px] rounded-xl border-2 border-dashed border-slate-200 hover:border-[#1a76d1] hover:bg-blue-50/40 transition-all flex flex-col items-center justify-center gap-1.5 p-4 text-center cursor-pointer"
                >
                  <Plus className="h-5 w-5 text-[#1a76d1]" />
                  <span className="text-xs font-semibold text-slate-700">Add Highlight Point</span>
                  <span className="text-[10px] text-slate-400">{8 - custom.points.length} remaining</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Confirm Removal Dialog */}
      <Dialog open={confirmRemoveOpen} onOpenChange={setConfirmRemoveOpen}>
        <DialogContent className="sm:max-w-sm bg-white">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900">
              Remove Custom Section?
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              This will disable the custom section from your website. Tip: you can also simply toggle its switch OFF to hide it temporarily without clearing your layout.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setConfirmRemoveOpen(false)}
              className="text-xs"
            >
              Keep Section
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleRemove}
              className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold"
            >
              Remove Section
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
