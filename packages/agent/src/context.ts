/**
 * Privacy L4 (SPEC §5): every buyer-facing LLM call takes a BuyerContext, and a BuyerContext can only
 * be built from ONE buyer's rows. The builder copies whitelisted fields, so on-chain addresses,
 * emails and other buyers' data cannot reach a prompt through it.
 */
import { formatUsdc } from "./money";
import type { InvoiceStatus } from "./rules/decision";

export type BuyerRecord = { id: string; name: string; contactName: string; country: string; timezone: string };
export type InvoiceRecord = {
  id: string;
  buyerId: string;
  number: string;
  amountUsdc: bigint;
  dueDate: string;
  status: InvoiceStatus;
  lineItems: Array<{ description: string; quantity: number; unitPriceUsdc: bigint }>;
  payUrl: string;
};
export type MessageRecord = { invoiceId: string; direction: "out" | "in"; subject: string; body: string; createdAt: string };

declare const brand: unique symbol;

export type BuyerContext = {
  readonly [brand]: true;
  readonly exporterName: string;
  readonly buyer: Readonly<BuyerRecord>;
  readonly invoices: ReadonlyArray<Readonly<InvoiceRecord>>;
  readonly messages: ReadonlyArray<Readonly<MessageRecord>>;
};

const built = new WeakSet<object>();

export function buildBuyerContext(src: {
  exporterName: string;
  buyer: BuyerRecord;
  invoices: InvoiceRecord[];
  messages: MessageRecord[];
}): BuyerContext {
  const { buyer } = src;
  for (const inv of src.invoices) {
    if (inv.buyerId !== buyer.id) throw new Error(`Invoice ${inv.id} belongs to another buyer`);
  }
  const invoiceIds = new Set(src.invoices.map((i) => i.id));
  for (const msg of src.messages) {
    if (!invoiceIds.has(msg.invoiceId)) throw new Error(`Message about invoice ${msg.invoiceId} is outside this buyer's context`);
  }

  const ctx = deepFreeze({
    exporterName: src.exporterName,
    buyer: { id: buyer.id, name: buyer.name, contactName: buyer.contactName, country: buyer.country, timezone: buyer.timezone },
    invoices: src.invoices.map((i) => ({
      id: i.id,
      buyerId: i.buyerId,
      number: i.number,
      amountUsdc: i.amountUsdc,
      dueDate: i.dueDate,
      status: i.status,
      lineItems: i.lineItems.map((l) => ({ description: l.description, quantity: l.quantity, unitPriceUsdc: l.unitPriceUsdc })),
      payUrl: i.payUrl,
    })),
    messages: src.messages.map((m) => ({ invoiceId: m.invoiceId, direction: m.direction, subject: m.subject, body: m.body, createdAt: m.createdAt })),
  });
  built.add(ctx);
  return ctx as unknown as BuyerContext;
}

export function assertBuyerContext(ctx: BuyerContext): void {
  if (!built.has(ctx)) throw new Error("BuyerContext must come from buildBuyerContext");
}

export function invoiceIn(ctx: BuyerContext, invoiceId: string): Readonly<InvoiceRecord> {
  const inv = ctx.invoices.find((i) => i.id === invoiceId);
  if (!inv) throw new Error(`Invoice ${invoiceId} is not in this buyer's context`);
  return inv;
}

/** The only text about the buyer's account that goes into a prompt. Amounts are formatted here, in code. */
export function renderBuyerContext(ctx: BuyerContext): string {
  assertBuyerContext(ctx);
  const lines = [
    `Seller: ${ctx.exporterName}`,
    `Buyer: ${ctx.buyer.name} (contact: ${ctx.buyer.contactName}, country: ${ctx.buyer.country})`,
    "Invoices:",
    ...ctx.invoices.map(
      (i) =>
        `- ${i.number}: ${formatUsdc(i.amountUsdc)}, due ${i.dueDate}, status ${i.status}; ` +
        i.lineItems.map((l) => `${l.quantity} × ${l.description} at ${formatUsdc(l.unitPriceUsdc)}`).join("; "),
    ),
  ];
  if (ctx.messages.length) {
    lines.push("Recent messages (oldest first):");
    for (const m of [...ctx.messages].sort((a, b) => a.createdAt.localeCompare(b.createdAt)).slice(-6)) {
      lines.push(`- ${m.createdAt} ${m.direction === "out" ? "seller → buyer" : "buyer → seller"}: ${m.subject} | ${m.body}`);
    }
  }
  return lines.join("\n");
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object") {
    for (const v of Object.values(value)) deepFreeze(v);
    Object.freeze(value);
  }
  return value;
}
