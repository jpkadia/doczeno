"use client";

import * as React from "react";
import {
  Sparkles,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Send,
  History,
  ShieldCheck,
  FileText,
  HelpCircle,
  Stethoscope,
  Building,
  Globe,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { apiClient } from "@/lib/api-client";

export interface ServiceItem {
  title: string;
  description: string;
}

export interface DepartmentItem {
  name: string;
  description: string;
}

export interface FAQItem {
  question: string;
  answer: string;
}

export interface AIContentPayload {
  tagline?: string;
  about?: string;
  shortIntro?: string;
  hospitalIntro?: string;
  professionalIntro?: string;
  clinicDescription?: string;
  expertiseSummary?: string;
  services?: ServiceItem[];
  departments?: DepartmentItem[];
  faqs?: FAQItem[];
  seoTitle?: string;
  seoDescription?: string;
  [key: string]: unknown;
}

export interface AIContentHistoryItem {
  version: number;
  status: string;
  content: AIContentPayload;
  sectionRegenerated?: string;
  actorRole?: string;
  action: string;
  createdAt: string;
}

export interface AIContentRecord {
  targetType: "INDEPENDENT_DOCTOR" | "HOSPITAL" | "HOSPITAL_DOCTOR";
  targetId: string;
  status: "NOT_GENERATED" | "GENERATING" | "DRAFT" | "APPROVED" | "PUBLISHED" | "FAILED";
  version: number;
  draftContent: AIContentPayload | null;
  approvedContent: AIContentPayload | null;
  publishedContent: AIContentPayload | null;
  lastError?: string | null;
  history?: AIContentHistoryItem[];
  updatedAt?: string;
}

interface AIContentPanelProps {
  targetType: "INDEPENDENT_DOCTOR" | "HOSPITAL" | "HOSPITAL_DOCTOR";
  targetId: string;
  onPublished?: () => void;
}

export function AIContentPanel({ targetType, targetId, onPublished }: AIContentPanelProps) {
  const [record, setRecord] = React.useState<AIContentRecord | null>(null);
  const [editableDraft, setEditableDraft] = React.useState<AIContentPayload>({});
  const [isLoading, setIsLoading] = React.useState(true);
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [regeneratingSection, setRegeneratingSection] = React.useState<string | null>(null);
  const [isApproving, setIsApproving] = React.useState(false);
  const [isPublishing, setIsPublishing] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [successMsg, setSuccessMsg] = React.useState<string | null>(null);
  const [showHistory, setShowHistory] = React.useState(false);

  // Fetch record on mount
  const fetchRecord = React.useCallback(async () => {
    if (!targetId) return;
    try {
      setIsLoading(true);
      setErrorMsg(null);
      const res = await apiClient.get<{ success: boolean; data: AIContentRecord }>(
        `/ai/content/${targetType}/${targetId}`
      );
      if (res?.data) {
        setRecord(res.data);
        setEditableDraft(res.data.draftContent || {});
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load AI content status";
      setErrorMsg(msg);
    } finally {
      setIsLoading(false);
    }
  }, [targetType, targetId]);

  React.useEffect(() => {
    fetchRecord();
  }, [fetchRecord]);

  // Generate full draft
  const handleGenerateFull = async () => {
    try {
      setIsGenerating(true);
      setErrorMsg(null);
      setSuccessMsg(null);
      const res = await apiClient.post<{ success: boolean; data: AIContentRecord; message: string }>(
        "/ai/content/generate",
        { targetType, targetId }
      );
      if (res?.data) {
        setRecord(res.data);
        setEditableDraft(res.data.draftContent || {});
        setSuccessMsg(res.message || "Fresh AI draft generated successfully");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Generation failed. Please try again.";
      setErrorMsg(msg);
    } finally {
      setIsGenerating(false);
    }
  };

  // Regenerate single section
  const handleRegenerateSection = async (section: string) => {
    try {
      setRegeneratingSection(section);
      setErrorMsg(null);
      setSuccessMsg(null);
      const res = await apiClient.post<{ success: boolean; data: AIContentRecord; message: string }>(
        "/ai/content/regenerate",
        { targetType, targetId, section }
      );
      if (res?.data) {
        setRecord(res.data);
        setEditableDraft(res.data.draftContent || {});
        setSuccessMsg(`Section "${section}" regenerated successfully`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : `Failed to regenerate section "${section}"`;
      setErrorMsg(msg);
    } finally {
      setRegeneratingSection(null);
    }
  };

  // Approve draft
  const handleApprove = async () => {
    try {
      setIsApproving(true);
      setErrorMsg(null);
      setSuccessMsg(null);
      const res = await apiClient.post<{ success: boolean; data: AIContentRecord; message: string }>(
        "/ai/content/approve",
        { targetType, targetId, editedContent: editableDraft }
      );
      if (res?.data) {
        setRecord(res.data);
        setSuccessMsg("AI content draft approved. Ready to publish to live website.");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Approval failed";
      setErrorMsg(msg);
    } finally {
      setIsApproving(false);
    }
  };

  // Publish to website
  const handlePublish = async () => {
    try {
      setIsPublishing(true);
      setErrorMsg(null);
      setSuccessMsg(null);
      const res = await apiClient.post<{ success: boolean; data: AIContentRecord; message: string }>(
        "/ai/content/publish",
        { targetType, targetId }
      );
      if (res?.data) {
        setRecord(res.data);
        setSuccessMsg("Content successfully published to live website!");
        if (onPublished) onPublished();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to publish content";
      setErrorMsg(msg);
    } finally {
      setIsPublishing(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "PUBLISHED":
        return <Badge className="bg-emerald-600 text-white font-medium">Published Live</Badge>;
      case "APPROVED":
        return <Badge className="bg-blue-600 text-white font-medium">Approved (Ready to Publish)</Badge>;
      case "DRAFT":
        return <Badge className="bg-amber-500 text-white font-medium">Draft (Requires Human Review)</Badge>;
      case "GENERATING":
        return <Badge className="bg-purple-600 text-white font-medium animate-pulse">Generating with Gemini 3.8...</Badge>;
      case "FAILED":
        return <Badge className="bg-rose-600 text-white font-medium">Generation Error</Badge>;
      default:
        return <Badge variant="outline" className="text-slate-500 font-medium">Not Generated</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="p-8 text-center bg-white rounded-lg border border-slate-200">
        <RefreshCw className="w-6 h-6 animate-spin mx-auto text-slate-400 mb-2" />
        <p className="text-sm text-slate-500">Loading AI Content Engine...</p>
      </div>
    );
  }

  const currentStatus = record?.status || "NOT_GENERATED";
  const hasDraft = !!record?.draftContent;
  const isApproved = currentStatus === "APPROVED" || currentStatus === "PUBLISHED";

  return (
    <div className="space-y-6">
      {/* 1. Header Banner & Safety Notice */}
      <Card className="bg-slate-900 text-white border-slate-800">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Sparkles className="w-5 h-5 text-amber-400" />
                <CardTitle className="text-lg font-bold text-white">
                  Gemini 3.8 Flash Clinical Content Engine
                </CardTitle>
                <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                  v{record?.version || 0}
                </span>
              </div>
              <CardDescription className="text-xs text-slate-400">
                AI text generation with schema validation and strict human approval boundary.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {getStatusBadge(currentStatus)}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowHistory(!showHistory)}
                className="text-xs border-slate-700 text-slate-300 hover:bg-slate-800"
              >
                <History className="w-3.5 h-3.5 mr-1" />
                Audit Log ({record?.history?.length || 0})
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="border-t border-slate-800 pt-4">
          <div className="flex items-start gap-3 text-xs text-slate-300 bg-slate-800/60 p-3 rounded-md">
            <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-white">Clinical Verification Policy: </span>
              Gemini generates text only and never invents clinical degrees, awards, or statistics. All draft copy must be reviewed and approved by a human practitioner before live website publication.
            </div>
          </div>
        </CardContent>
        <CardFooter className="border-t border-slate-800 pt-3 flex flex-wrap gap-2 justify-between">
          <Button
            onClick={handleGenerateFull}
            disabled={isGenerating || currentStatus === "GENERATING"}
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold"
          >
            {isGenerating ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1.5" />
                Generating Draft with Gemini...
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                {hasDraft ? "Regenerate Full Draft" : "Generate Draft Content"}
              </>
            )}
          </Button>

          <div className="flex items-center gap-2">
            <Button
              onClick={handleApprove}
              disabled={!hasDraft || isApproving || isGenerating}
              variant="outline"
              className="text-xs border-emerald-600 text-emerald-400 hover:bg-emerald-950/40"
            >
              {isApproving ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1" />
                  Approving...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                  Approve Draft
                </>
              )}
            </Button>

            <Button
              onClick={handlePublish}
              disabled={!isApproved || isPublishing || currentStatus === "PUBLISHED"}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold"
            >
              {isPublishing ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1" />
                  Publishing...
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5 mr-1" />
                  {currentStatus === "PUBLISHED" ? "Published to Live Website" : "Publish to Live Website"}
                </>
              )}
            </Button>
          </div>
        </CardFooter>
      </Card>

      {/* Messages */}
      {errorMsg && (
        <div className="p-3 text-xs bg-rose-50 border border-rose-200 text-rose-700 rounded-md flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}
      {successMsg && (
        <div className="p-3 text-xs bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-md flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* 2. Version Audit Log Collapsible */}
      {showHistory && record?.history && record.history.length > 0 && (
        <Card className="bg-white border-slate-200">
          <CardHeader className="py-3 px-4 bg-slate-50 border-b">
            <CardTitle className="text-sm font-semibold">Audit & Revisions Log</CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-2 max-h-60 overflow-y-auto">
            {record.history.slice().reverse().map((h, i) => (
              <div key={i} className="flex items-center justify-between text-xs p-2 rounded bg-slate-50 border border-slate-100">
                <div>
                  <span className="font-semibold text-slate-800">v{h.version} — {h.action}</span>
                  {h.sectionRegenerated && (
                    <span className="ml-2 text-indigo-600 font-medium">({h.sectionRegenerated})</span>
                  )}
                  <span className="ml-2 text-slate-500">[{h.status}]</span>
                </div>
                <div className="text-slate-400">
                  {new Date(h.createdAt).toLocaleString()}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* 3. Draft Sections Editor */}
      {!hasDraft ? (
        <Card className="bg-white border-dashed border-2 border-slate-200 text-center p-8">
          <CardContent className="space-y-3">
            <Sparkles className="w-8 h-8 text-indigo-400 mx-auto" />
            <h3 className="font-semibold text-slate-800 text-sm">No AI Content Generated Yet</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Click &quot;Generate Draft Content&quot; above to create professional clinical copy, service descriptions, FAQs, and SEO tags tailored to your practice profile.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {/* SECTION: TAGLINE */}
          {editableDraft.tagline !== undefined && (
            <Card className="bg-white border-slate-200 shadow-sm">
              <CardHeader className="py-3 px-4 bg-slate-50 border-b flex flex-row items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-indigo-600" />
                  <CardTitle className="text-sm font-semibold">Tagline</CardTitle>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleRegenerateSection("tagline")}
                  disabled={regeneratingSection === "tagline"}
                  className="text-xs text-indigo-600 hover:text-indigo-800 h-7"
                >
                  <Sparkles className="w-3 h-3 mr-1" />
                  {regeneratingSection === "tagline" ? "Regenerating..." : "Regenerate Tagline"}
                </Button>
              </CardHeader>
              <CardContent className="p-4">
                <Input
                  value={editableDraft.tagline || ""}
                  onChange={(e) => setEditableDraft({ ...editableDraft, tagline: e.target.value })}
                  className="text-sm font-medium text-slate-800"
                />
              </CardContent>
            </Card>
          )}

          {/* SECTION: SHORT INTRO / HOSPITAL INTRO / PROFESSIONAL INTRO */}
          {(editableDraft.shortIntro !== undefined || editableDraft.hospitalIntro !== undefined || editableDraft.professionalIntro !== undefined) && (
            <Card className="bg-white border-slate-200 shadow-sm">
              <CardHeader className="py-3 px-4 bg-slate-50 border-b flex flex-row items-center justify-between">
                <div className="flex items-center gap-2">
                  <Stethoscope className="w-4 h-4 text-indigo-600" />
                  <CardTitle className="text-sm font-semibold">Introductory Overview</CardTitle>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    const sec = editableDraft.shortIntro !== undefined
                      ? "shortIntro"
                      : editableDraft.hospitalIntro !== undefined
                      ? "hospitalIntro"
                      : "professionalIntro";
                    handleRegenerateSection(sec);
                  }}
                  disabled={
                    regeneratingSection === "shortIntro" ||
                    regeneratingSection === "hospitalIntro" ||
                    regeneratingSection === "professionalIntro"
                  }
                  className="text-xs text-indigo-600 hover:text-indigo-800 h-7"
                >
                  <Sparkles className="w-3 h-3 mr-1" />
                  Regenerate Intro
                </Button>
              </CardHeader>
              <CardContent className="p-4">
                <textarea
                  rows={3}
                  value={
                    editableDraft.shortIntro !== undefined
                      ? editableDraft.shortIntro
                      : editableDraft.hospitalIntro !== undefined
                      ? editableDraft.hospitalIntro
                      : editableDraft.professionalIntro || ""
                  }
                  onChange={(e) => {
                    const key = editableDraft.shortIntro !== undefined
                      ? "shortIntro"
                      : editableDraft.hospitalIntro !== undefined
                      ? "hospitalIntro"
                      : "professionalIntro";
                    setEditableDraft({ ...editableDraft, [key]: e.target.value });
                  }}
                  className="w-full text-sm rounded-md border border-input p-2.5"
                />
              </CardContent>
            </Card>
          )}

          {/* SECTION: ABOUT / BIOGRAPHY */}
          {editableDraft.about !== undefined && (
            <Card className="bg-white border-slate-200 shadow-sm">
              <CardHeader className="py-3 px-4 bg-slate-50 border-b flex flex-row items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-indigo-600" />
                  <CardTitle className="text-sm font-semibold">Full Clinical Bio / About Section</CardTitle>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleRegenerateSection("about")}
                  disabled={regeneratingSection === "about"}
                  className="text-xs text-indigo-600 hover:text-indigo-800 h-7"
                >
                  <Sparkles className="w-3 h-3 mr-1" />
                  {regeneratingSection === "about" ? "Regenerating..." : "Regenerate About"}
                </Button>
              </CardHeader>
              <CardContent className="p-4">
                <textarea
                  rows={6}
                  value={editableDraft.about || ""}
                  onChange={(e) => setEditableDraft({ ...editableDraft, about: e.target.value })}
                  className="w-full text-sm rounded-md border border-input p-2.5 leading-relaxed"
                />
              </CardContent>
            </Card>
          )}

          {/* SECTION: CLINIC DESCRIPTION (Independent Doctor) */}
          {editableDraft.clinicDescription !== undefined && (
            <Card className="bg-white border-slate-200 shadow-sm">
              <CardHeader className="py-3 px-4 bg-slate-50 border-b flex flex-row items-center justify-between">
                <div className="flex items-center gap-2">
                  <Building className="w-4 h-4 text-indigo-600" />
                  <CardTitle className="text-sm font-semibold">Clinic & Facilities Overview</CardTitle>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleRegenerateSection("clinicDescription")}
                  disabled={regeneratingSection === "clinicDescription"}
                  className="text-xs text-indigo-600 hover:text-indigo-800 h-7"
                >
                  <Sparkles className="w-3 h-3 mr-1" />
                  Regenerate Clinic Copy
                </Button>
              </CardHeader>
              <CardContent className="p-4">
                <textarea
                  rows={3}
                  value={editableDraft.clinicDescription || ""}
                  onChange={(e) => setEditableDraft({ ...editableDraft, clinicDescription: e.target.value })}
                  className="w-full text-sm rounded-md border border-input p-2.5"
                />
              </CardContent>
            </Card>
          )}

          {/* SECTION: EXPERTISE SUMMARY (Hospital Doctor) */}
          {editableDraft.expertiseSummary !== undefined && (
            <Card className="bg-white border-slate-200 shadow-sm">
              <CardHeader className="py-3 px-4 bg-slate-50 border-b flex flex-row items-center justify-between">
                <div className="flex items-center gap-2">
                  <Stethoscope className="w-4 h-4 text-indigo-600" />
                  <CardTitle className="text-sm font-semibold">Clinical Expertise & Procedures</CardTitle>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleRegenerateSection("expertiseSummary")}
                  disabled={regeneratingSection === "expertiseSummary"}
                  className="text-xs text-indigo-600 hover:text-indigo-800 h-7"
                >
                  <Sparkles className="w-3 h-3 mr-1" />
                  Regenerate Expertise
                </Button>
              </CardHeader>
              <CardContent className="p-4">
                <textarea
                  rows={4}
                  value={editableDraft.expertiseSummary || ""}
                  onChange={(e) => setEditableDraft({ ...editableDraft, expertiseSummary: e.target.value })}
                  className="w-full text-sm rounded-md border border-input p-2.5"
                />
              </CardContent>
            </Card>
          )}

          {/* SECTION: SERVICES */}
          {Array.isArray(editableDraft.services) && (
            <Card className="bg-white border-slate-200 shadow-sm">
              <CardHeader className="py-3 px-4 bg-slate-50 border-b flex flex-row items-center justify-between">
                <div className="flex items-center gap-2">
                  <Stethoscope className="w-4 h-4 text-indigo-600" />
                  <CardTitle className="text-sm font-semibold">Clinical Services ({editableDraft.services.length})</CardTitle>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleRegenerateSection("services")}
                  disabled={regeneratingSection === "services"}
                  className="text-xs text-indigo-600 hover:text-indigo-800 h-7"
                >
                  <Sparkles className="w-3 h-3 mr-1" />
                  Regenerate Services
                </Button>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                {editableDraft.services.map((svc: ServiceItem, idx: number) => (
                  <div key={idx} className="p-3 bg-slate-50 rounded border border-slate-200 space-y-1.5">
                    <Input
                      value={svc.title || ""}
                      onChange={(e) => {
                        const updated = [...(editableDraft.services || [])];
                        updated[idx] = { ...svc, title: e.target.value };
                        setEditableDraft({ ...editableDraft, services: updated });
                      }}
                      className="text-xs font-semibold"
                      placeholder="Service title"
                    />
                    <textarea
                      rows={2}
                      value={svc.description || ""}
                      onChange={(e) => {
                        const updated = [...(editableDraft.services || [])];
                        updated[idx] = { ...svc, description: e.target.value };
                        setEditableDraft({ ...editableDraft, services: updated });
                      }}
                      className="w-full text-xs rounded border border-input p-2"
                      placeholder="Service description"
                    />
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* SECTION: DEPARTMENTS (Hospital) */}
          {Array.isArray(editableDraft.departments) && (
            <Card className="bg-white border-slate-200 shadow-sm">
              <CardHeader className="py-3 px-4 bg-slate-50 border-b flex flex-row items-center justify-between">
                <div className="flex items-center gap-2">
                  <Building className="w-4 h-4 text-indigo-600" />
                  <CardTitle className="text-sm font-semibold">Hospital Departments ({editableDraft.departments.length})</CardTitle>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleRegenerateSection("departments")}
                  disabled={regeneratingSection === "departments"}
                  className="text-xs text-indigo-600 hover:text-indigo-800 h-7"
                >
                  <Sparkles className="w-3 h-3 mr-1" />
                  Regenerate Departments
                </Button>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                {editableDraft.departments.map((dept: DepartmentItem, idx: number) => (
                  <div key={idx} className="p-3 bg-slate-50 rounded border border-slate-200 space-y-1.5">
                    <Input
                      value={dept.name || ""}
                      onChange={(e) => {
                        const updated = [...(editableDraft.departments || [])];
                        updated[idx] = { ...dept, name: e.target.value };
                        setEditableDraft({ ...editableDraft, departments: updated });
                      }}
                      className="text-xs font-semibold"
                      placeholder="Department name"
                    />
                    <textarea
                      rows={2}
                      value={dept.description || ""}
                      onChange={(e) => {
                        const updated = [...(editableDraft.departments || [])];
                        updated[idx] = { ...dept, description: e.target.value };
                        setEditableDraft({ ...editableDraft, departments: updated });
                      }}
                      className="w-full text-xs rounded border border-input p-2"
                      placeholder="Department description"
                    />
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* SECTION: PATIENT FAQS */}
          {Array.isArray(editableDraft.faqs) && (
            <Card className="bg-white border-slate-200 shadow-sm">
              <CardHeader className="py-3 px-4 bg-slate-50 border-b flex flex-row items-center justify-between">
                <div className="flex items-center gap-2">
                  <HelpCircle className="w-4 h-4 text-indigo-600" />
                  <CardTitle className="text-sm font-semibold">Patient FAQs ({editableDraft.faqs.length})</CardTitle>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleRegenerateSection("faqs")}
                  disabled={regeneratingSection === "faqs"}
                  className="text-xs text-indigo-600 hover:text-indigo-800 h-7"
                >
                  <Sparkles className="w-3 h-3 mr-1" />
                  Regenerate FAQs
                </Button>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                {editableDraft.faqs.map((faq: FAQItem, idx: number) => (
                  <div key={idx} className="p-3 bg-slate-50 rounded border border-slate-200 space-y-1.5">
                    <Input
                      value={faq.question || ""}
                      onChange={(e) => {
                        const updated = [...(editableDraft.faqs || [])];
                        updated[idx] = { ...faq, question: e.target.value };
                        setEditableDraft({ ...editableDraft, faqs: updated });
                      }}
                      className="text-xs font-semibold"
                      placeholder="Question"
                    />
                    <textarea
                      rows={2}
                      value={faq.answer || ""}
                      onChange={(e) => {
                        const updated = [...(editableDraft.faqs || [])];
                        updated[idx] = { ...faq, answer: e.target.value };
                        setEditableDraft({ ...editableDraft, faqs: updated });
                      }}
                      className="w-full text-xs rounded border border-input p-2"
                      placeholder="Answer"
                    />
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* SECTION: SEO METADATA */}
          {(editableDraft.seoTitle !== undefined || editableDraft.seoDescription !== undefined) && (
            <Card className="bg-white border-slate-200 shadow-sm">
              <CardHeader className="py-3 px-4 bg-slate-50 border-b flex flex-row items-center justify-between">
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-indigo-600" />
                  <CardTitle className="text-sm font-semibold">SEO Title & Meta Description</CardTitle>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleRegenerateSection("seoTitle")}
                    disabled={regeneratingSection === "seoTitle"}
                    className="text-xs text-indigo-600 hover:text-indigo-800 h-7"
                  >
                    <Sparkles className="w-3 h-3 mr-1" />
                    Regenerate Title
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleRegenerateSection("seoDescription")}
                    disabled={regeneratingSection === "seoDescription"}
                    className="text-xs text-indigo-600 hover:text-indigo-800 h-7"
                  >
                    <Sparkles className="w-3 h-3 mr-1" />
                    Regenerate Meta Desc
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">SEO Title (5-70 chars)</label>
                  <Input
                    value={editableDraft.seoTitle || ""}
                    onChange={(e) => setEditableDraft({ ...editableDraft, seoTitle: e.target.value })}
                    className="text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">SEO Description (10-160 chars)</label>
                  <textarea
                    rows={2}
                    value={editableDraft.seoDescription || ""}
                    onChange={(e) => setEditableDraft({ ...editableDraft, seoDescription: e.target.value })}
                    className="w-full text-sm rounded border border-input p-2"
                  />
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
