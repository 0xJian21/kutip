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

| What | Solami product | How | Code |
|---|---|---|---|
| **Payment detection** (Seen → Paid → Settled) | Yellowstone gRPC (`SOLAMI_GRPC_URL`, key sent as `x-token`) | One stream: `processed` transactions touching any open invoice's reference key or a buyer vault ATA, plus slot updates that move each tx to confirmed/finalized. The filter set is rewritten in place when invoices open or close (5 s DB poll) and resent with every ping. Reconnects with backoff (1 → 30 s), and also after 20 s of silence. Measured: geyser → worker 19 ms, Seen → Paid ~0.2 s, Settled ~8 s | `apps/worker/src/stream.ts`, `payments.ts`, `verify.ts` |
| **Balances** | same stream | vault/treasury token-account updates → cached balances for the dashboard | `apps/worker/src/balances.ts` |
| **Catch-up** | RPC `getSignaturesForAddress` + `getTransaction` | At startup, after every reconnect and every 3 minutes, per open reference key, so a payment made while the worker was down is recorded with its block time | `apps/worker/src/payments.ts` (`backfill`) |
| **Send path** | RPC (`SOLAMI_RPC_URL`) | Kutip builds every transaction it co-signs with a Solami blockhash. x402 settlements (simulate, then `sendRawTransaction`), agent sweeps, cash-out proposals, owner approvals and onboarding provisioning are all sent through Solami RPC and confirmed by polling `getSignatureStatuses`. Solana Pay transactions are sent by the buyer's wallet. SWQoS is not used (the key returned 401 in the spike) | `packages/solana/src/payments/x402.ts`, `packages/solana/src/treasury/rpc.ts` |
| **Wallet screening** | RPC | the payer's history (up to 3 × 1,000 signatures) and its first transaction's counterparties vs the OFAC SDN list, capped at 2.5 s per payment | `packages/solana/src/payments/screen.ts` |

To run on your own Solami key, set `SOLAMI_API_KEY`, `SOLAMI_RPC_URL` and `SOLAMI_GRPC_URL` from your Solami dashboard. Nothing else is tied to ours. One worker uses one gRPC stream (the Pro plan allows 2): never run two workers against the same database.

## Prerequisites

- Node 22 and pnpm 10 (`corepack enable`)
- Accounts and keys:
  - [Solami](https://solami.dev): an API key with RPC + gRPC access (the Pro plan allows 2 gRPC streams; the worker uses 1)
  - [Supabase](https://supabase.com): a Postgres project. Realtime must be on (it is by default).
  - [Privy](https://dashboard.privy.io): an app with **Passkey** and **Email** enabled under Login methods, passkeys allowed for sign-up, and your exact origins (e.g. `http://localhost:3000`, your production domain) under allowed domains. For Touch ID on every approval, enable MFA with passkey (Settings → Agent permissions enrols the owner).
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

pnpm --filter @kutip/db db:migrate             # 0000–0006: schema, RLS, Realtime Broadcast triggers, accounts (0005), inbox (0006)
pnpm --filter @kutip/db db:seed                # demo exporter "Teratai Woodworks", buyers, invoice history

pnpm --filter web dev                          # http://localhost:3000
```

1. Open `http://localhost:3000/onboarding` and sign in with email or a passkey. Two ways on from here:
   - **Your own company:** fill in the company step. Onboarding creates your exporter and provisions its Squads treasury on **mainnet**: about 0.004 SOL from the fee payer, capped at 5 sign-ups an hour, and paused while the fee payer holds under 0.02 SOL. Needs `AGENT_SECRET` (or `AGENT_PUBKEY`) on the web app.
   - **The seeded demo company** (Teratai Woodworks, with history and five buyers): copy the wallet address the onboarding page shows. That is the Squads owner. Continue with step 2. (`DEMO_FALLBACK=1` lets any sign-in into the demo company as a read-only `demo` role.)
2. Provision the demo treasury and one multisig per buyer on **mainnet**. It costs about 0.03 SOL from the fee payer; the script prints the plan and asks before every transaction.
   ```bash
   pnpm --filter @kutip/scripts exec tsx provision-demo.ts --owner <your wallet address>
   ```
3. Put the demo into a known state: fresh seed, provisioned multisigs attached, a live USD 1 invoice and a USD 0.50 invoice, every buyer email set to your inbox, and every `ZZ TEST …` exporter deleted. Database only, one transaction (a failure changes nothing), and it asks first. `--warm` screens the wallet you'll pay from so the first payment doesn't wait on a 12–37 s history check; `APP_URL` only sets the printed pay links. It creates new invoice ids on every run, so don't run it in the middle of a rehearsal.
   ```bash
   APP_URL=http://localhost:3000 pnpm --filter @kutip/scripts exec tsx demo-reset.ts --inbox you@gmail.com [--warm <buyer wallet>] [--yes]
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
7. Sweep and approve: press **Sweep now** on the dashboard (the agent key moves buyer vaults into the treasury under the on-chain spending limit), or run `pnpm --filter @kutip/scripts exec tsx sweep-demo.ts`. **Cash out** on the Treasury page (or `propose-cashout.ts --amount 250000`) creates a Squads proposal; approve it in **Agent activity** with your passkey (Touch ID).
8. The agent: ask the dashboard command bar ("What's due this week?", "Remind Najd about INV-2026-0141", "Sweep now"). Type a question on a pay page's message box and watch it land in `/inbox` with a drafted reply. `docs/REHEARSAL.md` is the full demo script.

Offline UI work without any keys: `NEXT_PUBLIC_KUTIP_MOCK=1 pnpm --filter web dev`.

### Checks

```bash
pnpm -r typecheck
pnpm -r test
pnpm --filter web build
```

## Deploy

**Web → Vercel.** Import the repo and set **Root Directory = `apps/web`**; `apps/web/vercel.json` does the rest (pnpm workspace install, functions in `hnd1`, next to the Supabase region). Keep **Fluid compute** on (the default; 300 s function lifetime): late wallet screenings and the pay-page agent run in `after()` once the response has gone out. Environment variables (Production):
- required: `SOLAMI_API_KEY SOLAMI_RPC_URL USDC_MINT FEE_PAYER_SECRET AGENT_SECRET DATABASE_URL SUPABASE_URL SUPABASE_ANON_KEY NEXT_PUBLIC_PRIVY_APP_ID PRIVY_APP_SECRET DEMO_EXPORTER_ID ANTHROPIC_API_KEY APP_URL`
- email: `RESEND_API_KEY EMAIL_ALLOWLIST` (+ `EMAIL_FROM` once you have a verified domain)
- optional: `SUPABASE_SERVICE_ROLE_KEY` (company logo uploads), `OPENROUTER_API_KEY` (Jev), `JUPITER_API_KEY`, `PAYMENTS_SOL_ENABLED`, `CASHOUT_FEE_BPS`, `NEXT_PUBLIC_DEMO_CONTROLS` ("Simulate a reply"), `DEMO_FALLBACK`

`AGENT_SECRET` signs "Sweep now" and creates cash-out proposals; `AGENT_PUBKEY` alone is enough if you only need onboarding. Use the Supabase **transaction pooler** URL (port 6543) for `DATABASE_URL`. Set `APP_URL` to the public https origin, and add that origin to the Privy app's allowed domains (passkeys are domain-bound). `next.config.ts` exposes `SUPABASE_URL`/`SUPABASE_ANON_KEY` to the browser for Realtime Broadcast (RLS gives the anon key no table access) and warns at build time if they're missing.

**Database migrations** run from your machine, never from a deploy: `pnpm --filter @kutip/db db:migrate` against the production `DATABASE_URL`. Drizzle skips a migration whose journal timestamp is older than the last applied one, so always generate new migrations after merging, never renumber them by hand.

**Worker → Fly.io.** One machine only: the Solami gRPC stream is stateful. `fly.toml` is at the repo root.
```bash
fly apps create kutip-worker
fly secrets set DATABASE_URL=… SOLAMI_API_KEY=… SOLAMI_RPC_URL=… SOLAMI_GRPC_URL=… FEE_PAYER_PUBKEY=… ANTHROPIC_API_KEY=… [OPENROUTER_API_KEY=… RESEND_API_KEY=… EMAIL_ALLOWLIST=…]
fly deploy --remote-only            # builds apps/worker/Dockerfile for linux/amd64
fly scale count 1
```
`fly.toml` sets `APP_URL`, `USDC_MINT` and `COLLECTIONS` (`on` sends reminders and receipts; `dry` logs them and writes nothing, for a shared database you're still seeding; `off`). Health: the worker answers `GET /health` on port 8080 inside Fly (503 when the stream is silent for 60 s); `fly status` shows the check. It never needs the fee payer's secret, only its public key for the low-balance alert. About US$4 per 30 days at 512 MB; `fly scale memory 256` halves it.

## Emailing buyers for real

Out of the box Kutip uses Resend's test sender (`onboarding@resend.dev`), which only delivers to the Resend account's own address, so `EMAIL_ALLOWLIST` holds just that inbox. The New invoice form still takes the buyer's address ("Send to", pre-filled from the buyer, optional CC to you). When the address is not on the allowlist, nothing is sent: the owner sees "Email not sent: Kutip can only email you until a domain is verified" with Copy pay link and Share on WhatsApp, and the attempt is recorded on the invoice (`messages.to_address`, `messages.delivery = skipped`).

To email any buyer:

1. In Resend, add and verify a domain you own (DNS: the SPF, DKIM and return-path records Resend lists).
2. Set, on Vercel **and** Fly (web sends invoices; the worker sends reminders and receipts):
   - `EMAIL_FROM="Teratai Woodworks via Kutip <invoices@your-domain.com>"` (an address on the verified domain)
   - `EMAIL_ALLOWLIST=*` (`*` lets the mailer send to anyone; leave a list while testing)
3. Redeploy. The form's caption changes to "The invoice and its pay link go here", and invoices, reminders, receipts and agent replies go to the buyer, with Reply-To set to the exporter's contact email.

The allowlist stays the safety gate: CC addresses pass the same check, and a skipped or failed send is always shown as not sent.

## Safety notes

- Money is `bigint` base units everywhere (USDC has 6 decimals).
- The fee payer never appears in instruction accounts, and it only co-signs transactions Kutip built itself (x402 payloads are checked strictly against the spec).
- Nothing identifying goes on-chain: the memo is an opaque `k_xxxxxxxx` and the reference key is random.
- Buyer wallets are checked against the OFAC SDN list on every payment. The wallet-history check gets 2.5 s; past that the payment proceeds and a bad late result is escalated for review.
- Web and worker only email addresses on `EMAIL_ALLOWLIST` (and their `+aliases`).
- Owner approvals only ever execute Squads proposals created by Kutip's agent key (a single USDC transfer out of the treasury), and the fee payer never appears in any instruction it signs.
- Buyers can message the seller from the pay page; the agent drafts, and it only answers on its own for routine questions the owner allowed, after a code check (no links, account numbers or other invoices).
