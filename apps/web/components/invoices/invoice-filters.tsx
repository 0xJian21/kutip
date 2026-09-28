"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { useEffect, useState } from "react";
import { Select, controlClass } from "@/components/ui/field";
import { Tabs } from "@/components/ui/tabs";
import type { Buyer } from "@/lib/ui/types";

const TABS: Array<{ value: string; label: string }> = [
  { value: "all", label: "All" },
  { value: "needs_attention", label: "Needs attention" },
  { value: "overdue", label: "Overdue" },
  { value: "open", label: "Open" },
  { value: "settled", label: "Settled" },
  { value: "draft", label: "Drafts" },
];

export function InvoiceFilters({ buyers, counts }: { buyers: Buyer[]; counts: Record<string, number> }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const status = params.get("status") ?? "all";
  const buyerId = params.get("buyer") ?? "";
  const [query, setQuery] = useState(params.get("q") ?? "");

  function push(next: Record<string, string>) {
    const sp = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(next)) {
      if (v) sp.set(k, v);
      else sp.delete(k);
    }
    router.replace(`${pathname}?${sp.toString()}`);
  }

  useEffect(() => {
    const t = setTimeout(() => {
      if ((params.get("q") ?? "") !== query) push({ q: query });
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const items = TABS.map((t) => {
    const sp = new URLSearchParams(params.toString());
    if (t.value === "all") sp.delete("status");
    else sp.set("status", t.value);
    return { value: t.value, label: t.label, count: counts[t.value] ?? 0, href: `${pathname}?${sp.toString()}`, countTone: t.value === "overdue" ? ("warn" as const) : undefined };
  });

  return (
    <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <Tabs label="Filter by status" value={status} items={items} className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0 [&>ul]:flex-nowrap sm:[&>ul]:flex-wrap" />
      <div className="flex gap-2">
        <Select aria-label="Buyer" value={buyerId} onChange={(e) => push({ buyer: e.target.value })} className="w-auto max-w-[220px]">
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
            onChange={(e) => setQuery(e.target.value)}
            className={`${controlClass} w-44 rounded-full pl-9`}
          />
        </div>
      </div>
    </div>
  );
}
