"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useSignTransaction, useWallets } from "@privy-io/react-auth/solana";
import { useCallback } from "react";

/**
 * The owner's Privy-embedded Solana wallet: the key the passkey unlocks and the
 * "owner" member of every Squads multisig Kutip provisions.
 */
export function useOwnerWallet() {
  const { ready, authenticated, user, logout } = usePrivy();
  const { wallets, ready: walletsReady } = useWallets();
  const linked = user?.linkedAccounts.find(
    (a) => a.type === "wallet" && a.chainType === "solana" && a.walletClientType === "privy",
  );
  const address = linked && "address" in linked ? linked.address : undefined;
  const wallet = address ? wallets.find((w) => w.address === address) : undefined;
  const { signTransaction: privySign } = useSignTransaction();
  /** Sign a fee-payer-built transaction (base64 in, base64 out); one passkey prompt with MFA enrolled. */
  const signTransaction = useCallback(
    async (base64: string): Promise<{ signedTransaction: string }> => {
      if (!wallet) throw new Error("sign in with your passkey first");
      const { signedTransaction } = await privySign({
        transaction: Uint8Array.from(atob(base64), (c) => c.charCodeAt(0)),
        wallet,
        chain: "solana:mainnet",
        options: { uiOptions: { showWalletUIs: false } },
      });
      return { signedTransaction: btoa(String.fromCharCode(...signedTransaction)) };
    },
    [wallet, privySign],
  );
  return { ready: ready && walletsReady, authenticated, address, wallet, logout, signTransaction };
}
