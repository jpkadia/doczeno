"use client";

import * as React from "react";
import {
  MessageSquare,
  Search,
  Trash2,
  User,
  Phone,
  FileText,
  AlertCircle,
  RefreshCw,
  Eye,
  CheckCircle2,
  Stethoscope,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { apiClient } from "@/lib/api-client";

export interface AIChatSessionSummary {
  id: string;
  sessionId: string;
  conversationType: "PUBLIC" | "ADMIN";
  patientName: string;
  patientPhone?: string;
  problem?: string;
  bookingStatus: "COLLECTING" | "AWAITING_CONFIRMATION" | "BOOKED" | "INQUIRY";
  appointmentDate?: string;
  timeSlot?: string;
  doctorName?: string;
  doctorSpecialization?: string;
  doctorId?: string;
  hospitalName?: string;
  messageCount: number;
  lastMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AIChatMessageDetail {
  role: "user" | "assistant" | "system" | "tool" | "model";
  content: string;
  timestamp: string;
}

export interface AIChatFullDetail extends AIChatSessionSummary {
  patientEmail?: string;
  messages: AIChatMessageDetail[];
  appointmentDraft?: {
    step: string;
    patientName?: string;
    patientPhone?: string;
    patientEmail?: string;
    appointmentDate?: string;
    timeSlot?: string;
    notes?: string;
    doctorName?: string;
  } | null;
}

interface AIChatHistoryViewProps {
  portalType: "ONLY_DOCTOR" | "HOSPITAL_DOCTOR" | "HOSPITAL";
  doctorList?: Array<{ id: string; name: string; specialization?: string }>;
  currentDoctorId?: string;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "-";
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateStr;
  }
}

export function AIChatHistoryView({
  portalType,
  doctorList = [],
  currentDoctorId,
}: AIChatHistoryViewProps) {
  const [conversations, setConversations] = React.useState<AIChatSessionSummary[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState("");
  const [selectedDoctorId, setSelectedDoctorId] = React.useState<string>(currentDoctorId || "");
  const [page, setPage] = React.useState(1);
  const [totalPages, setTotalPages] = React.useState(1);
  const [totalCount, setTotalCount] = React.useState(0);

  // Transcript view modal state
  const [transcriptOpen, setTranscriptOpen] = React.useState(false);
  const [activeDetail, setActiveDetail] = React.useState<AIChatFullDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = React.useState(false);

  // Permanent Delete modal state
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [itemToDelete, setItemToDelete] = React.useState<AIChatSessionSummary | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [actionNotice, setActionNotice] = React.useState<string | null>(null);

  const fetchConversations = React.useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const params: Record<string, string | number> = {
        page,
        limit: 15,
        conversationType: "PUBLIC",
      };
      if (search.trim()) {
        params.search = search.trim();
      }
      if (portalType === "HOSPITAL" && selectedDoctorId) {
        params.doctorId = selectedDoctorId;
      }

      const res = await apiClient.get<{
        success: boolean;
        data: {
          conversations: AIChatSessionSummary[];
          pagination: { total: number; page: number; limit: number; totalPages: number };
        };
      }>("/chatbot/conversations", { params });

      if (res.data) {
        setConversations(res.data.conversations || []);
        setTotalCount(res.data.pagination.total || 0);
        setTotalPages(res.data.pagination.totalPages || 1);
      }
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : typeof err === "object" && err !== null && "message" in err
          ? String((err as { message: unknown }).message)
          : "Failed to load chat conversations";
      setErrorMessage(msg);
    } finally {
      setLoading(false);
    }
  }, [page, search, selectedDoctorId, portalType]);

  React.useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  const handleOpenTranscript = async (item: AIChatSessionSummary) => {
    setTranscriptOpen(true);
    setLoadingDetail(true);
    setActiveDetail(null);
    try {
      const res = await apiClient.get<{
        success: boolean;
        data: AIChatFullDetail;
      }>(`/chatbot/conversations/${item.id}`);
      if (res.data) {
        setActiveDetail(res.data);
      }
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : typeof err === "object" && err !== null && "message" in err
          ? String((err as { message: unknown }).message)
          : "Failed to load conversation transcript";
      setErrorMessage(msg);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handlePromptDelete = (item: AIChatSessionSummary) => {
    setItemToDelete(item);
    setDeleteOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!itemToDelete) return;
    setIsDeleting(true);
    try {
      await apiClient.delete(`/chatbot/conversations/${itemToDelete.id}`);
      setConversations((prev) => prev.filter((c) => c.id !== itemToDelete.id));
      setTotalCount((prev) => Math.max(0, prev - 1));
      setDeleteOpen(false);
      if (transcriptOpen && activeDetail?.id === itemToDelete.id) {
        setTranscriptOpen(false);
      }
      setActionNotice("Chat conversation was permanently deleted from the database.");
      setTimeout(() => setActionNotice(null), 3000);
      setItemToDelete(null);
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : typeof err === "object" && err !== null && "message" in err
          ? String((err as { message: unknown }).message)
          : "Failed to delete conversation";
      setErrorMessage(msg);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Action banner */}
      {actionNotice && (
        <div className="bg-blue-50 border border-blue-200 text-blue-900 text-xs px-4 py-2.5 rounded-lg flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-[#1a76d1]" />
            <span>{actionNotice}</span>
          </div>
          <Badge variant="outline" className="text-[10px] bg-white border-blue-200 text-[#1560aa]">
            Deleted
          </Badge>
        </div>
      )}

      {errorMessage && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-4 py-2.5 rounded-lg flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Main Card */}
      <Card className="bg-white border-slate-200 shadow-2xs">
        <CardHeader className="p-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-[#1a76d1]" />
              <CardTitle className="text-lg font-bold text-slate-900">
                AI Patient Chat History
              </CardTitle>
              <Badge variant="outline" className="text-xs bg-slate-50 text-slate-700 font-medium">
                {totalCount} Sessions
              </Badge>
            </div>
            <CardDescription className="text-xs text-slate-500 mt-1">
              Visitor conversations recorded via the website AI chatbot. All conversations are automatically retained for 30 days.
            </CardDescription>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchConversations()}
              disabled={loading}
              className="text-xs flex items-center gap-1.5 h-9"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin text-[#1a76d1]" : ""}`} />
              <span>Refresh</span>
            </Button>
          </div>
        </CardHeader>

        {/* Filters & Search Bar */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              type="text"
              placeholder="Search by patient name, phone, problem..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="pl-9 text-xs h-9 bg-white border-slate-200"
            />
          </div>

          {/* Doctor Selector for Hospital Admin */}
          {portalType === "HOSPITAL" && doctorList.length > 0 && (
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Stethoscope className="h-4 w-4 text-slate-400 shrink-0" />
              <select
                value={selectedDoctorId}
                onChange={(e) => {
                  setSelectedDoctorId(e.target.value);
                  setPage(1);
                }}
                className="text-xs bg-white border border-slate-200 rounded-md px-3 py-1.5 h-9 text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#1a76d1]"
              >
                <option value="">All Hospital Doctors</option>
                {doctorList.map((doc) => (
                  <option key={doc.id} value={doc.id}>
                    Dr. {doc.name} {doc.specialization ? `(${doc.specialization})` : ""}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Table Content */}
        <CardContent className="p-0">
          {loading && conversations.length === 0 ? (
            <div className="py-16 text-center text-xs text-slate-500">
              <RefreshCw className="h-6 w-6 text-[#1a76d1] animate-spin mx-auto mb-2" />
              Loading AI chat history...
            </div>
          ) : conversations.length === 0 ? (
            <div className="py-16 text-center text-xs text-slate-400">
              <MessageSquare className="h-8 w-8 text-slate-300 mx-auto mb-2" />
              <p className="font-medium text-slate-600 text-sm">No chat conversations recorded</p>
              <p className="mt-1">When website visitors chat with your AI assistant, their sessions will appear here.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50 text-[11px] font-semibold text-slate-600">
                    <TableHead className="w-40">Date & Time</TableHead>
                    <TableHead>Patient / Visitor</TableHead>
                    <TableHead>Contact Phone</TableHead>
                    <TableHead>Reason / Symptoms</TableHead>
                    {portalType === "HOSPITAL" && <TableHead>Doctor</TableHead>}
                    <TableHead className="text-center">Messages</TableHead>
                    <TableHead>Booking Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {conversations.map((item) => {
                    const isBooked = item.bookingStatus === "BOOKED";
                    return (
                      <TableRow key={item.id} className="text-xs hover:bg-slate-50/80 transition-colors">
                        <TableCell className="font-mono text-[11px] text-slate-500 whitespace-nowrap">
                          {formatDate(item.createdAt)}
                        </TableCell>
                        <TableCell className="font-medium text-slate-800">
                          {item.patientName || "Anonymous Visitor"}
                        </TableCell>
                        <TableCell className="text-slate-600 font-mono text-[11px]">
                          {item.patientPhone || "-"}
                        </TableCell>
                        <TableCell className="max-w-xs truncate text-slate-700" title={item.problem || ""}>
                          {item.problem || "-"}
                        </TableCell>
                        {portalType === "HOSPITAL" && (
                          <TableCell className="text-slate-700 whitespace-nowrap">
                            {item.doctorName || "-"}
                          </TableCell>
                        )}
                        <TableCell className="text-center">
                          <Badge variant="outline" className="text-[10px] bg-slate-100 text-slate-700">
                            {item.messageCount} turns
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {isBooked ? (
                            <Badge className="bg-blue-100 text-blue-800 border-blue-200 text-[10px]">
                              Booked ({item.appointmentDate})
                            </Badge>
                          ) : item.bookingStatus === "AWAITING_CONFIRMATION" ? (
                            <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-[10px]">
                              Draft Pending
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-slate-500 text-[10px]">
                              Inquiry
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenTranscript(item)}
                              className="h-8 px-2.5 text-xs text-[#1560aa] hover:bg-blue-50"
                              title="View complete transcript"
                            >
                              <Eye className="h-3.5 w-3.5 mr-1" />
                              <span>View</span>
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handlePromptDelete(item)}
                              className="h-8 px-2 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                              title="Permanently delete from database"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="p-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span>
                Page {page} of {totalPages} ({totalCount} total)
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="h-8 text-xs"
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="h-8 text-xs"
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Transcript View Modal */}
      <Dialog open={transcriptOpen} onOpenChange={setTranscriptOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-0">
          <DialogHeader className="p-5 border-b border-slate-100">
            <div className="flex items-start justify-between">
              <div>
                <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-[#1a76d1]" />
                  Chat Session Transcript
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500 mt-1">
                  Session ID: <span className="font-mono">{activeDetail?.sessionId || "..."}</span>
                </DialogDescription>
              </div>
            </div>

            {/* Patient & Booking Metadata banner */}
            {activeDetail && (
              <div className="mt-3 bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs grid grid-cols-2 sm:grid-cols-3 gap-2">
                <div>
                  <span className="text-slate-400 block text-[10px]">Patient</span>
                  <span className="font-medium text-slate-800 flex items-center gap-1">
                    <User className="h-3 w-3 text-slate-400" />
                    {activeDetail.patientName || "Anonymous"}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Phone</span>
                  <span className="font-mono text-slate-800 flex items-center gap-1">
                    <Phone className="h-3 w-3 text-slate-400" />
                    {activeDetail.patientPhone || "-"}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Doctor</span>
                  <span className="text-slate-800">{activeDetail.doctorName || "-"}</span>
                </div>
                <div className="col-span-2 sm:col-span-3">
                  <span className="text-slate-400 block text-[10px]">Problem / Notes</span>
                  <span className="text-slate-700 flex items-center gap-1">
                    <FileText className="h-3 w-3 text-slate-400 shrink-0" />
                    {activeDetail.problem || "General clinic inquiry"}
                  </span>
                </div>
                {activeDetail.bookingStatus === "BOOKED" && (
                  <div className="col-span-2 sm:col-span-3 bg-blue-50 border border-blue-200 rounded p-2 text-blue-900 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-[#1a76d1]" />
                      <span className="font-semibold text-xs">Appointment Confirmed in Database</span>
                    </div>
                    <span className="font-mono text-xs">
                      {activeDetail.appointmentDate} at {activeDetail.timeSlot}
                    </span>
                  </div>
                )}
              </div>
            )}
          </DialogHeader>

          {/* Transcript Message Bubbles */}
          <div className="flex-1 overflow-y-auto p-5 space-y-3 bg-slate-50/50">
            {loadingDetail ? (
              <div className="py-12 text-center text-xs text-slate-500">
                <RefreshCw className="h-5 w-5 text-[#1a76d1] animate-spin mx-auto mb-2" />
                Loading message history...
              </div>
            ) : !activeDetail || activeDetail.messages.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400">
                No message exchanges recorded for this session.
              </div>
            ) : (
              activeDetail.messages.map((msg, idx) => {
                const isUser = msg.role === "user";
                return (
                  <div
                    key={idx}
                    className={`flex flex-col ${isUser ? "items-end" : "items-start"} max-w-[85%] ${
                      isUser ? "ml-auto" : "mr-auto"
                    }`}
                  >
                    <div className="flex items-center gap-1 text-[10px] text-slate-400 mb-0.5 px-1">
                      <span>{isUser ? "Patient / Visitor" : "AI Assistant"}</span>
                      {msg.timestamp && (
                        <span>
                          {new Date(msg.timestamp).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      )}
                    </div>
                    <div
                      className={`rounded-2xl px-3.5 py-2 text-xs leading-relaxed ${
                        isUser
                          ? "bg-slate-900 text-white rounded-br-xs"
                          : "bg-white border border-slate-200 text-slate-800 rounded-bl-xs shadow-2xs"
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <DialogFooter className="p-4 border-t border-slate-100 flex items-center justify-between">
            {activeDetail && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setItemToDelete(activeDetail);
                  setDeleteOpen(true);
                }}
                className="text-xs text-red-600 hover:text-red-700 hover:bg-red-50 flex items-center gap-1"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Delete Permanently</span>
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setTranscriptOpen(false)}
              className="text-xs ml-auto"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Permanent Delete Confirmation Modal */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="max-w-md p-5">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2 text-red-600">
              <Trash2 className="h-5 w-5" />
              Permanently Delete Chat
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500 mt-2">
              Are you sure you want to permanently delete this chat session from the database?
              All messages, visitor logs, and temporary drafts associated with this conversation will be immediately and irreversibly removed.
            </DialogDescription>
          </DialogHeader>

          {itemToDelete && (
            <div className="bg-slate-50 border border-slate-200 rounded p-3 text-xs space-y-1">
              <div>
                <span className="text-slate-400">Patient: </span>
                <span className="font-semibold text-slate-800">{itemToDelete.patientName || "Anonymous Visitor"}</span>
              </div>
              {itemToDelete.patientPhone && (
                <div>
                  <span className="text-slate-400">Phone: </span>
                  <span className="font-mono text-slate-800">{itemToDelete.patientPhone}</span>
                </div>
              )}
              {itemToDelete.problem && (
                <div>
                  <span className="text-slate-400">Reason: </span>
                  <span className="text-slate-700">{itemToDelete.problem}</span>
                </div>
              )}
              <div>
                <span className="text-slate-400">Date: </span>
                <span className="text-slate-700">{formatDate(itemToDelete.createdAt)}</span>
              </div>
            </div>
          )}

          <DialogFooter className="mt-4 flex items-center justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDeleteOpen(false)}
              disabled={isDeleting}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleConfirmDelete}
              disabled={isDeleting}
              className="text-xs bg-red-600 hover:bg-red-700 text-white flex items-center gap-1.5"
            >
              {isDeleting ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  <span>Deleting...</span>
                </>
              ) : (
                <>
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Yes, Delete Permanently</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
