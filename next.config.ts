import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Static export for clean Cloudflare Pages deployment without Vercel-specific dependencies
  output: "export",
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
