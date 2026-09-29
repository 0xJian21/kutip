"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { ArrowLeft, ClipboardPaste, MessageSquare, Sparkles } from "lucide-react";
import type { InboxThread, InboxThreadDetail } from "@kutip/db";
import { Avatar } from "@/components/ui/avatar";
import { RowItem, RowList } from "@/components/ui/row-list";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/field";
import { EmptyState } from "@/components/ui/states";
import { Tabs } from "@/components/ui/tabs";
import { useBroadcast } from "@/lib/data/live";
import { relativeTime } from "@/lib/ui/format";
import type { BnmRate, Buyer } from "@/lib/ui/types";
import { fetchThread, fetchThreads } from "./actions";
import { LogMessage } from "./log-message";
import { IntentChip } from "./intent";
import { ThreadView } from "./thread-view";

type View = "all" | "needs_reply" | "disputed";
type InvoiceOption = { id: string; number: string; buyerId: string };

/**
 * Unified inbox (IMPROVEMENTS M1): one thread per invoice across all buyers, filters for buyer,
 * needs-reply and disputed, the agent's reading on each thread, and the reply composer (M2).
 * Content-free Realtime "changed" events → refetch through the server.
 */
export function InboxView({
  exporterId,
  initialThreads,
  initialDetail,
  buyers,
  invoices,
  rate,
  openOnMobile,
}: {
  exporterId: string;
  initialThreads: InboxThread[];
  initialDetail: InboxThreadDetail | null;
  buyers: Buyer[];
  invoices: InvoiceOption[];
  rate: BnmRate;
  openOnMobile: boolean;
}) {
  const [threads, setThreads] = useState(initialThreads);
  const [detail, setDetail] = useState(initialDetail);
  const [selected, setSelected] = useState(initialDetail?.invoice.id ?? null);
  const [showDetail, setShowDetail] = useState(openOnMobile);
  const [view, setView] = useState<View>("all");
  const [buyerId, setBuyerId] = useState("");
  const [loading, start] = useTransition();
  const current = useRef(selected);

  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  /** Collapse bursts of "changed" events into one refetch of the list and the open thread. */
  function refresh() {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      void fetchThreads().then((r) => r.ok && setThreads(r.value));
      const id = current.current;
      if (id) void fetchThread(id).then((r) => r.ok && id === current.current && setDetail(r.value));
    }, 400);
  }
  useBroadcast(`owner:${exporterId}`, refresh);

  function open(invoiceId: string) {
    current.current = invoiceId;
    setSelected(invoiceId);
    setShowDetail(true);
    window.history.replaceState(null, "", `/inbox?thread=${invoiceId}`);
    start(async () => {
      const r = await fetchThread(invoiceId);
      if (r.ok) setDetail(r.value);
    });
  }

  const visible = threads.filter(
    (t) =>
      (!buyerId || t.buyerId === buyerId) &&
      (view === "all" || (view === "needs_reply" ? t.needsReply : t.invoiceStatus === "disputed" || t.lastIntent?.intent === "dispute")),
  );
  const count = (v: View) => threads.filter((t) => (!buyerId || t.buyerId === buyerId) && (v === "all" || (v === "needs_reply" ? t.needsReply : t.invoiceStatus === "disputed" || t.lastIntent?.intent === "dispute"))).length;


  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] lg:gap-6">
      <div className={`grid min-w-0 content-start gap-4 ${showDetail ? "max-lg:hidden" : ""}`}>
        <div className="flex flex-wrap items-center gap-2">
          <Tabs<View>
            label="Filter threads"
            size="sm"
            value={view}
            onChange={setView}
            items={[
              { value: "all", label: "All", count: count("all") },
              { value: "needs_reply", label: "Needs reply", count: count("needs_reply"), countTone: "warn" },
              { value: "disputed", label: "Disputed", count: count("disputed"), countTone: "warn" },
            ]}
          />
        </div>
        <div className="flex gap-2">
          <Select aria-label="Buyer" value={buyerId} onChange={(e) => setBuyerId(e.target.value)} className="h-9 flex-1">
            <option value="">All buyers</option>
            {buyers.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </Select>
          <LogMessage invoices={invoices} buyers={buyers} onLogged={(invoiceId) => (open(invoiceId), refresh())} />
        </div>

        <Card padded={false} className="overflow-hidden">
          {visible.length === 0 ? (
            <EmptyState
              compact
              title={threads.length ? "No threads match" : "No conversations yet"}
              body={threads.length ? "Try another filter." : "Reminders, buyer questions from the pay page and messages you log show up here."}
            />
          ) : (
            <RowList stacked label="Conversations">
              {visible.map((t) => (
                <RowItem
                  key={t.invoiceId}
                  stacked
                  onClick={() => open(t.invoiceId)}
                  selected={t.invoiceId === selected}
                  lead={<Avatar name={t.buyerName} size="sm" shape="square" />}
                  status={
                    t.needsReply || t.hasDraft || t.lastIntent ? (
                      <span className="flex flex-col items-end gap-1">
                        {t.needsReply ? <span className="inline-flex h-5 items-center whitespace-nowrap rounded-full bg-overdue-bg px-2 text-xs font-medium text-overdue-fg">Needs reply</span> : null}
                        {t.hasDraft ? (
                          <span className="inline-flex h-5 items-center gap-1 whitespace-nowrap rounded-full bg-accent-soft px-2 text-xs font-medium text-accent">
                            <Sparkles size={11} aria-hidden="true" />
                            Draft ready
                          </span>
                        ) : null}
                        {t.lastIntent ? <IntentChip intent={t.lastIntent.intent} /> : null}
                      </span>
                    ) : undefined
                  }
                >
                  <span className={`line-clamp-2 text-base leading-snug ${t.needsReply ? "font-semibold text-ink" : "font-medium text-ink"}`}>{t.buyerName}</span>
                  <span className="block text-sm tabular text-ink-2">
                    <span className="whitespace-nowrap">{t.invoiceNumber}</span> · <span className="whitespace-nowrap">{relativeTime(t.last.createdAt)}</span>
                  </span>
                  <span className="mt-0.5 block truncate text-sm text-ink-2">
                    {t.last.direction === "out" ? "You: " : ""}
                    {t.last.body}
                  </span>
                </RowItem>
              ))}
            </RowList>
          )}
        </Card>
      </div>

      <div className={`min-w-0 ${showDetail ? "" : "max-lg:hidden"}`}>
        <button type="button" onClick={() => setShowDetail(false)} className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-ink-2 hover:text-ink lg:hidden">
          <ArrowLeft size={14} aria-hidden="true" />
          All threads
        </button>
        {detail ? (
          <ThreadView key={detail.invoice.id} detail={detail} rate={rate} busy={loading} onChanged={refresh} />
        ) : (
          <Card>
            <EmptyState
              title="Pick a thread"
              body="Or ask a buyer to use the message box on their pay link."
              action={
                <Link href="/invoices" className="inline-flex items-center gap-1.5 text-sm font-medium text-accent underline-offset-4 hover:underline">
                  <MessageSquare size={14} aria-hidden="true" />
                  Go to invoices
                </Link>
              }
            />
          </Card>
        )}
        <p className="mt-3 flex items-center gap-1.5 px-1 text-xs text-ink-3">
          <ClipboardPaste size={12} aria-hidden="true" />
          Got a reply by email or WhatsApp? Use “Log a message” so the agent reads it too.
        </p>
      </div>
    </div>
  );
}
