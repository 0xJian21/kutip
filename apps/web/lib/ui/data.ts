/**
 * The one data interface the UI talks to. Components import from here only.
 * Today it is implemented by lib/mock. Session 7 replaces the implementation
 * (Supabase queries + Realtime) without touching components.
 */
import { mockData } from "@/lib/mock";
import type {
  AgentAction,
  Buyer,
  DashboardSummary,
  Exporter,
  Invoice,
  InvoiceDetail,
  InvoiceFilter,
  MockScenario,
  PayInvoice,
  Rulebook,
  SimulationStage,
  TreasurySummary,
} from "./types";

export type QueryOptions = { scenario?: MockScenario };

export type KutipData = {
  getExporter(opts?: QueryOptions): Promise<Exporter>;
  getDashboard(opts?: QueryOptions): Promise<DashboardSummary>;
  listBuyers(opts?: QueryOptions): Promise<Buyer[]>;
  listInvoices(filter?: InvoiceFilter, opts?: QueryOptions): Promise<Invoice[]>;
  getInvoice(id: string, opts?: QueryOptions): Promise<InvoiceDetail | null>;
  listAgentActions(opts?: QueryOptions): Promise<AgentAction[]>;
  decideAction(id: string, decision: "approved" | "rejected"): Promise<AgentAction | null>;
  getRulebook(opts?: QueryOptions): Promise<Rulebook>;
  saveRulebook(rulebook: Rulebook): Promise<Rulebook>;
  getTreasury(opts?: QueryOptions): Promise<TreasurySummary>;
  getPayInvoice(id: string, opts?: QueryOptions): Promise<PayInvoice | null>;

  /**
   * Live updates for one invoice (status bar, pay page success state).
   * Real implementation: Supabase Realtime on `invoices` + `payments`.
   * Returns an unsubscribe function. Client-side only.
   */
  subscribeInvoice(id: string, onChange: (detail: InvoiceDetail) => void): () => void;
  subscribePayInvoice(id: string, onChange: (pay: PayInvoice) => void): () => void;

  /** Dev-only: walk an invoice through seen → paid → settled with realistic delays. */
  simulatePayment(id: string, opts?: { onStage?: (stage: SimulationStage) => void }): Promise<void>;
  /** Dev-only: forget all simulated state. */
  resetSimulation(): void;
};

export const data: KutipData = mockData;
