import bs58 from "bs58";
import { expect, test } from "vitest";
import { loadConfig } from "./config";

// A 64-byte "secret key" whose last 32 bytes are the public key (Solana keypair layout).
const pub = new Uint8Array(32).fill(7);
const secret = bs58.encode(Uint8Array.from([...new Uint8Array(32).fill(1), ...pub]));
const base = { DATABASE_URL: "postgres://x", SOLAMI_RPC_URL: "https://rpc.solami.dev/sol", SOLAMI_API_KEY: "k1", SOLAMI_GRPC_URL: "https://grpc.solami.dev" };

test("defaults: gRPC key as x-token, RPC key as api_key, fee payer from its secret, collections on", () => {
  const c = loadConfig({ ...base, FEE_PAYER_SECRET: secret });
  expect(c).toMatchObject({
    grpcUrl: "https://grpc.solami.dev",
    grpcToken: "k1",
    rpcUrl: "https://rpc.solami.dev/sol?api_key=k1",
    usdcMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    feePayer: bs58.encode(pub),
    feePayerMinLamports: 10_000_000n,
    collections: "on",
    emailFrom: "Kutip <onboarding@resend.dev>",
    port: 8080,
  });
  expect(JSON.stringify(c, (_k, v) => (typeof v === "bigint" ? String(v) : v))).not.toContain(secret);
});

test("an api_key in the gRPC URL becomes the x-token (the napi client drops query strings)", () => {
  expect(loadConfig({ ...base, SOLAMI_GRPC_URL: "https://grpc.solami.dev?api_key=g2", FEE_PAYER_PUBKEY: "Fee1" })).toMatchObject({ grpcUrl: "https://grpc.solami.dev", grpcToken: "g2", feePayer: "Fee1" });
});

test("SOLAMI_GRPC_KEY wins over SOLAMI_API_KEY; an api_key already on the RPC URL is kept", () => {
  const c = loadConfig({ ...base, SOLAMI_GRPC_KEY: "g3", SOLAMI_RPC_URL: "https://rpc.solami.dev/sol?api_key=r9", FEE_PAYER_PUBKEY: "Fee1" });
  expect(c).toMatchObject({ grpcToken: "g3", rpcUrl: "https://rpc.solami.dev/sol?api_key=r9" });
});

test("missing required settings fail fast, naming them", () => {
  expect(() => loadConfig({})).toThrow(/DATABASE_URL, SOLAMI_RPC_URL, SOLAMI_GRPC_URL, SOLAMI_GRPC_KEY or SOLAMI_API_KEY, FEE_PAYER_PUBKEY or FEE_PAYER_SECRET/);
  expect(() => loadConfig({ ...base, FEE_PAYER_PUBKEY: "F", COLLECTIONS: "maybe" })).toThrow(/COLLECTIONS/);
});
