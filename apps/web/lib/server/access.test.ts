import { describe, expect, it } from "vitest";
import { DEFAULT_RULEBOOK } from "@kutip/agent";
import { assertApprover, safeNext, validateRulebook } from "./access";

describe("assertApprover (C1)", () => {
  it("only the signed-in owner's own wallet may get a co-signed approval", () => {
    expect(() => assertApprover("Wallet1", "Wallet1")).not.toThrow();
    expect(() => assertApprover("Attacker", "Wallet1")).toThrow(/signed-in wallet/);
    expect(() => assertApprover("Wallet1", undefined)).toThrow(/signed-in wallet/);
  });
});

describe("validateRulebook (I3)", () => {
  it("accepts a valid rulebook and strips unknown keys", () => {
    const out = validateRulebook({ ...DEFAULT_RULEBOOK, extra: 1 } as never);
    expect(out).toEqual(DEFAULT_RULEBOOK);
  });
  it("rejects a float limit and out-of-range values instead of storing them", () => {
    expect(() => validateRulebook({ ...DEFAULT_RULEBOOK, treasury: { ...DEFAULT_RULEBOOK.treasury, agentDailyLimitUsdc: 1.5 as never } })).toThrow();
    expect(() => validateRulebook({ ...DEFAULT_RULEBOOK, collections: { ...DEFAULT_RULEBOOK.collections, maxDiscountPctWithoutApproval: 100 } })).toThrow();
  });
  it("USDC must stay accepted", () => {
    expect(() => validateRulebook({ ...DEFAULT_RULEBOOK, treasury: { ...DEFAULT_RULEBOOK.treasury, acceptedTokens: ["SOL"] } })).toThrow(/USDC/);
  });
});

describe("safeNext (M2)", () => {
  it("keeps same-origin paths and drops anything that could leave the site", () => {
    expect(safeNext("/dashboard")).toBe("/dashboard");
    expect(safeNext("/invoices/inv_1?x=1")).toBe("/invoices/inv_1?x=1");
    for (const bad of ["//evil.com", "/\\evil.com", "https://evil.com", "evil.com", "/%5Cevil.com", undefined, ["/a"]]) {
      expect(safeNext(bad as never)).toBeUndefined();
    }
  });
});
