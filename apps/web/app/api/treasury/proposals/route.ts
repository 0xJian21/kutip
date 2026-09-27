import { listProposals } from "@kutip/solana";
import { json, treasuryContext, treasuryMultisig } from "@/lib/treasury/server";

/** Every proposal on the exporter's treasury multisig, newest first (on-chain state). */
export async function GET() {
  try {
    const { connection } = treasuryContext();
    const multisigPda = await treasuryMultisig();
    const proposals = await listProposals(connection, multisigPda);
    return json({ multisig: multisigPda.toBase58(), proposals });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
}
