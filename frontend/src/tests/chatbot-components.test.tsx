import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { PublicChatbotWidget } from "@/components/chatbot/public-chatbot-widget";
import { AdminAssistantDrawer } from "@/components/admin/admin-assistant-drawer";
import { apiClient } from "@/lib/api-client";

vi.mock("@/lib/api-client", () => ({
  apiClient: {
    post: vi.fn(),
    get: vi.fn(),
  },
}));

describe("TASK 7 — Chatbot UI Components (Frontend)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("PublicChatbotWidget", () => {
    it("renders floating button and opens chat panel on click", () => {
      render(
        <PublicChatbotWidget
          slug="dr-parth-kadiya"
          displayName="Dr. Parth Kadiya"
          websiteType="INDEPENDENT_DOCTOR"
        />
      );

      const trigger = screen.getByRole("button", { name: /Open AI Assistant/i });
      expect(trigger).toBeDefined();

      fireEvent.click(trigger);

      // Panel should now be open
      expect(screen.getByText("Practice AI Assistant")).toBeDefined();
      expect(screen.getByText(/Practice Info Only:/i)).toBeDefined();
      expect(screen.getByText(/Not for medical diagnosis or prescription/i)).toBeDefined();
    });

    it("displays initial greeting and suggested prompts", () => {
      render(
        <PublicChatbotWidget
          slug="dr-parth-kadiya"
          displayName="Dr. Parth Kadiya"
          websiteType="INDEPENDENT_DOCTOR"
        />
      );

      fireEvent.click(screen.getByRole("button", { name: /Open AI Assistant/i }));

      expect(screen.getByText(/Hello! I am the virtual assistant for Dr\. Parth Kadiya/i)).toBeDefined();
      expect(screen.getByText("What are consultation hours?")).toBeDefined();
      expect(screen.getByText("How can I book an appointment?")).toBeDefined();
    });

    it("sends user message and displays assistant response", async () => {
      vi.mocked(apiClient.post).mockResolvedValueOnce({
        success: true,
        response: "Consultation hours are Monday to Saturday, 09:00 AM - 01:00 PM.",
        sessionId: "pub_123",
      });

      render(
        <PublicChatbotWidget
          slug="dr-parth-kadiya"
          displayName="Dr. Parth Kadiya"
          websiteType="INDEPENDENT_DOCTOR"
        />
      );

      fireEvent.click(screen.getByRole("button", { name: /Open AI Assistant/i }));

      const input = screen.getByPlaceholderText(/Ask about hours, location, booking/i);
      fireEvent.change(input, { target: { value: "What are your timings?" } });

      const form = input.closest("form");
      expect(form).not.toBeNull();
      fireEvent.submit(form!);

      await waitFor(() => {
        expect(apiClient.post).toHaveBeenCalledWith(
          "/chatbot/public/message",
          expect.objectContaining({
            slug: "dr-parth-kadiya",
            message: "What are your timings?",
          })
        );
      });

      await waitFor(() => {
        expect(screen.getByText(/Consultation hours are Monday to Saturday/i)).toBeDefined();
      });
    });

    it("prevents submitting messages over 500 characters", () => {
      render(
        <PublicChatbotWidget
          slug="dr-parth-kadiya"
          displayName="Dr. Parth Kadiya"
          websiteType="INDEPENDENT_DOCTOR"
        />
      );

      fireEvent.click(screen.getByRole("button", { name: /Open AI Assistant/i }));

      const longMessage = "a".repeat(501);
      const input = screen.getByPlaceholderText(/Ask about hours, location, booking/i);
      fireEvent.change(input, { target: { value: longMessage } });

      const form = input.closest("form");
      fireEvent.submit(form!);

      expect(apiClient.post).not.toHaveBeenCalled();
    });
  });

  describe("AdminAssistantDrawer", () => {
    it("renders drawer when isOpen is true with practice context and security notice", () => {
      render(
        <AdminAssistantDrawer
          isOpen={true}
          onClose={vi.fn()}
          roleBadge="HOSPITAL_ADMIN"
          practiceTitle="Apollo Hospitals"
        />
      );

      expect(screen.getByText("Practice Copilot")).toBeDefined();
      expect(screen.getByText("HOSPITAL_ADMIN")).toBeDefined();
      expect(screen.getByText("Apollo Hospitals")).toBeDefined();
      expect(screen.getByText(/Operating with strict tenant permissions/i)).toBeDefined();
    });

    it("displays confirmation card when destructive action is pending", async () => {
      vi.mocked(apiClient.post).mockResolvedValueOnce({
        success: true,
        response: 'Are you sure you want to deactivate doctor "Dr. Rajiv Shah"?',
        sessionId: "admin_123",
        pendingConfirmation: {
          actionId: "action-deactivate-99",
          actionType: "deactivateDoctor",
          parameters: { doctorId: "doc-99" },
          expiresAt: new Date(Date.now() + 300000).toISOString(),
        },
      });

      render(
        <AdminAssistantDrawer
          isOpen={true}
          onClose={vi.fn()}
          roleBadge="HOSPITAL_ADMIN"
          practiceTitle="Apollo Hospitals"
        />
      );

      const input = screen.getByPlaceholderText(/Ask assistant to fetch records or manage profile/i);
      fireEvent.change(input, { target: { value: "Deactivate doctor doc-99" } });

      const form = input.closest("form");
      fireEvent.submit(form!);

      await waitFor(() => {
        expect(screen.getByText(/Confirmation Required \(Destructive Action\)/i)).toBeDefined();
        expect(screen.getAllByText(/Are you sure you want to deactivate doctor/i).length).toBeGreaterThan(0);
        expect(screen.getByRole("button", { name: /Confirm & Execute/i })).toBeDefined();
      });

      // Confirm button click
      vi.mocked(apiClient.post).mockResolvedValueOnce({
        success: true,
        response: "Doctor was deactivated successfully.",
        sessionId: "admin_123",
      });

      fireEvent.click(screen.getByRole("button", { name: /Confirm & Execute/i }));

      await waitFor(() => {
        expect(apiClient.post).toHaveBeenCalledWith(
          "/chatbot/admin/message",
          expect.objectContaining({
            confirmActionId: "action-deactivate-99",
          })
        );
      });
    });
  });
});
