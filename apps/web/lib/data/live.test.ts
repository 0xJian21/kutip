import { describe, expect, it, vi } from "vitest";
import { guard } from "./live";

describe("guard (Broadcast payloads are untrusted)", () => {
  it("a handler that throws on a malformed payload is contained and logged", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const h = guard(() => {
      BigInt(undefined as never);
    });
    expect(() => h("invoice", {})).not.toThrow();
    expect(warn).toHaveBeenCalled();
  });
  it("passes events through otherwise", () => {
    const seen: string[] = [];
    guard((e) => seen.push(e))("payment", {});
    expect(seen).toEqual(["payment"]);
  });
});
