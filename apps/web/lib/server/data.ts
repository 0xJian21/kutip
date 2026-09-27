import "server-only";
import { mockData } from "@/lib/mock";
import type { KutipData } from "@/lib/ui/data";
import { DEMO_EXPORTER_ID, MOCK, requireSession, sessionOrThrow } from "./auth";
import { store } from "./store";

/** KutipData over @kutip/db, every owner call scoped to one exporter. */
function forExporter(exporterId: string): KutipData {
  const s = store();
  return {
    async getExporter() {
      const e = await s.getExporter(exporterId);
      if (!e) throw new Error(`exporter not found: ${exporterId}`);
      return e;
    },
    getDashboard: () => s.getDashboard(exporterId),
    listBuyers: () => s.listBuyers(exporterId),
    listInvoices: (filter) => s.listInvoices(exporterId, filter),
    getInvoice: (id) => s.getInvoice(exporterId, id),
    listAgentActions: () => s.listAgentActions(exporterId),
    decideAction: (id, decision) => s.decideAction(exporterId, id, decision),
    getRulebook: () => s.getRulebook(exporterId),
    saveRulebook: (rulebook) => s.updateRulebook(exporterId, rulebook),
    getTreasury: () => s.getTreasury(exporterId),
    getPayInvoice: (id) => s.getPayInvoice(id),
  };
}

/** Owner pages: data for the signed-in exporter (redirects to sign-in without a session). */
export async function ownerData(next?: string): Promise<KutipData & { exporterId: string }> {
  const { exporterId } = await requireSession(next);
  return { ...(MOCK ? mockData : forExporter(exporterId)), exporterId };
}

/** Server actions: same, but throws instead of redirecting. */
export async function ownerDataOrThrow(): Promise<KutipData & { exporterId: string }> {
  const { exporterId } = await sessionOrThrow();
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
