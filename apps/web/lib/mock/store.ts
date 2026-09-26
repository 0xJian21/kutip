/**
 * Client-side simulation state for the mock data layer.
 * Overrides sit on top of the static fixtures, persist in localStorage so a
 * reload keeps the rehearsed state, and sync across tabs (phone pay page in
 * one tab, dashboard in another) via BroadcastChannel.
 * On the server there are no overrides; live components apply them after mount.
 */
import type { InvoiceStatus, Payment } from "@/lib/ui/types";

export type InvoiceOverride = {
  status: InvoiceStatus;
  seenAt?: string;
  paidAt?: string;
  settledAt?: string;
  payment?: Payment;
  receivedUsdc?: bigint;
};

export type AgentOverride = { status: "approved" | "rejected" };

type State = {
  invoices: Record<string, InvoiceOverride>;
  actions: Record<string, AgentOverride>;
};

const KEY = "kutip-mock-state";
const CHANNEL = "kutip-mock";

const isBrowser = typeof window !== "undefined";

let state: State = { invoices: {}, actions: {} };
const listeners = new Set<() => void>();
let channel: BroadcastChannel | null = null;

function replacer(_k: string, v: unknown) {
  return typeof v === "bigint" ? { __bigint: v.toString() } : v;
}
function reviver(_k: string, v: unknown) {
  if (v && typeof v === "object" && "__bigint" in v) return BigInt((v as { __bigint: string }).__bigint);
  return v;
}

function load() {
  if (!isBrowser) return;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) state = JSON.parse(raw, reviver) as State;
  } catch {
    state = { invoices: {}, actions: {} };
  }
}

function persist() {
  if (!isBrowser) return;
  try {
    localStorage.setItem(KEY, JSON.stringify(state, replacer));
  } catch {}
}

function ensureChannel() {
  if (!isBrowser || channel || typeof BroadcastChannel === "undefined") return;
  channel = new BroadcastChannel(CHANNEL);
  channel.onmessage = () => {
    load();
    listeners.forEach((l) => l());
  };
}

if (isBrowser) {
  load();
  ensureChannel();
}

function commit() {
  persist();
  channel?.postMessage("changed");
  listeners.forEach((l) => l());
}

export const store = {
  get(): State {
    return state;
  },
  invoice(id: string): InvoiceOverride | undefined {
    return state.invoices[id];
  },
  setInvoice(id: string, patch: Partial<InvoiceOverride> & { status: InvoiceStatus }) {
    state = { ...state, invoices: { ...state.invoices, [id]: { ...state.invoices[id], ...patch } } };
    commit();
  },
  action(id: string): AgentOverride | undefined {
    return state.actions[id];
  },
  setAction(id: string, patch: AgentOverride) {
    state = { ...state, actions: { ...state.actions, [id]: patch } };
    commit();
  },
  reset() {
    state = { invoices: {}, actions: {} };
    commit();
  },
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};
