"use client";

import { useMfaEnrollment, usePrivy } from "@privy-io/react-auth";
import { Check, Fingerprint } from "lucide-react";
import { useState, useTransition } from "react";
import { Address } from "@/components/ui/address";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, Inset } from "@/components/ui/card";
import { Field, PrefixedInput, Select } from "@/components/ui/field";
import { Facts } from "@/components/ui/panel";
import { Chip } from "@/components/ui/status-pill";
import { permissionsLimitTxs, permissionsSave, permissionsStatementNow, type AgentPermissions, type PermissionsView } from "@/lib/data/treasury-actions";
import { describePermissions } from "@/lib/treasury/permissions-model";
import { useOwnerWallet } from "@/lib/treasury/owner-wallet";
import { describeSigningError, useOwnerSignature } from "@/lib/treasury/use-owner-signature";
import { formatDateTime } from "@/lib/ui/format";
import { formatUsdc, parseUsdc } from "@/lib/ui/money";

/**
 * Settings → Agent permissions (IMPROVEMENTS R4, E3). Shows what the agent may do on its
 * own, the on-chain daily cap on each buyer account, and lets the owner change any of it
 * with Touch ID. Also where passkey MFA is enrolled, which retired /treasury-test.
 */
export function AgentPermissionsForm({ initial, embedded = false, onSaved }: { initial: PermissionsView; embedded?: boolean; onSaved?: () => void }) {
  const [view, setView] = useState(initial);
  const [p, setP] = useState<AgentPermissions>(initial.permissions);
  const [capText, setCapText] = useState(formatUsdc(initial.permissions.dailyCapUsdc, 0).replace(/,/g, ""));
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const { sign, owner } = useOwnerSignature();
  const cap = parseUsdc(capText);
  const dirty = JSON.stringify({ ...p, dailyCapUsdc: cap?.toString() }) !== JSON.stringify({ ...view.permissions, dailyCapUsdc: view.permissions.dailyCapUsdc.toString() });
  const capChanged = cap !== null && cap !== view.permissions.dailyCapUsdc;
  const needsChain = view.buyers.some((b) => b.provisioned && (capChanged || !b.matchesCap));

  function approve() {
    if (cap === null || cap <= 0n) return setNotice({ ok: false, text: "Enter a daily cap above 0." });
    const next = { ...p, dailyCapUsdc: cap };
    setNotice(null);
    start(async () => {
      try {
        const st = await permissionsStatementNow();
        if (!st.ok) throw new Error(st.error);
        // One Touch ID prompt signs the statement; with a cap change it also signs the config transactions (same MFA window).
        const signed = await sign(st.value);
        let approval: Parameters<typeof permissionsSave>[0]["approval"] = { kind: "statement", ...signed };
        if (needsChain) {
          const txs = await permissionsLimitTxs(cap);
          if (!txs.ok) throw new Error(txs.error);
          const signedTxs = [];
          for (const t of txs.value) {
            const { signedTransaction } = await owner.signTransaction(t.transaction);
            signedTxs.push({ buyerId: t.buyerId, spendingLimitPda: t.spendingLimitPda, signedTransaction });
          }
          approval = { kind: "transactions", signed: signedTxs, ...signed };
        }
        const r = await permissionsSave({ permissions: next, approval });
        if (!r.ok) throw new Error(r.error);
        setView((v) => ({ ...v, permissions: next, approvedAt: r.value.approvedAt, buyers: v.buyers.map((b) => ({ ...b, matchesCap: b.provisioned ? true : b.matchesCap })), outOfSync: 0 }));
        setNotice({ ok: true, text: r.value.signatures.length ? `Approved and re-issued on ${r.value.signatures.length} buyer account(s) on Solana.` : "Approved with Touch ID." });
        onSaved?.();
      } catch (e) {
        setNotice({ ok: false, text: describeSigningError(e) });
      }
    });
  }

  const form = (
    <div className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Daily sweep cap, per buyer account" hint="Enforced on Solana by a Squads spending limit on each buyer account">
          <PrefixedInput prefix="USD" inputMode="numeric" value={capText} onChange={(e) => setCapText(e.target.value)} />
        </Field>
        <Field label="Sweeps go to" hint="The only destination the agent's key can send to">
          <Select value="treasury" disabled>
            <option value="treasury">My treasury · {view.treasuryVault.slice(0, 4)}…{view.treasuryVault.slice(-4)}</option>
          </Select>
        </Field>
        <Field label="Replies to buyer messages">
          <Select value={p.buyerReplies} onChange={(e) => setP({ ...p, buyerReplies: e.target.value as AgentPermissions["buyerReplies"] })}>
            <option value="draft">Draft, I approve before sending</option>
            <option value="routine">Automatic for routine answers only</option>
            <option value="off">Off, just show me the message</option>
          </Select>
        </Field>
        <Field label="Reminders and receipts">
          <Select value={p.remindersAndReceipts} onChange={(e) => setP({ ...p, remindersAndReceipts: e.target.value as AgentPermissions["remindersAndReceipts"] })}>
            <option value="automatic">Automatic, on the rulebook schedule</option>
            <option value="draft">Draft, I approve before sending</option>
          </Select>
        </Field>
        <Field label="Discount the agent may offer" hint="Anything above this waits for you (rule C3)">
          <PrefixedInput prefix="%" inputMode="decimal" value={String(p.maxDiscountPct)} onChange={(e) => setP({ ...p, maxDiscountPct: Number(e.target.value) })} />
        </Field>
      </div>
      <Inset className="p-4">
        <p className="text-sm font-semibold text-ink">What you are approving</p>
        <ul className="mt-2 grid gap-1.5 text-base text-ink-2">
          {describePermissions({ ...p, dailyCapUsdc: cap ?? p.dailyCapUsdc }).map((line) => (
            <li key={line} className="flex gap-2"><Check size={16} className="mt-1 shrink-0 text-accent" aria-hidden="true" />{line}</li>
          ))}
          <li className="flex gap-2"><Check size={16} className="mt-1 shrink-0 text-accent" aria-hidden="true" />Never on its own: discounts above the limit, disputes, anything else that moves money.</li>
        </ul>
      </Inset>
      {notice ? <p role={notice.ok ? "status" : "alert"} className={`text-sm ${notice.ok ? "text-paid-fg" : "text-disputed-fg"}`}>{notice.text}</p> : null}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm text-ink-3">{view.approvedAt ? `Last approved ${formatDateTime(view.approvedAt)} MYT` : "Not approved with Touch ID yet"}{needsChain ? ` · ${view.outOfSync || view.buyers.filter((b) => b.provisioned).length} buyer account(s) will be re-issued on Solana` : ""}</span>
        <Button variant="secondary" onClick={approve} disabled={pending || !owner.wallet || (!dirty && Boolean(view.approvedAt) && !needsChain)}>
          <Fingerprint size={16} aria-hidden="true" /> {pending ? "Waiting for Touch ID…" : "Approve with Touch ID"}
        </Button>
      </div>
    </div>
  );

  if (embedded) return form;
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-6">
      <div className="grid content-start gap-5 lg:gap-6">
        <Card>
          <CardHeader title="What the agent may do on its own" caption="Everything else waits for your tap. Changes need Touch ID." />
          <div className="mt-5">{form}</div>
        </Card>
        <Card>
          <CardHeader title="On-chain limits" caption="The agent's key holds a Squads spending limit on each buyer account: USDC, per day, destination = your treasury." />
          <ul className="mt-4 divide-y divide-line">
            {view.buyers.map((b) => (
              <li key={b.buyerId} className="flex items-center justify-between gap-3 py-2.5 text-base">
                <span className="min-w-0"><span className="block truncate text-ink">{b.buyerName}</span>{b.limit ? <span className="block text-xs tabular text-ink-3"><Address value={b.limit.pda} /></span> : null}</span>
                <span className="text-right">
                  {!b.provisioned ? <Chip>Not on Solana yet</Chip> : b.limit ? <span className="tabular text-ink">USD {formatUsdc(b.limit.amountUsdc, 0)}/day{b.matchesCap ? "" : " · differs"}</span> : <Chip>No limit</Chip>}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
      <div className="grid content-start gap-5 lg:gap-6">
        <TouchIdCard />
        <Card>
          <CardHeader title="Keys" />
          <Facts className="mt-4" items={[{ label: "You (passkey)", value: owner.address ? <Address value={owner.address} /> : "—" }, { label: "Kutip agent", value: <Address value={view.agentKey} />, muted: true }, { label: "Treasury", value: <Address value={view.treasuryVault} />, muted: true }]} />
        </Card>
      </div>
    </div>
  );
}

/** Passkey MFA: with it enrolled, every signature (sweep approvals, cash-outs, permissions) prompts Touch ID / Face ID. */
export function TouchIdCard() {
  const { user } = usePrivy();
  const { showMfaEnrollmentModal } = useMfaEnrollment();
  const owner = useOwnerWallet();
  const methods = user?.mfaMethods ?? [];
  const on = methods.includes("passkey");
  return (
    <Card>
      <CardHeader title="Touch ID for money" aside={on ? <Chip tone="accent">On</Chip> : <Chip>Off</Chip>} />
      <p className="mt-2 text-base text-ink-2">{on ? "Every approval, cash-out and permissions change asks for your fingerprint or face before your key signs." : "Turn this on so approvals, cash-outs and permissions changes always ask for your fingerprint or face, even when you signed in with email."}</p>
      {!on ? (
        <Button className="mt-4" onClick={showMfaEnrollmentModal} disabled={!owner.authenticated}>
          <Fingerprint size={16} aria-hidden="true" /> Require Touch ID for approvals
        </Button>
      ) : null}
    </Card>
  );
}
