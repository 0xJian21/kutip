import { describe, expect, it } from "vitest";
import {
  bpsDiff,
  formatBps,
  formatMyr,
  formatSol,
  formatUnits,
  formatUsdc,
  formatUsdcExact,
  parseUsdc,
  toMyr,
  type BnmRate,
} from "./money";

const rate: BnmRate = { myrPerUsd: 42150n, date: "2026-09-26" };

describe("formatUsdc", () => {
  it("formats whole and fractional amounts with thousands separators", () => {
    expect(formatUsdc(50_000_000n)).toBe("50.00");
    expect(formatUsdc(48_211_400_000n)).toBe("48,211.40");
    expect(formatUsdc(1_234_567_891_234n)).toBe("1,234,567.89");
  });
  it("rounds half-up at the displayed precision", () => {
    expect(formatUsdc(1_005_000n)).toBe("1.01");
    expect(formatUsdc(1_004_999n)).toBe("1.00");
  });
  it("handles zero and sub-cent amounts", () => {
    expect(formatUsdc(0n)).toBe("0.00");
    expect(formatUsdc(1n)).toBe("0.00");
    expect(formatUsdcExact(1n)).toBe("0.000001");
    expect(formatUsdcExact(50_000_000n)).toBe("50.000000");
  });
  it("formats negatives with a true minus sign", () => {
    expect(formatUsdc(-2_500_000n)).toBe("−2.50");
  });
});

describe("toMyr", () => {
  it("converts USDC base units to sen at a 4dp rate", () => {
    // 50 USD × 4.2150 = 210.75 MYR
    expect(toMyr(50_000_000n, rate)).toBe(21_075n);
  });
  it("rounds half-up to the sen", () => {
    // 1 USDC base unit × 4.2150 = 0.0000042150 MYR → 0 sen
    expect(toMyr(1n, rate)).toBe(0n);
    // 0.001186 USD × 4.2150 = 0.004999 MYR → 0 sen ; 0.001187 → 0.0050 → 1 sen
    expect(toMyr(1_186n, rate)).toBe(0n);
    expect(toMyr(1_187n, rate)).toBe(1n);
  });
  it("never loses precision on large invoices", () => {
    // 11,437.50 USD × 4.2150 = 48,209.0625 → 48,209.06
    expect(formatMyr(toMyr(11_437_500_000n, rate))).toBe("RM48,209.06");
  });
});

describe("formatMyr / formatSol / formatUnits", () => {
  it("prefixes RM and groups thousands", () => {
    expect(formatMyr(21_075n)).toBe("RM210.75");
    expect(formatMyr(4_821_140n)).toBe("RM48,211.40");
    expect(formatMyr(4_821_140n, { symbol: false })).toBe("48,211.40");
  });
  it("formats lamports as SOL", () => {
    expect(formatSol(283_100_000n)).toBe("0.2831");
    expect(formatSol(1_000_000_000n, 2)).toBe("1.00");
  });
  it("refuses more fraction digits than the unit has", () => {
    expect(() => formatUnits(1n, 2, 3)).toThrow();
  });
});

describe("bpsDiff / formatBps", () => {
  it("expresses actual vs quoted in basis points", () => {
    expect(bpsDiff(50_060_000n, 50_000_000n)).toBe(12n);
    expect(bpsDiff(49_975_000n, 50_000_000n)).toBe(-5n);
    expect(bpsDiff(1n, 0n)).toBe(0n);
  });
  it("formats with sign and two decimals", () => {
    expect(formatBps(12n)).toBe("+0.12%");
    expect(formatBps(-5n)).toBe("−0.05%");
    expect(formatBps(0n)).toBe("+0.00%");
    expect(formatBps(150n)).toBe("+1.50%");
  });
});

describe("parseUsdc", () => {
  it("parses user input into base units", () => {
    expect(parseUsdc("50")).toBe(50_000_000n);
    expect(parseUsdc("48,211.40")).toBe(48_211_400_000n);
    expect(parseUsdc("0.000001")).toBe(1n);
  });
  it("rejects junk and over-precise input", () => {
    expect(parseUsdc("abc")).toBeNull();
    expect(parseUsdc("1.2345678")).toBeNull();
    expect(parseUsdc("-5")).toBeNull();
  });
});
