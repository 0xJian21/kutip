import { describe, expect, it } from "vitest";
import { formatUsdc, parseUsdc } from "./money";

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
