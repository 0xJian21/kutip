/**
 * Real numbers only. Every figure here comes from docs/REHEARSAL.md (the 29 Sep 2026
 * production walk-through on Solana mainnet) or from the demo exporter's seeded data as it
 * appears in docs/screenshots/v2. Estimates are marked `estimate: true` and the video labels them.
 */

export const APP_URL = "kutip-app.vercel.app";
export const APP_HTTPS = "https://kutip-app.vercel.app";

export const solscanTx = (sig: string) => `https://solscan.io/tx/${sig}`;
export const shortSig = (sig: string, edge = 4) => `${sig.slice(0, edge)}…${sig.slice(-edge)}`;

/** Measured on mainnet, 29 Sep 2026 (REHEARSAL.md, "8d walk-through results"). */
export const TIMINGS = {
  seenToPaidMs: 153,
  seenToSettledMs: 7860,
  x402Seconds: 4.5,
  draftReadySeconds: 4.2,
  receiptEmailSeconds: 2.9,
} as const;

export type Proof = {
  id: string;
  label: string;
  signature: string;
  timing?: string;
  date: string;
};

export const PROOFS: Proof[] = [
  // Demo recording, 10 Oct 2026, production on mainnet (payments / agent_actions rows).
  {
    id: "pay-oct10",
    label: "Buyer pays INV-2026-0154 from Phantom; exactly 1.000000 USDC lands",
    signature: "3mRq6ZcmvXU6bpbAsPAGJPX1C42QaLsZcfLt7BrWmmdPJWM8hKQRQHsXqSXc4FcERwN9AzadHskSk8u7AMmsZ9fk",
    timing: "Seen → Paid 0.10 s · Settled 6.6 s · buyer fee 0 SOL",
    date: "10 Oct 2026",
  },
  {
    id: "x402-oct10",
    label: "An AP bot pays INV-2026-0155 over x402",
    signature: "2uu4L4a932gLMY3rk7Dm7fpMtS16Lx5DMMTgMmmSGhxJbHmrwJkwUaJ1iTjnX3e5zstEjet86217dLcptF2Spjoe",
    timing: "HTTP 402 → 200 · Settled 6.9 s after Seen",
    date: "10 Oct 2026",
  },
  {
    id: "cash-out-oct10",
    label: "Cash-out of 0.25 USDC to the owner's HATA address, approved with Touch ID",
    signature: "4gMuoj7m9divrcYncBjk6g45Wd4wd44wkSQUioAsE5wChuNp4fPwVzikFDsYsFnAZ6A1cj7dZ8VJ6UDjFJMXRG7p",
    timing: "Squads proposal #4 → approve + execute",
    date: "10 Oct 2026",
  },
  {
    id: "pay-sol",
    label: "Buyer pays INV-2026-0154 in SOL; exactly 1.000000 USDC lands",
    signature: "5GDG5XPL8cJwDPJTvvqbgnKcL5SThS9t5GgVDYeVh6fQFgTHJxayc7KqM84KZwBy75by2jBcfdAsA8HHvtjv3AMV",
    timing: "Seen → Paid 0.15 s · Settled 7.9 s · buyer fee 0 SOL",
    date: "29 Sep 2026",
  },
  {
    id: "x402",
    label: "An AP bot pays INV-2026-0155 over x402",
    signature: "5taDgww4YGWphCH5rMiGLjM3253HeZa2LbQcbhy9bqNHHAznh58hA7h7J1cuRJ1eB7S5MtdrUVMvD9jXL1sM1AWm",
    timing: "HTTP 402 → 200 in 4.5 s",
    date: "29 Sep 2026",
  },
  {
    id: "sweep",
    label: "Sweep now: two buyer accounts into the treasury, agent-signed",
    signature: "47KoPjR6tVT5pLGwfAADGT5LKLXmGcjSeX5hSc6rGGFDdwyF14gSxuPX6QnJyvLR3z74vUPmjrCK4JN4qhkpfobP",
    timing: "Spending limit enforced on chain (T2)",
    date: "29 Sep 2026",
  },
  {
    id: "cash-out",
    label: "Cash-out proposal approved with Touch ID",
    signature: "3b7KNHLUENg36RWemfqc6N2nXhTbjZSDeQqu9xkkzeSio9rPojq6JgJGRSXk1wYRtLU2vg3qiwm8duBpcmjYKTq1",
    timing: "Squads proposal → approve + execute in one tx",
    date: "29 Sep 2026",
  },
];

export const proofById = (id: string) => {
  const p = PROOFS.find((x) => x.id === id);
  if (!p) throw new Error(`unknown proof ${id}`);
  return p;
};

/** The demo exporter, as seeded (docs/screenshots/v2). Demo data, labelled as such on screen. */
export const DEMO = {
  exporter: "Teratai Woodworks Sdn. Bhd.",
  exporterShort: "Teratai Woodworks",
  exporterAddress: "Lot 2188, Jalan Bakri, 84000 Muar, Johor, Malaysia",
  exporterSsm: "SSM 202001034567 (1391234-K)",
  owner: "Farid Zulkifli",
  ownerRole: "Owner · Teratai Woodworks (demo exporter)",
  bnmRate: "4.0830",
  bnmDate: "29 Sept 2026",
  treasury: { myr: "4.08", usdc: "1.00", waitingUsd: "0", capUsd: "5,000" },
  /** The Sydney invoice on the pay page screenshot. */
  invoice0142: {
    number: "INV-2026-0142",
    buyer: "Harbourline Interiors Pty Ltd",
    buyerContact: "Claire Whitmore",
    buyerAddress: "Level 3, 48 Pirrama Road, Pyrmont NSW 2009, Australia",
    city: "Sydney, Australia",
    issued: "26 Aug 2026",
    due: "22 Sept 2026",
    usdc: "11,437.50",
    myr: "46,699.31",
    items: [
      { item: "Teak dining table 180cm", qty: 5, unit: "1,189.50", amount: "5,947.50" },
      { item: "Teak bench", qty: 15, unit: "366.00", amount: "5,490.00" },
    ],
  },
  /** The USD 1 invoice the rehearsal paid in SOL (live proof). */
  invoice0154: {
    number: "INV-2026-0154",
    buyer: "Harbourline Interiors Pty Ltd",
    buyerAddress: "Level 3, 48 Pirrama Road, Pyrmont NSW 2009, Australia",
    usdc: "1.00",
    usdcExact: "1.000000",
    myr: "4.08",
    solPaid: "0.008361",
    /** scripts/demo-reset.ts: issued the day of the run (29 Sep 2026), due 7 days later, one line item. */
    issued: "29 Sept 2026",
    due: "6 Oct 2026",
    items: [{ item: "LIVE DEMO · teak side table sample (pay by wallet)", qty: 1, unit: "1.00", amount: "1.00" }],
  },
  /** Agent activity rows, verbatim from the agent screenshot. */
  cashOutProposal: {
    kind: "Cash-out alert",
    decision: "Proposed moving 1.50 USDC from the treasury to HATA USDC deposit (Solana)",
    reason: "Any movement other than the daily sweep needs the owner's approval",
    rule: "T4",
    confidence: "100%",
  },
  cancelledReminders: {
    kind: "Payment received",
    decision: "Cancelled the reminder schedule for INV-2026-0154",
    reason: "Payment received, so reminders are cancelled",
    rule: "C6",
    confidence: "100%",
  },
  /** Who still owes (dashboard "Agent needs you" list; seeded demo data). */
  overdue: [
    { buyer: "Harbourline Interiors Pty Ltd", number: "INV-2026-0142", usd: "11,437.50", myr: "46,699.31", status: "7 days overdue" },
    { buyer: "Meridian Hospitality Group LLC", number: "INV-2026-0140", usd: "12,950.00", myr: "52,874.85", status: "5 days overdue" },
    { buyer: "Najd Contract Interiors Co.", number: "INV-2026-0141", usd: "9,900.00", myr: "40,421.70", status: "4 days overdue" },
    { buyer: "Kobayashi Living Co., Ltd.", number: "INV-2026-0143", usd: "8,760.00", myr: "35,767.08", status: "Disputed" },
  ],
} as const;

/** Wire figures are estimates (landing page "Versus a wire"); always labelled "est." on screen. */
export const WIRE = {
  days: "2 to 5 days",
  daysShort: "3 days",
  feesRm: "RM 50 to 150",
  feesHook: "~RM150",
  spread: "1% to 3%",
  kutipFee: "Under RM 0.05",
  estimate: true,
} as const;

/** SPEC §6 compliance posture and the landing's Trust section, condensed for cards. */
export const TRUST_POINTS = [
  { title: "Non-custodial", body: "Funds sit in your own Squads multisig. Kutip holds a sweep-only agent key and a fee-payer float." },
  { title: "No ringgit touches Kutip", body: "You cash out to your own whitelisted address at an SC-registered exchange, approved with Touch ID." },
  { title: "Every paying wallet screened", body: "Checked against the OFAC list and history signals before the payment is built." },
  { title: "A trail you can audit", body: "Every payment and agent decision has a signature, a reason and the rule it followed." },
];

export const WHY_SOLANA_POINTS = [
  { title: "Finality in seconds", body: "Seen to Paid in 0.15 s, Settled in 7.9 s, measured on mainnet." },
  { title: "Gasless for the buyer", body: "Kutip is the fee payer. The buyer sends the exact invoice amount, 0 SOL for gas." },
  { title: "Exact USD in, any token out", body: "SOL converts to the exact USDC inside the same payment (Jupiter ExactOut)." },
  { title: "Solami Yellowstone gRPC", body: "One stream watches every invoice reference key and vault. Processed, confirmed, finalized: Seen, Paid, Settled." },
  { title: "Squads v4 treasury", body: "Owner holds the keys; the agent has a daily spending limit enforced by the program." },
  { title: "x402 for machines", body: "A buyer's AP bot pays over HTTP: 402 to 200 in 4.5 s." },
];

export const GTM_POINTS = [
  { title: "Today", body: "Malaysian furniture and wood-product exporters in Muar and Batu Pahat, selling in USD on 30 to 60 day terms." },
  { title: "Next", body: "Any Malaysian SME invoicing abroad: gloves, electronics parts, food, services." },
  { title: "After that", body: "Exporters across emerging markets who lose days and margin to correspondent banking." },
];
