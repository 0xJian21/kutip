"use client";

import { Fingerprint } from "lucide-react";
import { useState, useTransition } from "react";
import { Address } from "@/components/ui/address";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Inset } from "@/components/ui/card";
import { Field, Input, PrefixedInput, Select } from "@/components/ui/field";
import { Facts } from "@/components/ui/panel";
import { Chip } from "@/components/ui/status-pill";
import { Stepper } from "@/components/ui/stepper";
import { cashOutPreview, cashOutPropose, whitelistAdd, whitelistStatementFor, type CashOutPreview } from "@/lib/data/treasury-actions";
import { useApproveProposal } from "@/lib/treasury/use-approve-proposal";
import { describeSigningError, useOwnerSignature } from "@/lib/treasury/use-owner-signature";
import { formatBps, formatMyr, formatRate, formatSol, formatUsdc, parseUsdc } from "@/lib/ui/money";

const STEPS = [
  { key: "quote", label: "Quote" },
  { key: "proposed", label: "Proposed by agent" },
  { key: "approved", label: "Approved with Touch ID" },
  { key: "chain", label: "On Solana" },
];

type Phase = { kind: "quote" } | { kind: "proposing" } | { kind: "approving"; index: string } | { kind: "done"; signature: string; index: string } | { kind: "error"; error: string };

/**
 * Cash out to ringgit (IMPROVEMENTS T4): indicative quote (USDC × BNM rate − exchange fee
 * estimate), destination = the owner's own whitelisted exchange deposit address (HATA, USDC on
 * Solana), then agent proposal → owner approves + executes with Touch ID. MYRC is shown
 * disabled until BNM's ringgit-stablecoin framework lands.
 */
export function CashOutDialog({ open, onClose, initialWhitelist, onDone }: { open: boolean; onClose: () => void; initialWhitelist: Array<{ label: string; address: string }>; onDone?: () => void }) {
  const [amountText, setAmountText] = useState("");
  const [destination, setDestination] = useState(initialWhitelist[0]?.address ?? "");
  const [whitelist, setWhitelist] = useState(initialWhitelist);
  const [preview, setPreview] = useState<CashOutPreview | null>(null);
  const [phase, setPhase] = useState<Phase>({ kind: "quote" });
  const [pending, start] = useTransition();
  const { approve, owner } = useApproveProposal();
  const amount = parseUsdc(amountText);

  function quote(next?: { amount?: bigint; destination?: string }) {
    const a = next?.amount ?? amount;
    if (a === null) return setPreview(null);
    start(async () => {
      const r = await cashOutPreview({ amountUsdc: a, destination: next?.destination ?? destination });
      setPreview(r.ok ? r.value : null);
      if (!r.ok) setPhase({ kind: "error", error: r.error });
    });
  }

  function propose() {
    if (!preview?.ok || !preview.destination) return setPhase({ kind: "error", error: preview?.problem ?? "Enter an amount and pick a whitelisted address first." });
    if (!owner.wallet) return setPhase({ kind: "error", error: owner.ready ? "Your Privy wallet is not connected in this tab. Reload the page and sign in again." : "Still connecting to your wallet, try again in a moment." });
    setPhase({ kind: "proposing" });
    start(async () => {
      const p = await cashOutPropose({ amountUsdc: preview.amountUsdc, destination: preview.destination!.address });
      if (!p.ok) return setPhase({ kind: "error", error: p.error });
      setPhase({ kind: "approving", index: p.value.transactionIndex });
      try {
        const signature = await approve(p.value.transactionIndex, p.value.actionId);
        setPhase({ kind: "done", signature, index: p.value.transactionIndex });
        onDone?.();
      } catch (e) {
        setPhase({ kind: "error", error: `Proposal #${p.value.transactionIndex} is waiting under Agent activity. ${describeSigningError(e)}` });
      }
    });
  }

  const step = phase.kind === "done" ? 4 : phase.kind === "approving" ? 2 : phase.kind === "proposing" ? 1 : preview?.ok ? 1 : 0;

  return (
    <Dialog open={open} onClose={onClose} title="Cash out to ringgit" caption="USDC goes from your treasury to your own exchange account. The exchange pays your bank. Kutip never touches ringgit.">
      <Stepper size="sm" steps={STEPS} done={step} live={phase.kind === "proposing" || phase.kind === "approving"} className="mb-5" />

      {phase.kind === "quote" || phase.kind === "error" ? (
        <div className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Amount" hint={preview ? `Treasury holds USD ${formatUsdc(preview.treasuryBalanceUsdc)}` : undefined} error={amountText && amount === null ? "Enter a USDC amount, e.g. 2500.00" : undefined}>
              <PrefixedInput prefix="USDC" inputMode="decimal" placeholder="2500.00" value={amountText} onChange={(e) => setAmountText(e.target.value)} onBlur={() => quote()} />
            </Field>
            <Field label="Send to">
              <Select value={destination} onChange={(e) => { setDestination(e.target.value); quote({ destination: e.target.value }); }}>
                {whitelist.length === 0 ? <option value="">Whitelist an address first</option> : null}
                {whitelist.map((w) => (
                  <option key={w.address} value={w.address}>{w.label}</option>
                ))}
                <option value="myrc" disabled>MYRC ringgit stablecoin · when BNM approves</option>
              </Select>
            </Field>
          </div>

          {preview ? (
            <Inset className="p-4">
              <div className="flex items-baseline justify-between gap-4">
                <span className="text-sm text-ink-2">You would receive about</span>
                <span className="money text-money-md text-ink">{formatMyr(preview.netMyrSen)}</span>
              </div>
              <Facts
                className="mt-3"
                items={[
                  { label: `USD ${formatUsdc(preview.amountUsdc)} × BNM ${formatRate(preview.rate)}`, value: formatMyr(preview.grossMyrSen), muted: true },
                  { label: `Exchange fee, about ${formatBps(preview.feeBps).slice(1)}`, value: `− ${formatMyr(preview.feeMyrSen)}`, muted: true },
                  { label: "Network fee", value: `${formatSol(preview.rentLamports, 4)} SOL, paid by Kutip`, muted: true },
                  { label: "Timing", value: <span className={preview.timing.good ? "text-paid-fg" : "text-ink-2"}>{preview.timing.good ? "Good time" : "Below your alert margin"} · rate {formatBps(preview.timing.aboveBps)} vs 30-day average</span> },
                ]}
              />
              <p className="mt-3 text-xs text-ink-3">Indicative. The exchange&apos;s own rate and fee apply when you sell there; BNM reference rate for {preview.rate.date}.</p>
              {preview.problem ? <p className="mt-2 text-sm text-disputed-fg">{preview.problem}</p> : null}
            </Inset>
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            <Chip tone="accent">Rule T4</Chip>
            <span className="text-sm text-ink-2">Any movement other than the daily sweep needs your approval with Touch ID.</span>
          </div>

          <WhitelistAdd onAdded={(list) => { setWhitelist(list); if (!destination && list[0]) { setDestination(list[0].address); quote({ destination: list[0].address }); } }} />
          {phase.kind === "error" ? <p role="alert" className="text-sm text-disputed-fg">{phase.error}</p> : null}
        </div>
      ) : null}

      {phase.kind === "proposing" ? <p className="text-base text-ink-2">The agent is writing the proposal on Solana…</p> : null}
      {phase.kind === "approving" ? <p className="text-base text-ink-2" aria-live="polite">Proposal #{phase.index} created. Your device will ask for Touch ID or Face ID to approve and execute it.</p> : null}
      {phase.kind === "done" && preview ? (
        <Inset className="grid gap-2 p-4 text-sm">
          <p className="text-base font-medium text-ink">Sent {formatUsdc(preview.amountUsdc)} USDC to {preview.destination?.label}</p>
          <div className="flex items-center justify-between gap-3"><span className="text-ink-2">Proposal</span><span className="tabular text-ink">#{phase.index}</span></div>
          <div className="flex items-center justify-between gap-3"><span className="text-ink-2">Transaction</span><Address value={phase.signature} kind="tx" label="View on Solscan" /></div>
          <p className="text-xs text-ink-3">Sell the USDC in your exchange app and withdraw ringgit to your bank.</p>
        </Inset>
      ) : null}

      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>{phase.kind === "done" ? "Close" : "Cancel"}</Button>
        {phase.kind === "quote" || phase.kind === "error" ? (
          <Button variant="secondary" onClick={propose} disabled={pending}>
            <Fingerprint size={16} aria-hidden="true" /> Propose and approve with Touch ID
          </Button>
        ) : null}
      </div>
    </Dialog>
  );
}

/** Owner whitelists their own exchange deposit address once, signed with the passkey wallet. */
export function WhitelistAdd({ onAdded }: { onAdded: (list: Array<{ label: string; address: string }>) => void }) {
  const [openForm, setOpenForm] = useState(false);
  const [label, setLabel] = useState("HATA USDC deposit (Solana)");
  const [address, setAddress] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const { sign, owner } = useOwnerSignature();

  function submit() {
    setError(null);
    if (!address.trim()) return setError("Paste the deposit address first.");
    if (!owner.wallet) return setError(owner.ready ? "Your Privy wallet is not connected in this tab. Reload the page and sign in again." : "Still connecting to your wallet, try again in a moment.");
    start(async () => {
      try {
        const st = await whitelistStatementFor(address.trim(), owner.address);
        if (!st.ok) throw new Error(st.error);
        const signed = await sign(st.value);
        const r = await whitelistAdd({ label, address: address.trim(), signedTransaction: signed.signedTransaction });
        if (!r.ok) throw new Error(r.error);
        onAdded(r.value);
        setOpenForm(false);
        setAddress("");
      } catch (e) {
        setError(describeSigningError(e));
      }
    });
  }

  if (!openForm) {
    return (
      <button type="button" onClick={() => setOpenForm(true)} className="justify-self-start text-sm font-medium text-accent underline-offset-4 hover:underline">
        Add your exchange deposit address
      </button>
    );
  }
  return (
    <Inset className="grid gap-3 p-4">
      <p className="text-sm text-ink-2">In the HATA app, open Deposit → USDC → Solana network and copy the address. Only you can add addresses, with Touch ID.</p>
      <Field label="Label"><Input value={label} onChange={(e) => setLabel(e.target.value)} /></Field>
      <Field label="Solana address"><Input value={address} placeholder="Your USDC deposit address on Solana" onChange={(e) => setAddress(e.target.value)} className="font-mono text-sm" /></Field>
      {error ? <p className="text-sm text-disputed-fg">{error}</p> : null}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={() => setOpenForm(false)}>Cancel</Button>
        <Button size="sm" onClick={submit} disabled={pending}><Fingerprint size={14} aria-hidden="true" /> {pending ? "Waiting for Touch ID…" : "Whitelist with Touch ID"}</Button>
      </div>
    </Inset>
  );
}
