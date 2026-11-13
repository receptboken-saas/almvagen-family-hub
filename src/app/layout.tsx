import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Fraunces, Plus_Jakarta_Sans } from "next/font/google";
import { AuthProvider } from "@/lib/supabase/AuthProvider";
import { HAProvider } from "@/lib/ha/HAProvider";
import { ThemeProvider } from "@/components/ui/ThemeProvider";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
});

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Almvägen Family Hub",
  description:
    "Smart hem-hubb för belysning, klimat, energi och familjens anslagstavla.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Almvägen",
  },
};

export const viewport: Viewport = {
  themeColor: "#F6F2EC",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="sv"
      data-theme="light"
      className={`${fraunces.variable} ${plusJakarta.variable}`}
    >
      <body className="min-h-screen antialiased selection:bg-[#6B8E6B]/25">
        <ThemeProvider>
          <AuthProvider>
            <HAProvider>{children}</HAProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
