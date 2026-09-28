import { describe, expect, it } from "vitest";
import { sessionFor } from "./access";

describe("sessionFor: the session wallet is the exporter's registered owner wallet, or nothing", () => {
  const owner = { userId: "usr_1", exporterId: "exp_1", role: "owner" as const, walletPubkey: "Owner111" };
  it("binds the owner's registered wallet when Privy holds it", () => {
    expect(sessionFor({ user: owner, privyUserId: "did:privy:a", wallets: ["Other222", "Owner111"] })).toEqual({ exporterId: "exp_1", privyUserId: "did:privy:a", role: "owner", wallet: "Owner111" });
  });
  it("drops the wallet when the Privy account does not hold the registered owner key", () => {
    expect(sessionFor({ user: owner, privyUserId: "did:privy:a", wallets: ["Other222"] })).toEqual({ exporterId: "exp_1", privyUserId: "did:privy:a", role: "owner" });
  });
  it("never gives an admin or a demo-fallback session a wallet", () => {
    expect(sessionFor({ user: { ...owner, role: "admin", walletPubkey: "Admin333" }, privyUserId: "did:privy:b", wallets: ["Admin333"] })).toEqual({ exporterId: "exp_1", privyUserId: "did:privy:b", role: "admin" });
    expect(sessionFor({ user: null, demoExporterId: "exp_demo", privyUserId: "did:privy:c", wallets: ["Stranger444"] })).toEqual({ exporterId: "exp_demo", privyUserId: "did:privy:c", role: "demo" });
  });
});
