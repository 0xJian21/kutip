"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLoginWithEmail, useLoginWithPasskey, usePrivy, useSignupWithPasskey } from "@privy-io/react-auth";
import { useCreateWallet } from "@privy-io/react-auth/solana";
import { Check, Fingerprint, Mail, Upload } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { AgentPermissionsForm } from "@/components/settings/agent-permissions";
import { Avatar } from "@/components/ui/avatar";
import { Button, buttonClass } from "@/components/ui/button";
import { Card, Inset } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Stepper } from "@/components/ui/stepper";
import { Address } from "@/components/ui/address";
import { establishSession } from "@/lib/data/actions";
import { agentPermissions, completeOnboarding, logoUploadForSignup, type PermissionsView } from "@/lib/data/treasury-actions";
import { unwrap } from "@/lib/data/result";
import { useOwnerWallet } from "@/lib/treasury/owner-wallet";
import type { Exporter, Rulebook } from "@/lib/ui/types";

const STEPS = ["Account", "Company", "Treasury", "Agent permissions"] as const;

const TREASURY_TASKS = [
  "Creating your treasury account (Squads)",
  "Adding your passkey as the owner",
  "Adding Kutip's agent key, sweep only",
  "Preparing the USDC account",
];

type Company = { name: string; registrationNo: string; city: string; address: string; contactEmail: string; ownerName: string; logoUrl?: string };

/**
 * Onboarding (SPEC F1, IMPROVEMENTS R1–R4). Sign in with a passkey or an email code;
 * a sign-in that already belongs to a Kutip account goes straight to the app (R3).
 * New users describe their company (logo included), get a real Squads treasury on
 * Solana, then approve the agent's permissions once with Touch ID.
 */
export function Onboarding({ exporter, rulebook, next }: { exporter: Exporter; rulebook: Rulebook; next?: string }) {
  const router = useRouter();
  const { getAccessToken, logout, user } = usePrivy();
  const [step, setStep] = useState(0);
  const [company, setCompany] = useState<Company>({ name: "", registrationNo: "", city: "", address: "", contactEmail: "", ownerName: "" });
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [uploading, startUpload] = useTransition();
  const [provision, setProvision] = useState<{ status: "idle" | "running" | "done" | "error"; tasksDone: number; vault?: string; signature?: string; error?: string }>({ status: "idle", tasksDone: 0 });
  const [permissions, setPermissions] = useState<PermissionsView | null>(null);
  const t = rulebook.treasury;

  // Step 2 runs the real provisioning; the task list animates while the server works.
  useEffect(() => {
    if (step !== 2 || provision.status !== "idle") return;
    setProvision({ status: "running", tasksDone: 0 });
    const ticker = setInterval(() => setProvision((p) => (p.status === "running" && p.tasksDone < TREASURY_TASKS.length - 1 ? { ...p, tasksDone: p.tasksDone + 1 } : p)), 900);
    (async () => {
      try {
        const token = await getAccessToken();
        if (!token) throw new Error("no Privy access token");
        const r = unwrap(await completeOnboarding(token, company));
        setProvision({ status: "done", tasksDone: TREASURY_TASKS.length, vault: r.treasuryVault, signature: r.signature });
        const view = await agentPermissions();
        if (view.ok) setPermissions(view.value);
      } catch (e) {
        setProvision((p) => ({ ...p, status: "error", error: (e as Error).message }));
      } finally {
        clearInterval(ticker);
      }
    })();
    return () => clearInterval(ticker);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const companyValid = company.name.trim() && company.ownerName.trim() && company.contactEmail.includes("@");

  function chooseLogo(file: File | undefined) {
    if (!file) return;
    if (logoPreview) URL.revokeObjectURL(logoPreview);
    setLogoPreview(URL.createObjectURL(file));
    setLogoError(null);
    startUpload(async () => {
      try {
        const token = await getAccessToken();
        if (!token) throw new Error("sign in first");
        const form = new FormData();
        form.set("logo", file);
        const r = unwrap(await logoUploadForSignup(token, form));
        setCompany((c) => ({ ...c, logoUrl: r.logoUrl }));
      } catch (e) {
        setLogoError((e as Error).message);
      }
    });
  }

  return (
    <div className="mx-auto w-full max-w-xl">
      <Stepper size="sm" className="mb-8" done={step} steps={STEPS.map((label) => ({ key: label, label }))} />

      {step === 0 ? (
        <SignInStep
          autoContinue={Boolean(next)}
          onSignedIn={({ linked }) => {
            if (linked) router.replace(next ?? "/dashboard");
            else setStep(1);
          }}
        />
      ) : null}

      {step === 1 ? (
        <Card className="sm:p-8">
          <h1 className="text-xl font-semibold tracking-tight text-ink">Your company</h1>
          <p className="mt-2 text-base text-ink-2">Shown on invoices, pay pages and receipts so buyers know who they are paying.</p>
          <form className="mt-6 grid gap-4" onSubmit={(e) => { e.preventDefault(); if (companyValid && !uploading) setStep(2); }}>
            <Field label="Company logo" hint={logoError ?? "PNG, JPEG or WebP under 512 KB. Optional; your initials stand in until then."} error={logoError ?? undefined}>
              <label className="flex cursor-pointer items-center gap-4 rounded-md border border-dashed border-line-strong bg-well p-4 transition-colors duration-(--dur-fast) hover:border-accent">
                <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => chooseLogo(e.target.files?.[0])} />
                <Avatar name={company.name || "Your company"} src={company.logoUrl ?? logoPreview} size="lg" shape="square" />
                <span className="min-w-0 flex-1">
                  <span className="block text-base text-ink">{uploading ? "Uploading…" : company.logoUrl ? "Looks good. Choose another to replace it." : "Drop a logo here, or click to choose"}</span>
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
                <Input value={company.registrationNo} placeholder="202001034567" onChange={(e) => setCompany({ ...company, registrationNo: e.target.value })} />
              </Field>
              <Field label="City">
                <Input value={company.city} placeholder="Muar, Johor" onChange={(e) => setCompany({ ...company, city: e.target.value })} />
              </Field>
            </div>
            <Field label="Registered address" hint="Printed under your name on invoices">
              <Textarea value={company.address} placeholder="Lot 2188, Jalan Bakri, 84000 Muar, Johor" onChange={(e) => setCompany({ ...company, address: e.target.value })} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Your name" required>
                <Input value={company.ownerName} placeholder="Farid Zulkifli" onChange={(e) => setCompany({ ...company, ownerName: e.target.value })} required />
              </Field>
              <Field label="Email for receipts" required>
                <Input type="email" value={company.contactEmail} placeholder="farid@teratai.example" onChange={(e) => setCompany({ ...company, contactEmail: e.target.value })} required />
              </Field>
            </div>
            <div className="mt-2 flex items-center justify-between gap-3">
              <button type="button" onClick={() => setCompany({ ...company, name: exporter.name, registrationNo: exporter.registrationNo, city: exporter.city, address: exporter.address, ownerName: exporter.ownerName, contactEmail: exporter.contactEmail || "farid@teratai.example" })} className="text-base font-medium text-accent underline-offset-4 hover:underline">
                Use demo details
              </button>
              <Button type="submit" disabled={!companyValid || uploading}>Continue</Button>
            </div>
          </form>
          <p className="mt-4 text-center text-sm text-ink-3">
            This sign-in ({user?.linkedAccounts.some((a) => a.type === "passkey") ? "passkey" : "email"}) has no Kutip account yet. Not you?{" "}
            <button type="button" onClick={() => { void logout().then(() => setStep(0)); }} className="font-medium text-accent underline-offset-4 hover:underline">Sign out and use another passkey</button>
          </p>
        </Card>
      ) : null}

      {step === 2 ? (
        <Card className="sm:p-8">
          <h1 className="text-xl font-semibold tracking-tight text-ink">{provision.status === "done" ? "Your treasury is ready" : provision.status === "error" ? "Treasury setup stopped" : "Setting up your treasury"}</h1>
          <p className="mt-2 text-base text-ink-2">An account on Solana that only your passkey controls. Kutip gets a limited key that can sweep buyer payments into it and nothing else. Kutip pays the setup cost.</p>
          <ol className="mt-6 grid gap-3" aria-live="polite">
            {TREASURY_TASKS.map((task, i) => {
              const done = i < provision.tasksDone;
              const active = i === provision.tasksDone && provision.status === "running";
              return (
                <li key={task} className="flex items-center gap-3 text-base">
                  <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full ${done ? "bg-accent text-on-accent" : active ? "border-2 border-accent" : "border-2 border-line"}`}>
                    {done ? <Check size={12} strokeWidth={3} aria-hidden="true" /> : active ? <span aria-hidden="true" className="h-2 w-2 animate-pulse rounded-full bg-accent" /> : null}
                  </span>
                  <span className={done || active ? "text-ink" : "text-ink-3"}>{task}</span>
                </li>
              );
            })}
          </ol>
          {provision.status === "done" ? (
            <Inset className="mt-6 grid gap-2 p-4 text-sm">
              <div className="flex items-center justify-between gap-4"><span className="text-ink-2">Treasury account</span>{provision.vault ? <Address value={provision.vault} /> : null}</div>
              <div className="flex items-center justify-between gap-4"><span className="text-ink-2">Owner</span><span className="text-ink">Your passkey</span></div>
              <div className="flex items-center justify-between gap-4"><span className="text-ink-2">Kutip agent</span><span className="text-right text-ink">Sweep into treasury, max USD {(t.agentDailyLimitUsdc / 1_000_000n).toLocaleString("en-MY")} a day</span></div>
              <div className="flex items-center justify-between gap-4"><span className="text-ink-2">Setup cost</span><span className="text-ink">Paid by Kutip{provision.signature ? <> · <Address value={provision.signature} kind="tx" label="View on Solscan" /></> : " (already set up)"}</span></div>
            </Inset>
          ) : null}
          {provision.status === "error" ? (
            <p role="alert" className="mt-4 text-sm text-disputed-fg">
              {provision.error}{" "}
              <button type="button" onClick={() => setProvision({ status: "idle", tasksDone: 0 })} className="font-medium text-accent underline-offset-4 hover:underline">Try again</button>
            </p>
          ) : null}
          <div className="mt-6 flex justify-end">
            <Button onClick={() => setStep(3)} disabled={provision.status !== "done"}>Continue</Button>
          </div>
        </Card>
      ) : null}

      {step === 3 ? (
        <Card className="sm:p-8">
          <h1 className="text-xl font-semibold tracking-tight text-ink">Agent permissions</h1>
          <p className="mt-2 text-base text-ink-2">What the agent may do on its own. Everything else waits for your tap. Approve once with Touch ID; change any of it later under Settings.</p>
          <div className="mt-6">
            {permissions ? (
              <AgentPermissionsForm initial={permissions} embedded onSaved={() => router.push("/dashboard")} />
            ) : (
              <p className="text-base text-ink-2">Loading the default permissions…</p>
            )}
          </div>
          <div className="mt-6 flex items-center justify-between gap-3">
            <Link href="/rulebook" className="text-base font-medium text-accent underline-offset-4 hover:underline">See the full rulebook</Link>
            <Button variant="ghost" onClick={() => router.push("/dashboard")}>Skip for now</Button>
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
 * Sign-in (Privy): a passkey (Touch ID / Face ID, primary) or a one-time code by email (R2).
 * Either way Privy holds the Solana embedded wallet that owns the treasury; money actions
 * always ask for the passkey (transaction MFA). The server verifies the access token and
 * either starts the session (linked user) or hands over to the company step (new user).
 */
function SignInStep({ onSignedIn, autoContinue }: { onSignedIn: (r: { linked: boolean }) => void; autoContinue: boolean }) {
  const owner = useOwnerWallet();
  const { getAccessToken } = usePrivy();
  const [session, setSession] = useState<"idle" | "pending" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [platformAuth, setPlatformAuth] = useState<boolean | null>(null);
  const [mode, setMode] = useState<"passkey" | "email">("passkey");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const onError = (e: unknown) => setError(describePasskeyError(e));
  const { loginWithPasskey, state: loginState } = useLoginWithPasskey({ onError });
  const { signupWithPasskey, state: signupState } = useSignupWithPasskey({ onError });
  const { sendCode, loginWithCode, state: emailState } = useLoginWithEmail({ onError: (e) => setError(describeEmailError(e)) });
  const idle = (st: { status: string }) => ["initial", "error", "done"].includes(st.status);
  const busy = !idle(loginState) || !idle(signupState) || emailState.status === "sending-code" || emailState.status === "submitting-code";
  const codeSent = emailState.status === "awaiting-code-input" || emailState.status === "submitting-code";
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
      const r = unwrap(await establishSession(token));
      setSession("idle");
      onSignedIn({ linked: r.linked });
    } catch (e) {
      setSession("error");
      setError(`Could not start your session: ${(e as Error).message}`);
    }
  };
  const ready = signedIn && Boolean(owner.address);
  const autoRan = useRef(false);
  useEffect(() => {
    if (!ready || autoRan.current) return;
    // A returning user lands in the app without another click (R3); a new one continues to the company step.
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
        {mode === "email" ? <Mail size={24} aria-hidden="true" /> : <Fingerprint size={24} aria-hidden="true" />}
      </span>
      <h1 className="mt-4 text-xl font-semibold tracking-tight text-ink">Sign in to Kutip</h1>
      <p className="mt-2 text-base text-ink-2">Your fingerprint or face unlocks a key held securely on your device. There is no password and no seed phrase to keep. Money always needs your fingerprint, even if you sign in by email.</p>
      {signedIn ? (
        <>
          <Inset className="mt-6 grid gap-2 p-4 text-sm">
            <div className="flex items-center justify-between gap-4"><span className="text-ink-2">Signed in</span><span className="inline-flex items-center gap-1 font-medium text-ink"><Check size={14} aria-hidden="true" /> {mode === "email" || codeSent ? "Email" : "Passkey"}</span></div>
            <div className="flex items-center justify-between gap-4"><span className="text-ink-2">Your wallet</span>{owner.address ? <Address value={owner.address} /> : <span className="text-ink-3">Creating…</span>}</div>
          </Inset>
          {walletError ? (
            <p className="mt-3 text-center text-sm text-overdue-fg">
              {walletError}{" "}
              <button type="button" onClick={ensureWallet} className="font-medium text-accent underline-offset-4 hover:underline">Try again</button>
            </p>
          ) : null}
          {error ? <p className="mt-3 text-center text-sm text-overdue-fg">{error}</p> : null}
          <Button size="lg" className="mt-6 w-full" onClick={() => void finish()} disabled={!owner.address || session === "pending"}>{session === "pending" ? "Opening Kutip…" : "Continue"}</Button>
          <p className="mt-3 text-center text-sm text-ink-3">
            Not you? <button type="button" onClick={() => owner.logout()} className="font-medium text-accent underline-offset-4 hover:underline">Sign out</button>
          </p>
        </>
      ) : mode === "email" ? (
        <form
          className="mt-6 grid gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => (codeSent ? loginWithCode({ code: code.trim() }) : sendCode({ email: email.trim() })));
          }}
        >
          <Field label="Work email">
            <Input type="email" value={email} placeholder="farid@teratai.example" onChange={(e) => setEmail(e.target.value)} disabled={codeSent} required autoFocus />
          </Field>
          {codeSent ? (
            <Field label="Code from the email" hint="Six digits, valid for a few minutes">
              <Input inputMode="numeric" autoComplete="one-time-code" value={code} placeholder="123456" onChange={(e) => setCode(e.target.value)} required autoFocus />
            </Field>
          ) : null}
          {error ? <p className="text-center text-sm text-overdue-fg">{error}</p> : null}
          <Button size="lg" type="submit" className="w-full" disabled={!owner.ready || busy || (codeSent ? code.trim().length < 6 : !email.includes("@"))}>
            {busy ? "One moment…" : codeSent ? "Sign in" : "Email me a code"}
          </Button>
          <div className="flex items-center justify-between text-sm">
            {codeSent ? <button type="button" onClick={() => run(() => sendCode({ email: email.trim() }))} className="font-medium text-accent underline-offset-4 hover:underline">Send a new code</button> : <span />}
            <button type="button" onClick={() => { setMode("passkey"); setError(null); }} className="font-medium text-accent underline-offset-4 hover:underline">Use Touch ID instead</button>
          </div>
        </form>
      ) : (
        <>
          <Button size="lg" className="mt-6 w-full" onClick={() => run(signupWithPasskey)} disabled={!owner.ready || busy || platformAuth === false}>
            <Fingerprint size={18} aria-hidden="true" />
            {busy ? "Checking with your device…" : "Create account with Touch ID or Face ID"}
          </Button>
          <p className="mt-3 text-center text-sm text-ink-3" aria-live="polite">
            {platformAuth === false ? (
              <span className="text-overdue-fg">This browser has no fingerprint or face unlock. Sign in by email, or open this page in Safari or Chrome.</span>
            ) : error ? (
              <span className="text-overdue-fg">{error}</span>
            ) : (
              "Works with Touch ID, Face ID and Windows Hello"
            )}
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Button variant="outline" onClick={() => run(() => loginWithPasskey())} disabled={!owner.ready || busy || platformAuth === false}>
              I already have a passkey
            </Button>
            <Button variant="outline" onClick={() => { setMode("email"); setError(null); }} disabled={!owner.ready || busy}>
              <Mail size={16} aria-hidden="true" /> Sign in with email
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

function describeEmailError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (/invalid|incorrect|expired/i.test(msg)) return "That code didn't match. Check the email or ask for a new code.";
  if (/too many|rate/i.test(msg)) return "Too many tries. Wait a minute, then ask for a new code.";
  if (/not allowed|disallowed/i.test(msg)) return "Email sign-in is not enabled for this app yet.";
  return `Sign-in failed: ${msg}`;
}
