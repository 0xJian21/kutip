/**
 * The data interface the UI renders from. Server-side it is implemented by
 * @kutip/db bound to the signed-in exporter (lib/server/data.ts), or by lib/mock
 * when NEXT_PUBLIC_KUTIP_MOCK=1 (offline UI work). Client components never call
 * it directly: they use server actions (lib/data/actions.ts) and Realtime
 * Broadcast (lib/data/live.ts).
 */
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
};

/** Mock-only, client-side: in-memory live updates and the payment simulation. */
export type MockControls = {
  subscribeInvoice(id: string, onChange: (detail: InvoiceDetail) => void): () => void;
  subscribeChanges(onChange: () => void): () => void;
  subscribePayInvoice(id: string, onChange: (pay: PayInvoice) => void): () => void;
  simulatePayment(id: string, opts?: { onStage?: (stage: SimulationStage) => void }): Promise<void>;
  resetSimulation(): void;
};

export const MOCK = process.env.NEXT_PUBLIC_KUTIP_MOCK === "1";
