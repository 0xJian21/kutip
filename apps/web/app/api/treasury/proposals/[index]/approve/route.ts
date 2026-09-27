import { approveExecuteInstructions, buildOwnerTx } from "@kutip/solana";
import { assertApprover } from "@/lib/server/access";
import { json, pubkey, treasuryContext, treasuryMultisig } from "@/lib/treasury/server";

/**
 * Builds proposalApprove + vaultTransactionExecute for the owner, fee paid by
 * Kutip's fee payer (already signed). Body: { owner: <Privy wallet pubkey> }.
 * The owner signs the returned transaction client-side, then POSTs it to ../submit.
 */
export async function POST(req: Request, ctx: RouteContext<"/api/treasury/proposals/[index]/approve">) {
  try {
    const { index } = await ctx.params;
    const body = (await req.json()) as { owner?: string };
    const owner = pubkey(body.owner, "owner");
    const { multisig: multisigPda, wallet } = await treasuryMultisig();
    assertApprover(owner.toBase58(), wallet); // never co-sign (and pay fees) for someone else's key
    const { connection, feePayer } = treasuryContext();
    const { ixs, lookupTables } = await approveExecuteInstructions({ connection, multisigPda, transactionIndex: BigInt(index), member: owner });
    const built = await buildOwnerTx({ connection, feePayer, ixs, lookupTables });
    return json({ transaction: built.base64, lastValidBlockHeight: built.lastValidBlockHeight });
  } catch (e) {
    return json({ error: (e as Error).message }, 400);
  }
}
