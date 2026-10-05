import fs from "fs";
import path from "path";
import { z } from "zod";

/**
 * Safely parse root env.txt if available during local development
 * without echoing secrets to stdout or stderr.
 */
function loadRootEnvTxt(): void {
  const rootEnvTxtPath = path.resolve(process.cwd(), "../env.txt");
  const localEnvTxtPath = path.resolve(process.cwd(), "env.txt");
  const targetPath = fs.existsSync(localEnvTxtPath)
    ? localEnvTxtPath
    : fs.existsSync(rootEnvTxtPath)
    ? rootEnvTxtPath
    : null;

  if (!targetPath) return;

  try {
    const content = fs.readFileSync(targetPath, "utf8");
    const lines = content.split("\n");
    let inSuperadmin = false;

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;

      if (line.toLowerCase().startsWith("superadmin")) {
        inSuperadmin = true;
        continue;
      }

      const sepIndex = line.indexOf(":");
      const eqIndex = line.indexOf("=");
      let splitIndex = -1;
      if (sepIndex !== -1 && eqIndex !== -1) splitIndex = Math.min(sepIndex, eqIndex);
      else if (sepIndex !== -1) splitIndex = sepIndex;
      else if (eqIndex !== -1) splitIndex = eqIndex;

      if (splitIndex === -1) continue;

      const key = line.slice(0, splitIndex).trim().toLowerCase();
      const val = line.slice(splitIndex + 1).trim();

      if ((key.includes("mongo uri") || key === "mongodb_uri") && !process.env.MONGODB_URI) {
        process.env.MONGODB_URI = val;
      } else if (key === "cloudinary_url" && !process.env.CLOUDINARY_URL) {
        process.env.CLOUDINARY_URL = val;
      } else if (key.includes("cloudinary key name") && !process.env.CLOUDINARY_CLOUD_NAME) {
        process.env.CLOUDINARY_CLOUD_NAME = val;
      } else if (key.includes("cloudinary api key") && !process.env.CLOUDINARY_API_KEY) {
        process.env.CLOUDINARY_API_KEY = val;
      } else if (key.includes("cloudinary api secret") && !process.env.CLOUDINARY_API_SECRET) {
        process.env.CLOUDINARY_API_SECRET = val;
      } else if (key.includes("brevo api") && !process.env.BREVO_API_KEY) {
        process.env.BREVO_API_KEY = val;
      } else if (key.includes("brevo sender") && !process.env.BREVO_SENDER_EMAIL) {
        process.env.BREVO_SENDER_EMAIL = val;
      } else if (inSuperadmin && key === "email" && !process.env.SUPERADMIN_EMAIL) {
        process.env.SUPERADMIN_EMAIL = val;
      } else if (inSuperadmin && key === "password" && !process.env.SUPERADMIN_PASSWORD) {
        process.env.SUPERADMIN_PASSWORD = val;
      }
    }
  } catch {
    // Silently continue if reading fails
  }
}

loadRootEnvTxt();

const envSchema = z.object({
  PORT: z.coerce.number().default(5000),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  MONGODB_URI: z
    .string({ required_error: "MONGODB_URI is required" })
    .min(1, "MONGODB_URI is required"),
  AUTH_SECRET: z
    .string()
    .min(16, "AUTH_SECRET must be at least 16 characters")
    .default("doczeno-secure-default-auth-secret-key-32chars"),
  FRONTEND_URL: z.string().url().default("http://localhost:3000"),

  // Cloudinary credentials
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
  if (parsedEnv) return parsedEnv;

  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const errorDetails = result.error.issues
      .map((issue) => `[${issue.path.join(".")}]: ${issue.message}`)
      .join("; ");
    throw new Error(`[Doczeno Backend Config Error]: ${errorDetails}`);
  }

  parsedEnv = result.data;
  return parsedEnv;
}
