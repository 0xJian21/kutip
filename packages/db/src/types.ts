/**
 * Shapes returned by the query functions. Structurally identical to
 * apps/web/lib/ui/types.ts (pinned by src/ui-types.test.ts), so the web app can
 * hand DB results straight to components. Amounts are bigint base units.
 */

export type InvoiceStatus = "draft" | "sent" | "seen" | "paid" | "settled" | "partially_paid" | "overdue" | "disputed";
export type AgentActionStatus = "proposed" | "approved" | "executed" | "rejected" | "escalated";
export type AgentActionKind =
  | "reminder"
  | "classify_reply"
  | "sweep"
  | "sweep_proposal"
  | "escalate"
  | "cash_out_alert"
  | "extract_invoice"
  | "cancel_reminders"
  | "reply";
export type Commitment = "processed" | "confirmed" | "finalized";
export type Token = "USDC" | "SOL" | "USDT";

/** BNM reference rate: MYR per 1 USD, integer with 4 decimals (42150n = 4.2150). */
export type BnmRate = { myrPerUsd: bigint; date: string };

export type Rulebook = {
  collections: {
    firstReminderDaysBeforeDue: number;
    maxMessagesPer48h: number;
    quietHoursStart: number;
    quietHoursEnd: number;
    maxDiscountPctWithoutApproval: number;
    escalateAfterOverdueReminders: number;
    escalateOnDispute: boolean;
  };
  treasury: {
    acceptedTokens: Token[];
    sweepDaily: boolean;
    sweepRandomised: boolean;
    agentDailyLimitUsdc: bigint;
    otherMovementsNeedApproval: boolean;
    cashOutAlertMarginBps: bigint;
  };
};

export type Exporter = {
  id: string;
  name: string;
  registrationNo: string;
  city: string;
  ownerName: string;
  adminName: string;
  treasuryMultisig: string;
  treasuryVault: string;
  treasuryUsdcAta: string;
  rulebook: Rulebook;
};

export type Buyer = {
  id: string;
  name: string;
  contactName: string;
  email: string;
  country: string;
  countryName: string;
  city: string;
  timezone: string;
  multisig: string;
  vault: string;
  usdcAta: string;
};

export type LineItem = { description: string; quantity: number; unitPriceUsdc: bigint };

export type Invoice = {
  id: string;
  buyerId: string;
  number: string;
  lineItems: LineItem[];
  amountUsdc: bigint;
  receivedUsdc: bigint;
  issuedAt: string; // ISO date
  dueDate: string; // ISO date
  status: InvoiceStatus;
  referencePubkey: string;
  memoCode: string;
  createdAt: string; // ISO datetime
  sentAt?: string;
  seenAt?: string;
  paidAt?: string;
  settledAt?: string;
  payUrl: string;
  x402Url: string;
};

export type Payment = {
  id: string;
  invoiceId: string;
  signature: string;
  payer: string;
  mint: "USDC";
  amount: bigint;
  inputMint?: "SOL" | "USDT";
  inputAmount?: bigint;
  quotedOut?: bigint;
  quotedInput?: bigint;
  commitment: Commitment;
  slot: number;
  verified: boolean;
  issues: string[];
  observedAt: string;
  confirmedAt?: string;
  finalizedAt?: string;
  feePaidByKutip: true;
  via: "solana_pay" | "x402";
};

export type AgentAction = {
  id: string;
  kind: AgentActionKind;
  buyerId?: string;
  invoiceId?: string;
  inputSummary: string;
  decision: string;
  reason: string;
  confidence: number;
  ruleId: string;
  status: AgentActionStatus;
  txSignature?: string;
  createdAt: string;
};

export type ReplyIntent = "will_pay_on_date" | "dispute" | "discount_request" | "claims_paid" | "question" | "other";

export type Message = {
  id: string;
  invoiceId: string;
  direction: "out" | "in";
  channel: "email";
  from: string;
  subject: string;
  body: string;
  classification?: { intent: ReplyIntent; confidence: number };
  createdAt: string;
};

export type Sweep = {
  id: string;
  buyerIds: string[];
  amountUsdc: bigint;
  signature?: string;
  scheduledFor: string;
  executedAt?: string;
  status: "scheduled" | "executed";
};

export type DashboardSummary = {
  rate: BnmRate;
  receivedThisMonthUsdc: bigint;
  outstandingUsdc: bigint;
  overdueUsdc: bigint;
  overdueCount: number;
  treasuryBalanceUsdc: bigint;
  attention: Invoice[];
  activity: AgentAction[];
};

export type TreasurySummary = {
  rate: BnmRate;
  mainBalanceUsdc: bigint;
  mainVault: string;
  buyerAccounts: Array<{ buyer: Buyer; balanceUsdc: bigint; lastSweepAt?: string }>;
  lastSweep?: Sweep;
  nextSweep?: Sweep;
  agentDailyLimitUsdc: bigint;
  cashOut: {
    currentRate: BnmRate;
    thirtyDayAvg: BnmRate;
    alertMarginBps: bigint;
    whitelisted: Array<{ label: string; address: string }>;
  };
};

/** Public subset for /pay/[invoiceId]. Nothing here identifies other buyers. */
export type PayInvoice = {
  invoiceId: string;
  exporterName: string;
  invoiceNumber: string;
  amountUsdc: bigint;
  dueDate: string;
  status: InvoiceStatus;
  solanaPayUrl: string;
  acceptedTokens: Token[];
  paidAt?: string;
  settledAt?: string;
  payment?: Pick<Payment, "signature" | "amount" | "inputMint" | "inputAmount">;
};

export type InvoiceDetail = {
  invoice: Invoice;
  buyer: Buyer;
  payments: Payment[];
  messages: Message[];
  actions: AgentAction[];
  rate: BnmRate;
};

export type InvoiceFilter = {
  status?: InvoiceStatus | "all" | "open" | "needs_attention";
  buyerId?: string;
  query?: string;
};

/** Everything the agent may see when working on one buyer (SPEC §5 L4). */
export type BuyerContext = {
  exporterName: string;
  buyer: Buyer;
  invoices: Invoice[];
  messages: Message[];
  actions: AgentAction[];
};
