// Dev helper: decode a Solana Pay POST response ({transaction}) and print the instruction layout + fee-payer audit.
// Run: pnpm --filter @kutip/solana exec tsx --env-file=../../.env scripts/decode-tx.ts <response.json>
import { readFileSync } from "node:fs";
import { Connection, Transaction, TransactionMessage, VersionedTransaction, PublicKey, type AddressLookupTableAccount } from "@solana/web3.js";
import { decodeComputeBudget } from "../src/shared/audit";

const { transaction } = JSON.parse(readFileSync(process.argv[2]!, "utf8")) as { transaction: string };
const bytes = Buffer.from(transaction, "base64");
let feePayer: PublicKey, ixs, sigs: string[], version: string;
try {
  const tx = VersionedTransaction.deserialize(bytes);
  if (tx.version === "legacy") throw new Error("legacy");
  version = "v0";
  feePayer = tx.message.staticAccountKeys[0]!;
  const luts: AddressLookupTableAccount[] = [];
  if (tx.message.addressTableLookups.length) {
    const c = new Connection(process.env["SOLAMI_RPC_URL"]!, "confirmed");
    for (const l of tx.message.addressTableLookups) luts.push((await c.getAddressLookupTable(l.accountKey)).value!);
  }
  ixs = TransactionMessage.decompile(tx.message, { addressLookupTableAccounts: luts }).instructions;
  sigs = tx.signatures.map((s, i) => `${tx.message.staticAccountKeys[i]!.toBase58().slice(0, 6)}:${s.some((b) => b !== 0) ? "signed" : "empty"}`);
} catch {
  const tx = Transaction.from(bytes);
  version = "legacy";
  feePayer = tx.feePayer!;
  ixs = tx.instructions;
  sigs = tx.signatures.map((s) => `${s.publicKey.toBase58().slice(0, 6)}:${s.signature ? "signed" : "empty"}`);
}
console.log(`${version} ${bytes.length}B feePayer ${feePayer.toBase58()} sigs [${sigs.join(", ")}]`);
ixs.forEach((ix, i) => {
  const keys = ix.keys.map((k) => `${k.pubkey.toBase58().slice(0, 6)}${k.isSigner ? "S" : ""}${k.isWritable ? "W" : ""}`);
  console.log(`  ix[${i}] ${ix.programId.toBase58()} data=${ix.data.length}B keys[${keys.length}] ${keys.join(" ")}`);
});
console.log(`  budget ${JSON.stringify(decodeComputeBudget(ixs), (_, v) => (typeof v === "bigint" ? v.toString() : v))}`);
const inIx = ixs.some((ix) => ix.programId.equals(feePayer) || ix.keys.some((k) => k.pubkey.equals(feePayer)));
console.log(`  fee payer in any instruction: ${inIx ? "YES (BAD)" : "no"}`);
