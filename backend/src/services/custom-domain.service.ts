import dns from "dns/promises";
import { Website, IWebsite, Organization, Doctor } from "@/models";
import { getEnv } from "@/config/env";
import { WebsiteType } from "@/types";

export const MAX_CUSTOM_DOMAINS = 50; // Strict Vercel Hobby Free Plan cap

export interface VercelVerificationRecord {
  type: string;
  domain: string;
  value: string;
  reason?: string;
}

export interface DnsInstructionRecord {
  purpose: string;
  type: "A" | "CNAME" | "TXT";
  name: string;
  value: string;
}

export interface CustomDomainResolution {
  found: boolean;
  customDomain?: string;
  targetPath?: string;
  websiteType?: string;
  isVerified?: boolean;
  redirectEnabled?: boolean;
  reason?: string;
}

const DOMAIN_REGEX = /^(?!-)[a-z0-9-]+(\.[a-z0-9-]+)+$/;
const BLOCKED_SUFFIXES = [".vercel.app", ".onrender.com", ".localhost", ".local", ".internal"];

// In-memory CORS & routing cache (refreshed every 60s or invalidated immediately on mutations)
let corsAllowedHostsCache: Set<string> | null = null;
let corsCacheTimestamp = 0;
const CORS_CACHE_TTL_MS = 60 * 1000;
let isHealthCheckRunning = false;

async function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((resolve) => {
        timer = setTimeout(() => resolve(fallback), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function delayMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function invalidateCustomDomainCache(): void {
  corsAllowedHostsCache = null;
  corsCacheTimestamp = 0;
}

/**
 * Normalizes and validates a user-provided domain string (e.g., "https://www.ParthKadiya.com/" -> "parthkadiya.com" or "www.parthkadiya.com").
 */
export function normalizeDomainInput(raw: string): string {
  let clean = (raw || "").trim().toLowerCase();
  clean = clean.replace(/^https?:\/\//, "");
  clean = clean.split("/")[0]?.split("?")[0]?.split("#")[0] || "";
  clean = clean.split(":")[0] || "";
  clean = clean.replace(/\.+$/, "");

  if (!clean || clean.length > 253 || !DOMAIN_REGEX.test(clean)) {
    throw new Error("Please enter a valid domain name (e.g., parthkadiya.com or clinic.example.com).");
  }

  for (const suffix of BLOCKED_SUFFIXES) {
    if (clean === suffix.slice(1) || clean.endsWith(suffix)) {
      throw new Error(`Platform/local domain (${clean}) cannot be used as a custom domain.`);
    }
  }

  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(clean)) {
    throw new Error("IP addresses cannot be used as a custom domain.");
  }

  return clean;
}

/**
 * Generates standard DNS instructions that the doctor/hospital needs to add in GoDaddy/Namecheap/Cloudflare.
 */
export function buildDnsInstructions(
  domain: string,
  vercelVerification: VercelVerificationRecord[] = []
): DnsInstructionRecord[] {
  const parts = domain.split(".");
  const isApex = parts.length === 2 || (parts.length === 3 && parts[1] && parts[1].length <= 3 && parts[2] && parts[2].length <= 2);
  const hostPrefix = isApex ? "@" : parts[0] || "@";

  const records: DnsInstructionRecord[] = [];

  if (isApex) {
    records.push({
      purpose: "Primary Root Domain (Required)",
      type: "A",
      name: "@",
      value: "76.76.21.21",
    });
    records.push({
      purpose: "WWW Subdomain (Optional)",
      type: "CNAME",
      name: "www",
      value: "cname.vercel-dns.com",
    });
  } else {
    records.push({
      purpose: "Subdomain Routing (Required)",
      type: "CNAME",
      name: hostPrefix,
      value: "cname.vercel-dns.com",
    });
  }

  for (const v of vercelVerification) {
    records.push({
      purpose: v.reason || "Domain Ownership Verification (Required by Vercel)",
      type: (v.type as "A" | "CNAME" | "TXT") || "TXT",
      name: v.domain.endsWith(`.${domain}`)
        ? v.domain.slice(0, -(domain.length + 1)) || "@"
        : v.domain,
      value: v.value,
    });
  }

  return records;
}

export class CustomDomainService {
  static isVercelApiConfigured(): boolean {
    const env = getEnv();
    return Boolean(env.VERCEL_API_TOKEN && env.VERCEL_PROJECT_ID);
  }

  private static async callVercelApi(
    endpointPath: string,
    method: "GET" | "POST" | "DELETE",
    body?: Record<string, any>
  ): Promise<{ ok: boolean; status: number; data: any }> {
    const env = getEnv();
    if (!env.VERCEL_API_TOKEN || !env.VERCEL_PROJECT_ID) {
      return { ok: false, status: 0, data: { error: { message: "Vercel API credentials not configured" } } };
    }

    const baseUrl = `https://api.vercel.com${endpointPath}`;
    const separator = baseUrl.includes("?") ? "&" : "?";
    const fullUrl = env.VERCEL_TEAM_ID
      ? `${baseUrl}${separator}teamId=${encodeURIComponent(env.VERCEL_TEAM_ID)}`
      : baseUrl;

    const res = await fetch(fullUrl, {
      method,
      headers: {
        Authorization: `Bearer ${env.VERCEL_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  }

  private static createPublicDnsResolver(): dns.Resolver {
    const resolver = new dns.Resolver();
    resolver.setServers(["8.8.8.8", "1.1.1.1", "8.8.4.4"]);
    return resolver;
  }

  /**
   * Returns all allowed hostnames from verified/registered custom domains for Render dynamic CORS.
   */
  static async isAllowedCustomOrigin(origin: string): Promise<boolean> {
    try {
      const parsed = new URL(origin);
      if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
        return false;
      }
      const hostname = parsed.hostname.toLowerCase();
      const now = Date.now();

      if (!corsAllowedHostsCache || now - corsCacheTimestamp > CORS_CACHE_TTL_MS) {
        const websites = await Website.find({
          customDomain: { $exists: true, $nin: [null, ""] },
          customDomainStatus: { $ne: "FAILED" },
        })
          .select("customDomain")
          .lean();

        const hostSet = new Set<string>();
        for (const w of websites) {
          if (w.customDomain) {
            const d = w.customDomain.toLowerCase().trim();
            hostSet.add(d);
            if (d.startsWith("www.")) {
              hostSet.add(d.slice(4));
            } else {
              hostSet.add(`www.${d}`);
            }
          }
        }
        corsAllowedHostsCache = hostSet;
        corsCacheTimestamp = now;
      }

      return corsAllowedHostsCache.has(hostname);
    } catch {
      return false;
    }
  }

  /**
   * Counts currently used custom domain slots against the strict 50-domain limit.
   */
  static async getCustomDomainUsageCount(): Promise<number> {
    return Website.countDocuments({
      customDomain: { $exists: true, $nin: [null, ""] },
    });
  }

  /**
   * Assigns a custom domain to a Website (enforcing 50-domain limit, uniqueness, and Vercel API attachment).
   */
  static async assignCustomDomain(params: {
    website: IWebsite;
    rawDomain: string;
    redirectEnabled?: boolean;
  }): Promise<{
    website: IWebsite;
    dnsInstructions: DnsInstructionRecord[];
    vercelAttached: boolean;
    vercelMessage?: string;
  }> {
    const domain = normalizeDomainInput(params.rawDomain);

    // Check uniqueness across all other websites
    const duplicate = await Website.findOne({
      customDomain: domain,
      _id: { $ne: params.website._id },
    }).select("_id slug");
    if (duplicate) {
      throw new Error(`Domain "${domain}" is already linked to another website (${duplicate.slug}).`);
    }

    // Also check www/non-www conflict across other websites
    const altDomain = domain.startsWith("www.") ? domain.slice(4) : `www.${domain}`;
    const altDuplicate = await Website.findOne({
      customDomain: altDomain,
      _id: { $ne: params.website._id },
    }).select("_id slug");
    if (altDuplicate) {
      throw new Error(`Domain variant "${altDomain}" is already linked to another website.`);
    }

    const isReplacingExisting = Boolean(params.website.customDomain && params.website.customDomain.trim());
    if (!isReplacingExisting) {
      const usedCount = await this.getCustomDomainUsageCount();
      if (usedCount >= MAX_CUSTOM_DOMAINS) {
        const err: any = new Error(
          `Maximum limit of ${MAX_CUSTOM_DOMAINS} custom domains reached (Vercel Hobby plan limit). Please remove an unused custom domain before adding a new one.`
        );
        err.status = 400;
        err.code = "CUSTOM_DOMAIN_LIMIT_REACHED";
        throw err;
      }
    }

    // If replacing an old domain on the same website, clean up the old one from Vercel first
    if (isReplacingExisting && params.website.customDomain !== domain && this.isVercelApiConfigured()) {
      const env = getEnv();
      await this.callVercelApi(
        `/v10/projects/${encodeURIComponent(env.VERCEL_PROJECT_ID!)}/domains/${encodeURIComponent(params.website.customDomain!)}`,
        "DELETE"
      ).catch(() => {});
    }

    let verificationRecords: VercelVerificationRecord[] = [];
    let isVerified = false;
    let vercelAttached = false;
    let vercelMessage: string | undefined;

    if (this.isVercelApiConfigured()) {
      const env = getEnv();
      const addRes = await this.callVercelApi(
        `/v10/projects/${encodeURIComponent(env.VERCEL_PROJECT_ID!)}/domains`,
        "POST",
        { name: domain }
      );

      if (addRes.ok) {
        vercelAttached = true;
        isVerified = Boolean(addRes.data?.verified);
        if (Array.isArray(addRes.data?.verification)) {
          verificationRecords = addRes.data.verification.map((v: any) => ({
            type: String(v.type || "TXT"),
            domain: String(v.domain || `_vercel.${domain}`),
            value: String(v.value || ""),
            reason: v.reason ? String(v.reason) : undefined,
          }));
        }
      } else {
        const apiErrMsg =
          addRes.data?.error?.message || `Vercel API error (status ${addRes.status})`;
        if (addRes.data?.error?.code === "domain_already_in_use") {
          throw new Error(
            `Domain "${domain}" is already attached to another Vercel account/project. The owner must add the Vercel verification TXT record or remove it from the previous Vercel project.`
          );
        }
        vercelMessage = apiErrMsg;
      }
    } else {
      vercelMessage =
        "Saved in Doczeno database. Add VERCEL_API_TOKEN & VERCEL_PROJECT_ID in backend .env for automatic Vercel attachment.";
    }

    // Run live DNS pre-check even right away in case user already configured DNS
    const dnsCheck = await this.checkLiveDns(domain);
    const finalVerified = this.isVercelApiConfigured()
      ? isVerified && dnsCheck.pointsToVercel
      : dnsCheck.pointsToVercel;

    params.website.customDomain = domain;
    params.website.customDomainStatus = finalVerified ? "VERIFIED" : "PENDING";
    params.website.customDomainRedirect = params.redirectEnabled !== false;
    params.website.customDomainVerification = verificationRecords;
    params.website.customDomainVerifiedAt = finalVerified ? new Date() : null;
    params.website.customDomainLastCheckedAt = new Date();
    params.website.customDomainLastError = finalVerified ? null : vercelMessage || null;
    await params.website.save();

    invalidateCustomDomainCache();

    return {
      website: params.website,
      dnsInstructions: buildDnsInstructions(domain, verificationRecords),
      vercelAttached,
      vercelMessage,
    };
  }

  /**
   * Performs live DNS resolution check (A record 76.76.21.21 or CNAME cname.vercel-dns.com) using Node's built-in dns module.
   */
  static async checkLiveDns(domain: string): Promise<{
    pointsToVercel: boolean;
    aRecords: string[];
    cnameRecords: string[];
    txtRecords: string[];
  }> {
    const aRecords: string[] = [];
    const cnameRecords: string[] = [];
    const txtRecords: string[] = [];
    const publicResolver = this.createPublicDnsResolver();

    try {
      let ips = await withTimeout(publicResolver.resolve4(domain), 4000, [] as string[]);
      if (ips.length === 0) {
        ips = await withTimeout(dns.resolve4(domain), 4000, [] as string[]);
      }
      aRecords.push(...ips);
    } catch {}

    try {
      let cnames = await withTimeout(publicResolver.resolveCname(domain), 4000, [] as string[]);
      if (cnames.length === 0) {
        cnames = await withTimeout(dns.resolveCname(domain), 4000, [] as string[]);
      }
      cnameRecords.push(...cnames);
    } catch {}

    try {
      let txts = await withTimeout(publicResolver.resolveTxt(`_vercel.${domain}`), 4000, [] as string[][]);
      if (txts.length === 0) {
        txts = await withTimeout(dns.resolveTxt(`_vercel.${domain}`), 4000, [] as string[][]);
      }
      for (const t of txts) {
        txtRecords.push(t.join(""));
      }
    } catch {}

    const VERCEL_APEX_IPS = new Set(["76.76.21.21", "216.198.79.1"]);
    const hasVercelIp = aRecords.some((ip) => VERCEL_APEX_IPS.has(ip));
    const hasVercelCname = cnameRecords.some((c) =>
      c.toLowerCase().includes("vercel-dns.com")
    );

    return {
      pointsToVercel: hasVercelIp || hasVercelCname,
      aRecords,
      cnameRecords,
      txtRecords,
    };
  }

  /**
   * Verifies both Vercel project domain status/SSL and live DNS records.
   */
  static async verifyCustomDomain(website: IWebsite): Promise<{
    verified: boolean;
    status: "PENDING" | "VERIFIED" | "FAILED";
    dnsCheck: Awaited<ReturnType<typeof CustomDomainService.checkLiveDns>>;
    vercelConfig?: any;
    dnsInstructions: DnsInstructionRecord[];
    message: string;
  }> {
    if (!website.customDomain) {
      throw new Error("No custom domain configured for this website.");
    }

    const domain = website.customDomain.toLowerCase();
    const dnsCheck = await this.checkLiveDns(domain);
    let vercelVerified = false;
    let misconfigured = false;
    let verificationRecords: VercelVerificationRecord[] = website.customDomainVerification || [];
    let vercelConfig: any = null;

    if (this.isVercelApiConfigured()) {
      const env = getEnv();
      // 1. Trigger domain verification on Vercel
      const verifyRes = await this.callVercelApi(
        `/v10/projects/${encodeURIComponent(env.VERCEL_PROJECT_ID!)}/domains/${encodeURIComponent(domain)}/verify`,
        "POST"
      );

      if (verifyRes.ok) {
        vercelVerified = Boolean(verifyRes.data?.verified);
        if (Array.isArray(verifyRes.data?.verification)) {
          verificationRecords = verifyRes.data.verification.map((v: any) => ({
            type: String(v.type || "TXT"),
            domain: String(v.domain || `_vercel.${domain}`),
            value: String(v.value || ""),
            reason: v.reason ? String(v.reason) : undefined,
          }));
        }
      }

      // 2. Check domain DNS configuration status on Vercel
      const cfgRes = await this.callVercelApi(
        `/v6/domains/${encodeURIComponent(domain)}/config`,
        "GET"
      );
      if (cfgRes.ok) {
        vercelConfig = cfgRes.data;
        misconfigured = Boolean(cfgRes.data?.misconfigured);
      }
    }

    const isFullyVerified = this.isVercelApiConfigured()
      ? vercelVerified && !misconfigured && dnsCheck.pointsToVercel
      : dnsCheck.pointsToVercel;

    website.customDomainVerification = verificationRecords;
    website.customDomainStatus = isFullyVerified ? "VERIFIED" : "PENDING";
    website.customDomainLastCheckedAt = new Date();
    if (isFullyVerified) {
      website.customDomainVerifiedAt = new Date();
      website.customDomainLastError = null;
    } else {
      website.customDomainLastError = !dnsCheck.pointsToVercel
        ? "DNS records are not pointing to Vercel (76.76.21.21 or cname.vercel-dns.com) yet."
        : misconfigured
        ? "Vercel reported DNS misconfiguration. Please verify A/CNAME records."
        : "Waiting for Vercel TXT ownership verification.";
    }
    await website.save();

    invalidateCustomDomainCache();

    return {
      verified: isFullyVerified,
      status: website.customDomainStatus as "PENDING" | "VERIFIED" | "FAILED",
      dnsCheck,
      vercelConfig,
      dnsInstructions: buildDnsInstructions(domain, verificationRecords),
      message: isFullyVerified
        ? `Domain "${domain}" is verified and live with automatic SSL!`
        : website.customDomainLastError || "DNS verification still pending.",
    };
  }

  /**
   * Removes a custom domain from Vercel Project and MongoDB, freeing up 1 slot out of 50.
   */
  static async removeCustomDomain(website: IWebsite): Promise<void> {
    const oldDomain = website.customDomain;
    if (oldDomain && this.isVercelApiConfigured()) {
      const env = getEnv();
      await this.callVercelApi(
        `/v10/projects/${encodeURIComponent(env.VERCEL_PROJECT_ID!)}/domains/${encodeURIComponent(oldDomain)}`,
        "DELETE"
      ).catch(() => {});
    }

    website.customDomain = undefined;
    website.customDomainStatus = "NONE";
    website.customDomainVerification = [];
    website.customDomainVerifiedAt = null;
    website.customDomainLastCheckedAt = null;
    website.customDomainLastError = null;
    await website.save();

    invalidateCustomDomainCache();
  }

  /**
   * Lightweight sequential DNS health check for VERIFIED custom domains.
   * Automatically marks dead/expired/transferred domains as FAILED and disables
   * slug redirect so doczeno.vercel.app/<slug> never redirects to an expired or third-party site.
   */
  static async runDailyHealthCheck(options?: { forceAll?: boolean }): Promise<{
    checked: number;
    healthy: number;
    disabled: number;
    skippedReason?: string;
    disabledDomains: Array<{ websiteId: string; customDomain: string; slug: string }>;
  }> {
    if (isHealthCheckRunning) {
      return {
        checked: 0,
        healthy: 0,
        disabled: 0,
        skippedReason: "Health check already in progress",
        disabledDomains: [],
      };
    }

    isHealthCheckRunning = true;
    const disabledDomains: Array<{ websiteId: string; customDomain: string; slug: string }> = [];
    let checked = 0;
    let healthy = 0;
    let disabled = 0;

    try {
      const now = new Date();
      const staleThreshold = new Date(now.getTime() - 23 * 60 * 60 * 1000);

      const query: Record<string, any> = {
        customDomainStatus: "VERIFIED",
        customDomain: { $exists: true, $nin: [null, ""] },
      };

      if (!options?.forceAll) {
        query.$or = [
          { customDomainLastCheckedAt: { $exists: false } },
          { customDomainLastCheckedAt: null },
          { customDomainLastCheckedAt: { $lt: staleThreshold } },
        ];
      }

      // Lean minimal projection: <= 50 small objects (~5 KB RAM total)
      const candidates = await Website.find(query)
        .select("_id slug customDomain")
        .lean();

      if (candidates.length === 0) {
        return { checked: 0, healthy: 0, disabled: 0, disabledDomains };
      }

      let networkSanityVerified = false;

      // Process sequentially (1 DNS lookup at a time) for near-zero memory/socket overhead
      for (const item of candidates) {
        if (!item.customDomain) continue;
        const domain = item.customDomain.toLowerCase().trim();
        checked++;

        let dnsResult = await this.checkLiveDns(domain);
        if (!dnsResult.pointsToVercel) {
          // Retry once after 1.5s to filter out transient UDP DNS packet loss
          await delayMs(1500);
          dnsResult = await this.checkLiveDns(domain);
        }

        let vercelMisconfigured = false;
        if (!dnsResult.pointsToVercel && this.isVercelApiConfigured()) {
          const cfgRes = await this.callVercelApi(
            `/v6/domains/${encodeURIComponent(domain)}/config`,
            "GET"
          ).catch(() => ({ ok: false, status: 0, data: null }));
          if (cfgRes.ok && typeof cfgRes.data?.misconfigured === "boolean") {
            vercelMisconfigured = cfgRes.data.misconfigured;
          }
        }

        const isStillHealthy = dnsResult.pointsToVercel && !vercelMisconfigured;

        if (isStillHealthy) {
          healthy++;
          await Website.updateOne(
            { _id: item._id },
            { $set: { customDomainLastCheckedAt: new Date() } }
          );
          continue;
        }

        // Before marking any domain FAILED, verify server's own DNS resolver can resolve Vercel
        if (!networkSanityVerified) {
          const probeResolver = this.createPublicDnsResolver();
          const probe = await withTimeout(
            probeResolver.resolve4("cname.vercel-dns.com").catch(() => [] as string[]),
            4000,
            [] as string[]
          );
          if (probe.length === 0) {
            return {
              checked,
              healthy,
              disabled,
              skippedReason: "Aborted health check: server outbound DNS probe failed.",
              disabledDomains,
            };
          }
          networkSanityVerified = true;
        }

        // Domain DNS no longer points to Vercel (expired, parked, or transferred)
        await Website.updateOne(
          { _id: item._id },
          {
            $set: {
              customDomainStatus: "FAILED",
              customDomainRedirect: false,
              customDomainLastCheckedAt: new Date(),
              customDomainLastError:
                "Auto-disabled by daily health check: DNS no longer points to Vercel (domain may have expired or been transferred). Doczeno slug redirect has been turned OFF automatically.",
            },
          }
        );

        disabled++;
        disabledDomains.push({
          websiteId: item._id.toString(),
          customDomain: domain,
          slug: item.slug,
        });
      }

      if (disabled > 0) {
        invalidateCustomDomainCache();
      }

      return { checked, healthy, disabled, disabledDomains };
    } finally {
      isHealthCheckRunning = false;
    }
  }

  /**
   * Resolves a custom domain (from Edge middleware host header) to its exact internal Doczeno path.
   */
  static async resolveDomainTarget(rawHost: string): Promise<CustomDomainResolution> {
    const host = (rawHost || "").split(":")[0]?.trim().toLowerCase() || "";
    if (!host) return { found: false };

    const candidates = [host];
    if (host.startsWith("www.")) {
      candidates.push(host.slice(4));
    } else {
      candidates.push(`www.${host}`);
    }

    const website = await Website.findOne({
      customDomain: { $in: candidates },
    }).lean();

    if (!website || !website.customDomain) {
      return { found: false };
    }

    if (website.customDomainStatus === "FAILED") {
      return { found: false, reason: "DOMAIN_HEALTH_FAILED" };
    }

    let targetPath = `/${website.slug}`;

    if (website.websiteType === WebsiteType.HOSPITAL_DOCTOR && website.doctorId && website.organizationId) {
      const [org, doc] = await Promise.all([
        Organization.findById(website.organizationId).select("slug status").lean(),
        Doctor.findById(website.doctorId).select("slug status approvalStatus").lean(),
      ]);
      if (!org || !doc || doc.approvalStatus === "PENDING" || doc.approvalStatus === "REJECTED") {
        return { found: false, reason: "UNDER_APPROVAL_OR_UNAVAILABLE" };
      }
      targetPath = `/${org.slug}/${doc.slug}`;
    } else if (website.websiteType === WebsiteType.ONLY_DOCTOR && website.doctorId) {
      const doc = await Doctor.findById(website.doctorId).select("slug").lean();
      targetPath = `/${doc?.slug || website.slug}`;
    } else if (website.websiteType === WebsiteType.HOSPITAL_CLINIC && website.organizationId) {
      const org = await Organization.findById(website.organizationId).select("slug").lean();
      targetPath = `/${org?.slug || website.slug}`;
    }

    return {
      found: true,
      customDomain: website.customDomain,
      targetPath,
      websiteType: website.websiteType,
      isVerified: website.customDomainStatus === "VERIFIED",
      redirectEnabled: website.customDomainRedirect !== false,
    };
  }

  /**
   * Checks if a platform path (e.g. /dr-parth-kadiya or /dr-parth-kadiya/admin) should permanently redirect to a custom domain.
   */
  static async checkRedirectForPath(rawPath: string): Promise<{
    shouldRedirect: boolean;
    redirectUrl?: string;
  }> {
    const cleanPath = (rawPath || "").replace(/\/+$/, "") || "/";
    const segments = cleanPath.split("/").filter(Boolean);
    if (segments.length === 0) return { shouldRedirect: false };

    const firstSeg = segments[0]!.toLowerCase();
    const secondSeg = segments[1]?.toLowerCase();

    let website: any = null;
    let remainingSegments: string[] = [];

    // Case A: Dual-slug hospital doctor (e.g., /zydus/dr-hiten-sharma or /zydus/dr-hiten-sharma/admin)
    if (secondSeg && secondSeg !== "admin") {
      const org = await Organization.findOne({ slug: firstSeg }).select("_id").lean();
      if (org) {
        const doc = await Doctor.findOne({
          organizationId: org._id,
          slug: secondSeg,
          approvalStatus: "APPROVED",
        })
          .select("_id")
          .lean();
        if (doc) {
          website = await Website.findOne({
            doctorId: doc._id,
            organizationId: org._id,
          })
            .select("customDomain customDomainStatus customDomainRedirect")
            .lean();
          remainingSegments = segments.slice(2);
        }
      }
    }

    // Case B: Single-slug Only Doctor or Hospital (e.g., /dr-parth-kadiya or /dr-parth-kadiya/admin)
    if (!website) {
      website = await Website.findOne({
        slug: firstSeg,
        websiteType: { $in: [WebsiteType.ONLY_DOCTOR, WebsiteType.HOSPITAL_CLINIC] },
      })
        .select("customDomain customDomainStatus customDomainRedirect")
        .lean();
      remainingSegments = segments.slice(1);
    }

    if (
      !website ||
      !website.customDomain ||
      website.customDomainStatus !== "VERIFIED" ||
      website.customDomainRedirect === false
    ) {
      return { shouldRedirect: false };
    }

    const suffix = remainingSegments.length > 0 ? `/${remainingSegments.join("/")}` : "/";
    return {
      shouldRedirect: true,
      redirectUrl: `https://${website.customDomain}${suffix === "/" ? "" : suffix}`,
    };
  }
}
