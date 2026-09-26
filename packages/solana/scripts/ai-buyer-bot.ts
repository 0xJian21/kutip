// Demo scene (SPEC §7 step 8): the buyer's accounts-payable bot pays an invoice over x402 v2 with no human.
// Run: pnpm --filter @kutip/solana bot <x402 invoice url> [--yes]     (TEST_BUYER_SECRET + SOLAMI_RPC_URL from .env)
// Read-only until --yes: fetches the 402, prints the payment terms and the AP policy check, then stops.
import { getAssociatedTokenAddressSync, getAccount } from "@solana/spl-token";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import bs58 from "bs58";
import { buildX402ClientTransaction, decodeHeader, encodeHeader, X402_HEADERS, type PaymentRequired, type SettleResponse } from "../src/payments/x402";

const url = process.argv[2];
if (!url) throw new Error("usage: bot <x402 invoice url> [--yes]");
const yes = process.argv.includes("--yes");
const env = (k: string) => {
  const v = process.env[k];
  if (!v) throw new Error(`missing env ${k}`);
  return v;
};
const buyer = Keypair.fromSecretKey(bs58.decode(env("TEST_BUYER_SECRET")));
const connection = new Connection(env("SOLAMI_RPC_URL"), "confirmed");
const AP_POLICY = { maxPerInvoiceUsdc: 1_000_000n, allowedAssets: [env("USDC_MINT")], network: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp" };
const say = (s: string) => console.log(`🤖 ${s}`);
const usdc = (n: bigint) => `${n / 1_000_000n}.${(n % 1_000_000n).toString().padStart(6, "0")} USDC`;

say(`AP bot ${buyer.publicKey.toBase58()} fetching ${url}`);
const first = await fetch(url, { headers: { accept: "application/json" } });
if (first.status === 200) {
  say(`already paid: ${JSON.stringify(await first.json())}`);
  process.exit(0);
}
if (first.status !== 402) throw new Error(`expected 402, got ${first.status}: ${await first.text()}`);
const header = first.headers.get(X402_HEADERS.required);
if (!header) throw new Error("402 without PAYMENT-REQUIRED header");
const required = decodeHeader<PaymentRequired>(header);
const offer = required.accepts.find((a) => a.scheme === "exact" && a.network === AP_POLICY.network);
if (!offer) throw new Error(`no exact/solana offer in ${JSON.stringify(required.accepts)}`);
say(`invoice: "${required.resource.description}" — ${usdc(BigInt(offer.amount))} to vault ${offer.payTo}, memo ${offer.extra.memo}, fee payer ${offer.extra.feePayer.slice(0, 6)}… (they cover gas)`);

// AP policy: the rules engine decides, not the bot's mood.
const amount = BigInt(offer.amount);
const checks = [
  [`asset is USDC`, AP_POLICY.allowedAssets.includes(offer.asset)],
  [`amount ${usdc(amount)} ≤ policy cap ${usdc(AP_POLICY.maxPerInvoiceUsdc)}`, amount <= AP_POLICY.maxPerInvoiceUsdc],
  [`network is Solana mainnet`, offer.network === AP_POLICY.network],
] as const;
for (const [label, ok] of checks) say(`${ok ? "✓" : "✗"} ${label}`);
if (!checks.every(([, ok]) => ok)) throw new Error("AP policy refused this invoice");

const sourceAta = getAssociatedTokenAddressSync(new PublicKey(offer.asset), buyer.publicKey);
const balance = (await getAccount(connection, sourceAta)).amount;
say(`USDC balance ${usdc(balance)}${balance < amount ? " — insufficient" : ""}`);
if (balance < amount) process.exit(1);
if (!yes) {
  say("dry run complete; re-run with --yes to pay (mainnet)");
  process.exit(0);
}

const { blockhash } = await connection.getLatestBlockhash("confirmed");
const payload = buildX402ClientTransaction({ requirements: offer, client: buyer, blockhash, sourceAta });
say(`signed a ${Buffer.from(payload.payload.transaction, "base64").length}-byte transaction; retrying with PAYMENT-SIGNATURE`);
const t0 = Date.now();
const paid = await fetch(url, { headers: { accept: "application/json", [X402_HEADERS.signature]: encodeHeader(payload) } });
const body = await paid.json();
const response = paid.headers.get(X402_HEADERS.response);
const settle = response ? decodeHeader<SettleResponse>(response) : undefined;
say(`HTTP ${paid.status} in ${Date.now() - t0} ms`);
say(`PAYMENT-RESPONSE: ${JSON.stringify(settle)}`);
say(`receipt: ${JSON.stringify(body)}`);
if (paid.status !== 200 || !settle?.success) process.exit(1);
say(`paid. https://solscan.io/tx/${settle.transaction}`);
