import { buildOwnerTx, rejectProposalInstructions } from "@kutip/solana";
import { assertApprover } from "@/lib/server/access";
import { json, pubkey, treasuryContext, treasuryMultisig } from "@/lib/treasury/server";

/**
 * Builds proposalReject for the owner (FOLLOWUPS: rejecting used to update only the
 * database). Body: { owner }. The owner signs client-side, then POSTs to ../submit
 * with { decision: "rejected" }; threshold 1 means one rejection settles the proposal.
 */
export async function POST(req: Request, ctx: RouteContext<"/api/treasury/proposals/[index]/reject">) {
  try {
    const { index } = await ctx.params;
    const body = (await req.json()) as { owner?: string };
    const owner = pubkey(body.owner, "owner");
    const { multisig: multisigPda, wallet } = await treasuryMultisig();
    assertApprover(owner.toBase58(), wallet);
    const { connection, feePayer } = treasuryContext();
    const ixs = rejectProposalInstructions({ multisigPda, transactionIndex: BigInt(index), member: owner });
    const built = await buildOwnerTx({ connection, feePayer, ixs });
    return json({ transaction: built.base64, lastValidBlockHeight: built.lastValidBlockHeight });
  } catch (e) {
    return json({ error: (e as Error).message }, 400);
  }
}
