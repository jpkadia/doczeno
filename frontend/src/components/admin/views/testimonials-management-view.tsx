"use client";

import * as React from "react";
import { useState, useEffect, useCallback } from "react";
import {
  Star,
  MessageSquareQuote,
  Plus,
  Trash2,
  Edit2,
  Loader2,
  Quote,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { apiClient, ApiError } from "@/lib/api-client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

export interface TestimonialData {
  id: string;
  patientName: string;
  rating: number;
  comment: string;
  tag?: string;
  isVerified?: boolean;
  isPublished?: boolean;
  createdAt?: string;
}

interface TestimonialsManagementViewProps {
  portalType: "ONLY_DOCTOR" | "HOSPITAL" | "HOSPITAL_DOCTOR";
  practiceName?: string;
  doctorId?: string;
  embedded?: boolean;
}

const PRESET_TAGS = [
  "Verified Patient",
  "OPD Consultation",
  "Follow-up Care",
  "Inpatient Care",
];

export function TestimonialsManagementView({
  portalType,
  practiceName: _practiceName,
  doctorId,
  embedded = false,
}: TestimonialsManagementViewProps) {
  const [testimonials, setTestimonials] = useState<TestimonialData[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Add / Edit Dialog state
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<TestimonialData | null>(null);
  const [formName, setFormName] = useState("");
  const [formRating, setFormRating] = useState(5);
  const [formTag, setFormTag] = useState("Verified Patient");
  const [formComment, setFormComment] = useState("");

  // Styled Delete Dialog state
  const [deleteTarget, setDeleteTarget] = useState<TestimonialData | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchTestimonials = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | undefined> = {};
      if (doctorId) {
        params.doctorId = doctorId;
      } else if (portalType === "HOSPITAL") {
        params.scope = "hospital";
      }

      const res: any = await apiClient.get("/reviews", { params });
      if (res?.success && Array.isArray(res.data?.reviews)) {
        setTestimonials(res.data.reviews);
      }
    } catch {
      toast.error("Failed to load patient testimonials");
    } finally {
      setLoading(false);
    }
  }, [doctorId, portalType]);

  useEffect(() => {
    fetchTestimonials();
  }, [fetchTestimonials]);

  const handleOpenAdd = () => {
    if (testimonials.length >= 9) {
      toast.error("Maximum 9 patient reviews allowed. Please edit or delete existing reviews.");
      return;
    }
    setEditingItem(null);
    setFormName("");
    setFormRating(5);
    setFormTag(portalType === "HOSPITAL" ? "Inpatient Care" : "Verified Patient");
    setFormComment("");
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (item: TestimonialData) => {
    setEditingItem(item);
    setFormName(item.patientName);
    setFormRating(item.rating);
    setFormTag(item.tag || "Verified Patient");
    setFormComment(item.comment);
    setIsDialogOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      toast.error("Please enter the patient's name");
      return;
    }
    if (!formComment.trim()) {
      toast.error("Please enter the testimonial text");
      return;
    }

    setSaving(true);
    try {
      if (editingItem) {
        const res: any = await apiClient.put(`/reviews/${editingItem.id}`, {
          patientName: formName.trim(),
          rating: formRating,
          tag: formTag.trim() || "Verified Patient",
          comment: formComment.trim(),
        });
        if (res?.success) {
          toast.success("Testimonial updated successfully");
          setIsDialogOpen(false);
          fetchTestimonials();
        } else {
          toast.error(res?.error || "Failed to update testimonial");
        }
      } else {
        const payload: Record<string, unknown> = {
          patientName: formName.trim(),
          rating: formRating,
          tag: formTag.trim() || "Verified Patient",
          comment: formComment.trim(),
        };
        if (doctorId) {
          payload.doctorId = doctorId;
        }
        const res: any = await apiClient.post("/reviews", payload);
        if (res?.success) {
          toast.success("Testimonial added successfully");
          setIsDialogOpen(false);
          fetchTestimonials();
        } else {
          toast.error(res?.error || "Failed to add testimonial");
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof ApiError ? err.message : "Could not save testimonial";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    if (testimonials.length <= 3) {
      toast.error("Minimum 3 patient reviews are required on your website. You cannot delete below 3 reviews.");
      setDeleteTarget(null);
      return;
    }
    setDeleting(true);
    try {
      const res: any = await apiClient.delete(`/reviews/${deleteTarget.id}`);
      if (res?.success) {
        toast.success("Testimonial deleted");
        setTestimonials((prev) => prev.filter((t) => t.id !== deleteTarget.id));
        setDeleteTarget(null);
      } else {
        toast.error(res?.error || "Failed to delete testimonial");
      }
    } catch (err: unknown) {
      const msg = err instanceof ApiError ? err.message : "Could not delete testimonial";
      toast.error(msg);
    } finally {
      setDeleting(false);
    }
  };

  const innerContent = (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
              Patient Reviews ({testimonials.length}/9)
            </span>
            <Badge
              variant="outline"
              className={cn(
                "text-[10px] font-semibold",
                testimonials.length < 3
                  ? "bg-amber-50 text-amber-700 border-amber-200"
                  : "bg-emerald-50 text-emerald-700 border-emerald-200"
              )}
            >
              Min 3 • Max 9 Required
            </Badge>
          </div>
          <p className="text-[11px] text-slate-500">
            Changes sync immediately to your live patient review slider (4 reviews generated by AI initially).
          </p>
        </div>

        <Button
          type="button"
          size="sm"
          onClick={handleOpenAdd}
          disabled={testimonials.length >= 9}
          className="bg-[#1a76d1] hover:bg-[#1560aa] text-white text-xs font-semibold h-8 px-3 rounded-lg shadow-xs disabled:opacity-50 shrink-0 self-start sm:self-auto"
        >
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          Add Testimonial ({testimonials.length}/9)
        </Button>
      </div>

      {loading ? (
        <div className="py-10 flex flex-col items-center justify-center text-slate-400 gap-2 border border-slate-100 rounded-xl bg-slate-50/40">
          <Loader2 className="h-5 w-5 animate-spin text-[#1a76d1]" />
          <span className="text-xs">Loading patient testimonials...</span>
        </div>
      ) : testimonials.length === 0 ? (
        <div className="py-10 text-center space-y-3 bg-slate-50/70 border border-dashed border-slate-200 rounded-xl px-4">
          <Quote className="h-7 w-7 text-slate-300 mx-auto" />
          <div className="space-y-1">
            <p className="text-sm font-semibold text-slate-800">No testimonials added yet</p>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Add patient feedback cards to build trust on your website slider.
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            onClick={handleOpenAdd}
            className="text-xs bg-[#1a76d1] hover:bg-[#1560aa] text-white"
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Add First Testimonial
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {testimonials.map((t, idx) => (
            <div
              key={t.id}
              className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-blue-300 transition-colors flex flex-col justify-between space-y-3 shadow-2xs"
            >
              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1 text-amber-500">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        className={`h-3.5 w-3.5 ${
                          i < t.rating
                            ? "fill-amber-400 text-amber-400"
                            : "text-slate-200"
                        }`}
                      />
                    ))}
                    <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 ml-1">
                      {t.rating}.0
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {t.tag && (
                      <Badge variant="outline" className="text-[10px] bg-slate-50 dark:bg-slate-800 font-medium max-w-[130px] truncate">
                        {t.tag}
                      </Badge>
                    )}
                    <span className="text-[10px] font-mono text-slate-400">#{idx + 1}</span>
                  </div>
                </div>

                <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed italic line-clamp-4">
                  &ldquo;{t.comment}&rdquo;
                </p>
              </div>

              <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="h-7 w-7 rounded-full bg-blue-50 text-[#1a76d1] font-bold text-xs flex items-center justify-center shrink-0 border border-blue-100">
                    {t.patientName?.charAt(0)?.toUpperCase() || "P"}
                  </div>
                  <span className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                    {t.patientName}
                  </span>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => handleOpenEdit(t)}
                    className="h-7 px-2 text-xs text-slate-600 hover:text-[#1a76d1] hover:bg-blue-50"
                    title="Edit testimonial"
                  >
                    <Edit2 className="h-3.5 w-3.5 mr-1" />
                    Edit
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setDeleteTarget(t)}
                    disabled={testimonials.length <= 3}
                    className={cn(
                      "h-7 w-7 p-0 text-xs",
                      testimonials.length <= 3
                        ? "text-slate-300 dark:text-slate-600 cursor-not-allowed"
                        : "text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                    )}
                    title={testimonials.length <= 3 ? "Minimum 3 reviews required" : "Delete testimonial"}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          ))}

          {/* Quick-Add Grid Slot Card */}
          {testimonials.length < 9 && (
            <button
              type="button"
              onClick={handleOpenAdd}
              className="min-h-[140px] rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-[#1a76d1] hover:bg-blue-50/40 transition-all flex flex-col items-center justify-center gap-2 p-4 text-center group cursor-pointer"
            >
              <div className="h-9 w-9 rounded-full bg-blue-50 text-[#1a76d1] flex items-center justify-center group-hover:scale-110 transition-transform">
                <Plus className="h-4 w-4" />
              </div>
              <div>
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 block">
                  Add Patient Review
                </span>
                <span className="text-[10px] text-slate-500">
                  {9 - testimonials.length} slot{9 - testimonials.length === 1 ? "" : "s"} remaining
                </span>
              </div>
            </button>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div className={embedded ? "" : "space-y-6"}>
      {embedded ? (
        innerContent
      ) : (
        <Card className="border-slate-200 shadow-xs">
          <CardHeader className="pb-3 border-b border-slate-100">
            <CardTitle className="text-base font-bold flex items-center gap-2 text-slate-900">
              <MessageSquareQuote className="h-5 w-5 text-[#1a76d1]" />
              Patient Testimonials &amp; Reviews
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">
              Display authentic patient stories on your website slider. Maintain between 3 and 9 reviews.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">{innerContent}</CardContent>
        </Card>
      )}

      {/* Add / Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md bg-white">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900">
              {editingItem ? "Edit Patient Testimonial" : "Add Patient Testimonial"}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Provide authentic patient feedback details to display on your public website.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSave} className="space-y-4 py-1">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-700">
                  Patient Name <span className="text-rose-500">*</span>
                </label>
                <span className="text-[10px] text-slate-400">{formName.length}/60</span>
              </div>
              <Input
                maxLength={60}
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g. Rajesh Mehta"
                className="text-xs h-9"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 block">
                Star Rating
              </label>
              <div className="flex items-center gap-1 pt-0.5">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setFormRating(star)}
                    className="p-1 hover:scale-110 transition-transform focus:outline-none"
                  >
                    <Star
                      className={`h-5 w-5 ${
                        star <= formRating
                          ? "fill-amber-400 text-amber-400"
                          : "text-slate-300"
                      }`}
                    />
                  </button>
                ))}
                <span className="text-xs font-bold text-slate-700 ml-1.5">{formRating}.0 / 5.0</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-700">
                  Visit Tag / Treatment
                </label>
                <span className="text-[10px] text-slate-400">{formTag.length}/35</span>
              </div>
              <Input
                maxLength={35}
                value={formTag}
                onChange={(e) => setFormTag(e.target.value)}
                placeholder="e.g. Verified Patient"
                className="text-xs h-9"
              />
              <div className="flex flex-wrap gap-1.5 pt-1">
                {PRESET_TAGS.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setFormTag(tag)}
                    className={cn(
                      "px-2 py-0.5 rounded-full text-[10px] font-medium border transition-colors",
                      formTag === tag
                        ? "bg-blue-50 text-[#1a76d1] border-blue-200"
                        : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                    )}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-700">
                  Testimonial / Review Text <span className="text-rose-500">*</span>
                </label>
                <span className="text-[10px] text-slate-400">{formComment.length}/350</span>
              </div>
              <textarea
                maxLength={350}
                rows={4}
                value={formComment}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFormComment(e.target.value)}
                placeholder="Write the patient's feedback or consultation experience..."
                className="flex min-h-[90px] w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-xs shadow-xs placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1a76d1]/20 focus-visible:border-[#1a76d1] resize-none"
                required
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsDialogOpen(false)}
                className="text-xs"
                disabled={saving}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={saving}
                className="bg-[#1a76d1] hover:bg-[#1560aa] text-white text-xs font-semibold"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    Saving...
                  </>
                ) : editingItem ? (
                  "Update Testimonial"
                ) : (
                  "Add Testimonial"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Styled Delete Confirmation Dialog */}
      <Dialog open={Boolean(deleteTarget)} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <DialogContent className="sm:max-w-sm bg-white">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900">
              Delete Patient Review?
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Remove testimonial by <strong>{deleteTarget?.patientName}</strong> from your live website? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDeleteTarget(null)}
              disabled={deleting}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleConfirmDelete}
              disabled={deleting}
              className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold"
            >
              {deleting ? "Deleting..." : "Delete Review"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
