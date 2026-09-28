"use client";

import { useCallback } from "react";
import { useOwnerWallet } from "./owner-wallet";

export type Statement = { message: string; transaction: string };

/**
 * "Approve with Touch ID" for things that are not on-chain moves (whitelisting a cash-out
 * address, approving the agent's permissions). The server hands us a small transaction that
 * can never be sent (payer = the owner, one memo with the dated statement, zero blockhash);
 * the owner's Privy wallet signs it, and with passkey MFA enrolled that prompts Touch ID /
 * Face ID. The server verifies the signature against the session's owner wallet.
 */
export function useOwnerSignature() {
  const owner = useOwnerWallet();
  const sign = useCallback(
    async (statement: Statement): Promise<{ message: string; signedTransaction: string }> => {
      const { signedTransaction } = await owner.signTransaction(statement.transaction);
      return { message: statement.message, signedTransaction };
    },
    [owner],
  );
  return { sign, owner };
}

/** Plain-English text for the errors a person can act on when a wallet prompt fails. */
export function describeSigningError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (/passkey first|not authenticated|sign in/i.test(msg)) return "Sign in again to approve. Your session in this browser has ended.";
  if (/cancel|abort|notallowed|denied|rejected/i.test(msg)) return "Cancelled before your device confirmed. Nothing was signed.";
  if (/mfa|verification/i.test(msg)) return "Touch ID is not set up for this account yet. Turn it on under Settings → Agent permissions.";
  return msg;
}
