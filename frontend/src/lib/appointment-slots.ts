import { apiClient } from "@/lib/api-client";

export interface LiveSlotOption {
  slotKey: string;
  startTime: string;
  endTime: string;
  displayLabel: string;
  maxPatients: number | null;
  bookedCount: number;
  remainingSeats: number | null;
  isFull: boolean;
  currentServingToken: number;
  lastTokenNumber: number;
}

export interface LiveSlotsResponse {
  doctorId: string;
  doctorName: string;
  dateKey: string;
  dayOfWeek: string;
  isOpen: boolean;
  closedReason?: string;
  slots: LiveSlotOption[];
}

/**
 * Fetches configured consultation slots & live remaining capacity for a doctor + date.
 */
export async function fetchDoctorLiveSlots(params: {
  doctorId?: string;
  organizationId?: string;
  date: string;
}): Promise<LiveSlotsResponse | null> {
  if (!params.date || (!params.doctorId && !params.organizationId)) return null;
  try {
    const res = await apiClient.get<{
      success: boolean;
      data?: LiveSlotsResponse;
    }>("/appointments/slots", {
      params: {
        doctorId: params.doctorId,
        organizationId: params.organizationId,
        date: params.date,
      },
    });
    if (res?.success && res.data) {
      return res.data;
    }
    return null;
  } catch {
    return null;
  }
}

export function formatSlotSelectLabel(slot: LiveSlotOption): string {
  if (slot.isFull && slot.maxPatients !== null) {
    return `${slot.displayLabel} — FULL (${slot.bookedCount}/${slot.maxPatients})`;
  }
  if (slot.maxPatients !== null && slot.remainingSeats !== null) {
    return `${slot.displayLabel} (${slot.bookedCount}/${slot.maxPatients} booked, ${slot.remainingSeats} left)`;
  }
  return `${slot.displayLabel}${slot.bookedCount > 0 ? ` (${slot.bookedCount} booked)` : ""}`;
}
