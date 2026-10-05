import { z } from "zod";

/**
 * Server-only environment configuration schema
 * Ensures typed, validated environment variables at startup.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  MONGODB_URI: z
    .string({ required_error: "MONGODB_URI is required" })
    .min(1, "MONGODB_URI is required"),
  BETTER_AUTH_SECRET: z
    .string({ required_error: "BETTER_AUTH_SECRET is required" })
    .min(16, "BETTER_AUTH_SECRET must be at least 16 characters"),
  BETTER_AUTH_URL: z.string().url().default("http://localhost:3000"),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),

  // Cloudinary credentials (from env.txt)
  CLOUDINARY_URL: z.string().optional(),
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),

  // Cloudflare R2 / S3 storage credentials (optional path)
  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET_NAME: z.string().optional(),
  R2_PUBLIC_BASE_URL: z.string().optional(),

  // Transactional Email
  BREVO_API_KEY: z.string().optional(),
  BREVO_SENDER_EMAIL: z.string().email().optional(),

  // Gemini AI configuration
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default("gemini-2.0-flash"),

  // Initial Platform Superadmin
  SUPERADMIN_EMAIL: z.string().email().optional(),
  SUPERADMIN_PASSWORD: z.string().min(6).optional(),
});

export type Env = z.infer<typeof envSchema>;

let parsedEnv: Env | null = null;

export function getEnv(): Env {
  if (parsedEnv) {
    return parsedEnv;
  }

  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const errorDetails = result.error.issues
      .map((issue) => `[${issue.path.join(".")}]: ${issue.message}`)
      .join("; ");
    throw new Error(`[Doczeno Environment Configuration Error]: ${errorDetails}`);
  }

  parsedEnv = result.data;
  return parsedEnv;
}

/**
 * Convenience helper to retrieve server configuration
 */
export const env = getEnv;
