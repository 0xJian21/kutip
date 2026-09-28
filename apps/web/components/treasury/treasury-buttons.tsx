"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { BnmRate } from "@/lib/ui/money";
import { CashOutDialog } from "./cash-out";
import { SweepNowDialog } from "./sweep-now";

/** The two money actions on the treasury hero, each owning its dialog. Server pages can render them directly. */
export function SweepNowButton({ rate, variant = "hero", className = "" }: { rate: BnmRate; variant?: "hero" | "primary" | "secondary"; className?: string }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  return (
    <>
      <Button variant={variant} className={className} onClick={() => setOpen(true)}>Sweep now</Button>
      <SweepNowDialog open={open} onClose={() => setOpen(false)} rate={rate} onDone={() => router.refresh()} />
    </>
  );
}

export function CashOutButton({ whitelist, variant = "heroOutline", className = "", label = "Cash out to ringgit" }: { whitelist: Array<{ label: string; address: string }>; variant?: "hero" | "heroOutline" | "primary" | "secondary" | "outline"; className?: string; label?: string }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  return (
    <>
      <Button variant={variant} className={className} onClick={() => setOpen(true)}>{label}</Button>
      <CashOutDialog open={open} onClose={() => setOpen(false)} initialWhitelist={whitelist} onDone={() => router.refresh()} />
    </>
  );
}
