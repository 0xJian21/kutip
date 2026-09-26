"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { useEffect, useState } from "react";
import { Select, controlClass } from "@/components/ui/field";
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

  return (
    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <nav aria-label="Filter by status" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <ul className="flex gap-1">
          {TABS.map((t) => {
            const active = status === t.value;
            const sp = new URLSearchParams(params.toString());
            if (t.value === "all") sp.delete("status");
            else sp.set("status", t.value);
            const n = counts[t.value] ?? 0;
            return (
              <li key={t.value}>
                <Link
                  href={`${pathname}?${sp.toString()}`}
                  aria-current={active ? "page" : undefined}
                  className={`inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-sm px-2.5 text-base transition-colors duration-(--dur-fast) ${
                    active ? "bg-surface font-medium text-ink ring-1 ring-inset ring-line" : "text-ink-2 hover:bg-paper-2 hover:text-ink"
                  }`}
                >
                  {t.label}
                  <span className={`tabular text-sm ${t.value === "overdue" && n > 0 ? "text-overdue-fg" : "text-ink-3"}`}>{n}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="flex gap-2">
        <Select aria-label="Buyer" value={buyerId} onChange={(e) => push({ buyer: e.target.value })} className="w-auto max-w-[200px]">
          <option value="">All buyers</option>
          {buyers.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </Select>
        <div className="relative">
          <Search size={14} aria-hidden="true" className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-3" />
          <input
            type="search"
            aria-label="Search invoices"
            placeholder="Search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className={`${controlClass} w-40 pl-8`}
          />
        </div>
      </div>
    </div>
  );
}
