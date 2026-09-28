"use client";

import { useSignMessage } from "@privy-io/react-auth/solana";
import bs58 from "bs58";
import { useCallback } from "react";
import { useOwnerWallet } from "./owner-wallet";

/**
 * "Approve with Touch ID" for things that are not transactions: the owner's Privy
 * wallet signs a plain statement (whitelisting a cash-out address, approving the
 * agent's permissions). With passkey MFA enrolled, Privy prompts Touch ID / Face ID
 * before the embedded wallet signs. The server verifies the signature against the
 * session wallet (lib/server/owner-signature.ts).
 */
export function useOwnerSignature() {
  const owner = useOwnerWallet();
  const { signMessage } = useSignMessage();
  const sign = useCallback(
    async (message: string): Promise<{ message: string; signature: string }> => {
      if (!owner.wallet) throw new Error("sign in with your passkey first");
      const { signature } = await signMessage({ message: new TextEncoder().encode(message), wallet: owner.wallet, options: { uiOptions: { showWalletUIs: false } } });
      return { message, signature: bs58.encode(signature) };
    },
    [owner.wallet, signMessage],
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
