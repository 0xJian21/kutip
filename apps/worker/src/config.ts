/** Worker settings from env. Secrets are read here and never logged; the fee payer secret only yields its pubkey. */
import bs58 from "bs58";

export type Config = ReturnType<typeof loadConfig>;

export function loadConfig(env: Record<string, string | undefined> = process.env) {
  const missing: string[] = [];
  const need = (name: string, value: string | undefined) => {
    if (!value) missing.push(name);
    return value ?? "";
  };

  const databaseUrl = need("DATABASE_URL", env.DATABASE_URL);
  const rpcRaw = need("SOLAMI_RPC_URL", env.SOLAMI_RPC_URL);
  const grpcRaw = need("SOLAMI_GRPC_URL", env.SOLAMI_GRPC_URL);
  // The napi gRPC client drops query strings, so a key in the URL moves to the x-token header (Spike C).
  const grpc = grpcRaw ? new URL(grpcRaw) : null;
  const grpcToken = need("SOLAMI_GRPC_KEY or SOLAMI_API_KEY", grpc?.searchParams.get("api_key") ?? env.SOLAMI_GRPC_KEY ?? env.SOLAMI_API_KEY);
  const feePayer = need(
    "FEE_PAYER_PUBKEY or FEE_PAYER_SECRET",
    env.FEE_PAYER_PUBKEY ?? (env.FEE_PAYER_SECRET ? bs58.encode(bs58.decode(env.FEE_PAYER_SECRET).slice(32)) : undefined),
  );
  if (missing.length) throw new Error(`worker config missing: ${missing.join(", ")}`);

  const rpc = new URL(rpcRaw);
  if (!rpc.searchParams.has("api_key") && env.SOLAMI_API_KEY) rpc.searchParams.set("api_key", env.SOLAMI_API_KEY);
  const collections = env.COLLECTIONS ?? "on";
  if (collections !== "on" && collections !== "dry" && collections !== "off") throw new Error(`COLLECTIONS must be on, dry or off (got ${collections})`);

  return {
    databaseUrl,
    rpcUrl: rpc.toString(),
    grpcUrl: grpc!.origin,
    grpcToken,
    usdcMint: env.USDC_MINT ?? "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    feePayer,
    /** Low-balance alert floor (D4). Default 0.01 SOL. */
    feePayerMinLamports: BigInt(env.FEE_PAYER_MIN_LAMPORTS ?? "10000000"),
    anthropicApiKey: env.ANTHROPIC_API_KEY,
    openrouterApiKey: env.OPENROUTER_API_KEY,
    resendApiKey: env.RESEND_API_KEY,
    emailFrom: env.EMAIL_FROM ?? "Kutip <onboarding@resend.dev>",
    /** Only these inboxes (and their +aliases) get mail; "*" = anyone; empty = nobody. */
    emailAllowlist: (env.EMAIL_ALLOWLIST ?? "").split(",").map((a) => a.trim()).filter(Boolean),
    appUrl: env.APP_URL ?? "http://localhost:3000",
    /** on: send reminders; dry: log what would happen (shared demo DB); off. */
    collections: collections as "on" | "dry" | "off",
    port: Number(env.PORT ?? 8080),
  };
}
