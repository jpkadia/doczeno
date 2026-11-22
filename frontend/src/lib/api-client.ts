/**
 * Centralized Typed API Client for Doczeno Frontend
 * Handles base URL, credentials, header normalization, and structured errors.
 */

export class ApiError extends Error {
  status: number;
  data: unknown;

  constructor(message: string, status: number, data?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

export interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  params?: Record<string, string | number | boolean | undefined>;
}

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api/v1";

const AUTH_TOKEN_KEY = "doczeno_auth_token";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function request<T>(
  endpoint: string,
  options: RequestOptions = {},
  retryCount = 0
): Promise<T> {
  const { body, params, headers, ...customConfig } = options;

  let url = `${API_BASE_URL}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;

  if (params) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        searchParams.append(key, String(value));
      }
    });
    const queryString = searchParams.toString();
    if (queryString) {
      url += (url.includes("?") ? "&" : "?") + queryString;
    }
  }

  const defaultHeaders: Record<string, string> = {
    Accept: "application/json",
  };

  if (body && !(body instanceof FormData)) {
    defaultHeaders["Content-Type"] = "application/json";
  }

  // Cross-site fallback: Attach Bearer authorization header if token exists in localStorage
  if (typeof window !== "undefined") {
    try {
      const savedToken = localStorage.getItem(AUTH_TOKEN_KEY);
      if (savedToken && !defaultHeaders["Authorization"]) {
        defaultHeaders["Authorization"] = `Bearer ${savedToken}`;
      }
    } catch {}
  }

  const config: RequestInit = {
    ...customConfig,
    headers: {
      ...defaultHeaders,
      ...headers,
    },
    // Include cookies/credentials by default for secure session auth
    credentials: customConfig.credentials ?? "include",
  };

  if (body) {
    config.body = body instanceof FormData ? body : JSON.stringify(body);
  }

  try {
    const response = await fetch(url, config);

    // Auto-retry cold start statuses (502 Bad Gateway / 503 Service Unavailable / 504 Gateway Timeout)
    if (
      !response.ok &&
      (response.status === 502 || response.status === 503 || response.status === 504) &&
      retryCount < 2
    ) {
      await sleep(2500);
      return request<T>(endpoint, options, retryCount + 1);
    }

    if (!response.ok) {
      let errorData: unknown;
      try {
        errorData = await response.json();
      } catch {
        errorData = await response.text();
      }

      let errorMessage = `Request failed with status ${response.status}`;

      if (typeof errorData === "object" && errorData !== null) {
        const errObj = errorData as Record<string, unknown>;
        if (typeof errObj.error === "string" && errObj.error) {
          errorMessage = errObj.error;
        } else if (typeof errObj.message === "string" && errObj.message) {
          errorMessage = errObj.message;
        }

        // If validation details exist, extract the specific human-friendly message
        if (Array.isArray(errObj.details) && errObj.details.length > 0) {
          const firstDetail = errObj.details[0] as { message?: string };
          if (firstDetail && typeof firstDetail.message === "string") {
            errorMessage = firstDetail.message;
          }
        }
      } else if (typeof errorData === "string" && errorData.trim()) {
        errorMessage = errorData;
      }

      if (
        (response.status === 401 || response.status === 403) &&
        typeof window !== "undefined"
      ) {
        // Clear saved token on 401
        try {
          localStorage.removeItem(AUTH_TOKEN_KEY);
        } catch {}

        if (
          window.location.pathname.startsWith("/superadmin") &&
          !window.location.pathname.startsWith("/superadmin/login")
        ) {
          window.location.replace("/superadmin/login");
          // Return pending promise during navigation to prevent Next.js dev overlay from throwing
          return new Promise(() => {}) as unknown as T;
        }
      }

      throw new ApiError(errorMessage, response.status, errorData);
    }

    if (response.status === 204) {
      return {} as T;
    }

    const data = (await response.json()) as T;

    // Automatically persist auth token from login/session responses into localStorage
    if (typeof window !== "undefined" && typeof data === "object" && data !== null) {
      const responseData = (data as Record<string, any>).data;
      if (responseData && typeof responseData.token === "string" && responseData.token) {
        try {
          localStorage.setItem(AUTH_TOKEN_KEY, responseData.token);
        } catch {}
      } else if (typeof (data as Record<string, any>).token === "string") {
        try {
          localStorage.setItem(AUTH_TOKEN_KEY, (data as Record<string, any>).token);
        } catch {}
      }

      // If logging out, remove token
      if (endpoint.includes("/auth/logout")) {
        try {
          localStorage.removeItem(AUTH_TOKEN_KEY);
        } catch {}
      }
    }

    return data;
  } catch (err) {
    if (err instanceof ApiError) {
      throw err;
    }

    // Auto-retry network failures caused by Render cold start wake-up
    if (retryCount < 2) {
      await sleep(2500);
      return request<T>(endpoint, options, retryCount + 1);
    }

    const rawMsg = err instanceof Error ? err.message : "";
    let friendlyMessage = "Network error: Unable to connect to backend server.";
    if (
      rawMsg.includes("Failed to fetch") ||
      rawMsg.includes("fetch failed") ||
      rawMsg.includes("ECONNREFUSED") ||
      rawMsg.includes("NetworkError")
    ) {
      friendlyMessage =
        "Unable to connect to the healthcare server. If the server is waking up from standby, please wait a few seconds and try again.";
    } else if (rawMsg) {
      friendlyMessage = rawMsg;
    }

    throw new ApiError(friendlyMessage, 0);
  }
}

export const apiClient = {
  get<T>(endpoint: string, options?: RequestOptions): Promise<T> {
    return request<T>(endpoint, { ...options, method: "GET" });
  },

  post<T>(endpoint: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return request<T>(endpoint, { ...options, method: "POST", body });
  },

  put<T>(endpoint: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return request<T>(endpoint, { ...options, method: "PUT", body });
  },

  patch<T>(endpoint: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return request<T>(endpoint, { ...options, method: "PATCH", body });
  },

  delete<T>(endpoint: string, options?: RequestOptions): Promise<T> {
    return request<T>(endpoint, { ...options, method: "DELETE" });
  },
};
