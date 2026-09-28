import { describe, expect, it } from "vitest";
import { formatUsdc, myrSenToUsdc, parseMoneyText, parseUsdc, usdcToMyrSen } from "./money";

describe("parseUsdc", () => {
  it.each([
    ["33,750.00", 33_750_000_000n],
    ["USD 1,234.5", 1_234_500_000n],
    ["$50", 50_000_000n],
    ["0.000001", 1n],
    ["8760.00 USD", 8_760_000_000n],
  ])("%s", (text, units) => expect(parseUsdc(text)).toBe(units));

  it.each(["", "abc", "-5.00", "1.0000001", "1,23,4.00", "12.34.56"])("rejects %j", (text) => {
    expect(() => parseUsdc(text)).toThrow();
  });
});

describe("formatUsdc", () => {
  it.each([
    [8_760_000_000n, "USD 8,760.00"],
    [50_000_000n, "USD 50.00"],
    [1_234_567n, "USD 1.234567"],
    [0n, "USD 0.00"],
  ])("%s", (units, text) => expect(formatUsdc(units)).toBe(text));
});

describe("owner-typed amounts (command bar)", () => {
  it.each([
    ["RM 10k", { currency: "MYR", units: 1_000_000n }],
    ["rm10,000", { currency: "MYR", units: 1_000_000n }],
    ["10000 ringgit", { currency: "MYR", units: 1_000_000n }],
    ["RM 2.5m", { currency: "MYR", units: 250_000_000n }],
    ["RM 1,234.56", { currency: "MYR", units: 123_456n }],
    ["USD 500", { currency: "USD", units: 500_000_000n }],
    ["$1.5k", { currency: "USD", units: 1_500_000_000n }],
    ["250 USDC", { currency: "USD", units: 250_000_000n }],
  ])("%s", (text, want) => {
    expect(parseMoneyText(text)).toEqual(want);
  });

  it("returns null for anything unclear", () => {
    for (const t of ["", "a lot", "RM", "10k", "RM -5", "RM 1.234"]) expect(parseMoneyText(t)).toBeNull();
  });

  it("converts with the BNM rate in integers (4 implied decimals)", () => {
    // RM 10,000 at 4.2150 → USD 2,372.479240… → floor to base units
    expect(myrSenToUsdc(1_000_000n, 42150n)).toBe(2_372_479_240n);
    expect(usdcToMyrSen(1_000_000_000n, 42150n)).toBe(421_500n);
  });
});
