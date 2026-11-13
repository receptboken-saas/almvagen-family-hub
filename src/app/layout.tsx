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
    "Smart hem-hubb för belysning, klimat, energi och elbilsladdning.",
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
