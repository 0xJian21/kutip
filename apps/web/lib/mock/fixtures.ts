/**
 * Fictional data for the UI shell. Every company, person, address and
 * signature here is invented. Addresses are base58-shaped strings, not real
 * accounts; Solscan links built from them will not resolve.
 */
import type { BnmRate } from "@/lib/ui/money";
import type { AgentAction, Buyer, Exporter, Invoice, Message, Payment, Rulebook, Sweep } from "@/lib/ui/types";

const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

/** Deterministic base58-looking string. Not a real key. */
export function fakeKey(seed: string, length = 44): string {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  let out = "";
  for (let i = 0; out.length < length; i++) {
    h ^= i + 1;
    h = Math.imul(h, 16777619) >>> 0;
    out += B58[(h >>> 8) % B58.length];
  }
  return out;
}

export const APP_ORIGIN = "https://kutip.my";

export const RATE: BnmRate = { myrPerUsd: 42150n, date: "2026-09-26" };
export const RATE_30D_AVG: BnmRate = { myrPerUsd: 41930n, date: "2026-09-26" };

export const RULEBOOK: Rulebook = {
  collections: {
    firstReminderDaysBeforeDue: 3,
    maxMessagesPer48h: 1,
    quietHoursStart: 18,
    quietHoursEnd: 9,
    maxDiscountPctWithoutApproval: 2,
    escalateAfterOverdueReminders: 2,
    escalateOnDispute: true,
  },
  treasury: {
    acceptedTokens: ["USDC", "SOL", "USDT"],
    sweepDaily: true,
    sweepRandomised: true,
    agentDailyLimitUsdc: 5_000_000_000n,
    otherMovementsNeedApproval: true,
    cashOutAlertMarginBps: 50n,
  },
  replies: { remindersAndReceipts: "automatic", buyerReplies: "draft" },
};

export const EXPORTER: Exporter = {
  id: "exp_teratai",
  name: "Teratai Woodworks Sdn. Bhd.",
  registrationNo: "202001034567 (1391234-K)",
  city: "Muar, Johor",
  address: "Lot 2188, Jalan Bakri, 84000 Muar, Johor, Malaysia",
  contactEmail: "accounts@teratai.example",
  // The demo exporter's Squads accounts are real mainnet accounts holding test-sized balances.
  demoFunds: true,
  ownerName: "Farid Zulkifli",
  adminName: "Tan Mei Ling",
  treasuryMultisig: fakeKey("treasury-multisig"),
  treasuryVault: fakeKey("treasury-vault"),
  treasuryUsdcAta: fakeKey("treasury-usdc-ata"),
  rulebook: RULEBOOK,
};

function buyer(id: string, b: Omit<Buyer, "id" | "multisig" | "vault" | "usdcAta">): Buyer {
  return { id, ...b, multisig: fakeKey(`${id}-multisig`), vault: fakeKey(`${id}-vault`), usdcAta: fakeKey(`${id}-ata`) };
}

export const BUYERS: Buyer[] = [
  buyer("b_harbourline", {
    name: "Harbourline Interiors Pty Ltd",
    contactName: "Claire Whitmore",
    email: "accounts@harbourline-interiors.example",
    country: "AU",
    countryName: "Australia",
    city: "Sydney",
    address: "Level 3, 48 Pirrama Road, Pyrmont NSW 2009, Australia",
    timezone: "Australia/Sydney",
  }),
  buyer("b_meridian", {
    name: "Meridian Hospitality Group LLC",
    contactName: "Devon Alvarez",
    email: "ap@meridianhg.example",
    country: "US",
    countryName: "United States",
    city: "Austin, Texas",
    address: "2100 S Lamar Blvd, Austin, TX 78704, United States",
    timezone: "America/Chicago",
  }),
  buyer("b_alrashid", {
    name: "Al Rashid Furnishing LLC",
    contactName: "Omar Al Rashid",
    email: "finance@alrashidfurnishing.example",
    country: "AE",
    countryName: "United Arab Emirates",
    city: "Dubai",
    address: "Warehouse 14, Al Quoz Industrial Area 3, Dubai, UAE",
    timezone: "Asia/Dubai",
  }),
  buyer("b_najd", {
    name: "Najd Contract Interiors Co.",
    contactName: "Hessa Al Qahtani",
    email: "payables@najdcontract.example",
    country: "SA",
    countryName: "Saudi Arabia",
    city: "Riyadh",
    address: "King Fahd Road, Al Olaya, Riyadh 12211, Saudi Arabia",
    timezone: "Asia/Riyadh",
  }),
  buyer("b_kobayashi", {
    name: "Kobayashi Living Co., Ltd.",
    contactName: "Yuki Kobayashi",
    email: "keiri@kobayashi-living.example",
    country: "JP",
    countryName: "Japan",
    city: "Osaka",
    address: "1-2-3 Umeda, Kita-ku, Osaka 530-0001, Japan",
    timezone: "Asia/Tokyo",
  }),
];

type InvoiceSeed = {
  id: string;
  n: number;
  buyerId: string;
  items: Array<[string, number, bigint]>;
  issued: string;
  due: string;
  status: Invoice["status"];
  received?: bigint;
  sentAt?: string;
  seenAt?: string;
  paidAt?: string;
  settledAt?: string;
};

function inv(s: InvoiceSeed): Invoice {
  const lineItems = s.items.map(([description, quantity, unitPriceUsdc]) => ({ description, quantity, unitPriceUsdc }));
  const amountUsdc = lineItems.reduce((sum, li) => sum + li.unitPriceUsdc * BigInt(li.quantity), 0n);
  const number = `INV-2026-${String(s.n).padStart(4, "0")}`;
  return {
    id: s.id,
    buyerId: s.buyerId,
    number,
    lineItems,
    amountUsdc,
    receivedUsdc: s.received ?? (s.status === "settled" || s.status === "paid" ? amountUsdc : 0n),
    issuedAt: s.issued,
    dueDate: s.due,
    status: s.status,
    referencePubkey: fakeKey(`${s.id}-reference`),
    memoCode: `k_${fakeKey(`${s.id}-memo`, 6).toLowerCase()}`,
    createdAt: `${s.issued}T01:30:00Z`,
    sentAt: s.sentAt ?? (s.status === "draft" ? undefined : `${s.issued}T02:05:00Z`),
    seenAt: s.seenAt,
    paidAt: s.paidAt,
    settledAt: s.settledAt,
    payUrl: `${APP_ORIGIN}/pay/${s.id}`,
    x402Url: `${APP_ORIGIN}/api/x402/invoice/${s.id}`,
  };
}

const U = (n: number) => BigInt(Math.round(n * 100)) * 10_000n; // USD (2dp) → base units, integer arithmetic on cents

/**
 * Paid history for the charts (IMPROVEMENTS "demo data"): four settled invoices a month,
 * April to August, numbered before the September story (INV-0128 onwards).
 */
const HISTORY_PRODUCTS: Array<Array<[string, number, bigint]>> = [
  [["Teak dining table 240cm", 6, U(1450)], ["Teak dining chair", 36, U(140)]],
  [["Rubberwood bed frame, queen", 15, U(392.5)]],
  [["Oak sideboard 180cm", 8, U(980)], ["Oak coffee table", 12, U(220)]],
  [["Hotel guest room desk", 40, U(310)]],
  [["Majlis seating set, walnut", 4, U(2600)]],
  [["Outdoor teak lounger", 24, U(210)]],
  [["Executive desk, walnut veneer", 10, U(1900)]],
  [["Lobby armchair", 20, U(370)]],
  [["Conference table 4.8m", 2, U(3300)]],
  [["Teak bench", 30, U(366)]],
  [["Oak dining chair", 48, U(146)]],
  [["Reception counter, custom", 1, U(9750)]],
  [["Bookshelf 220cm, walnut", 18, U(510)]],
  [["Bar stool", 40, U(140)]],
  [["Teak console table", 16, U(330)]],
  [["Oak wardrobe, 3-door", 12, U(1345)]],
  [["Side table, marble top", 20, U(275)]],
  [["Boardroom chair, leather", 24, U(750)]],
  [["Oak TV console", 15, U(298)]],
  [["Teak serving tray", 120, U(48)]],
];
const HISTORY_BUYERS = ["b_alrashid", "b_harbourline", "b_kobayashi", "b_meridian", "b_najd"];
const HISTORY: InvoiceSeed[] = Array.from({ length: 20 }, (_, i) => {
  const month = 4 + Math.floor(i / 4); // April..August
  const day = 3 + (i % 4) * 7; // 3, 10, 17, 24
  const issued = `2026-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const dueDate = new Date(Date.UTC(2026, month - 1, day + 30));
  const paidDate = new Date(Date.UTC(2026, month - 1, day + 26 + (i % 3)));
  const due = dueDate.toISOString().slice(0, 10);
  const paid = `${paidDate.toISOString().slice(0, 10)}T0${(i % 8) + 1}:${String(10 + (i * 7) % 50).padStart(2, "0")}:0${i % 10}Z`;
  const later = (secs: number) => new Date(Date.parse(paid) + secs * 1000).toISOString().replace(".000Z", "Z");
  return { id: `inv_h${101 + i}`, n: 101 + i, buyerId: HISTORY_BUYERS[i % 5]!, items: HISTORY_PRODUCTS[i]!, issued, due, status: "settled", seenAt: paid, paidAt: later(1), settledAt: later(13) };
});

export const INVOICES: Invoice[] = [
  ...HISTORY.map(inv),
  inv({ id: "inv_0128", n: 128, buyerId: "b_alrashid", issued: "2026-07-30", due: "2026-08-29", status: "settled",
    items: [["Teak dining table 240cm", 8, U(1450)], ["Teak dining chair", 48, U(140)]],
    seenAt: "2026-08-27T06:41:02Z", paidAt: "2026-08-27T06:41:03Z", settledAt: "2026-08-27T06:41:15Z" }),
  inv({ id: "inv_0131", n: 131, buyerId: "b_harbourline", issued: "2026-08-04", due: "2026-09-03", status: "settled",
    items: [["Rubberwood bed frame, queen", 20, U(392.5)], ["Bedside table", 40, U(50)]],
    seenAt: "2026-09-02T00:12:40Z", paidAt: "2026-09-02T00:12:41Z", settledAt: "2026-09-02T00:12:54Z" }),
  inv({ id: "inv_0133", n: 133, buyerId: "b_kobayashi", issued: "2026-08-08", due: "2026-09-07", status: "settled",
    items: [["Oak sideboard 180cm", 10, U(980)], ["Oak coffee table", 20, U(220)]],
    seenAt: "2026-09-09T02:03:11Z", paidAt: "2026-09-09T02:03:12Z", settledAt: "2026-09-09T02:03:24Z" }),
  inv({ id: "inv_0135", n: 135, buyerId: "b_meridian", issued: "2026-08-12", due: "2026-09-11", status: "settled",
    items: [["Hotel guest room desk", 60, U(310)], ["Luggage bench", 60, U(150)]],
    seenAt: "2026-09-11T14:22:08Z", paidAt: "2026-09-11T14:22:09Z", settledAt: "2026-09-11T14:22:21Z" }),
  inv({ id: "inv_0136", n: 136, buyerId: "b_najd", issued: "2026-08-14", due: "2026-10-13", status: "sent",
    items: [["Majlis seating set, walnut", 12, U(2600)]] }),
  inv({ id: "inv_0138", n: 138, buyerId: "b_harbourline", issued: "2026-08-20", due: "2026-09-19", status: "settled",
    items: [["Outdoor teak lounger", 30, U(210)]],
    seenAt: "2026-09-18T03:55:30Z", paidAt: "2026-09-18T03:55:31Z", settledAt: "2026-09-18T03:55:43Z" }),
  inv({ id: "inv_0139", n: 139, buyerId: "b_alrashid", issued: "2026-08-22", due: "2026-09-21", status: "settled",
    items: [["Executive desk, walnut veneer", 12, U(1900)]],
    seenAt: "2026-09-21T09:00:04Z", paidAt: "2026-09-21T09:00:05Z", settledAt: "2026-09-21T09:00:17Z" }),
  inv({ id: "inv_0140", n: 140, buyerId: "b_meridian", issued: "2026-08-25", due: "2026-09-24", status: "overdue",
    items: [["Lobby armchair", 35, U(370)]] }),
  inv({ id: "inv_0141", n: 141, buyerId: "b_najd", issued: "2026-08-26", due: "2026-09-25", status: "overdue",
    items: [["Conference table 4.8m", 3, U(3300)]] }),
  inv({ id: "inv_0142", n: 142, buyerId: "b_harbourline", issued: "2026-08-26", due: "2026-09-22", status: "overdue",
    items: [["Teak dining table 180cm", 5, U(1189.5)], ["Teak bench", 15, U(366)]] }),
  inv({ id: "inv_0143", n: 143, buyerId: "b_kobayashi", issued: "2026-08-28", due: "2026-09-27", status: "disputed",
    items: [["Oak dining chair", 60, U(146)]] }),
  inv({ id: "inv_0144", n: 144, buyerId: "b_najd", issued: "2026-09-01", due: "2026-10-31", status: "sent",
    items: [["Reception counter, custom", 2, U(9750)]] }),
  inv({ id: "inv_0145", n: 145, buyerId: "b_alrashid", issued: "2026-09-03", due: "2026-10-03", status: "sent",
    items: [["Bookshelf 220cm, walnut", 30, U(510)]] }),
  inv({ id: "inv_0146", n: 146, buyerId: "b_meridian", issued: "2026-09-05", due: "2026-10-05", status: "partially_paid",
    items: [["Bar stool", 32, U(140)]], received: U(2000), seenAt: "2026-09-26T15:10:02Z", paidAt: "2026-09-26T15:10:03Z" }),
  inv({ id: "inv_0147", n: 147, buyerId: "b_harbourline", issued: "2026-09-08", due: "2026-10-08", status: "seen",
    items: [["Teak console table", 25, U(330)]], seenAt: "2026-09-27T01:58:31Z" }),
  inv({ id: "inv_0148", n: 148, buyerId: "b_kobayashi", issued: "2026-09-10", due: "2026-10-10", status: "sent",
    items: [["Oak wardrobe, 3-door", 20, U(1345)]] }),
  inv({ id: "inv_0149", n: 149, buyerId: "b_najd", issued: "2026-09-12", due: "2026-11-11", status: "sent",
    items: [["Side table, marble top", 26, U(275)]] }),
  inv({ id: "inv_0150", n: 150, buyerId: "b_alrashid", issued: "2026-09-25", due: "2026-10-25", status: "draft",
    items: [["Boardroom chair, leather", 45, U(750)]] }),
  inv({ id: "inv_0151", n: 151, buyerId: "b_kobayashi", issued: "2026-09-18", due: "2026-10-18", status: "sent",
    items: [["Oak TV console", 20, U(298)]] }),
  inv({ id: "inv_demo", n: 152, buyerId: "b_harbourline", issued: "2026-09-27", due: "2026-10-04", status: "sent",
    items: [["Sample: teak serving tray", 1, U(50)]] }),
  inv({ id: "inv_bot", n: 153, buyerId: "b_meridian", issued: "2026-09-27", due: "2026-10-04", status: "sent",
    items: [["Sample: rubberwood coasters, set of 6", 1, U(25)]] }),
];

export const DEMO_INVOICE_ID = "inv_demo";
export const BOT_INVOICE_ID = "inv_bot";

function pay(p: Omit<Payment, "mint" | "feePaidByKutip" | "signature" | "payer"> & { payer?: string }): Payment {
  return {
    mint: "USDC",
    feePaidByKutip: true,
    signature: fakeKey(`${p.id}-sig`, 88),
    payer: p.payer ?? fakeKey(`${p.invoiceId}-payer`),
    ...p,
  };
}

export const PAYMENTS: Payment[] = [
  ...HISTORY.map((h, i) => {
    const total = INVOICES.find((x) => x.id === h.id)!.amountUsdc;
    return pay({ id: `pay_h${101 + i}`, invoiceId: h.id, amount: total, commitment: "finalized", slot: 340_000_000 + i * 1_920_000, verified: true, issues: [],
      observedAt: h.seenAt!, confirmedAt: h.paidAt!, finalizedAt: h.settledAt!, via: i % 5 === 0 ? "x402" : "solana_pay" });
  }),
  pay({ id: "pay_0128", invoiceId: "inv_0128", amount: U(18320), commitment: "finalized", slot: 371_204_118, verified: true, issues: [],
    observedAt: "2026-08-27T06:41:02Z", confirmedAt: "2026-08-27T06:41:03Z", finalizedAt: "2026-08-27T06:41:15Z", via: "solana_pay" }),
  pay({ id: "pay_0131", invoiceId: "inv_0131", amount: U(9850), commitment: "finalized", slot: 372_611_905, verified: true, issues: [],
    observedAt: "2026-09-02T00:12:40Z", confirmedAt: "2026-09-02T00:12:41Z", finalizedAt: "2026-09-02T00:12:54Z", via: "solana_pay" }),
  // Paid in SOL, received exact USDC via Jupiter ExactOut. The execution receipt demo.
  pay({ id: "pay_0133", invoiceId: "inv_0133", amount: U(14200), inputMint: "SOL", inputAmount: 79_776_500_000n, quotedInput: 79_712_300_000n, quotedOut: U(14200),
    commitment: "finalized", slot: 374_302_557, verified: true, issues: [],
    observedAt: "2026-09-09T02:03:11Z", confirmedAt: "2026-09-09T02:03:12Z", finalizedAt: "2026-09-09T02:03:24Z", via: "solana_pay" }),
  pay({ id: "pay_0135", invoiceId: "inv_0135", amount: U(27600), commitment: "finalized", slot: 374_901_220, verified: true, issues: [],
    observedAt: "2026-09-11T14:22:08Z", confirmedAt: "2026-09-11T14:22:09Z", finalizedAt: "2026-09-11T14:22:21Z", via: "solana_pay" }),
  pay({ id: "pay_0138", invoiceId: "inv_0138", amount: U(6300), commitment: "finalized", slot: 376_455_003, verified: true, issues: [],
    observedAt: "2026-09-18T03:55:30Z", confirmedAt: "2026-09-18T03:55:31Z", finalizedAt: "2026-09-18T03:55:43Z", via: "solana_pay" }),
  // Paid by the buyer's accounts-payable bot over x402.
  pay({ id: "pay_0139", invoiceId: "inv_0139", amount: U(22800), commitment: "finalized", slot: 377_180_441, verified: true, issues: [],
    observedAt: "2026-09-21T09:00:04Z", confirmedAt: "2026-09-21T09:00:05Z", finalizedAt: "2026-09-21T09:00:17Z", via: "x402" }),
  pay({ id: "pay_0146", invoiceId: "inv_0146", amount: U(2000), commitment: "finalized", slot: 378_390_772, verified: true, issues: ["Amount is less than the invoice total"],
    observedAt: "2026-09-26T15:10:02Z", confirmedAt: "2026-09-26T15:10:03Z", finalizedAt: "2026-09-26T15:10:15Z", via: "solana_pay" }),
  pay({ id: "pay_0147", invoiceId: "inv_0147", amount: U(8250), commitment: "processed", slot: 378_488_010, verified: false, issues: [],
    observedAt: "2026-09-27T01:58:31Z", via: "solana_pay" }),
];

/** Payment shape used when the demo invoice is simulated (buyer pays in SOL). */
export const DEMO_PAYMENT: Omit<Payment, "observedAt" | "confirmedAt" | "finalizedAt" | "commitment" | "verified"> = {
  id: "pay_demo",
  invoiceId: DEMO_INVOICE_ID,
  signature: fakeKey("pay_demo-sig", 88),
  payer: fakeKey("demo-phone-wallet"),
  mint: "USDC",
  amount: U(50),
  inputMint: "SOL",
  inputAmount: 283_100_000n,
  quotedInput: 282_900_000n,
  quotedOut: U(50),
  slot: 378_512_990,
  issues: [],
  feePaidByKutip: true,
  via: "solana_pay",
};

export const MESSAGES: Message[] = [
  { id: "msg_1", invoiceId: "inv_0142", direction: "out", channel: "email", from: "Kutip for Teratai Woodworks",
    subject: "Invoice INV-2026-0142 is due on 22 September",
    body: "Hi Claire, a quick reminder that invoice INV-2026-0142 for USD 11,437.50 is due on 22 September. You can pay in one step with the link below; there is no bank fee and no gas fee on your side. Thank you, Teratai Woodworks.",
    createdAt: "2026-09-18T23:00:00Z" },
  { id: "msg_2", invoiceId: "inv_0142", direction: "out", channel: "email", from: "Kutip for Teratai Woodworks",
    subject: "Invoice INV-2026-0142 is now overdue",
    body: "Hi Claire, invoice INV-2026-0142 for USD 11,437.50 was due on 22 September and we have not seen a payment yet. If it is already on its way, please ignore this. Otherwise the pay link below still works. Thank you, Teratai Woodworks.",
    createdAt: "2026-09-23T23:00:00Z" },
  { id: "msg_3", invoiceId: "inv_0142", direction: "out", channel: "email", from: "Kutip for Teratai Woodworks",
    subject: "Second reminder: invoice INV-2026-0142",
    body: "Hi Claire, this is our second reminder for invoice INV-2026-0142 (USD 11,437.50, due 22 September). Could you let us know when we can expect payment? Thank you, Teratai Woodworks.",
    createdAt: "2026-09-25T23:00:00Z" },
  { id: "msg_4", invoiceId: "inv_0140", direction: "out", channel: "email", from: "Kutip for Teratai Woodworks",
    subject: "Invoice INV-2026-0140 is now overdue",
    body: "Hi Devon, invoice INV-2026-0140 for USD 12,950.00 was due on 24 September. The pay link below still works, with no fee on your side. Thank you, Teratai Woodworks.",
    createdAt: "2026-09-25T14:00:00Z" },
  { id: "msg_5", invoiceId: "inv_0140", direction: "in", channel: "email", from: "Devon Alvarez <ap@meridianhg.example>",
    subject: "Re: Invoice INV-2026-0140 is now overdue",
    body: "Hi, apologies for the delay. This is approved on our side and scheduled for payment on October 1st with our regular run. Devon",
    classification: { intent: "will_pay_on_date", confidence: 0.94 },
    createdAt: "2026-09-25T16:42:00Z" },
  { id: "msg_6", invoiceId: "inv_0143", direction: "out", channel: "email", from: "Kutip for Teratai Woodworks",
    subject: "Invoice INV-2026-0143 is due on 27 September",
    body: "Kobayashi-sama, a reminder that invoice INV-2026-0143 for USD 8,760.00 is due on 27 September. You can pay with the link below. Thank you, Teratai Woodworks.",
    createdAt: "2026-09-24T00:00:00Z" },
  { id: "msg_7", invoiceId: "inv_0143", direction: "in", channel: "email", from: "Yuki Kobayashi <keiri@kobayashi-living.example>",
    subject: "Re: Invoice INV-2026-0143 is due on 27 September",
    body: "Thank you for the reminder. Two of the sixty chairs arrived with cracked legs (photos attached). We would like to hold payment until we agree on a replacement or credit. Kobayashi",
    classification: { intent: "dispute", confidence: 0.91 },
    createdAt: "2026-09-24T02:15:00Z" },
  { id: "msg_8", invoiceId: "inv_0141", direction: "in", channel: "email", from: "Hessa Al Qahtani <payables@najdcontract.example>",
    subject: "Re: Invoice INV-2026-0141 is now overdue",
    body: "Dear Teratai team, we can settle this week if you can extend a 5% early-settlement discount as discussed with your sales team. Kindly confirm. Hessa",
    classification: { intent: "discount_request", confidence: 0.88 },
    createdAt: "2026-09-26T07:30:00Z" },
  { id: "msg_9", invoiceId: "inv_0133", direction: "out", channel: "email", from: "Kutip for Teratai Woodworks",
    subject: "Payment received: invoice INV-2026-0133",
    body: "Kobayashi-sama, we have received your payment of USD 14,200.00 for invoice INV-2026-0133. A receipt is attached. Thank you, Teratai Woodworks.",
    createdAt: "2026-09-09T02:04:00Z" },
];

export const AGENT_ACTIONS: AgentAction[] = [
  { id: "act_01", kind: "cash_out_alert", inputSummary: "BNM USD/MYR 4.2150 vs 30-day average 4.1930",
    decision: "Told the owner today's rate is 0.52% above the 30-day average", reason: "The rate beat the 30-day average by more than the 0.5% margin in the rulebook", confidence: 1, ruleId: "T5", status: "executed", createdAt: "2026-09-27T01:05:00Z" },
  { id: "act_02", kind: "sweep_proposal", inputSummary: "Meridian vault holds 2,000.00 USDC from a partial payment", buyerId: "b_meridian", invoiceId: "inv_0146",
    decision: "Proposes sweeping 2,000.00 USDC to the main treasury now instead of waiting for tonight's sweep", reason: "A partial payment sits outside the daily sweep window; moving it needs your approval", confidence: 0.83, ruleId: "T4", status: "proposed", createdAt: "2026-09-27T00:40:00Z" },
  { id: "act_03", kind: "classify_reply", inputSummary: "Reply from Najd Contract Interiors on INV-2026-0141", buyerId: "b_najd", invoiceId: "inv_0141",
    decision: "Read the reply as a discount request (5%) and escalated it to you", reason: "A 5% discount is above the 2% the rulebook lets the agent offer", confidence: 0.88, ruleId: "C3", status: "escalated", createdAt: "2026-09-26T07:31:00Z" },
  { id: "act_04", kind: "reminder", inputSummary: "INV-2026-0142 overdue 3 days, 1 reminder sent since due", buyerId: "b_harbourline", invoiceId: "inv_0142",
    decision: "Sent the second overdue reminder at 9:00 Sydney time", reason: "Rulebook allows one message per 48 hours in buyer hours; the last one was 48 hours ago", confidence: 0.96, ruleId: "C2", status: "executed", createdAt: "2026-09-25T23:00:00Z" },
  { id: "act_05", kind: "escalate", inputSummary: "INV-2026-0142: two overdue reminders sent, no reply", buyerId: "b_harbourline", invoiceId: "inv_0142",
    decision: "Escalated Harbourline Interiors to you and paused further reminders", reason: "Two overdue reminders with no reply is the escalation point in the rulebook", confidence: 0.97, ruleId: "C4", status: "escalated", createdAt: "2026-09-25T23:01:00Z" },
  { id: "act_06", kind: "classify_reply", inputSummary: "Reply from Meridian Hospitality on INV-2026-0140", buyerId: "b_meridian", invoiceId: "inv_0140",
    decision: "Read the reply as a promise to pay on 1 October and paused reminders until then", reason: "Buyer gave a specific date within 7 days; no escalation needed", confidence: 0.94, ruleId: "C5", status: "executed", createdAt: "2026-09-25T16:43:00Z" },
  { id: "act_07", kind: "reminder", inputSummary: "INV-2026-0140 overdue 1 day", buyerId: "b_meridian", invoiceId: "inv_0140",
    decision: "Sent the first overdue reminder at 9:00 Austin time", reason: "Invoice passed its due date with no payment seen", confidence: 0.95, ruleId: "C2", status: "executed", createdAt: "2026-09-25T14:00:00Z" },
  { id: "act_08", kind: "classify_reply", inputSummary: "Reply from Kobayashi Living on INV-2026-0143 with photos", buyerId: "b_kobayashi", invoiceId: "inv_0143",
    decision: "Marked the invoice as disputed and escalated it to you", reason: "The buyer reported damaged goods; any dispute goes to the owner", confidence: 0.91, ruleId: "C4", status: "escalated", createdAt: "2026-09-24T02:16:00Z" },
  { id: "act_09", kind: "sweep", inputSummary: "Nightly sweep: Al Rashid and Harbourline vaults", buyerId: undefined,
    decision: "Moved 29,100.00 USDC from two buyer accounts to the main treasury", reason: "Daily sweep at a random time, within the on-chain spending limit", confidence: 1, ruleId: "T2", status: "executed", txSignature: fakeKey("sweep_3-sig", 88), createdAt: "2026-09-26T11:17:42Z" },
  { id: "act_10", kind: "extract_invoice", inputSummary: "PDF: Al Rashid boardroom chairs, 1 page", buyerId: "b_alrashid", invoiceId: "inv_0150",
    decision: "Read the PDF into a draft invoice for USD 33,750.00 due 25 October", reason: "Fields were clear; the total matched the line items", confidence: 0.93, ruleId: "I1", status: "executed", createdAt: "2026-09-25T03:12:00Z" },
  { id: "act_11", kind: "reminder", inputSummary: "INV-2026-0143 due in 3 days", buyerId: "b_kobayashi", invoiceId: "inv_0143",
    decision: "Sent the pre-due reminder at 9:00 Osaka time", reason: "First reminder goes out 3 days before the due date", confidence: 0.98, ruleId: "C1", status: "executed", createdAt: "2026-09-24T00:00:00Z" },
  { id: "act_12", kind: "cancel_reminders", inputSummary: "INV-2026-0139 settled via x402", buyerId: "b_alrashid", invoiceId: "inv_0139",
    decision: "Cancelled the reminder schedule and emailed a receipt", reason: "Payment received and final", confidence: 1, ruleId: "C6", status: "executed", createdAt: "2026-09-21T09:00:20Z" },
  { id: "act_13", kind: "reminder", inputSummary: "INV-2026-0142 due in 3 days", buyerId: "b_harbourline", invoiceId: "inv_0142",
    decision: "Sent the pre-due reminder at 9:00 Sydney time", reason: "First reminder goes out 3 days before the due date", confidence: 0.98, ruleId: "C1", status: "executed", createdAt: "2026-09-18T23:00:00Z" },
  { id: "act_14", kind: "sweep", inputSummary: "Nightly sweep: Kobayashi and Meridian vaults", 
    decision: "Moved 41,800.00 USDC from two buyer accounts to the main treasury", reason: "Daily sweep at a random time, within the on-chain spending limit", confidence: 1, ruleId: "T2", status: "executed", txSignature: fakeKey("sweep_2-sig", 88), createdAt: "2026-09-12T02:48:09Z" },
  { id: "act_15", kind: "cancel_reminders", inputSummary: "INV-2026-0133 settled (paid in SOL)", buyerId: "b_kobayashi", invoiceId: "inv_0133",
    decision: "Cancelled the reminder schedule and emailed a receipt", reason: "Payment received and final", confidence: 1, ruleId: "C6", status: "executed", createdAt: "2026-09-09T02:03:30Z" },
  { id: "act_16", kind: "reminder", inputSummary: "INV-2026-0141 overdue 1 day", buyerId: "b_najd", invoiceId: "inv_0141",
    decision: "Sent the first overdue reminder at 9:00 Riyadh time", reason: "Invoice passed its due date with no payment seen", confidence: 0.95, ruleId: "C2", status: "executed", createdAt: "2026-09-26T06:00:00Z" },
];

export const SWEEPS: Sweep[] = [
  { id: "sweep_4", buyerIds: ["b_meridian", "b_harbourline"], amountUsdc: 0n, scheduledFor: "2026-09-27T13:26:00Z", status: "scheduled" },
  { id: "sweep_3", buyerIds: ["b_alrashid", "b_harbourline"], amountUsdc: U(29100), signature: fakeKey("sweep_3-sig", 88), scheduledFor: "2026-09-26T11:17:00Z", executedAt: "2026-09-26T11:17:42Z", status: "executed" },
  { id: "sweep_2", buyerIds: ["b_kobayashi", "b_meridian"], amountUsdc: U(41800), signature: fakeKey("sweep_2-sig", 88), scheduledFor: "2026-09-12T02:48:00Z", executedAt: "2026-09-12T02:48:09Z", status: "executed" },
  { id: "sweep_1", buyerIds: ["b_harbourline"], amountUsdc: U(9850), signature: fakeKey("sweep_1-sig", 88), scheduledFor: "2026-09-02T17:03:00Z", executedAt: "2026-09-02T17:03:11Z", status: "executed" },
];

export const TREASURY_MAIN_BALANCE = U(61420);
export const BUYER_VAULT_BALANCES: Record<string, bigint> = {
  b_harbourline: 0n,
  b_meridian: U(2000),
  b_alrashid: 0n,
  b_najd: 0n,
  b_kobayashi: 0n,
};
/** The owner's own deposit addresses at SC-registered exchanges (HATA lists USDC on Solana; Luno Malaysia does not offer USDC). */
export const WHITELISTED_CASH_OUT = [
  { label: "HATA USDC deposit (Solana) · Teratai Woodworks", address: fakeKey("hata-deposit") },
  { label: "Tokenize Xchange · Teratai Woodworks", address: fakeKey("tokenize-deposit") },
];
