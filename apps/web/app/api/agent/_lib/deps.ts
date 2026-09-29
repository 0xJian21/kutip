import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import {
  buildAgenda,
  createMailer,
  haikuClassifier,
  jevClassifier,
  type AgendaEvent,
  type CommandPort,
  type InboxDeps,
  type InboxPort,
  type ReminderSendPort,
} from "@kutip/agent";
import { connect, createInboxStore, type InboxStore } from "@kutip/db";
import { appUrl, store } from "@/lib/server/store";

/**
 * Wiring for the agent command bar, the inbox and the pay-page thread (Session 8c):
 * @kutip/db store + inbox store → the ports @kutip/agent expects, plus Haiku / Jev / Resend from env.
 */

declare global {
  var __kutipInbox: InboxStore | undefined;
}

export function inbox(): InboxStore {
  if (globalThis.__kutipInbox) return globalThis.__kutipInbox;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("missing env DATABASE_URL");
  globalThis.__kutipInbox = createInboxStore(connect(url, { max: 5 }).db, { appUrl: appUrl() });
  return globalThis.__kutipInbox;
}

export function anthropic(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");
  return new Anthropic({ apiKey, maxRetries: 1 });
}

/** Same as the invoice email's mailer: Resend when keyed, only to EMAIL_ALLOWLIST. */
export function mailer() {
  return createMailer({
    apiKey: process.env.RESEND_API_KEY,
    from: process.env.EMAIL_FROM ?? "Kutip <onboarding@resend.dev>",
    allowlist: (process.env.EMAIL_ALLOWLIST ?? "").split(",").map((a) => a.trim()).filter(Boolean),
    log: (m) => console.warn(`[email] ${m}`),
  });
}

export function jevConfig(): { apiKey: string } | undefined {
  const key = process.env.OPENROUTER_API_KEY;
  return key ? { apiKey: key } : undefined;
}

export function inboxPort(): InboxPort {
  const s = store();
  const i = inbox();
  return {
    getThread: (e, id) => i.getThread(e, id),
    getBuyerContext: (e, b) => s.getBuyerContext(e, b),
    getRulebook: (e) => s.getRulebook(e),
    setClassification: (id, c) => i.setClassification(id, c),
    setPromisedDate: (e, id, d) => s.setPromisedDate(e, id, d),
    setInvoiceStatus: (e, id, st, at) => s.setInvoiceStatus(e, id, st, at),
    recordAgentAction: (a) => s.recordAgentAction(a),
    saveDraft: (e, d) => i.saveDraft(e, d),
    sendDraft: (e, id, x) => i.sendDraft(e, id, x),
    getContactEmail: (e) => i.getContactEmail(e),
    getLetterhead: (e) => s.getLetterhead(e),
  };
}

export function inboxDeps(): InboxDeps {
  const client = anthropic();
  const haiku = haikuClassifier(client);
  const jev = jevConfig();
  return {
    store: inboxPort(),
    classifier: jev ? jevClassifier({ apiKey: jev.apiKey, fallback: haiku }) : haiku,
    client,
    mailer: mailer(),
    now: () => new Date(),
    log: (m) => console.warn(`[inbox] ${m}`),
  };
}

/** Calendar (A3) and the command bar's "this week": one query, built in code. */
export async function agenda(exporterId: string, range: { from: string; to: string }): Promise<AgendaEvent[]> {
  const s = store();
  const [invoices, open, buyers, treasury, actions, rulebook, messages] = await Promise.all([
    s.listInvoices(exporterId),
    s.listOpenInvoices(exporterId),
    s.listBuyers(exporterId),
    s.getTreasury(exporterId),
    s.listAgentActions(exporterId, { limit: 200 }),
    s.getRulebook(exporterId),
    s.listSentMessages(exporterId),
  ]);
  const promised = new Map(open.map((o) => [o.invoiceId, o.promisedDate]));
  // Outbound history of buyers with open invoices (for the reminder cap).
  const buyerIds = new Set(open.map((o) => o.buyerId));
  const sent = messages.filter((m) => buyerIds.has(m.buyerId));
  return buildAgenda({
    ...range,
    now: new Date(),
    rulebook,
    buyers,
    invoices: invoices.map((inv) => ({ ...inv, promisedDate: promised.get(inv.id) })),
    sent,
    sweeps: treasury.nextSweep ? [{ scheduledFor: treasury.nextSweep.scheduledFor }] : [],
    alerts: actions.filter((a) => a.kind === "cash_out_alert").map((a) => ({ createdAt: a.createdAt, decision: a.decision })),
  });
}

export function commandPort(): CommandPort {
  const s = store();
  return {
    listInvoices: (e) => s.listInvoices(e),
    listBuyers: (e) => s.listBuyers(e),
    getTreasury: (e) => s.getTreasury(e),
    getRulebook: (e) => s.getRulebook(e),
    getBuyerContext: (e, b) => s.getBuyerContext(e, b),
    agenda,
  };
}

export async function reminderPort(exporterId: string): Promise<ReminderSendPort> {
  const s = store();
  return {
    listInvoices: (e) => s.listInvoices(e),
    listBuyers: (e) => s.listBuyers(e),
    recordMessage: (m) => s.recordMessage(m),
    recordAgentAction: (a) => s.recordAgentAction(a),
    getContactEmail: (e) => inbox().getContactEmail(e),
    getLetterhead: (e) => s.getLetterhead(e),
    exporterName: (await s.getExporter(exporterId))?.name,
  };
}
