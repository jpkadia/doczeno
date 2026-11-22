import type { Metadata } from "next";
import { Toaster } from "@/components/ui/sonner";
import { BackendWarmup } from "@/components/common/backend-warmup";
import "./globals.css";

export const metadata: Metadata = {
  title: "Doczeno — Modern Healthcare Websites for Doctors & Hospitals",
  description: "Professional website platform for doctors, clinics, and hospitals.",
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/icon-round.png", type: "image/png" },
      { url: "/favicon.ico", sizes: "any" },
    ],
    shortcut: "/favicon.svg",
    apple: "/icon-round.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-background font-sans antialiased text-foreground">
        <BackendWarmup />
        {children}
        <Toaster />
      </body>
    </html>
  );
}
