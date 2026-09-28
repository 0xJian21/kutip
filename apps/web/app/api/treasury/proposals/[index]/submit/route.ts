import { parseSignedOwnerTx, sendSigned } from "@kutip/solana";
import { assertApprover } from "@/lib/server/access";
import { json, pubkey, routeError, treasuryContext, treasuryMultisig } from "@/lib/treasury/server";

/**
 * Sends the owner-signed transaction from ../approve or ../reject.
 * Body: { owner, signedTransaction: base64, actionId?, decision?: "executed" | "rejected" }.
 * With `actionId`, the agent action is settled with the signature, but only if it is
 * still `proposed` and belongs to proposal #index (agent_actions.proposal_index), so a
 * signature can never overwrite the trail of an unrelated or already-decided action.
 */
export async function POST(req: Request, ctx: RouteContext<"/api/treasury/proposals/[index]/submit">) {
  try {
    const { index } = await ctx.params;
    const body = (await req.json()) as { owner?: string; signedTransaction?: string; actionId?: string; decision?: "executed" | "rejected" };
    if (!body.signedTransaction) throw new Error("signedTransaction missing");
    const decision = body.decision ?? "executed";
    if (decision !== "executed" && decision !== "rejected") throw new Error("decision must be executed or rejected");
    const { exporterId, wallet } = await treasuryMultisig();
    const owner = pubkey(body.owner, "owner");
    assertApprover(owner.toBase58(), wallet);
    const { connection, feePayer, store } = treasuryContext();
    const tx = parseSignedOwnerTx(body.signedTransaction, feePayer.publicKey, owner);
    const signature = await sendSigned(connection, tx);
    let settled = false;
    if (body.actionId) {
      settled = (await store.settleProposal(exporterId, { actionId: body.actionId, proposalIndex: BigInt(index), status: decision, txSignature: signature })) !== null;
      if (!settled) console.warn(`[treasury] proposal #${index} ${decision} on-chain (${signature}) but action ${body.actionId} was not an open action for it; audit trail left as is`);
    }
    return json({ transactionIndex: index, signature, decision, settled });
  } catch (e) {
    return routeError(e, 400);
  }
}
