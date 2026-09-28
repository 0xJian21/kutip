/**
 * UI-facing data types. Mirrors docs/ARCHITECTURE.md "Data model".
 * Amounts are bigint base units: USDC 6dp, SOL 9dp. Never floats.
 * Session 7 swaps the mock implementation behind lib/ui/data.ts for real data;
 * components only ever import these types and that interface.
 */
import type { BnmRate } from "./money";
import type { AgentActionKind, AgentActionStatus, InvoiceStatus } from "./status";

export type { BnmRate, AgentActionKind, AgentActionStatus, InvoiceStatus };

export type Rulebook = {
  collections: {
    firstReminderDaysBeforeDue: number;
    maxMessagesPer48h: number;
    quietHoursStart: number; // buyer local hour, 24h
    quietHoursEnd: number;
    maxDiscountPctWithoutApproval: number;
    escalateAfterOverdueReminders: number;
    escalateOnDispute: boolean;
  };
  treasury: {
    acceptedTokens: Array<"USDC" | "SOL" | "USDT">;
    sweepDaily: boolean;
    sweepRandomised: boolean;
    agentDailyLimitUsdc: bigint; // per buyer vault
    otherMovementsNeedApproval: boolean;
    cashOutAlertMarginBps: bigint; // vs 30-day average
  };
  /** Session 8b (E3): what the agent may send on its own. Types are exported by @kutip/agent. */
  replies: {
    remindersAndReceipts: "automatic" | "draft";
    buyerReplies: "draft" | "routine" | "off";
  };
};

export type Exporter = {
  id: string;
  name: string;
  registrationNo: string;
  city: string;
  address: string;
  contactEmail: string;
  logoUrl?: string;
  /** Real mainnet accounts holding test-sized balances (the demo exporter). */
  demoFunds: boolean;
  /** When the owner last approved the agent's permissions with the passkey. */
  permissionsApprovedAt?: string;
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
  country: string; // ISO 3166-1 alpha-2
  countryName: string;
  city: string;
  address: string;
  timezone: string; // IANA
  multisig: string;
  vault: string;
  usdcAta: string;
};

export type LineItem = {
  description: string;
  quantity: number;
  unitPriceUsdc: bigint;
};

export type Invoice = {
  id: string;
  buyerId: string;
  number: string;
  lineItems: LineItem[];
  amountUsdc: bigint;
  receivedUsdc: bigint; // for partially_paid
  issuedAt: string; // ISO date
  dueDate: string; // ISO date
  status: InvoiceStatus;
  referencePubkey: string;
  memoCode: string; // opaque k_xxxx
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
  amount: bigint; // USDC received by the vault
  inputMint?: "SOL" | "USDT"; // set when the buyer paid via swap
  inputAmount?: bigint; // lamports or USDT base units (6dp)
  quotedOut?: bigint; // Jupiter quoted output (ExactOut: equals amount)
  quotedInput?: bigint; // Jupiter quoted input at build time
  commitment: "processed" | "confirmed" | "finalized";
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
  decision: string; // what the agent did or proposes, plain English
  reason: string; // why, plain English
  confidence: number; // 0..1, from Jev; display only
  ruleId: string; // e.g. C1, T2
  status: AgentActionStatus;
  txSignature?: string;
  /** Squads proposal index on the treasury multisig, for actions the owner approves on-chain. */
  proposalIndex?: number;
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
  /** Sum of buyer vault balances, not yet swept (the hero meter). */
  waitingInBuyerAccountsUsdc: bigint;
  nextSweepAt?: string;
  attention: Invoice[]; // overdue, disputed, seen, partially paid
  activity: AgentAction[]; // newest first
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
  exporterLogoUrl?: string;
  exporterAddress: string;
  /** The buyer's own details, for the invoice document (the pay link is the credential). */
  buyerName: string;
  buyerAddress: string;
  invoiceNumber: string;
  lineItems: LineItem[];
  amountUsdc: bigint;
  issuedAt: string;
  dueDate: string;
  status: InvoiceStatus;
  /** solana: URL for the wallet (Solana Pay transaction request) */
  solanaPayUrl: string;
  acceptedTokens: Array<"USDC" | "SOL" | "USDT">;
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

/** Dev-only way to preview loading/empty/error states: ?mock=empty|error|slow */
export type MockScenario = "empty" | "error" | "slow";

export type SimulationStage = "seen" | "paid" | "settled";
