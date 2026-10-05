import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";

export interface CustomApiError extends Error {
  status?: number;
  code?: string;
  details?: unknown;
}

export function errorHandler(
  err: CustomApiError,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Zod Validation Error Handling
  if (err instanceof ZodError) {
    res.status(400).json({
      success: false,
      error: "Validation error",
      code: "VALIDATION_ERROR",
      details: err.errors.map((e) => ({
        path: e.path.join("."),
        message: e.message,
      })),
    });
    return;
  }

  // Mongoose Duplicate Key Error (code 11000)
  if ((err as unknown as { code?: number }).code === 11000) {
    res.status(409).json({
      success: false,
      error: "A record with this unique identifier or slug already exists",
      code: "DUPLICATE_KEY_ERROR",
    });
    return;
  }

  const statusCode = err.status || 500;
  const message =
    statusCode === 500 && process.env.NODE_ENV === "production"
      ? "Internal server error"
      : err.message || "An unexpected error occurred";

  res.status(statusCode).json({
    success: false,
    error: message,
    code: err.code || "INTERNAL_ERROR",
    ...(err.details ? { details: err.details } : {}),
  });
}
