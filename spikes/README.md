# Kutip spikes (Session 1)

Throwaway scripts that proved / disproved the four riskiest assumptions on Solana **mainnet** (2026-09-27).
Not production code — no abstractions, no shared framework. Verdicts and consequences: `docs/DECISIONS.md` → "Spike results".
Detailed findings per spike: `notes/*.md`.

Secrets come from the repo-root `.env` (see `.env.example`). Amounts ≤ 1 USDC / 0.01 SOL per tx. Every script that writes
to mainnet prints the plan (accounts, amounts, estimated SOL) and waits for `y`; pass `--yes` only when you have already
approved that plan out-of-band (needed when there is no TTY, e.g. from Claude Code).

```
pnpm install                       # deps live in spikes/package.json
pnpm --filter @kutip/spikes typecheck
pnpm --filter @kutip/spikes exec tsx balances.ts        # read-only: SOL/USDC of FEE_PAYER, AGENT, TEST_BUYER
```

Env used: `SOLAMI_RPC_URL` (full URL incl. `?api_key=`), `SOLAMI_GRPC_URL`, `SOLAMI_API_KEY` (gRPC-type key, sent as
`x-token`), `SOLAMI_SWQOS_KEY` (optional), `FEE_PAYER_SECRET`, `AGENT_SECRET`, `TEST_BUYER_SECRET`, `USDC_MINT`,
`ANTHROPIC_API_KEY` (+ `ANTHROPIC_WORKSPACE_ID` for org-scoped keys), `TYPESAFE_API_KEY`.

## A — Solana Pay transaction request, gasless (`a-solana-pay/`) → PASS

```
brew install cloudflared
cloudflared tunnel --url http://localhost:3999          # copy the https://….trycloudflare.com URL
PORT=3999 PUBLIC_URL=https://<tunnel> DEST_USDC_ATA=<existing USDC ATA> MODE=usdc AMOUNT_USDC=100000 \
  pnpm --filter @kutip/spikes exec tsx a-solana-pay/server.ts      # prints QR (terminal + qr.png) and the reference
pnpm --filter @kutip/spikes exec tsx a-solana-pay/watch.ts        # polls the reference; prints "buyer paid 0 SOL"
```
- `MODE=jup-exactout` (default `AMOUNT_USDC=500000`): buyer pays SOL, destination receives exactly that USDC, v0 + LUTs.
- Scan the QR with the wallet's **own scanner** (Phantom/Solflare top-right icon). Do not paste the `solana:` URL into Send.
- The phone account needs USDC (usdc mode) or ~0.01 SOL (exactout mode). `fund-phone.ts <pubkey> [--usdc N] [--lamports N]`
  tops it up from the spike keys (test helper only).
- Server refuses to sign if the fee payer appears in any instruction, never creates ATAs, caps CU price, rejects > 1232 B.

## B — Squads v4 spending-limit sweep (`b-squads/`) → PASS

```
pnpm --filter @kutip/spikes exec tsx b-squads/run.ts [--yes]
```
Steps 0–8 (read ProgramConfig → create buyer + treasury multisig → vault ATAs → spending limit via config tx/proposal/
execute → fund 0.5 USDC → AGENT `spendingLimitUse` sweep → negative test to a non-allowlisted wallet → cost summary).
Resumable: `state.json` (gitignored) records addresses/signatures after each step; delete it to start from scratch
(≈0.012 SOL). Allowlist entries are **owner wallets (vault PDA)**, not token accounts.

## C — Solami as the data path (`c-solami/`) → PASS (gRPC) / PARTIAL (SWQoS)

```
# terminal 1: listener (one stream: processed txs + slot status → processed/confirmed/finalized timings)
pnpm --filter @kutip/spikes exec tsx c-solami/listen.ts <reference> <vaultAta> [--mode=slots|streams] [--debug]
# terminal 2: a Kutip-shaped payment (0.1 USDC + reference + memo, fee payer sponsored)
pnpm --filter @kutip/spikes exec tsx c-solami/trigger.ts --to-ata <vaultAta> --reference <reference> [--yes]
# normal RPC vs SWQoS send comparison (needs SOLAMI_SWQOS_KEY)
pnpm --filter @kutip/spikes exec tsx c-solami/send-compare.ts --rounds 1 [--no-tip] [--yes]
```
Generate the reference up front (`node -e 'console.log(require("@solana/web3.js").Keypair.generate().publicKey.toBase58())'`)
so the listener is running before the payment. Keepalive pings **must** carry the full filters (see notes/c-solami.md).

## D — Jev + Haiku fallback (`d-jev/`) → PARTIAL (Haiku PASS, Jev waitlisted)

```
pnpm --filter @kutip/spikes exec tsx d-jev/run.ts      # 6 sample emails through both classifiers, table + adversarial raw
```
No mainnet. Both implement `classify(email) → {label, confidence, latencyMs, costUsd}` (`samples.ts`). Jev runs once
`TYPESAFE_API_KEY` is set; Haiku needs `ANTHROPIC_API_KEY` (+ `ANTHROPIC_WORKSPACE_ID` if the key is org-scoped).
