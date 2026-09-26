"use client";

import { useEffect, useState } from "react";
import { ActionRow } from "@/components/agent/action-row";
import { EmptyState } from "@/components/ui/states";
import { data } from "@/lib/ui/data";
import type { AgentAction, Buyer, Invoice } from "@/lib/ui/types";

const TABS = [
  { value: "all", label: "All" },
  { value: "proposed", label: "Needs your approval" },
  { value: "escalated", label: "Escalated to you" },
  { value: "executed", label: "Done" },
] as const;

type Tab = (typeof TABS)[number]["value"];

function dayKey(iso: string) {
  return new Intl.DateTimeFormat("en-MY", { weekday: "long", day: "numeric", month: "long", timeZone: "Asia/Kuala_Lumpur" }).format(new Date(iso));
}

export function ActionList({ initial, buyers, invoices }: { initial: AgentAction[]; buyers: Buyer[]; invoices: Invoice[] }) {
  const [actions, setActions] = useState(initial);
  const [tab, setTab] = useState<Tab>("all");

  useEffect(() => {
    let alive = true;
    const refresh = () => data.listAgentActions().then((a) => alive && setActions(a)).catch(() => {});
    const unsubscribe = data.subscribeChanges(refresh);
    refresh();
    return () => {
      alive = false;
      unsubscribe();
    };
  }, []);

  const counts: Record<Tab, number> = {
    all: actions.length,
    proposed: actions.filter((a) => a.status === "proposed").length,
    escalated: actions.filter((a) => a.status === "escalated").length,
    executed: actions.filter((a) => a.status === "executed").length,
  };
  const visible = tab === "all" ? actions : actions.filter((a) => a.status === tab);
  const numberOf = (id?: string) => invoices.find((i) => i.id === id)?.number;

  const groups: Array<{ day: string; items: AgentAction[] }> = [];
  for (const a of visible) {
    const day = dayKey(a.createdAt);
    const g = groups.at(-1);
    if (g && g.day === day) g.items.push(a);
    else groups.push({ day, items: [a] });
  }

  return (
    <>
      <nav aria-label="Filter" className="-mx-4 mb-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <ul className="flex gap-1">
          {TABS.map((t) => {
            const active = tab === t.value;
            return (
              <li key={t.value}>
                <button
                  type="button"
                  onClick={() => setTab(t.value)}
                  aria-pressed={active}
                  className={`inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-sm px-2.5 text-base transition-colors duration-(--dur-fast) ${
                    active ? "bg-surface font-medium text-ink ring-1 ring-inset ring-line" : "text-ink-2 hover:bg-paper-2 hover:text-ink"
                  }`}
                >
                  {t.label}
                  <span className={`tabular text-sm ${t.value === "proposed" && counts[t.value] > 0 ? "text-partial-fg" : "text-ink-3"}`}>{counts[t.value]}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {groups.length === 0 ? (
        <div className="rounded-md border border-line bg-surface">
          <EmptyState title={tab === "all" ? "The agent hasn't done anything yet" : "Nothing here"} body={tab === "proposed" ? "When the agent wants to move money outside the rulebook, it asks you here." : "Every reminder, reply, sweep and alert is listed with its reason."} />
        </div>
      ) : (
        <div className="grid gap-6">
          {groups.map((g) => (
            <section key={g.day} aria-label={g.day}>
              <h2 className="mb-2 text-sm font-medium text-ink-2">{g.day}</h2>
              <div className="divide-y divide-line rounded-md border border-line bg-surface">
                {g.items.map((a) => (
                  <ActionRow key={a.id} action={a} buyers={buyers} invoiceNumber={numberOf(a.invoiceId)} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
