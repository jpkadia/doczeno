import { Request } from "express";

export interface ParsedUserAgent {
  browser: string;
  os: string;
  deviceType: "Desktop" | "Mobile" | "Tablet" | "Unknown";
  deviceLabel: string;
}

/**
 * Extracts and normalizes the true client IP address behind reverse proxies (Vercel, Render, Cloudflare, Nginx).
 */
export function getClientIp(req: Request): string {
  const cfIp = req.headers["cf-connecting-ip"];
  const realIp = req.headers["x-real-ip"];
  const forwarded = req.headers["x-forwarded-for"];

  let rawIp = "";
  if (typeof cfIp === "string" && cfIp.trim()) {
    rawIp = cfIp.trim();
  } else if (typeof realIp === "string" && realIp.trim()) {
    rawIp = realIp.trim();
  } else if (typeof forwarded === "string" && forwarded.trim()) {
    rawIp = forwarded.split(",")[0]?.trim() || "";
  } else if (Array.isArray(forwarded) && forwarded.length > 0) {
    rawIp = forwarded[0]?.split(",")[0]?.trim() || "";
  } else {
    rawIp = req.ip || req.socket?.remoteAddress || "";
  }

  if (!rawIp) return "Unknown";

  // Normalize IPv6-mapped IPv4 (e.g., ::ffff:127.0.0.1 -> 127.0.0.1)
  if (rawIp.startsWith("::ffff:")) {
    rawIp = rawIp.substring(7);
  }
  if (rawIp === "::1") {
    return "127.0.0.1 (Localhost)";
  }
  return rawIp;
}

/**
 * Industry-standard User-Agent parser extracting Browser, OS, and Device Type without external dependencies.
 */
export function parseUserAgent(uaRaw?: string): ParsedUserAgent {
  const ua = (uaRaw || "").trim();
  if (!ua) {
    return {
      browser: "Unknown Browser",
      os: "Unknown OS",
      deviceType: "Unknown",
      deviceLabel: "Unknown Device",
    };
  }

  // 1. Detect OS
  let os = "Unknown OS";
  if (/iPhone/i.test(ua)) {
    const match = ua.match(/OS (\d+[_\.]\d+)/i);
    const ver = match?.[1] ? ` ${match[1].replace("_", ".")}` : "";
    os = `iOS${ver}`;
  } else if (/iPad/i.test(ua)) {
    const match = ua.match(/OS (\d+[_\.]\d+)/i);
    const ver = match?.[1] ? ` ${match[1].replace("_", ".")}` : "";
    os = `iPadOS${ver}`;
  } else if (/Android/i.test(ua)) {
    const match = ua.match(/Android\s+(\d+(?:\.\d+)?)/i);
    const ver = match?.[1] ? ` ${match[1]}` : "";
    os = `Android${ver}`;
  } else if (/Windows NT 10\.0/i.test(ua)) {
    os = "Windows 10/11";
  } else if (/Windows NT 6\.3/i.test(ua)) {
    os = "Windows 8.1";
  } else if (/Windows NT 6\.1/i.test(ua)) {
    os = "Windows 7";
  } else if (/Windows/i.test(ua)) {
    os = "Windows";
  } else if (/Mac OS X/i.test(ua)) {
    const match = ua.match(/Mac OS X (\d+[_\.]\d+)/i);
    const ver = match?.[1] ? ` ${match[1].replace("_", ".")}` : "";
    os = `macOS${ver}`;
  } else if (/CrOS/i.test(ua)) {
    os = "ChromeOS";
  } else if (/Linux/i.test(ua)) {
    os = "Linux";
  }

  // 2. Detect Browser (order matters: Edge/Opera/Samsung/iOS variants before Chrome/Safari)
  let browser = "Unknown Browser";
  const matchVer = (regex: RegExp) => {
    const m = ua.match(regex);
    return m?.[1] ? ` ${m[1].split(".")[0]}` : "";
  };

  if (/EdgA\/|EdgiOS\/|Edg\//i.test(ua)) {
    browser = `Microsoft Edge${matchVer(/Edg(?:A|iOS)?\/(\d+(?:\.\d+)?)/i)}`;
  } else if (/OPR\/|Opera\//i.test(ua)) {
    browser = `Opera${matchVer(/(?:OPR|Opera)\/(\d+(?:\.\d+)?)/i)}`;
  } else if (/SamsungBrowser\//i.test(ua)) {
    browser = `Samsung Internet${matchVer(/SamsungBrowser\/(\d+(?:\.\d+)?)/i)}`;
  } else if (/CriOS\//i.test(ua)) {
    browser = `Chrome (iOS)${matchVer(/CriOS\/(\d+(?:\.\d+)?)/i)}`;
  } else if (/FxiOS\//i.test(ua)) {
    browser = `Firefox (iOS)${matchVer(/FxiOS\/(\d+(?:\.\d+)?)/i)}`;
  } else if (/Firefox\//i.test(ua)) {
    browser = `Mozilla Firefox${matchVer(/Firefox\/(\d+(?:\.\d+)?)/i)}`;
  } else if (/Chrome\//i.test(ua) && !/Chromium/i.test(ua)) {
    browser = `Google Chrome${matchVer(/Chrome\/(\d+(?:\.\d+)?)/i)}`;
  } else if (/Safari\//i.test(ua) && !/Chrome|Chromium/i.test(ua)) {
    browser = `Apple Safari${matchVer(/Version\/(\d+(?:\.\d+)?)/i)}`;
  } else if (/PostmanRuntime/i.test(ua)) {
    browser = "Postman";
  } else if (/curl\//i.test(ua)) {
    browser = "cURL";
  }

  // 3. Detect Device Type & Label
  let deviceType: ParsedUserAgent["deviceType"] = "Desktop";
  let deviceLabel = "Desktop PC";

  if (/iPad/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua)) || /Tablet/i.test(ua)) {
    deviceType = "Tablet";
    deviceLabel = /iPad/i.test(ua) ? "iPad" : "Android Tablet";
  } else if (/iPhone/i.test(ua)) {
    deviceType = "Mobile";
    deviceLabel = "iPhone";
  } else if (/iPod/i.test(ua)) {
    deviceType = "Mobile";
    deviceLabel = "iPod Touch";
  } else if (/Android/i.test(ua) && /Mobile/i.test(ua)) {
    deviceType = "Mobile";
    deviceLabel = "Android Phone";
  } else if (/Mobile|BlackBerry|IEMobile|Opera Mini/i.test(ua)) {
    deviceType = "Mobile";
    deviceLabel = "Mobile Phone";
  } else if (/Macintosh|Mac OS X/i.test(ua)) {
    deviceType = "Desktop";
    deviceLabel = "Mac / MacBook";
  } else if (/Windows/i.test(ua)) {
    deviceType = "Desktop";
    deviceLabel = "Windows PC";
  } else if (/Linux/i.test(ua)) {
    deviceType = "Desktop";
    deviceLabel = "Linux PC";
  } else if (/CrOS/i.test(ua)) {
    deviceType = "Desktop";
    deviceLabel = "Chromebook";
  }

  return { browser, os, deviceType, deviceLabel };
}
