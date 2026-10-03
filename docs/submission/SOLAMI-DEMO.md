# Solami demo script (2:30)

For the Solami prize: show that Solami does real work in Kutip, live on mainnet, and that anyone can clone the repo and run it on their own Solami key. Built in `video/` as the `Solami` composition (`SOLAMI` constants in `video/src/solami/Solami.tsx` match the timestamps below). Voice-over to `docs/video/vo-solami.mp3`, captions to `docs/video/captions/solami.srt`.

What Solami does in Kutip (README "Where Solami is used"):
- **Payment detection** on a Yellowstone gRPC stream: processed transactions touching any open invoice's reference key or buyer vault ATA, plus slot updates, become Seen → Paid → Settled. Filters are rewritten in place as invoices open and close and resent with every ping; reconnect with backoff and after 20 s of silence.
- **Balances** for the dashboard from the same stream.
- **Catch-up** over Solami RPC (`getSignaturesForAddress` + `getTransaction`) at startup, after every reconnect and every 3 minutes.
- **Every send** (x402 settlements, agent sweeps, cash-out proposals, owner approvals, onboarding provisioning) goes through Solami RPC with a Solami blockhash and is confirmed by polling.
- **Wallet screening** reads the payer's history over Solami RPC.
- Not used: SWQoS/Beam (the key returned 401 in the spike). Say so if asked; it is not on the critical path.

Measured (say the numbers that are on screen, nothing else):
| Run | Source | Seen | Paid | Settled |
|---|---|---|---|---|
| Spike C, 27 Sep 2026 (from send) | DECISIONS.md | +0.54 s (geyser → client 60 ms) | +0.73 s | +9.2 s |
| Worker live, 27 Sep 2026 (from Seen) | PLAN.md Session 4 | geyser → worker 19 ms | +0.23 s | +8.36 s |
| Production, 29 Sep 2026 (from Seen) | REHEARSAL.md | live flip, no refresh | +0.15 s | +7.86 s |

| Time | Segment | Voice-over | On-screen | Record |
|---|---|---|---|---|
| 0:00–0:06 | Title | This is the part of Kutip that runs on Solami: the worker that moves an invoice from Seen to Paid to Settled, live on Solana mainnet, and how to run it yourself. | **Payment detection on a Solami gRPC stream, live on mainnet.** | Kit `TitleCard` |
| 0:06–0:16 | How it listens | One Yellowstone gRPC stream on Solami watches every open invoice's reference key and every buyer vault, plus slot updates. Processed becomes Seen, confirmed becomes Paid, finalized becomes Settled. Each payment is verified from the transaction meta: USDC mint, exact amount, that buyer's vault, matching memo. | Four cards: One stream, every account · Seen, Paid, Settled · Verified from tx meta · Catch-up over RPC. Footnote: `apps/worker/src/stream.ts`, `payments.ts`, `verify.ts` | Kit `InfoCard` (HOW points already in `Solami.tsx`) |
| 0:16–0:56 | Live stream: worker logs beside the dashboard | On the left, the worker's log on Fly, reading the Solami stream. On the right, the invoice page. The buyer pays from a phone. Seen: the stream saw the transaction at processed, nineteen milliseconds after the geyser. Paid: confirmed, a fifth of a second later. Settled: finalized, under eight seconds. The page flipped by itself; the worker wrote each step to the database and Supabase Realtime pushed it to the browser. | Left: `fly logs -a kutip-worker`. Right: invoice page. Captions: "processed → Seen, confirmed → Paid, finalized → Settled." Proof card `pay-sol` at 0:46 | Terminal: `worker-stream.log` (`fly logs -a kutip-worker --no-tail \| tail -80` right after the payment; must contain the `gRPC subscribed: N tx keys, M balance accounts` line, then `Seen inv_… slot …`, `Paid … +0.1xx s`, `Settled … +7.x s` lines for the same signature). Browser: `clip-04-live-flip.mp4` (same clip as the demo video, or a second payment of INV-0154 if it was already paid) |
| 0:56–1:16 | Catch-up | Now the stream is gone: stop the worker, pay an invoice, start it again. On startup the worker fetches the signatures of every watched account over Solami RPC and finds the payment it never saw. Every three minutes it does the same, so a restart never loses a payment. | "Restart the worker: catch-up finds the payment over RPC within 3 minutes." Log lines: `Catch-up inv_… found over RPC (finalized)` | Terminal: `worker-catchup.log`. Recipe: `fly scale count 0 -a kutip-worker`; pay a fresh invoice from the phone (create one, USD 1); `fly scale count 1 -a kutip-worker`; `fly logs -a kutip-worker --no-tail \| tail -60 > docs/video/clips/worker-catchup.log` once the `Catch-up` line appears. Optional browser clip `clip-11-catchup.mp4`: the invoice page already Paid/Settled after the restart. **Never run two workers** (two streams would double-record) |
| 1:16–1:36 | Balances | Buyer receiving accounts and the treasury balance on the Treasury page come from the same stream: token-account updates for every vault, cached for the dashboard. Here is the sweep from earlier landing in the treasury. | "Vault and treasury balances update from the same stream." | `clip-12-treasury.mp4`: Treasury page; after a sweep (demo shot 8) the "Waiting" column drops to 0 and the treasury figure rises; hover the Solscan link of the last sweep |
| 1:36–2:16 | Clone and run | To run it on your own key you need three values from your Solami dashboard: the API key, sent as x-token on the stream and as the RPC key; the gRPC endpoint; and the RPC endpoint. Nothing else is tied to ours. Clone the repo, install, fill in dot-env, migrate, seed, start the web app and the worker. One worker uses one gRPC stream; the Pro plan allows two. | Three cards: `SOLAMI_API_KEY` · `SOLAMI_GRPC_URL` · `SOLAMI_RPC_URL`. Terminal with the README commands below | Kit `InfoCard` + `CommandTerminal` (commands below). Optionally a 5 s real terminal clip of `pnpm --filter @kutip/worker dev` printing `watching N tx keys, M balance accounts` |
| 2:16–2:30 | End | Kutip on Solami. The repo is public, the README is the whole setup. | kutip-app.vercel.app · github.com/0xJian21/kutip · README "Where Solami is used" | Kit `EndCard` |

README commands to show (verbatim from `README.md`):
```bash
git clone https://github.com/0xJian21/kutip kutip && cd kutip
pnpm install
cp .env.example .env            # SOLAMI_API_KEY, SOLAMI_RPC_URL, SOLAMI_GRPC_URL from your Solami dashboard
ln -s ../../.env apps/web/.env.local
pnpm --filter @kutip/db db:migrate
pnpm --filter @kutip/db db:seed
pnpm --filter web dev
COLLECTIONS=dry pnpm --filter @kutip/worker dev
```

Things to say only if asked (all true, none on screen): the spike found that a keepalive ping with empty filters replaced the subscription on Solami's geyser, so the worker resends the full filter set with every ping; `getTransaction` is used raw because `getParsedTransaction` fails on Solami's `stackHeight` field; Solami's WebSocket lives at `/ws/sol`, so confirmations poll `getSignatureStatuses`; Solami RPC had a 5-minute outage on 29 Sep 2026 during a test, which the catch-up path covers.
