import { NextRequest, NextResponse } from "next/server";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api/v1";

const CONFIGURED_PLATFORM_HOSTS = (process.env.NEXT_PUBLIC_PLATFORM_DOMAIN || "doczeno.vercel.app")
  .split(",")
  .map((h) => h.trim().toLowerCase())
  .filter(Boolean);

function isPlatformHost(hostname: string): boolean {
  const clean = hostname.toLowerCase();
  if (!clean) return true;
  if (clean === "localhost" || clean === "127.0.0.1") return true;
  if (clean.endsWith(".vercel.app")) return true;
  if (CONFIGURED_PLATFORM_HOSTS.includes(clean)) return true;
  return false;
}

// Short-lived Edge isolate cache (15s) to minimize repeated backend lookups while staying near-real-time
const domainCache = new Map<string, { targetPath: string | null; ts: number }>();
const redirectCache = new Map<string, { redirectUrl: string | null; ts: number }>();
const EDGE_CACHE_TTL_MS = 15 * 1000;

async function resolveCustomDomain(hostname: string): Promise<string | null> {
  const now = Date.now();
  const cached = domainCache.get(hostname);
  if (cached && now - cached.ts < EDGE_CACHE_TTL_MS) {
    return cached.targetPath;
  }

  try {
    const res = await fetch(
      `${API_BASE_URL}/websites/resolve-domain?domain=${encodeURIComponent(hostname)}`,
      { cache: "no-store", headers: { Accept: "application/json" } }
    );
    if (!res.ok) return null;
    const json = await res.json();
    const targetPath = json?.data?.found && json?.data?.targetPath ? String(json.data.targetPath) : null;
    domainCache.set(hostname, { targetPath, ts: now });
    return targetPath;
  } catch {
    return null;
  }
}

async function checkSlugRedirect(pathname: string): Promise<string | null> {
  const now = Date.now();
  const cached = redirectCache.get(pathname);
  if (cached && now - cached.ts < EDGE_CACHE_TTL_MS) {
    return cached.redirectUrl;
  }

  try {
    const res = await fetch(
      `${API_BASE_URL}/websites/check-redirect?path=${encodeURIComponent(pathname)}`,
      { cache: "no-store", headers: { Accept: "application/json" } }
    );
    if (!res.ok) return null;
    const json = await res.json();
    const redirectUrl = json?.data?.shouldRedirect && json?.data?.redirectUrl ? String(json.data.redirectUrl) : null;
    redirectCache.set(pathname, { redirectUrl, ts: now });
    return redirectUrl;
  } catch {
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const url = request.nextUrl;
  const pathname = url.pathname;

  // Never intercept Next.js internals, API routes, or public static assets
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/images") ||
    pathname === "/favicon.ico" ||
    pathname === "/favicon.svg" ||
    pathname === "/icon-round.png" ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml" ||
    pathname === "/custom-domain-not-found" ||
    /\.(?:png|jpg|jpeg|webp|gif|svg|ico|css|js|woff2?|ttf|map)$/i.test(pathname)
  ) {
    return NextResponse.next();
  }

  const rawHost =
    request.headers.get("x-forwarded-host") ||
    request.headers.get("host") ||
    "";
  const hostname = (rawHost.split(",")[0]?.split(":")[0] || "").trim().toLowerCase();

  // 1. CUSTOM DOMAIN HANDLING (e.g. parthkadiya.com)
  if (!isPlatformHost(hostname)) {
    const targetPath = await resolveCustomDomain(hostname);

    if (!targetPath) {
      // Strictly block unknown/unlinked custom domains from rendering Doczeno home page
      return NextResponse.rewrite(new URL("/custom-domain-not-found", request.url));
    }

    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-custom-domain-host", hostname);
    requestHeaders.set("x-custom-domain-target", targetPath);

    // Normalize path: "/" -> targetPath, "/admin*" -> targetPath + "/admin*"
    if (pathname === "/") {
      const rewriteUrl = new URL(`${targetPath}${url.search}`, request.url);
      return NextResponse.rewrite(rewriteUrl, { request: { headers: requestHeaders } });
    }

    if (pathname === "/admin" || pathname.startsWith("/admin/")) {
      const rewriteUrl = new URL(`${targetPath}${pathname}${url.search}`, request.url);
      return NextResponse.rewrite(rewriteUrl, { request: { headers: requestHeaders } });
    }

    // If a client link included targetPath (e.g., /dr-parth-kadiya or /dr-parth-kadiya/admin), normalize to clean root URL
    if (pathname === targetPath || pathname.startsWith(`${targetPath}/`)) {
      const stripped = pathname.slice(targetPath.length) || "/";
      const cleanRedirectUrl = new URL(`${stripped}${url.search}`, request.url);
      return NextResponse.redirect(cleanRedirectUrl, 307);
    }

    // Block all other slugs, /superadmin, /onboarding, etc. on this custom domain
    return NextResponse.rewrite(new URL("/custom-domain-not-found", request.url));
  }

  // 2. PLATFORM HOST HANDLING (e.g. doczeno.vercel.app)
  // Skip platform core routes immediately with 0 backend overhead
  if (
    pathname === "/" ||
    pathname.startsWith("/onboarding") ||
    pathname.startsWith("/superadmin") ||
    pathname.startsWith("/admin")
  ) {
    return NextResponse.next();
  }

  // Check if this slug/path has a verified custom domain with redirect enabled
  const redirectTarget = await checkSlugRedirect(pathname);
  if (redirectTarget) {
    // Use 307 + no-store so browsers don't permanently cache the redirect if the custom domain later expires
    const res = NextResponse.redirect(new URL(`${redirectTarget}${url.search}`), 307);
    res.headers.set("Cache-Control", "no-store, max-age=0");
    return res;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
