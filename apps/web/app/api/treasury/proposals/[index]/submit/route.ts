import { parseSignedOwnerTx, sendSigned } from "@kutip/solana";
import { json, pubkey, treasuryContext, treasuryMultisig } from "@/lib/treasury/server";

/**
 * Sends the owner-signed transaction from ../approve. Body: { owner, signedTransaction: base64, actionId? }.
 * With `actionId`, the agent action behind this proposal is marked executed with the signature once confirmed.
 */
export async function POST(req: Request, ctx: RouteContext<"/api/treasury/proposals/[index]/submit">) {
  try {
    const { index } = await ctx.params;
    const body = (await req.json()) as { owner?: string; signedTransaction?: string; actionId?: string };
    if (!body.signedTransaction) throw new Error("signedTransaction missing");
    const { exporterId } = await treasuryMultisig();
    const { connection, feePayer, store } = treasuryContext();
    const tx = parseSignedOwnerTx(body.signedTransaction, feePayer.publicKey, pubkey(body.owner, "owner"));
    const signature = await sendSigned(connection, tx);
    if (body.actionId) await store.setActionStatus(exporterId, body.actionId, "executed", signature);
    return json({ transactionIndex: index, signature });
  } catch (e) {
    return json({ error: (e as Error).message }, 400);
  }
}
