/** Two fictional buyers of one exporter, for isolation tests. Shapes follow apps/web/lib/ui/types.ts. */
import type { BuyerRecord, InvoiceRecord, MessageRecord } from "../context";

export const EXPORTER_NAME = "Teratai Woodworks Sdn. Bhd.";

type FullBuyer = BuyerRecord & { email: string; vault: string; multisig: string };
type FullInvoice = InvoiceRecord & { referencePubkey: string; memoCode: string };

export const HARBOURLINE: FullBuyer = {
  id: "b_harbourline",
  name: "Harbourline Interiors Pty Ltd",
  contactName: "Claire Whitmore",
  email: "accounts@harbourline-interiors.example",
  country: "AU",
  timezone: "Australia/Sydney",
  vault: "HbVau1tHarbour1ine11111111111111111111111111",
  multisig: "HbMu1tisigHarbour1ine111111111111111111111111",
};

export const MERIDIAN: FullBuyer = {
  id: "b_meridian",
  name: "Meridian Hospitality Group LLC",
  contactName: "Devon Alvarez",
  email: "ap@meridianhg.example",
  country: "US",
  timezone: "America/Chicago",
  vault: "MeVau1tMeridian111111111111111111111111111111",
  multisig: "MeMu1tisigMeridian1111111111111111111111111111",
};

export const HARBOURLINE_INVOICES: FullInvoice[] = [
  {
    id: "inv_0142",
    buyerId: HARBOURLINE.id,
    number: "INV-2026-0142",
    amountUsdc: 12_480_000_000n,
    dueDate: "2026-09-21",
    status: "overdue",
    lineItems: [{ description: "Teak dining table, 8-seater", quantity: 12, unitPriceUsdc: 1_040_000_000n }],
    payUrl: "https://kutip.my/pay/inv_0142",
    referencePubkey: "RefHarbour1ine0142111111111111111111111111111",
    memoCode: "k_h142",
  },
];

/** Meridian's numbers are deliberately distinctive so a leak is easy to spot in a prompt. */
export const MERIDIAN_INVOICES: FullInvoice[] = [
  {
    id: "inv_0140",
    buyerId: MERIDIAN.id,
    number: "INV-2026-0140",
    amountUsdc: 27_315_000_000n,
    dueDate: "2026-09-24",
    status: "overdue",
    lineItems: [{ description: "Rattan lounge chair, special hotel rate", quantity: 90, unitPriceUsdc: 303_500_000n }],
    payUrl: "https://kutip.my/pay/inv_0140",
    referencePubkey: "RefMeridian0140111111111111111111111111111111",
    memoCode: "k_m140",
  },
];

export const HARBOURLINE_MESSAGES: MessageRecord[] = [
  {
    invoiceId: "inv_0142",
    direction: "out",
    subject: "Invoice INV-2026-0142 is now overdue",
    body: "Hi Claire, invoice INV-2026-0142 for USD 12,480.00 was due on 21 September.",
    createdAt: "2026-09-21T23:00:00Z",
  },
];

export const MERIDIAN_MESSAGES: MessageRecord[] = [
  {
    invoiceId: "inv_0140",
    direction: "in",
    subject: "Re: Invoice INV-2026-0140",
    body: "Scheduled for payment on October 1st. Devon",
    createdAt: "2026-09-25T16:42:00Z",
  },
];

/** Every string that must never reach a prompt built for Harbourline. */
export const MERIDIAN_SECRETS = [
  MERIDIAN.name,
  MERIDIAN.contactName,
  MERIDIAN.email,
  MERIDIAN.vault,
  MERIDIAN_INVOICES[0]!.number,
  "27,315",
  "27315",
  "303.50",
  "special hotel rate",
  "October 1st",
];
