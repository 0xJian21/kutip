import "server-only";
import { randomUUID } from "node:crypto";
import { createKeyFor, deriveAccounts, limitCreateKeyFor, provisionMultisig } from "@kutip/solana";
import { PublicKey } from "@solana/web3.js";
import { UserError } from "@/lib/data/result";
import { agentPubkey, treasuryContext } from "@/lib/treasury/server";
import type { Buyer } from "@/lib/ui/types";
import { ownerSessionOrThrow } from "./auth";
import { validateBuyer, type BuyerInput } from "./input";
import { PROVISION_MIN_LAMPORTS } from "./onboarding";
import { store } from "./store";

/**
 * Add buyer (DECISIONS D3): one Squads multisig per buyer, provisioned the way
 * scripts/provision-demo.ts does it (owner = the owner's Privy wallet, agent = Initiate +
 * a daily spending limit to the treasury vault, USDC ATA pre-created; Kutip pays ≈0.005 SOL
 * rent). The chain write comes first and the buyer row only once it landed, so a failed
 * provision never leaves a buyer without a vault.
 */

/** Each buyer costs Kutip's fee payer rent: a cap per exporter, and 5 an hour per exporter per instance. */
const MAX_BUYERS = 20;
const ADDS_PER_HOUR = 5;
const adds = new Map<string, number[]>();

export async function addBuyer(input: BuyerInput): Promise<Buyer> {
  const { exporterId, wallet } = await ownerSessionOrThrow();
  const b = validateBuyer(input);
  const [exporter, buyers, rulebook] = await Promise.all([store().getExporter(exporterId), store().listBuyers(exporterId), store().getRulebook(exporterId)]);
  if (!exporter?.treasuryMultisig) throw new UserError("Your treasury isn't set up yet. Finish onboarding first.");
  if (buyers.length >= MAX_BUYERS) throw new UserError(`You have ${MAX_BUYERS} buyers, the most an account can have for now. Tell the Kutip team if you need more.`);
  if (buyers.some((x) => x.name.toLowerCase() === b.name.toLowerCase())) throw new UserError(`${b.name} is already one of your buyers`);

  const now = Date.now();
  const recent = (adds.get(exporterId) ?? []).filter((t) => t > now - 3_600_000);
  if (recent.length >= ADDS_PER_HOUR) throw new UserError("You've added several buyers in the last hour. Try again later.");
  recent.push(now); // reserved before any await below, so parallel requests can't all pass
  adds.set(exporterId, recent);
  try {
    const { connection, feePayer, usdcMint } = treasuryContext();
    if (BigInt(await connection.getBalance(feePayer.publicKey)) < PROVISION_MIN_LAMPORTS) throw new UserError("Kutip's fee payer is low on SOL, so new buyer accounts are paused. Tell the Kutip team.");
    const treasury = { multisigPda: new PublicKey(exporter.treasuryMultisig), vaultPda: new PublicKey(exporter.treasuryVault), vaultAta: new PublicKey(exporter.treasuryUsdcAta) };
    // A fresh create key per add: never derived from editable fields, so two buyers can't land on one vault.
    const createKey = createKeyFor(feePayer.secretKey, `buyer:${exporterId}:${randomUUID()}:${wallet}`);
    const r = await provisionMultisig({
      connection,
      feePayer,
      createKey,
      owner: new PublicKey(wallet),
      agent: agentPubkey(),
      usdcMint,
      label: `buyer ${exporterId}`,
      spendingLimit: { createKey: limitCreateKeyFor(feePayer.secretKey, deriveAccounts(createKey.publicKey, usdcMint).multisigPda).publicKey, amountUsdc: rulebook.treasury.agentDailyLimitUsdc, treasury },
      confirm: async (lines) => console.log(`[add-buyer] ${lines.join("\n")}`),
    });
    console.log(`[add-buyer] ${exporterId} multisig ${r.multisigPda.toBase58()} ${r.signature ?? "skipped"}`);
    return await store().createBuyer({
      exporterId,
      ...b,
      multisig: r.multisigPda.toBase58(),
      vault: r.vaultPda.toBase58(),
      usdcAta: r.vaultAta.toBase58(),
      ...(r.spendingLimitPda ? { spendingLimitPda: r.spendingLimitPda.toBase58() } : {}),
    });
  } catch (e) {
    recent.splice(recent.indexOf(now), 1); // a refused or failed attempt gives its slot back
    throw e;
  }
}
