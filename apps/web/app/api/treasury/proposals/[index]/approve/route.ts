import { approveExecuteInstructions, buildOwnerTx } from "@kutip/solana";
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
    const { connection, feePayer } = treasuryContext();
    const { multisig: multisigPda } = await treasuryMultisig();
    const { ixs, lookupTables } = await approveExecuteInstructions({ connection, multisigPda, transactionIndex: BigInt(index), member: owner });
    const built = await buildOwnerTx({ connection, feePayer, ixs, lookupTables });
    return json({ transaction: built.base64, lastValidBlockHeight: built.lastValidBlockHeight });
  } catch (e) {
    return json({ error: (e as Error).message }, 400);
  }
}
