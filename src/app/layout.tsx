import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { AuthProvider } from "@/lib/supabase/AuthProvider";
import { HAProvider } from "@/lib/ha/HAProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Almvägen Family Hub",
  description:
    "Smart hem-hubb för belysning, klimat, energi och elbilsladdning.",
};

export const viewport: Viewport = {
  themeColor: "#0B0F17",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="sv" className="dark">
      <body className="min-h-screen bg-[#0B0F17] text-slate-100 antialiased selection:bg-[#38BDF8]/30">
        <AuthProvider>
          <HAProvider>{children}</HAProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
