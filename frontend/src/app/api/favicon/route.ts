import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const targetUrl = searchParams.get("url")?.trim();

  // If no URL or accidental profile/clinic photo URL passed, fallback to default circular platform icon
  if (!targetUrl || targetUrl.includes("doctor_photo") || targetUrl.includes("clinic_photos")) {
    return NextResponse.redirect(new URL("/favicon.svg", req.url));
  }

  // If relative path, redirect to platform host
  if (targetUrl.startsWith("/")) {
    return NextResponse.redirect(new URL(targetUrl, req.url));
  }

  try {
    const upstreamRes = await fetch(targetUrl, {
      signal: AbortSignal.timeout(4000),
      headers: {
        Accept: "image/*,*/*",
      },
    });

    if (!upstreamRes.ok) {
      return NextResponse.redirect(new URL("/favicon.svg", req.url));
    }

    const contentType = upstreamRes.headers.get("content-type") || "image/png";
    const buffer = await upstreamRes.arrayBuffer();

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
      },
    });
  } catch {
    return NextResponse.redirect(new URL("/favicon.svg", req.url));
  }
}
