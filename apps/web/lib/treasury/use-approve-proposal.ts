"use client";

import { useSignTransaction } from "@privy-io/react-auth/solana";
import { useCallback, useState } from "react";
import { useOwnerWallet } from "./owner-wallet";

export type ProposalView = {
  transactionIndex: string;
  status: "Draft" | "Active" | "Rejected" | "Approved" | "Executing" | "Executed" | "Cancelled";
  statusAt: string;
  creator: string;
  transfer: { destinationAta: string; amountUsdc: string } | null;
  approvedBy: string[];
};

async function post<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const data = (await res.json()) as T & { error?: string };
  if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
  return data;
}

/**
 * Owner approval of a Squads proposal with the Privy passkey wallet:
 *   1. server builds approve+execute (fee payer signed),
 *   2. Privy signs it here (one passkey prompt),
 *   3. server sends it and confirms.
 * Session 7: call `approve(transactionIndex)` from the Approve button of a
 * `proposed` agent action, then `setActionStatus(..., "executed", signature)`.
 */
export function useApproveProposal() {
  const owner = useOwnerWallet();
  const { signTransaction } = useSignTransaction();
  const [state, setState] = useState<{ status: "idle" } | { status: "signing" | "sending"; index: string } | { status: "done"; index: string; signature: string } | { status: "error"; index: string; error: string }>({ status: "idle" });

  const approve = useCallback(
    async (transactionIndex: string): Promise<string> => {
      if (!owner.wallet || !owner.address) throw new Error("sign in with your passkey first");
      setState({ status: "signing", index: transactionIndex });
      try {
        const built = await post<{ transaction: string }>(`/api/treasury/proposals/${transactionIndex}/approve`, { owner: owner.address });
        const { signedTransaction } = await signTransaction({
          transaction: Uint8Array.from(atob(built.transaction), (c) => c.charCodeAt(0)),
          wallet: owner.wallet,
          chain: "solana:mainnet",
          options: { uiOptions: { showWalletUIs: false } },
        });
        setState({ status: "sending", index: transactionIndex });
        const { signature } = await post<{ signature: string }>(`/api/treasury/proposals/${transactionIndex}/submit`, {
          owner: owner.address,
          signedTransaction: btoa(String.fromCharCode(...signedTransaction)),
        });
        setState({ status: "done", index: transactionIndex, signature });
        return signature;
      } catch (e) {
        setState({ status: "error", index: transactionIndex, error: (e as Error).message });
        throw e;
      }
    },
    [owner.wallet, owner.address, signTransaction],
  );

  return { approve, state, owner };
}

export async function fetchProposals(): Promise<{ multisig: string; proposals: ProposalView[] }> {
  const res = await fetch("/api/treasury/proposals", { cache: "no-store" });
  const data = (await res.json()) as { multisig: string; proposals: ProposalView[]; error?: string };
  if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
  return data;
}
