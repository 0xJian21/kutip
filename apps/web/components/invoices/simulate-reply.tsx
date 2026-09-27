"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/field";
import { DEMO_CONTROLS } from "@/components/invoices/simulate-control";
import { simulateBuyerReply } from "@/lib/data/actions";
import { MOCK } from "@/lib/ui/data";

const SAMPLES = [
  { label: "Promise", text: "Hi, sorry for the delay. Our AP run is on Friday, we will pay this on 3 October." },
  { label: "Dispute", text: "Two of the chairs arrived with cracked legs. We won't pay until this is sorted out." },
  { label: "Discount", text: "We can pay today if you give us 5% off the total." },
];

/**
 * Demo scene (dev / NEXT_PUBLIC_DEMO_CONTROLS=1): plays an inbound buyer email through
 * Jev → rules engine → agent log. No real inbound email channel exists yet.
 */
export function SimulateReply({ invoiceId, buyerName }: { invoiceId: string; buyerName: string }) {
  const [text, setText] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  if (!DEMO_CONTROLS || MOCK) return null;

  function send() {
    setError(null);
    setResult(null);
    startTransition(async () => {
      try {
        const out = await simulateBuyerReply(invoiceId, text);
        setResult(`Read as ${out.intent.replaceAll("_", " ")} (${Math.round(out.confidence * 100)}%). ${out.action.decision}`);
        setText("");
      } catch (e) {
        setError((e as Error).message);
      }
    });
  }

  return (
    <details className="mt-4 border-t border-line pt-3">
      <summary className="cursor-pointer text-sm font-medium text-ink-2">Simulate a reply from {buyerName}</summary>
      <div className="mt-3 grid gap-2">
        <div className="flex flex-wrap gap-2">
          {SAMPLES.map((s) => (
            <button key={s.label} type="button" onClick={() => setText(s.text)} className="rounded-sm border border-line px-2 py-1 text-sm text-ink-2 hover:bg-paper-2 hover:text-ink">
              {s.label}
            </button>
          ))}
        </div>
        <Textarea aria-label="Buyer reply" value={text} onChange={(e) => setText(e.target.value)} placeholder="Type what the buyer wrote back" />
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-ink-2" aria-live="polite">
            {pending ? "The agent is reading the reply…" : error ? <span className="text-disputed-fg">{error}</span> : result}
          </p>
          <Button variant="secondary" onClick={send} disabled={pending || !text.trim()}>
            {pending ? "Reading…" : "Send as buyer"}
          </Button>
        </div>
      </div>
    </details>
  );
}
