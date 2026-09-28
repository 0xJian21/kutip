"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLoginWithPasskey, usePrivy, useSignupWithPasskey } from "@privy-io/react-auth";
import { useCreateWallet } from "@privy-io/react-auth/solana";
import { Check, Fingerprint, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Button, buttonClass } from "@/components/ui/button";
import { Card, Inset } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import { Stepper } from "@/components/ui/stepper";
import { Address } from "@/components/ui/address";
import { establishSession } from "@/lib/data/actions";
import { unwrap } from "@/lib/data/result";
import { useOwnerWallet } from "@/lib/treasury/owner-wallet";
import { formatUsdc } from "@/lib/ui/money";
import type { Exporter, Rulebook } from "@/lib/ui/types";

const STEPS = ["Account", "Company", "Treasury", "Agent permissions"] as const;

const TREASURY_TASKS = [
  "Creating your treasury account (Squads)",
  "Adding your passkey as the owner",
  "Adding Kutip's agent key, sweep only",
  "Preparing the USDC account",
];

export function Onboarding({ exporter, rulebook, next }: { exporter: Exporter; rulebook: Rulebook; next?: string }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [company, setCompany] = useState({ name: "", reg: "", city: "", owner: "", email: "" });
  // Logo preview only: the upload itself lands with the accounts update (PLAN.md Requests).
  const [logo, setLogo] = useState<string | null>(null);
  const [tasksDone, setTasksDone] = useState(0);
  const c = rulebook.collections;
  const t = rulebook.treasury;

  useEffect(() => {
    if (step !== 2 || tasksDone >= TREASURY_TASKS.length) return;
    const id = setTimeout(() => setTasksDone((n) => n + 1), 700);
    return () => clearTimeout(id);
  }, [step, tasksDone]);

  const companyValid = company.name.trim() && company.owner.trim() && company.email.includes("@");

  return (
    <div className="mx-auto w-full max-w-xl">
      <Stepper size="sm" className="mb-8" done={step} steps={STEPS.map((label) => ({ key: label, label }))} />

      {step === 0 ? <SignInStep onDone={() => (next ? router.replace(next) : setStep(1))} autoContinue={Boolean(next)} /> : null}

      {step === 1 ? (
        <Card className="sm:p-8">
          <h1 className="text-xl font-semibold tracking-tight text-ink">Your company</h1>
          <p className="mt-2 text-base text-ink-2">Shown on invoices, pay pages and receipts so buyers know who they are paying.</p>
          <form className="mt-6 grid gap-4" onSubmit={(e) => { e.preventDefault(); if (companyValid) setStep(2); }}>
            <Field label="Company logo" hint="PNG or SVG. Optional; your initials stand in until then.">
              <label className="flex cursor-pointer items-center gap-4 rounded-md border border-dashed border-line-strong bg-well p-4 transition-colors duration-(--dur-fast) hover:border-accent">
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (logo) URL.revokeObjectURL(logo);
                    setLogo(f ? URL.createObjectURL(f) : null);
                  }}
                />
                <Avatar name={company.name || "Your company"} src={logo} size="lg" shape="square" />
                <span className="min-w-0 flex-1">
                  <span className="block text-base text-ink">{logo ? "Looks good. Choose another to replace it." : "Drop a logo here, or click to choose"}</span>
                  <span className="block text-sm text-ink-3">Square works best, at least 128 px.</span>
                </span>
                <span className={buttonClass("outline", "sm")}><Upload size={14} aria-hidden="true" /> Choose file</span>
              </label>
            </Field>
            <Field label="Company name" required>
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
              <Field label="Your name" required>
                <Input value={company.owner} placeholder="Farid Zulkifli" onChange={(e) => setCompany({ ...company, owner: e.target.value })} required />
              </Field>
              <Field label="Email for receipts" required>
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
        </Card>
      ) : null}

      {step === 2 ? (
        <Card className="sm:p-8">
          <h1 className="text-xl font-semibold tracking-tight text-ink">{tasksDone < TREASURY_TASKS.length ? "Setting up your treasury" : "Your treasury is ready"}</h1>
          <p className="mt-2 text-base text-ink-2">An account on Solana that only your passkey controls. Kutip gets a limited key that can sweep buyer payments into it and nothing else.</p>
          <ol className="mt-6 grid gap-3" aria-live="polite">
            {TREASURY_TASKS.map((task, i) => {
              const done = i < tasksDone;
              const active = i === tasksDone;
              return (
                <li key={task} className="flex items-center gap-3 text-base">
                  <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full ${done ? "bg-accent text-on-accent" : active ? "border-2 border-accent" : "border-2 border-line"}`}>
                    {done ? <Check size={12} strokeWidth={3} aria-hidden="true" /> : active ? <span aria-hidden="true" className="h-2 w-2 animate-pulse rounded-full bg-accent" /> : null}
                  </span>
                  <span className={done ? "text-ink" : active ? "text-ink" : "text-ink-3"}>{task}</span>
                </li>
              );
            })}
          </ol>
          {tasksDone >= TREASURY_TASKS.length ? (
            <Inset className="mt-6 grid gap-2 p-4 text-sm">
              <div className="flex items-center justify-between gap-4"><span className="text-ink-2">Treasury account</span><Address value={exporter.treasuryVault} /></div>
              <div className="flex items-center justify-between gap-4"><span className="text-ink-2">Owner</span><span className="text-ink">Your passkey</span></div>
              <div className="flex items-center justify-between gap-4"><span className="text-ink-2">Kutip agent</span><span className="text-right text-ink">Sweep into treasury, max USD {formatUsdc(t.agentDailyLimitUsdc, 0)} a day</span></div>
              <div className="flex items-center justify-between gap-4"><span className="text-ink-2">Setup cost</span><span className="text-ink">Paid by Kutip</span></div>
            </Inset>
          ) : null}
          <div className="mt-6 flex justify-end">
            <Button onClick={() => setStep(3)} disabled={tasksDone < TREASURY_TASKS.length}>Continue</Button>
          </div>
        </Card>
      ) : null}

      {step === 3 ? (
        <Card className="sm:p-8">
          <h1 className="text-xl font-semibold tracking-tight text-ink">Agent permissions</h1>
          <p className="mt-2 text-base text-ink-2">What the agent may do on its own. Everything else waits for your tap. You can change any of these later in the rulebook.</p>
          <div className="mt-6 grid gap-4">
            <Inset className="p-4">
              <h2 className="text-sm font-semibold text-ink">Chasing invoices</h2>
              <ul className="mt-2 grid gap-1.5 text-base text-ink-2">
                <li>First reminder {c.firstReminderDaysBeforeDue} days before the due date.</li>
                <li>At most {c.maxMessagesPer48h} message every 48 hours, in the buyer&apos;s working hours.</li>
                <li>Never offers more than {c.maxDiscountPctWithoutApproval}% discount without asking you.</li>
                <li>Escalates to you after {c.escalateAfterOverdueReminders} overdue reminders, or on any dispute.</li>
              </ul>
            </Inset>
            <Inset className="p-4">
              <h2 className="text-sm font-semibold text-ink">Money</h2>
              <ul className="mt-2 grid gap-1.5 text-base text-ink-2">
                <li>Accepts {t.acceptedTokens.join(", ")}. SOL and USDT are converted to USDC on the spot.</li>
                <li>Sweeps buyer accounts into your treasury once a day at a random time.</li>
                <li>Can move at most USD {formatUsdc(t.agentDailyLimitUsdc, 0)} per buyer account per day. Anything else needs your approval.</li>
                <li>Tells you when the USD to MYR rate beats the 30-day average by {Number(t.cashOutAlertMarginBps) / 100}%.</li>
              </ul>
            </Inset>
          </div>
          <div className="mt-6 flex items-center justify-between gap-3">
            <Link href="/rulebook" className="text-base font-medium text-accent underline-offset-4 hover:underline">Edit the rules</Link>
            <Button onClick={() => router.push("/dashboard")}>Go to your overview</Button>
          </div>
        </Card>
      ) : null}

      <p className="mt-6 text-center text-sm text-ink-3">
        Already set up? <Link href="/dashboard" className={buttonClass("ghost", "md", "h-auto px-1 py-0 text-accent")}>Go to the overview</Link>
      </p>
    </div>
  );
}

/**
 * Real passkey sign-in (Privy). First-time users create a passkey (primary);
 * returning users log in with the one they have. Privy creates the Solana
 * embedded wallet on signup/login; its address is the owner of the treasury multisig.
 */
function SignInStep({ onDone, autoContinue }: { onDone: () => void; autoContinue: boolean }) {
  const owner = useOwnerWallet();
  const { getAccessToken } = usePrivy();
  const [session, setSession] = useState<"idle" | "pending" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [platformAuth, setPlatformAuth] = useState<boolean | null>(null);
  const onError = (e: unknown) => setError(describePasskeyError(e));
  const { loginWithPasskey, state: loginState } = useLoginWithPasskey({ onError });
  const { signupWithPasskey, state: signupState } = useSignupWithPasskey({ onError });
  const idle = (st: { status: string }) => ["initial", "error", "done"].includes(st.status);
  const busy = !idle(loginState) || !idle(signupState);
  const signedIn = owner.ready && owner.authenticated;
  const { createWallet } = useCreateWallet();
  const [walletError, setWalletError] = useState<string | null>(null);
  const creating = useRef(false);

  // Fallback for createOnLogin: a signed-in user without a Solana wallet gets one created here.
  const ensureWallet = () => {
    if (creating.current) return;
    creating.current = true;
    setWalletError(null);
    createWallet()
      .catch((e: unknown) => setWalletError(`Could not create your wallet: ${e instanceof Error ? e.message : String(e)}`))
      .finally(() => {
        creating.current = false;
      });
  };
  const needsWallet = signedIn && !owner.address;
  useEffect(() => {
    if (needsWallet) ensureWallet();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsWallet]);

  useEffect(() => {
    // Touch ID / Face ID / Windows Hello present? (async so state settles after the first paint)
    const pkc = typeof window !== "undefined" ? window.PublicKeyCredential : undefined;
    Promise.resolve()
      .then(() => pkc?.isUserVerifyingPlatformAuthenticatorAvailable?.() ?? false)
      .then(setPlatformAuth, () => setPlatformAuth(false));
  }, []);

  // The server verifies the Privy access token and sets Kutip's session cookie (lib/server/auth.ts).
  const finish = async () => {
    setSession("pending");
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("no Privy access token");
      unwrap(await establishSession(token));
      onDone();
    } catch (e) {
      setSession("error");
      setError(`Could not start your session: ${(e as Error).message}`);
    }
  };
  const ready = signedIn && Boolean(owner.address);
  const autoRan = useRef(false);
  useEffect(() => {
    if (!autoContinue || !ready || autoRan.current) return;
    autoRan.current = true;
    void finish();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoContinue, ready]);

  const run = (fn: () => Promise<void>) => {
    setError(null);
    fn().catch(() => undefined); // surfaced through onError
  };

  return (
    <Card className="sm:p-8">
      <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft text-accent">
        <Fingerprint size={24} aria-hidden="true" />
      </span>
      <h1 className="mt-4 text-xl font-semibold tracking-tight text-ink">Sign in to Kutip</h1>
      <p className="mt-2 text-base text-ink-2">Your fingerprint or face unlocks a key held securely on your device. There is no password and no seed phrase to keep.</p>
      {signedIn ? (
        <>
          <Inset className="mt-6 grid gap-2 p-4 text-sm">
            <div className="flex items-center justify-between gap-4"><span className="text-ink-2">Signed in</span><span className="inline-flex items-center gap-1 font-medium text-ink"><Check size={14} aria-hidden="true" /> Passkey</span></div>
            <div className="flex items-center justify-between gap-4"><span className="text-ink-2">Your wallet</span>{owner.address ? <Address value={owner.address} /> : <span className="text-ink-3">Creating…</span>}</div>
          </Inset>
          {walletError ? (
            <p className="mt-3 text-center text-sm text-overdue-fg">
              {walletError}{" "}
              <button type="button" onClick={ensureWallet} className="font-medium text-accent underline-offset-4 hover:underline">Try again</button>
            </p>
          ) : null}
          {owner.address ? <p className="mt-2 break-all text-center text-xs tabular text-ink-3" aria-label="Wallet address">{owner.address}</p> : null}
          {error ? <p className="mt-3 text-center text-sm text-overdue-fg">{error}</p> : null}
          <Button size="lg" className="mt-6 w-full" onClick={() => void finish()} disabled={!owner.address || session === "pending"}>{session === "pending" ? "Opening Kutip…" : "Continue"}</Button>
          <p className="mt-3 text-center text-sm text-ink-3">
            Not you? <button type="button" onClick={() => owner.logout()} className="font-medium text-accent underline-offset-4 hover:underline">Sign out</button>
          </p>
        </>
      ) : (
        <>
          <Button size="lg" className="mt-6 w-full" onClick={() => run(signupWithPasskey)} disabled={!owner.ready || busy || platformAuth === false}>
            <Fingerprint size={18} aria-hidden="true" />
            {busy ? "Checking with your device…" : "Create account with Touch ID or Face ID"}
          </Button>
          <p className="mt-3 text-center text-sm text-ink-3" aria-live="polite">
            {platformAuth === false ? (
              <span className="text-overdue-fg">This browser has no fingerprint or face unlock. Open this page in Safari or Chrome.</span>
            ) : error ? (
              <span className="text-overdue-fg">{error}</span>
            ) : (
              "Works with Touch ID, Face ID and Windows Hello"
            )}
          </p>
          <div className="mt-4 flex justify-center">
            <Button variant="outline" onClick={() => run(() => loginWithPasskey())} disabled={!owner.ready || busy || platformAuth === false}>
              I already have a passkey
            </Button>
          </div>
        </>
      )}
    </Card>
  );
}

/** Plain-English text for the WebAuthn / Privy errors a user can actually do something about. */
function describePasskeyError(e: unknown): string {
  const err = e instanceof Error ? e : { name: String(e), message: "" };
  const text = `${err.name} ${err.message}`.toLowerCase();
  if (text.includes("notallowed") || text.includes("cancel") || text.includes("abort") || text.includes("timed out") || text.includes("timeout")) {
    return "Cancelled before your device confirmed. Try again when you are ready.";
  }
  if (text.includes("notsupported") || text.includes("not supported") || text.includes("authenticator")) {
    return "Your browser could not use fingerprint or face unlock. Open this page in Safari or Chrome.";
  }
  if (text.includes("not allowed")) return "Passkey sign-in is not enabled for this app yet.";
  return `Sign-in failed: ${err.message || err.name}`;
}
