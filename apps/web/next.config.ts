import type { NextConfig } from "next";

// Live updates quietly stop when these are missing from the build (FOLLOWUPS): say so loudly.
for (const name of ["SUPABASE_URL", "SUPABASE_ANON_KEY"]) {
  if (!process.env[name]) console.warn(`[next.config] ${name} is not set: Realtime Broadcast (live Seen/Paid/Settled) will be off in this build`);
}

const nextConfig: NextConfig = {
  // `next dev` behind a cloudflared quick tunnel (phone rehearsals).
  allowedDevOrigins: ["*.trycloudflare.com"],
  // The browser joins Realtime Broadcast topics with the public anon key (no table access).
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.SUPABASE_URL ?? "",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY ?? "",
  },
  experimental: {
    // Invoice PDFs (≤ 4 MB) and logos (≤ 512 KB) go through server actions; Vercel caps bodies at 4.5 MB anyway.
    serverActions: { bodySizeLimit: "4mb" },
  },
};

export default nextConfig;
