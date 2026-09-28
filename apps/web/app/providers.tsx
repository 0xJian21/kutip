"use client";

import { PrivyProvider } from "@privy-io/react-auth";
import type { ReactNode } from "react";

/**
 * Privy (DECISIONS D2): passkey login unlocks a TEE-held Solana key; that key is
 * the owner member of the Squads treasury. Email OTP is the second way in (R2);
 * money still needs the passkey: transaction MFA prompts Touch ID / Face ID before
 * the embedded wallet signs. No external wallets, no Ethereum.
 * Passkeys are bound to the domain: enable "Passkey" under Login methods and add
 * the production domain in the Privy dashboard before deploying.
 */
export function Providers({ children }: { children: ReactNode }) {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  if (!appId) return <>{children}</>; // UI-only sessions without Privy keep working on mocks
  return (
    <PrivyProvider
      appId={appId}
      config={{
        loginMethods: ["passkey", "email"],
        appearance: { walletChainType: "solana-only" },
        embeddedWallets: {
          solana: { createOnLogin: "all-users" },
          ethereum: { createOnLogin: "off" },
          showWalletUIs: false,
        },
      }}
    >
      {children}
    </PrivyProvider>
  );
}
