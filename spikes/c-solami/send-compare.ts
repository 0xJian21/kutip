// Spike C — send-compare: normal Solami RPC sendTransaction vs Solami SWQoS ("Beam") path, on MAINNET.
//
// Each round sends two tiny SOL transfers FEE_PAYER → TEST_BUYER (1000 lamports):
//   normal : SOLAMI_RPC_URL (RPC key), sendTransaction { skipPreflight: false, maxRetries: 3 }
//   swqos  : same RPC host with the SWQoS-type key, sendTransaction { skipPreflight: true, maxRetries: 0 }  (per Solami docs)
//            + a 0.0001 SOL tip to a Solami tip account (Beam's minimum; `--no-tip` to skip)
// and measures send → first seen (processed) → confirmed with getSignatureStatuses polling.
//
// Usage:
//   pnpm --filter @kutip/spikes exec tsx c-solami/send-compare.ts [--rounds 1] [--lamports 1000] [--no-tip]
//
// Env (repo-root .env): SOLAMI_RPC_URL (+ SOLAMI_API_KEY), SOLAMI_SWQOS_KEY (SWQoS-type key from Dashboard → API Keys),
//   optional SOLAMI_SWQOS_RPC_URL (defaults to SOLAMI_RPC_URL host with ?api_key=SOLAMI_SWQOS_KEY), FEE_PAYER_SECRET, TEST_BUYER_SECRET.
//
// Docs: https://solami.mintlify.app/guides/sending-transactions, https://solami.mintlify.app/infrastructure/swqos
// Tip accounts: https://api.solami.dev/onchain/tip-addresses (no auth). Beam over QUIC (beam.solami.dev:11000) needs the
// `solami` npm SDK and a keypair-type SWQoS key — not exercised here; see notes/c-solami.md.

import { fileURLToPath } from "node:url";
import readline from "node:readline/promises";
import { Connection, Keypair, PublicKey, SystemProgram, TransactionMessage, VersionedTransaction } from "@solana/web3.js";
import bs58 from "bs58";

try {
  process.loadEnvFile(fileURLToPath(new URL("../../.env", import.meta.url)));
} catch {
  /* .env optional */
}

const TIP_LAMPORTS = 100_000; // 0.0001 SOL = Solami's documented minimum Beam tip
const TIP_ADDRESSES_URL = "https://api.solami.dev/onchain/tip-addresses";
const FALLBACK_TIP_ACCOUNTS = [
  "15qWd4huAkoxvhDsHMfpUn27TW1YBYMMJJ2jkAkbeam",
  "9XuGciSwr5wb7dLTQm91JhuBTvj3GG8WjuRDc3obeam",
  "kiQioJNyFG7pU36ELLsRKXkeT48kFbk3b6rSgrWbeam",
  "kjmVhW1UzJrW2sU5bY5NtZ79jpvjSStsj37Pzmabeam",
];

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`missing env ${name}`);
  return v;
}
function withKey(url: string, key: string | undefined): string {
  const u = new URL(url);
  if (key) u.searchParams.set("api_key", key);
  return u.toString();
}

type Result = { round: number; path: string; sig: string; slotAtSend: number; slotLanded?: number; processedMs?: number; confirmedMs?: number; landed: string };

async function main() {
  const rounds = Number(arg("--rounds") ?? "1");
  const lamports = Number(arg("--lamports") ?? "1000");
  const tip = !process.argv.includes("--no-tip");
  if (!(rounds >= 1 && rounds <= 10)) throw new Error("--rounds 1..10");
  if (!(lamports >= 1 && lamports <= 1_000_000)) throw new Error("--lamports 1..1000000");

  const feePayer = Keypair.fromSecretKey(bs58.decode(env("FEE_PAYER_SECRET")));
  const buyer = Keypair.fromSecretKey(bs58.decode(env("TEST_BUYER_SECRET")));

  const normalUrl = withKey(env("SOLAMI_RPC_URL"), new URL(env("SOLAMI_RPC_URL")).searchParams.get("api_key") ?? process.env.SOLAMI_API_KEY);
  const swqosUrl = process.env.SOLAMI_SWQOS_RPC_URL ?? withKey(env("SOLAMI_RPC_URL"), env("SOLAMI_SWQOS_KEY"));
  const normal = new Connection(normalUrl, "confirmed");
  const swqos = new Connection(swqosUrl, "confirmed");

  let tipAccounts = FALLBACK_TIP_ACCOUNTS;
  try {
    const live = (await (await fetch(TIP_ADDRESSES_URL)).json()) as string[];
    if (Array.isArray(live) && live.length) tipAccounts = live;
  } catch {
    console.log("tip-addresses fetch failed, using fallback list");
  }

  const payerLamports = await normal.getBalance(feePayer.publicKey);
  const perRound = 2 * (lamports + 5_000) + (tip ? TIP_LAMPORTS : 0);
  const total = rounds * perRound;
  if (payerLamports < total + 1_000_000) throw new Error(`fee payer has ${payerLamports} lamports, need ~${total + 1_000_000}`);

  console.log("About to send on MAINNET:");
  console.log(`  ${rounds} round(s) × 2 tx: ${lamports} lamports ${feePayer.publicKey.toBase58()} → ${buyer.publicKey.toBase58()}`);
  console.log(`  normal: ${new URL(normalUrl).host}  skipPreflight=false maxRetries=3`);
  console.log(`  swqos : ${new URL(swqosUrl).host}  skipPreflight=true  maxRetries=0  tip=${tip ? `${TIP_LAMPORTS} lamports → Solami tip account` : "none"}`);
  console.log(`  worst-case spend ≈ ${total} lamports (${total / 1e9} SOL) incl. base fees`);
  // --yes: plan already confirmed out-of-band (no TTY in the Claude Code shell).
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = process.argv.includes("--yes") ? "y" : await rl.question("Send? [y/N] ");
  rl.close();
  if (answer.trim().toLowerCase() !== "y") return console.log("aborted");

  const results: Result[] = [];
  for (let round = 1; round <= rounds; round++) {
    // Alternate order so neither path always goes first.
    const order = round % 2 === 1 ? (["normal", "swqos"] as const) : (["swqos", "normal"] as const);
    for (const path of order) {
      const conn = path === "normal" ? normal : swqos;
      const instructions = [SystemProgram.transfer({ fromPubkey: feePayer.publicKey, toPubkey: buyer.publicKey, lamports })];
      if (path === "swqos" && tip) {
        const tipTo = new PublicKey(tipAccounts[Math.floor(Math.random() * tipAccounts.length)]!);
        instructions.push(SystemProgram.transfer({ fromPubkey: feePayer.publicKey, toPubkey: tipTo, lamports: TIP_LAMPORTS }));
      }
      const { blockhash, lastValidBlockHeight } = await normal.getLatestBlockhash("confirmed");
      const tx = new VersionedTransaction(
        new TransactionMessage({ payerKey: feePayer.publicKey, recentBlockhash: blockhash, instructions }).compileToV0Message(),
      );
      tx.sign([feePayer]);

      const slotAtSend = await normal.getSlot("processed");
      const tSent = Date.now();
      const sig = await conn.sendRawTransaction(
        tx.serialize(),
        path === "normal" ? { skipPreflight: false, preflightCommitment: "processed", maxRetries: 3 } : { skipPreflight: true, maxRetries: 0 },
      );
      const r: Result = { round, path, sig, slotAtSend, landed: "pending" };
      results.push(r);
      console.log(`[${new Date(tSent).toISOString()}] ${path.padEnd(6)} sent ${sig}`);

      while (r.confirmedMs === undefined) {
        await new Promise((t) => setTimeout(t, 100));
        const now = Date.now();
        const st = (await normal.getSignatureStatuses([sig])).value[0];
        if (st?.err) {
          r.landed = `FAILED ${JSON.stringify(st.err)}`;
          break;
        }
        if (st) {
          r.slotLanded ??= st.slot;
          r.processedMs ??= now - tSent;
          if (st.confirmationStatus === "confirmed" || st.confirmationStatus === "finalized") {
            r.confirmedMs = now - tSent;
            r.landed = "yes";
            console.log(`[${new Date(now).toISOString()}] ${path.padEnd(6)} confirmed +${r.confirmedMs}ms slot=${st.slot} (+${st.slot - slotAtSend} slots)`);
          }
        } else if (now - tSent > 5_000 && (await normal.getBlockHeight("confirmed")) > lastValidBlockHeight) {
          r.landed = "expired";
          break;
        }
      }
    }
  }

  console.table(
    results.map((r) => ({
      round: r.round,
      path: r.path,
      signature: `${r.sig.slice(0, 8)}…`,
      slotAtSend: r.slotAtSend,
      slotLanded: r.slotLanded ?? "",
      "slots +": r.slotLanded !== undefined ? r.slotLanded - r.slotAtSend : "",
      "→processed ms": r.processedMs ?? "",
      "→confirmed ms": r.confirmedMs ?? "",
      landed: r.landed,
    })),
  );
  for (const r of results) console.log(`${r.path}: https://solscan.io/tx/${r.sig}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
