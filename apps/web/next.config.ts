import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The browser joins Realtime Broadcast topics with the public anon key (no table access).
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.SUPABASE_URL ?? "",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY ?? "",
  },
  experimental: {
    // Invoice PDFs go to the extractInvoice server action.
    serverActions: { bodySizeLimit: "10mb" },
  },
};

export default nextConfig;
