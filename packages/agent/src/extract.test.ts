import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { extractInvoice } from "./extract";
import { fakeAnthropic } from "./testing/fake-anthropic";

const pdf = readFileSync(new URL("../fixtures/invoices/harbourline-inv-0151.pdf", import.meta.url));

const harbourline = {
  buyerName: "Harbourline Interiors Pty Ltd",
  invoiceNumber: "INV-2026-0151",
  currency: "USD",
  issueDate: "2026-09-27",
  dueDate: "2026-10-27",
  paymentTermsDays: 30,
  lineItems: [
    { description: "Teak dining table, 8-seater", quantity: "12", unitPrice: "1,040.00", amount: "12,480.00" },
    { description: "Teak dining chair, woven seat", quantity: "24", unitPrice: "185.50", amount: "4,452.00" },
  ],
  total: "16,932.00",
};

describe("extractInvoice", () => {
  it("sends the PDF as a document block and parses amounts to base units in code", async () => {
    const { client, requests } = fakeAnthropic(() => ({ output: harbourline }));
    const inv = await extractInvoice(client, pdf);

    const doc = requests[0].messages[0].content[0];
    expect(doc).toMatchObject({ type: "document", source: { type: "base64", media_type: "application/pdf" } });
    expect(doc.source.data).toBe(pdf.toString("base64"));

    expect(inv).toMatchObject({
      buyerName: "Harbourline Interiors Pty Ltd",
      invoiceNumber: "INV-2026-0151",
      currency: "USD",
      issueDate: "2026-09-27",
      dueDate: "2026-10-27",
      totalUsdc: 16_932_000_000n,
      warnings: [],
    });
    expect(inv.lineItems).toEqual([
      { description: "Teak dining table, 8-seater", quantity: 12, unitPriceUsdc: 1_040_000_000n },
      { description: "Teak dining chair, woven seat", quantity: 24, unitPriceUsdc: 185_500_000n },
    ]);
    expect(inv.decision).toMatchObject({ allowed: true, ruleId: "I1" });
  });

  it("computes the due date from Net terms in code when none is printed", async () => {
    const { client } = fakeAnthropic(() => ({ output: { ...harbourline, issueDate: "2026-09-20", dueDate: null, paymentTermsDays: 30 } }));
    expect((await extractInvoice(client, pdf)).dueDate).toBe("2026-10-20");
  });

  it("flags a total that does not match the line items", async () => {
    const { client } = fakeAnthropic(() => ({ output: { ...harbourline, total: "16,923.00" } }));
    const inv = await extractInvoice(client, pdf);
    expect(inv.warnings.join(" ")).toMatch(/total/i);
    expect(inv.decision).toMatchObject({ allowed: false, ruleId: "I1" });
  });

  it("flags a line whose amount is not quantity × unit price", async () => {
    const lines = [{ ...harbourline.lineItems[0]!, amount: "12,840.00" }, harbourline.lineItems[1]!];
    const { client } = fakeAnthropic(() => ({ output: { ...harbourline, lineItems: lines } }));
    expect((await extractInvoice(client, pdf)).warnings.join(" ")).toMatch(/Teak dining table/);
  });

  it("drops zero-value lines such as free freight", async () => {
    const lines = [...harbourline.lineItems, { description: "Freight (FOB Port Klang)", quantity: "1", unitPrice: "0.00", amount: "0.00" }];
    const { client } = fakeAnthropic(() => ({ output: { ...harbourline, lineItems: lines } }));
    expect((await extractInvoice(client, pdf)).lineItems).toHaveLength(2);
  });

  it("flags a non-USD invoice", async () => {
    const { client } = fakeAnthropic(() => ({ output: { ...harbourline, currency: "MYR" } }));
    const inv = await extractInvoice(client, pdf);
    expect(inv.decision.allowed).toBe(false);
    expect(inv.warnings.join(" ")).toMatch(/USD/);
  });

  it("flags a missing due date and terms", async () => {
    const { client } = fakeAnthropic(() => ({ output: { ...harbourline, dueDate: null, paymentTermsDays: null } }));
    const inv = await extractInvoice(client, pdf);
    expect(inv.dueDate).toBeNull();
    expect(inv.decision.allowed).toBe(false);
  });

  it("refuses to guess an unreadable amount", async () => {
    const { client } = fakeAnthropic(() => ({ output: { ...harbourline, total: "about sixteen thousand" } }));
    await expect(extractInvoice(client, pdf)).rejects.toThrow(/USD amount/);
  });
});
