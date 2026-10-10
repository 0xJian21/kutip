"use client";

import { Search } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { Select, controlClass } from "@/components/ui/field";
import { Tabs } from "@/components/ui/tabs";
import { InvoiceTable } from "@/components/invoices/invoice-table";
import type { BnmRate, Buyer, Invoice, InvoiceFilter, InvoiceStatus } from "@/lib/ui/types";

type Status = NonNullable<InvoiceFilter["status"]>;

const TABS: Array<{ value: Status; label: string }> = [
  { value: "all", label: "All" },
  { value: "needs_attention", label: "Needs attention" },
  { value: "overdue", label: "Overdue" },
  { value: "open", label: "Open" },
  { value: "settled", label: "Settled" },
  { value: "draft", label: "Drafts" },
];

// Same sets as @kutip/db listInvoices.
const OPEN = new Set<InvoiceStatus>(["sent", "seen", "overdue", "partially_paid", "disputed"]);
const ATTENTION = new Set<InvoiceStatus>(["overdue", "disputed", "partially_paid", "seen"]);

function matchesStatus(s: InvoiceStatus, status: Status) {
  return status === "all" || (status === "open" ? OPEN.has(s) : status === "needs_attention" ? ATTENTION.has(s) : s === status);
}

/**
 * Status tabs, buyer and search over the full invoice list, filtered in the browser: the page
 * already loads every invoice, so a filter change is instant instead of a server round trip
 * (which also flashed the route's loading skeleton over the search box). The URL follows along
 * with history.replaceState so a filtered view can still be linked and reloaded.
 */
export function InvoiceBrowser({
  invoices,
  buyers,
  rate,
  initial,
  empty,
  noMatch,
}: {
  invoices: Invoice[];
  buyers: Buyer[];
  rate: BnmRate;
  initial: { status: Status; buyerId: string; query: string };
  empty: ReactNode;
  noMatch: ReactNode;
}) {
  const [status, setStatus] = useState(initial.status);
  const [buyerId, setBuyerId] = useState(initial.buyerId);
  const [query, setQuery] = useState(initial.query);

  function sync(next: { status?: Status; buyer?: string; q?: string }) {
    const sp = new URLSearchParams(window.location.search);
    const values = { status: next.status === "all" ? "" : next.status, buyer: next.buyer, q: next.q };
    for (const [k, v] of Object.entries(values)) {
      if (v === undefined) continue;
      if (v) sp.set(k, v);
      else sp.delete(k);
    }
    const qs = sp.toString();
    window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
  }

  const names = new Map(buyers.map((b) => [b.id, b.name.toLowerCase()]));
  const q = query.trim().toLowerCase();
  const scoped = invoices.filter((i) => (!buyerId || i.buyerId === buyerId) && (!q || i.number.toLowerCase().includes(q) || (names.get(i.buyerId) ?? "").includes(q)));
  const shown = scoped.filter((i) => matchesStatus(i.status, status));

  const items = TABS.map((t) => ({
    value: t.value,
    label: t.label,
    count: invoices.filter((i) => matchesStatus(i.status, t.value)).length,
    countTone: t.value === "overdue" ? ("warn" as const) : undefined,
  }));
  const filtered = Boolean(buyerId || q || status !== "all");

  return (
    <>
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Tabs
          label="Filter by status"
          value={status}
          items={items}
          onChange={(v) => (setStatus(v), sync({ status: v }))}
          className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0 [&>ul]:flex-nowrap sm:[&>ul]:flex-wrap"
        />
        <div className="flex gap-2">
          <Select aria-label="Buyer" value={buyerId} onChange={(e) => (setBuyerId(e.target.value), sync({ buyer: e.target.value }))} className="w-auto max-w-[220px]">
            <option value="">All buyers</option>
            {buyers.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </Select>
          <div className="relative">
            <Search size={15} aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-3" />
            <input
              type="search"
              aria-label="Search invoices"
              placeholder="Search"
              value={query}
              onChange={(e) => (setQuery(e.target.value), sync({ q: e.target.value.trim() }))}
              className={`${controlClass} w-44 rounded-full pl-9`}
            />
          </div>
        </div>
      </div>
      <Card padded={false} className="overflow-hidden">
        <InvoiceTable invoices={shown} buyers={buyers} rate={rate} empty={filtered ? noMatch : empty} />
      </Card>
    </>
  );
}
