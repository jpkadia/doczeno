import { PlatformConfig } from "@/models/PlatformConfig";

export const FIXED_PLATFORM_DOMAIN = "doczeno.vercel.app";

let cachedConfig: {
  domain: string;
  name: string;
  timestamp: number;
} | null = null;

const CACHE_TTL_MS = 60 * 1000; // 1 minute in-memory cache

export class PlatformConfigService {
  /**
   * Sanitizes and normalizes an input domain
   * Fixed immutable platform domain: "doczeno.vercel.app"
   */
  public static sanitizeDomain(_raw?: string): string {
    return FIXED_PLATFORM_DOMAIN;
  }

  /**
   * Retrieves active platform config with in-memory caching.
   * Hardcoded to "doczeno.vercel.app" without allowing .env or UI override.
   */
  public static async getConfig(): Promise<{
    platformDomain: string;
    platformName: string;
    supportEmail: string;
  }> {
    const now = Date.now();
    if (cachedConfig && now - cachedConfig.timestamp < CACHE_TTL_MS) {
      return {
        platformDomain: FIXED_PLATFORM_DOMAIN,
        platformName: cachedConfig.name,
        supportEmail: "support@" + FIXED_PLATFORM_DOMAIN,
      };
    }

    try {
      let config = await PlatformConfig.findOne().sort({ createdAt: -1 });
      if (!config) {
        config = await PlatformConfig.create({
          platformDomain: FIXED_PLATFORM_DOMAIN,
          platformName: "Doczeno",
          supportEmail: "support@" + FIXED_PLATFORM_DOMAIN,
        });
      } else if (config.platformDomain !== FIXED_PLATFORM_DOMAIN) {
        config.platformDomain = FIXED_PLATFORM_DOMAIN;
        await config.save();
      }

      cachedConfig = {
        domain: FIXED_PLATFORM_DOMAIN,
        name: config.platformName || "Doczeno",
        timestamp: now,
      };

      return {
        platformDomain: FIXED_PLATFORM_DOMAIN,
        platformName: config.platformName,
        supportEmail: config.supportEmail || "support@" + FIXED_PLATFORM_DOMAIN,
      };
    } catch {
      // Fallback if DB is unavailable during startup
      return {
        platformDomain: FIXED_PLATFORM_DOMAIN,
        platformName: "Doczeno",
        supportEmail: "support@" + FIXED_PLATFORM_DOMAIN,
      };
    }
  }

  /**
   * Domain cannot be changed from user, admin, superadmin, or .env.
   */
  public static async updateDomain(
    _rawDomain: string,
    _actor?: { userId?: string; email?: string; role?: string }
  ): Promise<{
    platformDomain: string;
    platformName: string;
  }> {
    throw new Error(
      "Platform domain is permanently locked to doczeno.vercel.app and cannot be changed from user, admin, superadmin, or environment."
    );
  }
}
