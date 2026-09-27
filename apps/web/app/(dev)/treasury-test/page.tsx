"use client";

import { useLoginWithPasskey, useMfaEnrollment, usePrivy } from "@privy-io/react-auth";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Address } from "@/components/ui/address";
import { fetchProposals, useApproveProposal, type ProposalView } from "@/lib/treasury/use-approve-proposal";

/** Dev-only proof page for Session 5: list treasury proposals, approve one with the passkey wallet. */
export default function TreasuryTestPage() {
  const { approve, state, owner } = useApproveProposal();
  const { loginWithPasskey } = useLoginWithPasskey();
  const { showMfaEnrollmentModal } = useMfaEnrollment();
  const { user } = usePrivy();
  const mfa = user?.mfaMethods ?? [];
  const [data, setData] = useState<{ multisig: string; proposals: ProposalView[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = () => fetchProposals().then(setData).catch((e) => setError(String(e)));
  useEffect(() => {
    void reload();
  }, []);

  return (
    <main className="mx-auto grid w-full max-w-2xl gap-6 p-6">
      <h1 className="text-xl font-semibold text-ink">Treasury test</h1>
      <section className="grid gap-2 rounded-lg border border-line bg-surface p-4 text-sm">
        <div className="flex items-center justify-between gap-4"><span className="text-ink-2">Passkey</span><span className="text-ink">{!owner.ready ? "loading…" : owner.authenticated ? "signed in" : "signed out"}</span></div>
        <div className="flex items-center justify-between gap-4"><span className="text-ink-2">Owner wallet</span>{owner.address ? <Address value={owner.address} /> : <span className="text-ink-3">—</span>}</div>
        <div className="flex items-center justify-between gap-4"><span className="text-ink-2">Treasury multisig</span>{data ? <Address value={data.multisig} /> : <span className="text-ink-3">—</span>}</div>
        <div className="flex items-center justify-between gap-4"><span className="text-ink-2">Touch ID per approval (MFA)</span><span className="text-ink">{mfa.length ? mfa.join(", ") : "not enrolled"}</span></div>
        <div className="flex flex-wrap gap-2 pt-2">
          {owner.authenticated ? <Button variant="ghost" onClick={() => owner.logout()}>Sign out</Button> : <Button onClick={() => loginWithPasskey()} disabled={!owner.ready}>Sign in with passkey</Button>}
          {owner.authenticated && !mfa.includes("passkey") ? <Button variant="ghost" onClick={showMfaEnrollmentModal}>Require Touch ID for approvals</Button> : null}
          <Button variant="ghost" onClick={reload}>Reload proposals</Button>
        </div>
      </section>
      {error ? <p className="text-sm text-overdue-fg">{error}</p> : null}
      <section className="grid gap-3">
        {data?.proposals.length === 0 ? <p className="text-sm text-ink-3">No proposals yet. Run scripts/propose-cashout.ts.</p> : null}
        {data?.proposals.map((p) => (
          <article key={p.transactionIndex} className="grid gap-1 rounded-lg border border-line bg-surface p-4 text-sm">
            <div className="flex items-center justify-between gap-4"><span className="font-medium text-ink">Proposal #{p.transactionIndex}</span><span className="text-ink-2">{p.status}</span></div>
            {p.transfer ? (
              <div className="flex items-center justify-between gap-4"><span className="text-ink-2">USDC {(Number(p.transfer.amountUsdc) / 1e6).toFixed(6)} →</span><Address value={p.transfer.destinationAta} /></div>
            ) : (
              <span className="text-ink-3">not a single USDC transfer</span>
            )}
            {p.status === "Active" ? (
              <div className="pt-2">
                <Button variant="secondary" onClick={() => approve(p.transactionIndex).then(reload).catch(() => undefined)} disabled={!owner.wallet || (state.status !== "idle" && state.status !== "done" && state.status !== "error")}>
                  {state.status === "signing" && state.index === p.transactionIndex ? "Signing…" : state.status === "sending" && state.index === p.transactionIndex ? "Sending…" : "Approve & execute"}
                </Button>
              </div>
            ) : null}
            {state.status === "done" && state.index === p.transactionIndex ? <Address value={state.signature} kind="tx" label="Executed — view on Solscan" /> : null}
            {state.status === "error" && state.index === p.transactionIndex ? <span className="text-overdue-fg">{state.error}</span> : null}
          </article>
        ))}
      </section>
    </main>
  );
}
