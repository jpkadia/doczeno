"use client";

import * as React from "react";
import { QRCodeSVG, QRCodeCanvas } from "qrcode.react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { usePlatformDomain } from "@/hooks/use-platform-domain";
import {
  QrCode,
  Download,
  Copy,
  ExternalLink,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export interface ClinicQrProps {
  title: string;
  subtitle?: string;
  pathOrSlug: string;
  logoUrl?: string;
  isOpen?: boolean;
  onClose?: () => void;
  className?: string;
  isInsideDialog?: boolean;
}

export function ClinicQrCard({
  title,
  subtitle,
  pathOrSlug,
  logoUrl,
  className,
  isInsideDialog = false,
}: Omit<ClinicQrProps, "isOpen" | "onClose">) {
  const { platformDomain } = usePlatformDomain();
  const [copied, setCopied] = React.useState(false);
  const canvasRef = React.useRef<HTMLDivElement>(null);

  // Standardize path: ensures leading slash
  const cleanPath = React.useMemo(() => {
    if (!pathOrSlug) return "/";
    let p = pathOrSlug.trim();
    if (p.startsWith("http://") || p.startsWith("https://")) {
      try {
        const u = new URL(p);
        p = u.pathname;
      } catch {
        // fallback
      }
    }
    return p.startsWith("/") ? p : `/${p}`;
  }, [pathOrSlug]);

  // Production base URL dynamically resolved from Superadmin config
  const productionBaseUrl = React.useMemo(() => {
    const raw = platformDomain || process.env.NEXT_PUBLIC_PLATFORM_DOMAIN || "doczeno.vercel.app";
    return raw.startsWith("http") ? raw.replace(/\/$/, "") : `https://${raw.replace(/\/$/, "")}`;
  }, [platformDomain]);

  // Computed Active URL encoded into the QR code
  const activeUrl = React.useMemo(() => {
    return `${productionBaseUrl}${cleanPath}`;
  }, [productionBaseUrl, cleanPath]);

  // Center logo image for QR code (high-error-correction)
  const centerLogoSrc = logoUrl || "/logo-icon.png";

  // Handle Copy Link
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(activeUrl);
      setCopied(true);
      toast.success("Website URL copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy URL to clipboard.");
    }
  };

  // Handle Download High-Res PNG (1000px)
  const handleDownload = () => {
    try {
      const container = canvasRef.current;
      const canvas = container?.querySelector("canvas");
      if (!canvas) {
        toast.error("QR Code canvas not ready for export.");
        return;
      }

      // Create a branded print-ready canvas
      const exportCanvas = document.createElement("canvas");
      const ctx = exportCanvas.getContext("2d");
      if (!ctx) return;

      const size = 1000;
      const padding = 80;
      exportCanvas.width = size;
      exportCanvas.height = size + 200; // Extra room for branding banner & text

      // Background
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);

      // Top Header Brand Bar
      ctx.fillStyle = "#0F2E4A";
      ctx.fillRect(0, 0, exportCanvas.width, 16);

      // Title (Doctor / Hospital Name)
      ctx.fillStyle = "#0F2E4A";
      ctx.font = "bold 44px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(title, size / 2, padding + 40);

      // Subtitle
      if (subtitle) {
        ctx.fillStyle = "#00A878";
        ctx.font = "600 28px sans-serif";
        ctx.fillText(subtitle, size / 2, padding + 85);
      }

      // Draw QR Canvas in center
      const qrSize = size - padding * 2;
      ctx.drawImage(canvas, padding, padding + 120, qrSize, qrSize);

      // Footer call to action
      ctx.fillStyle = "#475569";
      ctx.font = "500 24px sans-serif";
      ctx.fillText("Scan with phone camera to book an appointment", size / 2, padding + qrSize + 160);

      // URL display
      ctx.fillStyle = "#0284C7";
      ctx.font = "600 20px monospace";
      ctx.fillText(activeUrl, size / 2, padding + qrSize + 195);

      // Trigger download
      const safeFilename = `${title.toLowerCase().replace(/[^a-z0-9]/g, "-")}-qr-code.png`;
      const dataUrl = exportCanvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = safeFilename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      toast.success("High-Resolution QR Code downloaded successfully!");
    } catch (err) {
      console.error("QR export failed:", err);
      toast.error("Failed to export QR code.");
    }
  };

  return (
    <div
      className={cn(
        isInsideDialog
          ? "space-y-4 pt-1"
          : "bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4",
        className
      )}
    >
      {/* 1. Header */}
      {!isInsideDialog && (
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
          <QrCode className="h-4 w-4 text-[#1a76d1]" />
          <h3 className="font-bold text-sm text-slate-900 tracking-tight">
            Website QR Code & Sharing
          </h3>
        </div>
      )}

      {/* 2. Central QR Code Display Frame */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-5 py-1">
        {/* Printable Standee Preview Frame */}
        <div className="relative bg-white rounded-2xl p-4 border-2 border-slate-100 shadow-xs flex flex-col items-center w-full sm:w-[230px] shrink-0 text-center">
          {/* Top Brand Accent */}
          <div className="h-1.5 w-16 bg-[#1a76d1] rounded-full mb-3" />

          <h4 className="font-bold text-sm text-slate-900 leading-tight truncate max-w-full">
            {title}
          </h4>
          {subtitle && (
            <p className="text-[11px] font-medium text-[#1560aa] truncate max-w-full mt-0.5">
              {subtitle}
            </p>
          )}

          {/* High-Precision SVG QR Code */}
          <div className="my-2.5 p-2 bg-white rounded-xl border border-slate-100 shadow-inner flex items-center justify-center">
            <QRCodeSVG
              value={activeUrl}
              size={160}
              level="H" // 30% error correction allows center logo without scan degradation
              includeMargin={true}
              bgColor="#FFFFFF"
              fgColor="#0F2E4A"
              imageSettings={{
                src: centerLogoSrc,
                height: 38,
                width: 38,
                excavate: true,
              }}
            />
          </div>

          <Badge variant="secondary" className="text-[10px] font-semibold bg-slate-100 text-slate-700 border-slate-200">
            Scan to View &amp; Book
          </Badge>
        </div>

        {/* Hidden Canvas for High-Resolution PNG Generation */}
        <div ref={canvasRef} className="hidden" aria-hidden="true">
          <QRCodeCanvas
            value={activeUrl}
            size={800}
            level="H"
            includeMargin={true}
            bgColor="#FFFFFF"
            fgColor="#0F2E4A"
            imageSettings={{
              src: centerLogoSrc,
              height: 180,
              width: 180,
              excavate: true,
            }}
          />
        </div>

        {/* Action Panel & Details */}
        <div className="flex-1 space-y-3.5 w-full min-w-0">
          <div className="space-y-1.5">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
              Active Scanned Link
            </span>
            <div className="flex items-center gap-2">
              <div className="flex-1 font-mono text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 truncate select-all">
                {activeUrl}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleCopy}
                className="h-8 shrink-0 gap-1.5 text-xs font-semibold"
                title="Copy URL"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-[#1a76d1]" /> : <Copy className="h-3.5 w-3.5" />}
                <span>{copied ? "Copied" : "Copy"}</span>
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
            <Button
              type="button"
              onClick={handleDownload}
              className="w-full bg-[#1a76d1] hover:bg-[#1560aa] text-white h-9 text-xs font-semibold gap-1.5 shadow-sm"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Download PNG (1000px)</span>
            </Button>

            <Button
              asChild
              variant="outline"
              className="w-full h-9 text-xs font-semibold gap-1.5 border-slate-300 hover:bg-slate-50"
            >
              <a href={activeUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3.5 w-3.5 text-slate-500" />
                <span>Open in Browser</span>
              </a>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ClinicQrDialog({
  isOpen = false,
  onClose,
  title,
  subtitle,
  pathOrSlug,
  logoUrl,
}: ClinicQrProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose?.()}>
      <DialogContent className="max-w-2xl sm:max-w-3xl p-6 bg-white border-slate-200 shadow-xl overflow-hidden">
        <DialogHeader className="pb-3 border-b border-slate-100">
          <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-[#1560aa] shrink-0">
              <QrCode className="h-4 w-4" />
            </div>
            <span>Website QR Code &amp; Sharing</span>
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            Export a high-resolution QR code embedded with your clinic logo for printing and digital sharing.
          </DialogDescription>
        </DialogHeader>

        <ClinicQrCard
          title={title}
          subtitle={subtitle}
          pathOrSlug={pathOrSlug}
          logoUrl={logoUrl}
          isInsideDialog={true}
        />
      </DialogContent>
    </Dialog>
  );
}
