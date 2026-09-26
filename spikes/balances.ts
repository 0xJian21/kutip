// Read-only: SOL + USDC balances of the three spike keys. Run: pnpm --filter @kutip/spikes exec tsx balances.ts
import { Connection, PublicKey, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { getAssociatedTokenAddressSync, getAccount } from "@solana/spl-token";
import bs58 from "bs58";
process.loadEnvFile(new URL("../.env", import.meta.url).pathname);
const rpc = process.env.SOLAMI_RPC_URL || "https://api.mainnet-beta.solana.com";
const c = new Connection(rpc, "confirmed");
const USDC = new PublicKey(process.env.USDC_MINT!);
for (const name of ["FEE_PAYER", "AGENT", "TEST_BUYER"]) {
  const pk = Keypair.fromSecretKey(bs58.decode(process.env[`${name}_SECRET`]!)).publicKey;
  const sol = (await c.getBalance(pk)) / LAMPORTS_PER_SOL;
  const ata = getAssociatedTokenAddressSync(USDC, pk);
  let usdc = "no ATA";
  try { usdc = (Number((await getAccount(c, ata)).amount) / 1e6).toFixed(6); } catch {}
  console.log(`${name.padEnd(11)} ${pk.toBase58()}  SOL=${sol}  USDC=${usdc}  ata=${ata.toBase58()}`);
}
