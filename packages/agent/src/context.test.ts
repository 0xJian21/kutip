import { describe, expect, it } from "vitest";
import { buildBuyerContext, renderBuyerContext, type BuyerContext } from "./context";
import { EXPORTER_NAME, HARBOURLINE, HARBOURLINE_INVOICES, HARBOURLINE_MESSAGES, MERIDIAN, MERIDIAN_INVOICES, MERIDIAN_MESSAGES } from "./testing/buyers";

const build = () =>
  buildBuyerContext({ exporterName: EXPORTER_NAME, buyer: HARBOURLINE, invoices: HARBOURLINE_INVOICES, messages: HARBOURLINE_MESSAGES });

describe("buildBuyerContext", () => {
  it("builds from one buyer's data", () => {
    const ctx = build();
    expect(ctx.buyer.id).toBe(HARBOURLINE.id);
    expect(ctx.invoices.map((i) => i.number)).toEqual(HARBOURLINE_INVOICES.map((i) => i.number));
  });

  it("refuses an invoice that belongs to another buyer", () => {
    expect(() =>
      buildBuyerContext({ exporterName: EXPORTER_NAME, buyer: HARBOURLINE, invoices: [...HARBOURLINE_INVOICES, MERIDIAN_INVOICES[0]!], messages: [] }),
    ).toThrow(/another buyer/);
  });

  it("refuses a message about an invoice outside the context", () => {
    expect(() =>
      buildBuyerContext({ exporterName: EXPORTER_NAME, buyer: HARBOURLINE, invoices: HARBOURLINE_INVOICES, messages: [MERIDIAN_MESSAGES[0]!] }),
    ).toThrow(/outside/);
  });

  it("keeps only whitelisted fields (no on-chain addresses, no emails)", () => {
    const text = JSON.stringify(build(), (_k, v) => (typeof v === "bigint" ? v.toString() : v));
    expect(text).not.toContain(HARBOURLINE.email);
    expect(text).not.toContain(HARBOURLINE.vault);
    expect(text).not.toContain(HARBOURLINE_INVOICES[0]!.referencePubkey);
  });

  it("is frozen", () => {
    const ctx = build();
    expect(() => (ctx.invoices as unknown as unknown[]).push({})).toThrow();
  });

  it("cannot be faked with an object literal", () => {
    // @ts-expect-error BuyerContext is branded; only buildBuyerContext makes one
    const fake: BuyerContext = { buyer: MERIDIAN, exporterName: EXPORTER_NAME, invoices: [], messages: [] };
    expect(() => renderBuyerContext(fake)).toThrow(/buildBuyerContext/);
  });
});

describe("renderBuyerContext", () => {
  it("states amounts formatted by code and the buyer's own invoices only", () => {
    const text = renderBuyerContext(build());
    expect(text).toContain("INV-2026-0142");
    expect(text).toContain("USD 12,480.00");
    expect(text).not.toContain(MERIDIAN.name);
  });
});
