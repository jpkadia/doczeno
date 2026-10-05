import { describe, it, expect, vi, beforeEach } from "vitest";
import { apiClient, ApiError } from "@/lib/api-client";

describe("Frontend Typed API Client", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("performs GET request and parses JSON data", async () => {
    const mockData = { status: "ok", version: "1.0" };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockData,
    });

    const result = await apiClient.get<{ status: string }>("/health");
    expect(result).toEqual(mockData);
    expect(global.fetch).toHaveBeenCalledWith(
      "http://localhost:5000/api/v1/health",
      expect.objectContaining({
        method: "GET",
        credentials: "include",
      })
    );
  });

  it("handles normalized ApiError on HTTP failures", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({ message: "Forbidden tenant access" }),
    });

    await expect(apiClient.get("/organizations/org-1")).rejects.toThrow(ApiError);
    await expect(apiClient.get("/organizations/org-1")).rejects.toThrow(
      "Forbidden tenant access"
    );
  });
});
