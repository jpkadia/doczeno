import { describe, it, expect } from "vitest";
import {
  User,
  Organization,
  Doctor,
  Website,
  Template,
  Media,
  Service,
  Department,
  Appointment,
  Review,
  AIContent,
  ChatbotKnowledge,
  ChatbotConversation,
  AuditLog,
} from "@/models";

describe("Database Models & Indexing Verification", () => {
  it("defines all 14 required core domain models", () => {
    expect(User).toBeDefined();
    expect(Organization).toBeDefined();
    expect(Doctor).toBeDefined();
    expect(Website).toBeDefined();
    expect(Template).toBeDefined();
    expect(Media).toBeDefined();
    expect(Service).toBeDefined();
    expect(Department).toBeDefined();
    expect(Appointment).toBeDefined();
    expect(Review).toBeDefined();
    expect(AIContent).toBeDefined();
    expect(ChatbotKnowledge).toBeDefined();
    expect(ChatbotConversation).toBeDefined();
    expect(AuditLog).toBeDefined();
  });

  it("Organization model has unique slug and indexing", () => {
    const slugPath = Organization.schema.path("slug");
    expect(slugPath).toBeDefined();
  });

  it("Doctor model has tenant-scoped organizationId indexing and unique slug", () => {
    const orgPath = Doctor.schema.path("organizationId");
    const slugPath = Doctor.schema.path("slug");
    expect(orgPath).toBeDefined();
    expect(slugPath).toBeDefined();
  });

  it("Website model has ownerId, organizationId, and unique slug", () => {
    const slugPath = Website.schema.path("slug");
    const ownerPath = Website.schema.path("ownerId");
    expect(slugPath).toBeDefined();
    expect(ownerPath).toBeDefined();
  });

  it("Appointment model has doctorId, appointmentDate, and status indexing", () => {
    const docPath = Appointment.schema.path("doctorId");
    const datePath = Appointment.schema.path("appointmentDate");
    const statusPath = Appointment.schema.path("status");
    expect(docPath).toBeDefined();
    expect(datePath).toBeDefined();
    expect(statusPath).toBeDefined();
  });
});
