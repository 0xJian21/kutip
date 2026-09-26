import { parseSignedOwnerTx, sendSigned } from "@kutip/solana";
import { json, pubkey, treasuryContext } from "@/lib/treasury/server";

/** Sends the owner-signed transaction from ../approve. Body: { owner, signedTransaction: base64 }. */
export async function POST(req: Request, ctx: RouteContext<"/api/treasury/proposals/[index]/submit">) {
  try {
    const { index } = await ctx.params;
    const body = (await req.json()) as { owner?: string; signedTransaction?: string };
    if (!body.signedTransaction) throw new Error("signedTransaction missing");
    const { connection, feePayer } = treasuryContext();
    const tx = parseSignedOwnerTx(body.signedTransaction, feePayer.publicKey, pubkey(body.owner, "owner"));
    const signature = await sendSigned(connection, tx);
    return json({ transactionIndex: index, signature });
  } catch (e) {
    return json({ error: (e as Error).message }, 400);
  }
}
