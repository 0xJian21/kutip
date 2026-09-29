import "server-only";
import { cache } from "react";
import { mockData } from "@/lib/mock";
import type { KutipData } from "@/lib/ui/data";
import { DEMO_EXPORTER_ID, MOCK, requireSession, sessionOrThrow, writeSessionOrThrow } from "./auth";
import { store } from "./store";

/** Calls `load` once and hands every later caller the same promise. */
function once<T>(load: () => Promise<T>): () => Promise<T> {
  let p: Promise<T> | undefined;
  return () => (p ??= load());
}

/**
 * KutipData over @kutip/db, every owner call scoped to one exporter. Reads are memoised for the
 * life of the instance, so pages take one per request (`pageData`) and actions a fresh one.
 */
function forExporter(exporterId: string): KutipData {
  const s = store();
  const invoices = new Map<string, ReturnType<KutipData["listInvoices"]>>();
  return {
    getExporter: once(async () => {
      const e = await s.getExporter(exporterId);
      if (!e) throw new Error(`exporter not found: ${exporterId}`);
      return e;
    }),
    getDashboard: once(() => s.getDashboard(exporterId)),
    listBuyers: once(() => s.listBuyers(exporterId)),
    listInvoices: (filter) => {
      const key = JSON.stringify(filter ?? {});
      if (!invoices.has(key)) invoices.set(key, s.listInvoices(exporterId, filter));
      return invoices.get(key)!;
    },
    getInvoice: (id) => s.getInvoice(exporterId, id),
    listAgentActions: () => s.listAgentActions(exporterId),
    decideAction: (id, decision) => s.decideAction(exporterId, id, decision),
    getRulebook: () => s.getRulebook(exporterId),
    saveRulebook: (rulebook) => s.updateRulebook(exporterId, rulebook),
    getTreasury: () => s.getTreasury(exporterId),
    getPayInvoice: (id) => s.getPayInvoice(id),
  };
}

/** One instance per page render (React `cache`): the layout and the page share the exporter, buyers and lists. */
const pageData = cache(forExporter);

/** Owner pages: data for the signed-in exporter (redirects to sign-in without a session). */
export async function ownerData(next?: string): Promise<KutipData & { exporterId: string }> {
  const { exporterId } = await requireSession(next);
  return { ...(MOCK ? mockData : pageData(exporterId)), exporterId };
}

/** Server actions: same, but throws instead of redirecting. `write` refuses DEMO_FALLBACK visitors (read-only role). */
export async function ownerDataOrThrow(opts: { write?: boolean } = {}): Promise<KutipData & { exporterId: string }> {
  const { exporterId } = await (opts.write ? writeSessionOrThrow() : sessionOrThrow());
  return { ...(MOCK ? mockData : forExporter(exporterId)), exporterId };
}

/** Buyer-facing, no login: one invoice by its unguessable id. */
export function getPayInvoice(id: string, opts?: Parameters<KutipData["getPayInvoice"]>[1]) {
  return MOCK ? mockData.getPayInvoice(id, opts) : store().getPayInvoice(id);
}

/** Pre-login pages (onboarding's "Use demo details"): the demo exporter, read-only. */
export function demoData(): KutipData {
  return MOCK ? mockData : forExporter(DEMO_EXPORTER_ID);
}
