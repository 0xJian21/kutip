"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { data } from "@/lib/ui/data";
import type { InvoiceStatus, SimulationStage } from "@/lib/ui/types";

const STAGE_TEXT: Record<SimulationStage, string> = {
  seen: "Payment seen (processed)…",
  paid: "Paid (confirmed). Settling in about 13 s…",
  settled: "Settled (finalized).",
};

export const DEMO_CONTROLS = process.env.NODE_ENV !== "production" || process.env.NEXT_PUBLIC_DEMO_CONTROLS === "1";

/** Dev-only. Walks an invoice through seen → paid → settled with realistic delays. */
export function SimulateControl({ invoiceId, status, compact = false }: { invoiceId: string; status: InvoiceStatus; compact?: boolean }) {
  const [running, setRunning] = useState(false);
  const [stage, setStage] = useState<SimulationStage | null>(null);
  if (!DEMO_CONTROLS) return null;

  const finished = status === "settled";

  async function run() {
    setRunning(true);
    setStage(null);
    await data.simulatePayment(invoiceId, { onStage: setStage });
    setRunning(false);
  }

  function reset() {
    data.resetSimulation();
    setStage(null);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {stage && running ? <span className="text-sm text-ink-2" aria-live="polite">{STAGE_TEXT[stage]}</span> : null}
      {finished ? (
        <Button variant="ghost" onClick={reset}>Reset demo</Button>
      ) : (
        <Button variant="secondary" onClick={run} disabled={running}>
          {running ? "Paying…" : compact ? "Simulate" : "Simulate payment"}
        </Button>
      )}
    </div>
  );
}
