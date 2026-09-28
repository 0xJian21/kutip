import type { KutipData, MockControls, QueryOptions } from "@/lib/ui/data";
import type {
  AgentAction,
  DashboardSummary,
  Invoice,
  InvoiceDetail,
  PayInvoice,
  Payment,
  Rulebook,
  TreasurySummary,
} from "@/lib/ui/types";
import {
  AGENT_ACTIONS,
  BUYERS,
  BUYER_VAULT_BALANCES,
  DEMO_PAYMENT,
  EXPORTER,
  INVOICES,
  MESSAGES,
  PAYMENTS,
  RATE,
  RATE_30D_AVG,
  RULEBOOK,
  SWEEPS,
  TREASURY_MAIN_BALANCE,
  WHITELISTED_CASH_OUT,
} from "./fixtures";
import { store } from "./store";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Small delay so loading states are visible; ?mock=slow makes it obvious. */
async function settle(opts?: QueryOptions) {
  if (opts?.scenario === "error") {
    await sleep(200);
    throw new Error("Couldn't reach Kutip. Check your connection and try again.");
  }
  await sleep(opts?.scenario === "slow" ? 4000 : 250);
}

let rulebook: Rulebook = RULEBOOK;

function withOverrides(inv: Invoice): Invoice {
  const o = store.invoice(inv.id);
  if (!o) return inv;
  return {
    ...inv,
    status: o.status,
    seenAt: o.seenAt ?? inv.seenAt,
    paidAt: o.paidAt ?? inv.paidAt,
    settledAt: o.settledAt ?? inv.settledAt,
    receivedUsdc: o.receivedUsdc ?? inv.receivedUsdc,
  };
}

function actionWithOverrides(a: AgentAction): AgentAction {
  const o = store.action(a.id);
  return o ? { ...a, status: o.status } : a;
}

/** Actions the agent would log when a simulated payment lands. */
function simulatedActions(): AgentAction[] {
  const out: AgentAction[] = [];
  for (const [id, o] of Object.entries(store.get().invoices)) {
    const inv = INVOICES.find((i) => i.id === id);
    if (!inv) continue;
    if (o.paidAt) {
      out.push({
        id: `act_sim_${id}_paid`,
        kind: "cancel_reminders",
        buyerId: inv.buyerId,
        invoiceId: id,
        inputSummary: `${inv.number} paid${o.payment?.inputMint ? ` in ${o.payment.inputMint}` : ""}`,
        decision: "Cancelled the reminder schedule and emailed a receipt to the buyer and you",
        reason: "Payment received for the full amount",
        confidence: 1,
        ruleId: "C6",
        status: "executed",
        createdAt: o.paidAt,
      });
    }
  }
  return out;
}

function allActions(): AgentAction[] {
  return [...AGENT_ACTIONS.map(actionWithOverrides), ...simulatedActions()];
}

function allInvoices(): Invoice[] {
  return INVOICES.map(withOverrides);
}

function paymentsFor(id: string): Payment[] {
  const base = PAYMENTS.filter((p) => p.invoiceId === id);
  const o = store.invoice(id);
  return o?.payment ? [...base, o.payment] : base;
}

function byNewest<T extends { createdAt: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

const OPEN: Invoice["status"][] = ["sent", "seen", "overdue", "partially_paid", "disputed"];
const ATTENTION: Invoice["status"][] = ["overdue", "disputed", "partially_paid", "seen"];

function detail(id: string): InvoiceDetail | null {
  const invoice = allInvoices().find((i) => i.id === id);
  if (!invoice) return null;
  const buyer = BUYERS.find((b) => b.id === invoice.buyerId);
  if (!buyer) return null;
  return {
    invoice,
    buyer,
    payments: paymentsFor(id),
    messages: byNewest(MESSAGES.filter((m) => m.invoiceId === id)).reverse(),
    actions: byNewest(allActions().filter((a) => a.invoiceId === id)),
    rate: RATE,
  };
}

function payInvoice(id: string): PayInvoice | null {
  const d = detail(id);
  if (!d) return null;
  const { invoice, buyer } = d;
  const payment = d.payments.at(-1);
  return {
    invoiceId: invoice.id,
    exporterName: EXPORTER.name,
    exporterLogoUrl: EXPORTER.logoUrl,
    exporterAddress: EXPORTER.address,
    buyerName: buyer.name,
    buyerAddress: buyer.address,
    invoiceNumber: invoice.number,
    lineItems: invoice.lineItems,
    amountUsdc: invoice.amountUsdc,
    issuedAt: invoice.issuedAt,
    dueDate: invoice.dueDate,
    status: invoice.status,
    solanaPayUrl: `solana:${encodeURIComponent(invoice.x402Url.replace("/api/x402/invoice/", "/api/pay/"))}`,
    acceptedTokens: rulebook.treasury.acceptedTokens,
    paidAt: invoice.paidAt,
    settledAt: invoice.settledAt,
    payment: payment
      ? { signature: payment.signature, amount: payment.amount, inputMint: payment.inputMint, inputAmount: payment.inputAmount }
      : undefined,
  };
}

export const mockData: KutipData & MockControls = {
  async getExporter(opts) {
    await settle(opts);
    return { ...EXPORTER, rulebook };
  },

  async getDashboard(opts) {
    await settle(opts);
    const invoices = opts?.scenario === "empty" ? [] : allInvoices();
    const month = "2026-09";
    const received = invoices
      .filter((i) => (i.settledAt ?? i.paidAt ?? "").startsWith(month))
      .reduce((s, i) => s + i.receivedUsdc, 0n);
    const open = invoices.filter((i) => OPEN.includes(i.status));
    const outstanding = open.reduce((s, i) => s + (i.amountUsdc - i.receivedUsdc), 0n);
    const overdueList = open.filter((i) => i.status === "overdue");
    const overdue = overdueList.reduce((s, i) => s + (i.amountUsdc - i.receivedUsdc), 0n);
    const vaults = Object.values(BUYER_VAULT_BALANCES).reduce((s, v) => s + v, 0n);
    return {
      rate: RATE,
      receivedThisMonthUsdc: received,
      outstandingUsdc: outstanding,
      overdueUsdc: overdue,
      overdueCount: overdueList.length,
      treasuryBalanceUsdc: TREASURY_MAIN_BALANCE + vaults,
      waitingInBuyerAccountsUsdc: vaults,
      nextSweepAt: SWEEPS.find((s) => s.status === "scheduled")?.scheduledFor,
      attention: open
        .filter((i) => ATTENTION.includes(i.status))
        .sort((a, b) => (a.dueDate < b.dueDate ? -1 : 1)),
      activity: opts?.scenario === "empty" ? [] : byNewest(allActions()).slice(0, 8),
    } satisfies DashboardSummary;
  },

  async listBuyers(opts) {
    await settle(opts);
    return opts?.scenario === "empty" ? [] : BUYERS;
  },

  async listInvoices(filter, opts) {
    await settle(opts);
    if (opts?.scenario === "empty") return [];
    let list = allInvoices();
    const status = filter?.status ?? "all";
    if (status === "open") list = list.filter((i) => OPEN.includes(i.status));
    else if (status === "needs_attention") list = list.filter((i) => ATTENTION.includes(i.status));
    else if (status !== "all") list = list.filter((i) => i.status === status);
    if (filter?.buyerId) list = list.filter((i) => i.buyerId === filter.buyerId);
    if (filter?.query) {
      const q = filter.query.toLowerCase();
      list = list.filter((i) => {
        const buyer = BUYERS.find((b) => b.id === i.buyerId);
        return i.number.toLowerCase().includes(q) || buyer?.name.toLowerCase().includes(q);
      });
    }
    // Overdue and disputed first, then by due date.
    const rank = (i: Invoice) => (i.status === "overdue" ? 0 : i.status === "disputed" ? 1 : ATTENTION.includes(i.status) ? 2 : OPEN.includes(i.status) ? 3 : 4);
    return list.sort((a, b) => rank(a) - rank(b) || (a.dueDate < b.dueDate ? -1 : 1));
  },

  async getInvoice(id, opts) {
    await settle(opts);
    if (opts?.scenario === "empty") return null;
    return detail(id);
  },

  async listAgentActions(opts) {
    await settle(opts);
    if (opts?.scenario === "empty") return [];
    return byNewest(allActions());
  },

  async decideAction(id, decision) {
    await sleep(400);
    const a = AGENT_ACTIONS.find((x) => x.id === id);
    if (!a) return null;
    store.setAction(id, { status: decision });
    return actionWithOverrides(a);
  },

  async getRulebook(opts) {
    await settle(opts);
    return rulebook;
  },

  async saveRulebook(next) {
    await sleep(400);
    rulebook = next;
    return rulebook;
  },

  async getTreasury(opts) {
    await settle(opts);
    const executed = SWEEPS.filter((s) => s.status === "executed");
    return {
      rate: RATE,
      mainBalanceUsdc: TREASURY_MAIN_BALANCE,
      mainVault: EXPORTER.treasuryVault,
      buyerAccounts: BUYERS.map((buyer) => ({
        buyer,
        balanceUsdc: BUYER_VAULT_BALANCES[buyer.id] ?? 0n,
        lastSweepAt: executed.find((s) => s.buyerIds.includes(buyer.id))?.executedAt,
      })),
      lastSweep: executed[0],
      nextSweep: SWEEPS.find((s) => s.status === "scheduled"),
      agentDailyLimitUsdc: rulebook.treasury.agentDailyLimitUsdc,
      cashOut: {
        currentRate: RATE,
        thirtyDayAvg: RATE_30D_AVG,
        alertMarginBps: rulebook.treasury.cashOutAlertMarginBps,
        whitelisted: WHITELISTED_CASH_OUT,
      },
    } satisfies TreasurySummary;
  },

  async getPayInvoice(id, opts) {
    await settle(opts);
    if (opts?.scenario === "empty") return null;
    return payInvoice(id);
  },

  subscribeInvoice(id, onChange) {
    const emit = () => {
      const d = detail(id);
      if (d) onChange(d);
    };
    emit();
    return store.subscribe(emit);
  },

  subscribeChanges(onChange) {
    return store.subscribe(onChange);
  },

  subscribePayInvoice(id, onChange) {
    const emit = () => {
      const p = payInvoice(id);
      if (p) onChange(p);
    };
    emit();
    return store.subscribe(emit);
  },

  async simulatePayment(id, opts) {
    const inv = INVOICES.find((i) => i.id === id);
    if (!inv) return;
    const current = store.invoice(id)?.status ?? inv.status;
    if (current === "settled") return;
    const remaining = inv.amountUsdc - inv.receivedUsdc;
    const base: Payment = {
      ...DEMO_PAYMENT,
      id: `pay_sim_${id}`,
      invoiceId: id,
      amount: remaining,
      quotedOut: remaining,
      commitment: "processed",
      verified: false,
      observedAt: new Date().toISOString(),
    };
    // Realistic timings from the Solami gRPC stream: processed ≈0.4s, confirmed ≈1s, finalized ≈13s.
    await sleep(400);
    store.setInvoice(id, { status: "seen", seenAt: base.observedAt, payment: base });
    opts?.onStage?.("seen");
    await sleep(1000);
    const paidAt = new Date().toISOString();
    store.setInvoice(id, {
      status: "paid",
      paidAt,
      receivedUsdc: inv.amountUsdc,
      payment: { ...base, commitment: "confirmed", verified: true, confirmedAt: paidAt },
    });
    opts?.onStage?.("paid");
    await sleep(13000);
    const settledAt = new Date().toISOString();
    store.setInvoice(id, {
      status: "settled",
      settledAt,
      payment: { ...base, commitment: "finalized", verified: true, confirmedAt: paidAt, finalizedAt: settledAt },
    });
    opts?.onStage?.("settled");
  },

  resetSimulation() {
    store.reset();
  },
};
