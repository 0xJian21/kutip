// Dev helper: list signatures seen on invoice reference keys. Run: pnpm --filter @kutip/solana exec tsx --env-file=../../.env scripts/watch-references.ts <ref> [<ref>...]
import { Connection, PublicKey } from "@solana/web3.js";
const c = new Connection(process.env["SOLAMI_RPC_URL"]!, "confirmed");
for (const ref of process.argv.slice(2)) {
  const sigs = await c.getSignaturesForAddress(new PublicKey(ref), { limit: 5 }, "confirmed");
  console.log(`${ref.slice(0, 8)}… ${sigs.length ? sigs.map((s) => `${s.signature} slot ${s.slot} err ${JSON.stringify(s.err)}`).join("; ") : "no payment yet"}`);
}
