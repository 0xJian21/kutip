"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useWallets } from "@privy-io/react-auth/solana";

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
  return { ready: ready && walletsReady, authenticated, address, wallet, logout };
}
