"use client";

import { ClipboardPaste, X } from "lucide-react";
import { useState, useTransition, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Field, Select, Textarea } from "@/components/ui/field";
import type { Buyer } from "@/lib/ui/types";
import { logBuyerMessage } from "./actions";

/** E2.3: paste a buyer's email or WhatsApp message into its invoice thread; the agent reads it like any other. */
export function LogMessage({
  invoices,
  buyers,
  onLogged,
}: {
  invoices: Array<{ id: string; number: string; buyerId: string }>;
  buyers: Buyer[];
  onLogged: (invoiceId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [invoiceId, setInvoiceId] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const name = (id: string) => buyers.find((b) => b.id === id)?.name ?? "";

  function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      const r = await logBuyerMessage({ invoiceId, body });
      if (!r.ok) return setError(r.error);
      setOpen(false);
      setBody("");
      onLogged(invoiceId);
    });
  }

  return (
    <>
      <Button variant="outline" size="sm" className="h-9 shrink-0" onClick={() => setOpen(true)}>
        <ClipboardPaste size={14} aria-hidden="true" />
        Log a message
      </Button>
      {open ? (
        <div className="fixed inset-0 z-40 flex items-end justify-center sm:items-center sm:px-4" role="dialog" aria-modal="true" aria-labelledby="log-title">
          <button type="button" aria-label="Close" onClick={() => setOpen(false)} className="absolute inset-0 bg-ink/30" />
          <form onSubmit={submit} className="relative grid w-full max-w-[520px] gap-4 rounded-t-2xl bg-surface p-5 shadow-float sm:rounded-2xl sm:p-6">
            <header className="flex items-start justify-between gap-3">
              <div>
                <h2 id="log-title" className="text-lg font-semibold text-ink">Log a buyer message</h2>
                <p className="mt-0.5 text-sm text-ink-2">Paste what the buyer sent you by email or WhatsApp. The agent reads it and drafts a reply for you to approve.</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink-3 hover:bg-paper-2">
                <X size={16} aria-hidden="true" />
              </button>
            </header>
            <Field label="Invoice" required>
              <Select value={invoiceId} onChange={(e) => setInvoiceId(e.target.value)} required>
                <option value="" disabled>Choose the invoice it’s about</option>
                {invoices.map((i) => (
                  <option key={i.id} value={i.id}>{i.number} · {name(i.buyerId)}</option>
                ))}
              </Select>
            </Field>
            <Field label="Their message" required hint="Only this buyer's context is shared with the agent.">
              <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={6} maxLength={8000} required placeholder="Hi, we'll pay on Friday…" />
            </Field>
            {error ? <p role="alert" className="text-sm text-disputed-fg">{error}</p> : null}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={pending || !invoiceId || !body.trim()}>{pending ? "Logging…" : "Log message"}</Button>
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
}
