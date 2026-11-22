"use client";

import * as React from "react";
import { useState, useEffect } from "react";
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
import { apiClient } from "@/lib/api-client";
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
}

export function TestimonialsManagementView({
  portalType,
  practiceName: _practiceName,
}: TestimonialsManagementViewProps) {
  const [testimonials, setTestimonials] = useState<TestimonialData[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Dialog state
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<TestimonialData | null>(null);
  const [formName, setFormName] = useState("");
  const [formRating, setFormRating] = useState(5);
  const [formTag, setFormTag] = useState("Verified Patient");
  const [formComment, setFormComment] = useState("");

  const fetchTestimonials = async () => {
    setLoading(true);
    try {
      const res: any = await apiClient.get("/reviews");
      if (res?.success && Array.isArray(res.data?.reviews)) {
        setTestimonials(res.data.reviews);
      }
    } catch {
      toast.error("Failed to load patient testimonials");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTestimonials();
  }, []);

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
        // Update existing
        const res: any = await apiClient.put(`/reviews/${editingItem.id}`, {
          patientName: formName.trim(),
          rating: formRating,
          tag: formTag.trim(),
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
        // Create new
        const res: any = await apiClient.post("/reviews", {
          patientName: formName.trim(),
          rating: formRating,
          tag: formTag.trim(),
          comment: formComment.trim(),
        });
        if (res?.success) {
          toast.success("Testimonial added successfully");
          setIsDialogOpen(false);
          fetchTestimonials();
        } else {
          toast.error(res?.error || "Failed to add testimonial");
        }
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Could not save testimonial");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (testimonials.length <= 3) {
      toast.error("Minimum 3 patient reviews are required on your website. You cannot delete below 3 reviews.");
      return;
    }
    if (!window.confirm("Are you sure you want to delete this testimonial?")) return;
    try {
      const res: any = await apiClient.delete(`/reviews/${id}`);
      if (res?.success) {
        toast.success("Testimonial deleted");
        setTestimonials((prev) => prev.filter((t) => t.id !== id));
      } else {
        toast.error(res?.error || "Failed to delete testimonial");
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Could not delete testimonial");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <Card className="border-slate-200 shadow-xs">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4">
          <div className="space-y-1">
            <CardTitle className="text-lg font-bold flex items-center gap-2 text-slate-900">
              <MessageSquareQuote className="h-5 w-5 text-indigo-600" />
              Patient Testimonials & Reviews ({testimonials.length}/9)
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">
              Display authentic patient stories on your website slider. Maintain between 3 and 9 reviews (default 3).
            </CardDescription>
          </div>
          <div className="flex items-center gap-2.5 shrink-0">
            <Button
              size="sm"
              onClick={handleOpenAdd}
              disabled={testimonials.length >= 9}
              className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold disabled:opacity-50"
            >
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Add Testimonial ({testimonials.length}/9)
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
              <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
              <span className="text-xs">Loading testimonials...</span>
            </div>
          ) : testimonials.length === 0 ? (
            <div className="py-12 text-center space-y-3 bg-slate-50/70 border border-dashed border-slate-200 rounded-xl">
              <Quote className="h-8 w-8 text-slate-300 mx-auto" />
              <div className="space-y-1">
                <p className="text-sm font-semibold text-slate-800">No testimonials yet</p>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Add authentic patient reviews to showcase patient experiences on your live website.
                </p>
              </div>
              <Button
                size="sm"
                onClick={handleOpenAdd}
                className="text-xs bg-slate-900 hover:bg-slate-800 text-white"
              >
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                Add First Testimonial
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {testimonials.map((t) => (
                <div
                  key={t.id}
                  className="p-4 sm:p-5 rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition-colors flex flex-col justify-between space-y-3 shadow-xs"
                >
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      {/* Rating Stars */}
                      <div className="flex items-center gap-0.5 text-amber-500">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star
                            key={i}
                            className={`h-4 w-4 ${
                              i < t.rating
                                ? "fill-amber-400 text-amber-400"
                                : "text-slate-200"
                            }`}
                          />
                        ))}
                        <span className="text-xs font-semibold text-slate-700 ml-1.5">
                          {t.rating}.0
                        </span>
                      </div>

                      {/* Tag Badge */}
                      {t.tag && (
                        <Badge variant="outline" className="text-[10px] bg-slate-50 font-medium">
                          {t.tag}
                        </Badge>
                      )}
                    </div>

                    {/* Testimonial Text */}
                    <p className="text-xs sm:text-sm text-slate-700 leading-relaxed italic">
                      "{t.comment}"
                    </p>
                  </div>

                  {/* Card Footer: Patient Name & Actions */}
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="h-7 w-7 rounded-full bg-indigo-100 text-indigo-800 font-bold text-xs flex items-center justify-center shrink-0">
                        {t.patientName?.charAt(0) || "P"}
                      </div>
                      <span className="text-xs font-semibold text-slate-900">
                        {t.patientName}
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleOpenEdit(t)}
                        className="h-7 px-2 text-xs text-slate-600 hover:text-slate-900"
                        title="Edit testimonial"
                      >
                        <Edit2 className="h-3.5 w-3.5 mr-1" />
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(t.id)}
                        disabled={testimonials.length <= 3}
                        className={cn(
                          "h-7 px-2 text-xs",
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
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add / Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900">
              {editingItem ? "Edit Patient Testimonial" : "Add Patient Testimonial"}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Provide authentic patient feedback details to display on your public website.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSave} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-700 block">
                Patient Name <span className="text-rose-500">*</span>
              </label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g. Rajesh Mehta"
                className="text-xs"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-700 block">
                  Rating (Stars)
                </label>
                <div className="flex items-center gap-1 pt-1">
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
                  <span className="text-xs font-bold text-slate-700 ml-1">{formRating} / 5</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-700 block">
                  Tag / Treatment
                </label>
                <Input
                  value={formTag}
                  onChange={(e) => setFormTag(e.target.value)}
                  placeholder="e.g. Cardiology Patient"
                  className="text-xs"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-700 block">
                Testimonial / Review Text <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={4}
                value={formComment}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFormComment(e.target.value)}
                placeholder="Write the patient's feedback or consultation experience..."
                className="flex min-h-[90px] w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-xs shadow-xs placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-900 resize-none"
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
                className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold"
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
    </div>
  );
}
