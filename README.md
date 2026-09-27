# Kutip

An AI collections and settlement agent for Malaysian exporters, on Solana. Kutip chases overseas invoices, sees the payment land in about a second, and settles it into the exporter's own Squads treasury. It stays inside rules the owner sets and never holds the owner's keys.

- **Buyers pay** from any Solana wallet with a QR code or link (Solana Pay transaction request), in USDC or in SOL converted on the spot (Jupiter ExactOut). They pay **0 SOL in gas**: Kutip is the fee payer. Accounts-payable bots pay over **x402**.
- **Detection** runs over a **Solami Yellowstone gRPC** stream: Seen (processed) → Paid (confirmed) → Settled (finalized), verified from transaction meta (mint, exact amount, destination, memo).
- **Treasury**: one Squads v4 multisig per buyer plus a main treasury. The agent key can only sweep into the treasury under an on-chain spending limit. Anything else becomes a proposal the owner approves with a passkey (Privy, Touch ID).
- **Agent**: Jev (via OpenRouter) and Claude Haiku propose; a plain TypeScript rules engine decides. LLMs never compute amounts or dates.

Product docs: [`docs/SPEC.md`](docs/SPEC.md) · [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) · [`docs/DECISIONS.md`](docs/DECISIONS.md).

```
apps/web        Next.js 16: owner app, buyer pay page, /api/pay (Solana Pay), /api/x402 (x402 facilitator)
apps/worker     Node: Solami gRPC listener, payment catch-up, collections scheduler, BNM rate, daily sweep
packages/solana tx builders, screening, Jupiter, x402 verify, Squads provisioning / sweeps / proposals
packages/agent  rules engine, Haiku + Jev clients, invoice PDF extraction
packages/db     Drizzle schema + migrations (Supabase Postgres), typed store, demo seed
scripts/        one-shot mainnet scripts: provision, sweep, propose, demo reset
```

## Where Solami is used

| What | Solami product | Code |
|---|---|---|
| Payment detection, balances | Yellowstone gRPC (`SOLAMI_GRPC_URL`, key as `x-token`) | `apps/worker/src/stream.ts` |
| Building + sending txs, wallet screening, catch-up | RPC (`SOLAMI_RPC_URL`) | `packages/solana`, `apps/worker/src/rpc.ts` |

To run on your own Solami key, set `SOLAMI_API_KEY`, `SOLAMI_RPC_URL` and `SOLAMI_GRPC_URL` from your Solami dashboard. Nothing else is tied to ours.

## Prerequisites

- Node 22 and pnpm 10 (`corepack enable`)
- Accounts and keys:
  - [Solami](https://solami.dev): an API key with RPC + gRPC access (the Pro plan allows 2 gRPC streams; the worker uses 1)
  - [Supabase](https://supabase.com): a Postgres project. Realtime must be on (it is by default).
  - [Privy](https://dashboard.privy.io): an app with **Passkey** enabled under Login methods, passkeys allowed for sign-up, and your domains (`localhost`, your production domain) under allowed origins. For Touch ID on every approval, enable transaction MFA with passkey.
  - [Anthropic](https://console.anthropic.com): an API key (Claude Haiku)
  - Optional: [OpenRouter](https://openrouter.ai) (Jev), [Resend](https://resend.com) (email), a [Jupiter](https://developers.jup.ag) API key
- Three Solana keypairs (base58 secret keys): **fee payer** (fund it with ~0.1 SOL), **agent**, **test buyer** (a little USDC for the bot demo). To generate one:
  ```bash
  pnpm --filter @kutip/scripts exec node -e "import('@solana/web3.js').then(async (w) => { const bs58 = (await import('bs58')).default; const k = w.Keypair.generate(); console.log(k.publicKey.toBase58(), bs58.encode(k.secretKey)); })"
  ```

## Run it locally

```bash
git clone <this repo> kutip && cd kutip
pnpm install
cp .env.example .env                           # fill it in; every variable is explained there
ln -s ../../.env apps/web/.env.local           # Next.js reads env from apps/web

pnpm --filter @kutip/db db:migrate             # schema, RLS, Realtime Broadcast triggers
pnpm --filter @kutip/db db:seed                # demo exporter "Teratai Woodworks", buyers, invoice history

pnpm --filter web dev                          # http://localhost:3000
```

1. Open `http://localhost:3000/onboarding` and create a passkey. Copy the wallet address it shows: that is the Squads owner. (Until step 2 links that wallet to the demo owner, sign-in is refused; set `DEMO_FALLBACK=1` to get in right away.)
2. Provision the treasury and one multisig per buyer on **mainnet**. It costs about 0.03 SOL from the fee payer; the script prints the plan and asks before every transaction.
   ```bash
   pnpm --filter @kutip/scripts exec tsx provision-demo.ts --owner <your wallet address>
   ```
3. Put the demo into a known state: fresh seed, provisioned multisigs attached, a live USD 1 invoice and a USD 0.50 invoice, and every buyer email set to your inbox. Database only; it asks first.
   ```bash
   pnpm --filter @kutip/scripts exec tsx demo-reset.ts --inbox you@gmail.com [--warm <buyer wallet>]
   ```
4. Start the worker in a second terminal:
   ```bash
   COLLECTIONS=dry pnpm --filter @kutip/worker dev    # dry: log reminders, send nothing; `on` for the full agent
   ```
5. Pay from a phone. Wallets need a public https URL, so run `cloudflared tunnel --url http://localhost:3000`. Restart the web app with `APP_URL=<tunnel url>`, open `<tunnel url>/pay/<invoice id>` on the phone and scan or tap **Open in wallet** (Phantom or Solflare).
6. Play the buyer's AP bot (x402, no human):
   ```bash
   pnpm --filter @kutip/solana bot http://localhost:3000/api/x402/invoice/<invoice id>          # dry run
   pnpm --filter @kutip/solana bot http://localhost:3000/api/x402/invoice/<invoice id> --yes    # pays on mainnet
   ```
7. Sweep and approve: `pnpm --filter @kutip/scripts exec tsx sweep-demo.ts` moves buyer vaults into the treasury under the spending limit. `propose-cashout.ts --amount 250000` creates a proposal; approve it in **Agent activity** with your passkey.

Offline UI work without any keys: `NEXT_PUBLIC_KUTIP_MOCK=1 pnpm --filter web dev`.

### Checks

```bash
pnpm -r typecheck
pnpm -r test
pnpm --filter web build
```

## Deploy

**Web → Vercel.** Import the repo and set **Root Directory = `apps/web`**; `apps/web/vercel.json` does the rest (pnpm workspace install, functions in `hnd1`, next to the Supabase region). Environment variables (Production):
`SOLAMI_API_KEY SOLAMI_RPC_URL USDC_MINT FEE_PAYER_SECRET DATABASE_URL SUPABASE_URL SUPABASE_ANON_KEY NEXT_PUBLIC_PRIVY_APP_ID PRIVY_APP_SECRET DEMO_EXPORTER_ID ANTHROPIC_API_KEY OPENROUTER_API_KEY JUPITER_API_KEY PAYMENTS_SOL_ENABLED NEXT_PUBLIC_DEMO_CONTROLS APP_URL`.
Use the Supabase **transaction pooler** URL (port 6543) for `DATABASE_URL`. Set `APP_URL` to the public https origin, and add that domain to the Privy app's allowed origins (passkeys are domain-bound).

**Worker → Fly.io.** One machine only: the Solami gRPC stream is stateful. `fly.toml` is at the repo root.
```bash
fly apps create kutip-worker
fly secrets set DATABASE_URL=… SOLAMI_API_KEY=… SOLAMI_RPC_URL=… SOLAMI_GRPC_URL=… FEE_PAYER_PUBKEY=… ANTHROPIC_API_KEY=… APP_URL=… [RESEND_API_KEY=… EMAIL_ALLOWLIST=…]
fly deploy --remote-only            # builds apps/worker/Dockerfile for linux/amd64
fly scale count 1
```
Health: the worker answers `GET /health` on port 8080 (503 when the stream is silent for 60 s). It never needs the fee payer's secret, only its public key for the low-balance alert.

## Safety notes

- Money is `bigint` base units everywhere (USDC has 6 decimals).
- The fee payer never appears in instruction accounts, and it only co-signs transactions Kutip built itself (x402 payloads are checked strictly against the spec).
- Nothing identifying goes on-chain: the memo is an opaque `k_xxxxxxxx` and the reference key is random.
- Buyer wallets are checked against the OFAC SDN list on every payment. The wallet-history check gets 2.5 s; past that the payment proceeds and a bad late result is escalated for review.
- The worker only emails addresses on `EMAIL_ALLOWLIST` (and their `+aliases`).
