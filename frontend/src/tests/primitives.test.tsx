import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { EmptyState } from "@/components/ui/empty-state";
import { FormField } from "@/components/forms/form-field";
import { Input } from "@/components/ui/input";

describe("UI Foundation Primitives", () => {
  it("renders Button with proper classes and text", () => {
    render(<Button variant="default">Schedule Appointment</Button>);
    const button = screen.getByRole("button", { name: "Schedule Appointment" });
    expect(button).toBeDefined();
    expect(button.className).toContain("bg-primary");
  });

  it("renders Badge with custom variants", () => {
    render(<Badge variant="success">Active Hospital</Badge>);
    const badge = screen.getByText("Active Hospital");
    expect(badge).toBeDefined();
    expect(badge.className).toContain("bg-emerald-100");
  });

  it("renders LoadingSpinner with accessible label", () => {
    render(<LoadingSpinner text="Fetching clinical records..." />);
    expect(screen.getByRole("status")).toBeDefined();
    expect(screen.getAllByText("Fetching clinical records...").length).toBeGreaterThan(0);
  });

  it("renders EmptyState with title and description", () => {
    render(
      <EmptyState
        title="No Doctors Registered"
        description="Add doctors under this hospital to display on the public roster."
      />
    );
    expect(screen.getByText("No Doctors Registered")).toBeDefined();
    expect(
      screen.getByText("Add doctors under this hospital to display on the public roster.")
    ).toBeDefined();
  });

  it("renders FormField with accessible label and error state", () => {
    render(
      <FormField id="email" label="Doctor Email" required error="Valid email is required">
        <Input id="email" type="email" />
      </FormField>
    );

    expect(screen.getByLabelText(/Doctor Email/)).toBeDefined();
    expect(screen.getByRole("alert").textContent).toBe("Valid email is required");
  });
});
