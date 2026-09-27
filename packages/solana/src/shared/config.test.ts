import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";
import { describe, expect, test } from "vitest";
import { paymentsConfigFromEnv } from "./config";

const secret = bs58.encode(Keypair.generate().secretKey);
const base = { SOLAMI_RPC_URL: "https://rpc.test", FEE_PAYER_SECRET: secret, APP_URL: "https://kutip.test/" };

describe("paymentsConfigFromEnv", () => {
  test("PAYMENTS_SOL_ENABLED defaults to true and accepts false/0/off", () => {
    expect(paymentsConfigFromEnv(base).solEnabled).toBe(true);
    expect(paymentsConfigFromEnv({ ...base, PAYMENTS_SOL_ENABLED: "false" }).solEnabled).toBe(false);
    expect(paymentsConfigFromEnv({ ...base, PAYMENTS_SOL_ENABLED: "0" }).solEnabled).toBe(false);
    expect(paymentsConfigFromEnv({ ...base, PAYMENTS_SOL_ENABLED: "true" }).solEnabled).toBe(true);
  });
  test("throws on a missing fee payer secret and strips the trailing slash from APP_URL", () => {
    expect(() => paymentsConfigFromEnv({ SOLAMI_RPC_URL: "x" })).toThrow(/FEE_PAYER_SECRET/);
    expect(paymentsConfigFromEnv(base).appUrl).toBe("https://kutip.test");
  });
});
