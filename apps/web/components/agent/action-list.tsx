"use client";

import { useEffect, useMemo, useState } from "react";
import { ActionRow } from "@/components/agent/action-row";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { Tabs } from "@/components/ui/tabs";
import { fetchAgentActions } from "@/lib/data/actions";
import { debounce, useBroadcast } from "@/lib/data/live";
import { mockData } from "@/lib/mock";
import { MOCK } from "@/lib/ui/data";
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

export function ActionList({ initial, buyers, invoices, exporterId }: { initial: AgentAction[]; buyers: Buyer[]; invoices: Invoice[]; exporterId: string }) {
  const [actions, setActions] = useState(initial);
  const [tab, setTab] = useState<Tab>("all");

  const refresh = useMemo(() => debounce(() => void (MOCK ? mockData.listAgentActions() : fetchAgentActions()).then(setActions).catch(() => {})), []);
  useEffect(() => (MOCK ? mockData.subscribeChanges(refresh) : undefined), [refresh]);
  useBroadcast(MOCK ? null : `owner:${exporterId}`, refresh);

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
      <Tabs
        label="Filter"
        className="-mx-4 mb-4 overflow-x-auto px-4 sm:mx-0 sm:px-0 [&>ul]:flex-nowrap sm:[&>ul]:flex-wrap"
        value={tab}
        onChange={setTab}
        items={TABS.map((t) => ({ value: t.value, label: t.label, count: counts[t.value], countTone: t.value === "proposed" ? "warn" : undefined }))}
      />

      {groups.length === 0 ? (
        <Card padded={false}>
          <EmptyState title={tab === "all" ? "The agent hasn't done anything yet" : "Nothing here"} body={tab === "proposed" ? "When the agent wants to move money outside the rulebook, it asks you here." : "Every reminder, reply, sweep and alert is listed with its reason."} />
        </Card>
      ) : (
        <div className="grid gap-6">
          {groups.map((g) => (
            <section key={g.day} aria-label={g.day}>
              <h2 className="mb-2 px-1 text-sm font-medium text-ink-2">{g.day}</h2>
              <Card padded={false} className="divide-y divide-line overflow-hidden py-1">
                {g.items.map((a) => (
                  <ActionRow key={a.id} action={a} buyers={buyers} invoiceNumber={numberOf(a.invoiceId)} />
                ))}
              </Card>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
