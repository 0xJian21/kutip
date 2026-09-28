"use client";

import { MessageSquare, Send } from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/field";
import { useBroadcast } from "@/lib/data/live";
import { MOCK } from "@/lib/ui/data";
import { formatDateTime } from "@/lib/ui/format";

type PayMessage = { id: string; from: "buyer" | "seller"; body: string; createdAt: string };

const MAX = 1000;

async function getThread(invoiceId: string): Promise<PayMessage[] | null> {
  const res = await fetch(`/api/messages/pay/${invoiceId}`, { cache: "no-store" }).catch(() => null);
  return res?.ok ? ((await res.json()) as { messages: PayMessage[] }).messages : null;
}

/**
 * Buyer ↔ seller thread under the pay card (IMPROVEMENTS E2.1). Scoped to this one invoice: the server
 * returns only its pay-page messages, and the seller's replies appear once the owner approves them
 * (or, for routine answers, when the owner allows the agent to answer on its own).
 */
export function MessageThread({ invoiceId, exporterName }: { invoiceId: string; exporterName: string }) {
  const [messages, setMessages] = useState<PayMessage[]>([]);
  const [text, setText] = useState("");
  const [state, setState] = useState<{ status: "idle" | "sending" | "sent" } | { status: "error"; message: string }>({ status: "idle" });

  const load = useCallback(() => void getThread(invoiceId).then((m) => m && setMessages(m)), [invoiceId]);

  useEffect(() => {
    let live = true;
    void getThread(invoiceId).then((m) => live && m && setMessages(m));
    return () => {
      live = false;
    };
  }, [invoiceId]);
  // Content-free "message" event on the invoice topic → refetch through the server, which decides what's visible.
  useBroadcast(MOCK ? null : `invoice:${invoiceId}`, (event) => event === "message" && load());

  async function send(e: FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body || state.status === "sending") return;
    setState({ status: "sending" });
    const res = await fetch(`/api/messages/pay/${invoiceId}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ body }),
    }).catch(() => null);
    if (!res) return setState({ status: "error", message: "Couldn't reach the server. Check your connection and try again." });
    if (!res.ok) return setState({ status: "error", message: ((await res.json().catch(() => ({}))) as { message?: string }).message ?? "Couldn't send that. Try again." });
    setText("");
    setState({ status: "sent" });
    load();
  }

  const first = exporterName.split(/\s+/).slice(0, 2).join(" ");
  const waiting = messages.length > 0 && messages[messages.length - 1]!.from === "buyer";

  return (
    <Card>
      <h2 className="flex items-center gap-2 text-md font-semibold text-ink">
        <MessageSquare size={18} aria-hidden="true" className="text-accent" />
        Questions about this invoice?
      </h2>
      <p className="mt-1 text-sm text-ink-2">Message {exporterName}. Only you and they can see this conversation.</p>

      {messages.length ? (
        <ol className="mt-4 grid gap-3" aria-live="polite">
          {messages.map((m) => {
            const mine = m.from === "buyer";
            return (
              <li key={m.id} className={`max-w-[85%] rounded-lg px-3.5 py-2.5 ${mine ? "ml-auto bg-accent-soft" : "bg-paper-2"}`}>
                <div className="flex items-baseline justify-between gap-3 text-xs text-ink-3">
                  <span className="font-medium text-ink-2">{mine ? "You" : first}</span>
                  <time dateTime={m.createdAt} className="tabular">{formatDateTime(m.createdAt, Intl.DateTimeFormat().resolvedOptions().timeZone)}</time>
                </div>
                <p className="mt-1 whitespace-pre-line text-base text-ink">{m.body}</p>
              </li>
            );
          })}
        </ol>
      ) : null}
      {waiting ? <p className="mt-3 text-sm text-ink-3">{first} will reply here. You can keep this page open or come back to the same link.</p> : null}

      <form onSubmit={send} className="mt-4 grid gap-2">
        <label htmlFor="buyer-message" className="sr-only">Your message</label>
        <Textarea
          id="buyer-message"
          value={text}
          maxLength={MAX}
          rows={3}
          placeholder="For example: can you send the invoice as a PDF?"
          onChange={(e) => {
            setText(e.target.value);
            if (state.status !== "sending") setState({ status: "idle" });
          }}
        />
        <div className="flex items-center justify-between gap-3">
          <span className={`text-xs tabular ${text.length > MAX - 50 ? "text-overdue-fg" : "text-ink-3"}`}>
            {text.length}/{MAX}
          </span>
          <Button type="submit" size="sm" disabled={!text.trim() || state.status === "sending"}>
            <Send size={14} aria-hidden="true" />
            {state.status === "sending" ? "Sending…" : "Send"}
          </Button>
        </div>
        {state.status === "error" ? <p role="alert" className="text-sm text-disputed-fg">{state.message}</p> : null}
        {state.status === "sent" ? <p role="status" className="text-sm text-paid-fg">Sent to {exporterName}.</p> : null}
      </form>
    </Card>
  );
}
