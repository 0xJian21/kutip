"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Fingerprint } from "lucide-react";
import { useEffect, useState } from "react";
import { Button, buttonClass } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Address } from "@/components/ui/address";
import { formatUsdc } from "@/lib/ui/money";
import type { Exporter, Rulebook } from "@/lib/ui/types";

const STEPS = ["Sign in", "Your company", "Treasury", "Rulebook"] as const;

const TREASURY_TASKS = [
  "Creating your treasury account (Squads)",
  "Adding your passkey as the owner",
  "Adding Kutip's agent key, sweep only",
  "Preparing the USDC account",
];

export function Onboarding({ exporter, rulebook }: { exporter: Exporter; rulebook: Rulebook }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [auth, setAuth] = useState<"idle" | "checking" | "ok">("idle");
  const [company, setCompany] = useState({ name: "", reg: "", city: "", owner: "", email: "" });
  const [tasksDone, setTasksDone] = useState(0);
  const c = rulebook.collections;
  const t = rulebook.treasury;

  useEffect(() => {
    if (auth !== "checking") return;
    const a = setTimeout(() => setAuth("ok"), 1400);
    const b = setTimeout(() => setStep(1), 2300);
    return () => {
      clearTimeout(a);
      clearTimeout(b);
    };
  }, [auth]);

  useEffect(() => {
    if (step !== 2 || tasksDone >= TREASURY_TASKS.length) return;
    const id = setTimeout(() => setTasksDone((n) => n + 1), 700);
    return () => clearTimeout(id);
  }, [step, tasksDone]);

  const companyValid = company.name.trim() && company.owner.trim() && company.email.includes("@");

  return (
    <div className="mx-auto w-full max-w-lg">
      <ol className="mb-8 grid grid-cols-4 gap-1.5" aria-label="Setup progress">
        {STEPS.map((s, i) => (
          <li key={s} aria-current={i === step ? "step" : undefined}>
            <div className={`h-1.5 rounded-full ${i <= step ? "bg-accent" : "bg-line"}`} />
            <div className={`mt-1.5 truncate text-xs ${i === step ? "font-medium text-ink" : "text-ink-3"}`}>{s}</div>
          </li>
        ))}
      </ol>

      {step === 0 ? (
        <section className="rounded-lg border border-line bg-surface p-6 sm:p-8">
          <h1 className="text-xl font-semibold text-ink">Sign in to Kutip</h1>
          <p className="mt-2 text-base text-ink-2">Your fingerprint or face unlocks a key held securely on your device. There is no password and no seed phrase to keep.</p>
          <Button size="lg" className="mt-6 w-full" onClick={() => setAuth("checking")} disabled={auth !== "idle"}>
            {auth === "ok" ? <Check size={18} aria-hidden="true" /> : <Fingerprint size={18} aria-hidden="true" />}
            {auth === "idle" ? "Continue with fingerprint / Face ID" : auth === "checking" ? "Checking with your device…" : "Signed in"}
          </Button>
          <p className="mt-3 text-center text-sm text-ink-3" aria-live="polite">
            {auth === "ok" ? `Signed in as ${exporter.ownerName}` : "Works with Touch ID, Face ID and Windows Hello"}
          </p>
        </section>
      ) : null}

      {step === 1 ? (
        <section className="rounded-lg border border-line bg-surface p-6 sm:p-8">
          <h1 className="text-xl font-semibold text-ink">Your company</h1>
          <p className="mt-2 text-base text-ink-2">Shown on pay pages and receipts so buyers know who they are paying.</p>
          <form className="mt-6 grid gap-4" onSubmit={(e) => { e.preventDefault(); if (companyValid) setStep(2); }}>
            <Field label="Company name">
              <Input value={company.name} placeholder="Teratai Woodworks Sdn. Bhd." onChange={(e) => setCompany({ ...company, name: e.target.value })} required />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="SSM registration number" hint="Optional, for e-invoicing later">
                <Input value={company.reg} placeholder="202001034567" onChange={(e) => setCompany({ ...company, reg: e.target.value })} />
              </Field>
              <Field label="City">
                <Input value={company.city} placeholder="Muar, Johor" onChange={(e) => setCompany({ ...company, city: e.target.value })} />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Your name">
                <Input value={company.owner} placeholder="Farid Zulkifli" onChange={(e) => setCompany({ ...company, owner: e.target.value })} required />
              </Field>
              <Field label="Email for receipts">
                <Input type="email" value={company.email} placeholder="farid@teratai.example" onChange={(e) => setCompany({ ...company, email: e.target.value })} required />
              </Field>
            </div>
            <div className="mt-2 flex items-center justify-between gap-3">
              <button type="button" onClick={() => setCompany({ name: exporter.name, reg: exporter.registrationNo, city: exporter.city, owner: exporter.ownerName, email: "farid@teratai.example" })} className="text-base font-medium text-accent underline-offset-4 hover:underline">
                Use demo details
              </button>
              <Button type="submit" disabled={!companyValid}>Continue</Button>
            </div>
          </form>
        </section>
      ) : null}

      {step === 2 ? (
        <section className="rounded-lg border border-line bg-surface p-6 sm:p-8">
          <h1 className="text-xl font-semibold text-ink">{tasksDone < TREASURY_TASKS.length ? "Setting up your treasury" : "Your treasury is ready"}</h1>
          <p className="mt-2 text-base text-ink-2">An account on Solana that only your passkey controls. Kutip gets a limited key that can sweep buyer payments into it and nothing else.</p>
          <ol className="mt-6 grid gap-3" aria-live="polite">
            {TREASURY_TASKS.map((task, i) => {
              const done = i < tasksDone;
              const active = i === tasksDone;
              return (
                <li key={task} className="flex items-center gap-3 text-base">
                  <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full ${done ? "bg-paid-bg text-paid-fg" : active ? "bg-accent-soft" : "bg-paper-2"}`}>
                    {done ? <Check size={12} strokeWidth={2.5} aria-hidden="true" /> : active ? <span aria-hidden="true" className="h-2 w-2 animate-pulse rounded-full bg-accent" /> : null}
                  </span>
                  <span className={done ? "text-ink" : active ? "text-ink" : "text-ink-3"}>{task}</span>
                </li>
              );
            })}
          </ol>
          {tasksDone >= TREASURY_TASKS.length ? (
            <div className="mt-6 grid gap-2 rounded-md bg-paper p-4 text-sm">
              <div className="flex items-center justify-between gap-4"><span className="text-ink-2">Treasury account</span><Address value={exporter.treasuryVault} /></div>
              <div className="flex items-center justify-between gap-4"><span className="text-ink-2">Owner</span><span className="text-ink">Your passkey</span></div>
              <div className="flex items-center justify-between gap-4"><span className="text-ink-2">Kutip agent</span><span className="text-ink">Sweep into treasury, max USD {formatUsdc(t.agentDailyLimitUsdc, 0)} a day</span></div>
              <div className="flex items-center justify-between gap-4"><span className="text-ink-2">Setup cost</span><span className="text-ink">Paid by Kutip</span></div>
            </div>
          ) : null}
          <div className="mt-6 flex justify-end">
            <Button onClick={() => setStep(3)} disabled={tasksDone < TREASURY_TASKS.length}>Continue</Button>
          </div>
        </section>
      ) : null}

      {step === 3 ? (
        <section className="rounded-lg border border-line bg-surface p-6 sm:p-8">
          <h1 className="text-xl font-semibold text-ink">How the agent will behave</h1>
          <p className="mt-2 text-base text-ink-2">These are the starting rules. You can change any of them later; the agent never steps outside them.</p>
          <div className="mt-6 grid gap-5">
            <div>
              <h2 className="text-sm font-medium text-ink-2">Chasing invoices</h2>
              <ul className="mt-2 grid gap-1.5 text-base text-ink">
                <li>First reminder {c.firstReminderDaysBeforeDue} days before the due date.</li>
                <li>At most {c.maxMessagesPer48h} message every 48 hours, in the buyer&apos;s working hours.</li>
                <li>Never offers more than {c.maxDiscountPctWithoutApproval}% discount without asking you.</li>
                <li>Escalates to you after {c.escalateAfterOverdueReminders} overdue reminders, or on any dispute.</li>
              </ul>
            </div>
            <div>
              <h2 className="text-sm font-medium text-ink-2">Money</h2>
              <ul className="mt-2 grid gap-1.5 text-base text-ink">
                <li>Accepts {t.acceptedTokens.join(", ")}. SOL and USDT are converted to USDC on the spot.</li>
                <li>Sweeps buyer accounts into your treasury once a day at a random time.</li>
                <li>Can move at most USD {formatUsdc(t.agentDailyLimitUsdc, 0)} per buyer account per day. Anything else needs your approval.</li>
                <li>Tells you when the USD to MYR rate beats the 30-day average by {Number(t.cashOutAlertMarginBps) / 100}%.</li>
              </ul>
            </div>
          </div>
          <div className="mt-6 flex items-center justify-between gap-3">
            <Link href="/rulebook" className="text-base font-medium text-accent underline-offset-4 hover:underline">Edit the rules</Link>
            <Button onClick={() => router.push("/dashboard")}>Go to your overview</Button>
          </div>
        </section>
      ) : null}

      <p className="mt-6 text-center text-sm text-ink-3">
        Already set up? <Link href="/dashboard" className={buttonClass("ghost", "md", "h-auto px-1 py-0 text-accent")}>Go to the overview</Link>
      </p>
    </div>
  );
}
