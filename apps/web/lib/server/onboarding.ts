import "server-only";
import { DEFAULT_RULEBOOK } from "@kutip/agent";
import { createKeyFor, provisionMultisig } from "@kutip/solana";
import { PublicKey } from "@solana/web3.js";
import { UserError } from "@/lib/data/result";
import { DEMO_EXPORTER_ID, startSession, verifyPrivyToken } from "./auth";
import { signupLogoPrefix, validateCompany, type CompanyInput } from "./input";
import { store } from "./store";
import { agentPubkey, treasuryContext } from "@/lib/treasury/server";

/**
 * Onboarding for a verified Privy user with no Kutip account (SPEC F1): create the
 * exporter + owner user, provision the main treasury multisig on Solana (owner = the
 * user's embedded wallet, agent = Initiate only, USDC ATA pre-created; Kutip pays the
 * rent), then start the session. Idempotent per owner wallet: the create key is derived
 * from the wallet alone, so a retry after a failed or timed-out provision (which leaves an
 * empty exporter row) finds the same multisig and skips the chain write.
 */

/** Kutip's fee payer must keep enough SOL for payments after paying a treasury's rent. */
export const PROVISION_MIN_LAMPORTS = 20_000_000n;
/** Provisioning is a mainnet write anyone with a browser can trigger: 5 an hour across instances (DB), 5 per instance (memory, race-free). */
const SIGNUPS_PER_HOUR = 5;
const signups: number[] = [];

export async function completeOnboarding(accessToken: string, input: CompanyInput): Promise<{ exporterId: string; treasuryVault: string; signature?: string }> {
  const { privyUserId, wallets } = await verifyPrivyToken(accessToken);
  // A logo is kept only if it sits under this sign-up's own upload path (never an arbitrary URL).
  const company = validateCompany(input, { logoPrefix: process.env.SUPABASE_URL ? signupLogoPrefix(process.env.SUPABASE_URL, privyUserId) : undefined });
  const owner = wallets[0];
  if (!owner) throw new UserError("Your wallet is still being created. Try again in a moment.");
  const existing = await store().findUser({ privyUserId, wallets });
  if (existing) throw new UserError("This sign-in already has a Kutip account");

  const now = Date.now();
  while (signups.length && signups[0]! < now - 3_600_000) signups.shift();
  const busy = new UserError("Too many new accounts right now. Try again in an hour.");
  if (signups.length >= SIGNUPS_PER_HOUR) throw busy;
  signups.push(now); // reserved before any await, so parallel requests on this instance can't all pass
  try {
    return await provision({ privyUserId, owner, company, now, busy });
  } catch (e) {
    signups.splice(signups.indexOf(now), 1); // a refused or failed attempt gives its slot back
    throw e;
  }
}

async function provision(
  p: { privyUserId: string; owner: string; company: ReturnType<typeof validateCompany>; now: number; busy: UserError },
): Promise<{ exporterId: string; treasuryVault: string; signature?: string }> {
  const { privyUserId, owner, company, now, busy } = p;
  // The demo exporter is re-created by every demo-reset; it isn't a sign-up.
  if ((await store().countExportersCreatedSince(new Date(now - 3_600_000), { except: DEMO_EXPORTER_ID })) >= SIGNUPS_PER_HOUR) throw busy;

  const { connection, feePayer, usdcMint } = treasuryContext();
  const balance = await connection.getBalance(feePayer.publicKey);
  if (BigInt(balance) < PROVISION_MIN_LAMPORTS) throw new UserError("Kutip's fee payer is low on SOL, so new treasuries are paused. Tell the Kutip team.");

  const ownerKey = new PublicKey(owner);
  const exporter = await store().createExporter({
    name: company.name,
    registrationNo: company.registrationNo,
    city: company.city,
    address: company.address,
    contactEmail: company.contactEmail,
    logoUrl: company.logoUrl,
    treasuryMultisig: "",
    treasuryVault: "",
    treasuryUsdcAta: "",
    rulebook: DEFAULT_RULEBOOK,
  });
  const r = await provisionMultisig({
    connection,
    feePayer,
    createKey: createKeyFor(feePayer.secretKey, `treasury:onboarding:${owner}`),
    owner: ownerKey,
    agent: agentPubkey(),
    usdcMint,
    label: `treasury ${exporter.id}`,
    confirm: async (lines) => console.log(`[onboarding] ${lines.join("\n")}`),
  });
  await store().updateTreasuryAccounts(exporter.id, { treasuryMultisig: r.multisigPda.toBase58(), treasuryVault: r.vaultPda.toBase58(), treasuryUsdcAta: r.vaultAta.toBase58() });
  await store().createUser({ exporterId: exporter.id, name: company.ownerName, role: "owner", privyUserId, walletPubkey: owner });
  await startSession({ exporterId: exporter.id, privyUserId, role: "owner", wallet: owner });
  return { exporterId: exporter.id, treasuryVault: r.vaultPda.toBase58(), signature: r.signature };
}
