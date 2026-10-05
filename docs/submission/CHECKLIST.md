# Submission checklist

**Submit by Friday 10 Oct 2026** (submissions close 11 Oct; Colosseum main closes 12 Oct, DECISIONS D7). Three submissions: the Colosseum portal, the Superteam Earn track listing ("Build Global, Buatan Malaysia") and the Superteam Earn Solami listing. Everything below is paste-ready; `TODO` marks what only the owner can fill in. The exact field names on each form may differ; the blocks here cover every field those forms are known to ask for.

## Update from Superteam MY (received 2026-10-06)

- **Track listing renamed:** "Superteam MY x Superscrypt: Build Global, Buatan Malaysia" → https://superteam.fun/earn/listing/superteam-my-x-superscrypt-build-global-buatan-malaysia (use this link wherever this file says "track listing").
- **Solami listing:** https://superteam.fun/earn/listing/superteam-my-x-solami-build-global-buatan-malaysia
- **NEW: Colosseum Week 4 video (required, one per team).** Submissions open **9 Oct, 11:00 PM MYT**, due **12 Oct, 11:00 PM MYT**. Content: what you built, what you learned, what you'll work on next. YouTube, Loom or Vimeo, viewable without requesting access. **Links can't be changed or deleted after submitting** — double-check first. Plan: a ~2–3 min talking-head + screen recording (can reuse demo clips and the hook).
- [ ] X account live; post updates tagging **@SuperteamMY @solana @colosseum** through the week (pinned post with the 30 s hook).
- [ ] Optional: X Premium (blue tick) — recommended by the organisers.
- Help: @hanstmy or @tuakdotsol on Telegram.

## Links (one place)

| What | Link |
|---|---|
| Live app | https://kutip-app.vercel.app |
| GitHub (public) | https://github.com/0xJian21/kutip |
| Pitch video (≤ 2:00) | TODO: upload `docs/video/out/pitch-1920x1080.mp4` to YouTube (unlisted is fine) and paste the link |
| Demo video (≤ 2:00) | TODO: upload `docs/video/out/demo-1920x1080.mp4` |
| Solami demo (2:30) | TODO: upload `docs/video/out/solami-1920x1080.mp4` |
| Pitch deck | https://claude.ai/artifact/UzmmGo2rRV6TLzT5FYNATD (TODO: export to PDF from the deck's Share menu and attach the PDF; the artifact link is private until shared) |
| Write-up | `docs/submission/WRITEUP.md` (also in the repo) |
| Mainnet proof (Solscan) | Pay in SOL, exact USDC: https://solscan.io/tx/5GDG5XPL8cJwDPJTvvqbgnKcL5SThS9t5GgVDYeVh6fQFgTHJxayc7KqM84KZwBy75by2jBcfdAsA8HHvtjv3AMV · x402: https://solscan.io/tx/5taDgww4YGWphCH5rMiGLjM3253HeZa2LbQcbhy9bqNHHAznh58hA7h7J1cuRJ1eB7S5MtdrUVMvD9jXL1sM1AWm · Sweep: https://solscan.io/tx/47KoPjR6tVT5pLGwfAADGT5LKLXmGcjSeX5hSc6rGGFDdwyF14gSxuPX6QnJyvLR3z74vUPmjrCK4JN4qhkpfobP · Cash-out with Touch ID: https://solscan.io/tx/3b7KNHLUENg36RWemfqc6N2nXhTbjZSDeQqu9xkkzeSio9rPojq6JgJGRSXk1wYRtLU2vg3qiwm8duBpcmjYKTq1 |

## Eligibility (tick before submitting)

- [ ] Base country on the Colosseum entry: **Malaysia**.
- [ ] At least one Malaysian team member: Jian Wei, based in Malaysia.
- [ ] Pre-existing code disclosure: **none**. First commit 27 Sep 2026 (`git log --reverse`); the whole codebase was written during the hackathon window. State this verbatim where the form asks.
- [ ] Superteam MY registration form filled in: TODO (link from the track listing).
- [ ] Joined the Superteam MY Telegram builder group: TODO.
- [ ] Demo Day attendance confirmed: **date TBC with Superteam MY** (D7: the original 4 Oct date moved when the deadline moved to 11 Oct). TODO: ask in the builder group and put the date here.
- [ ] Repo public and the README runs end to end on a fresh machine with the three Solami env vars (Solami requirement).
- [x] Team details filled into `WRITEUP.md`, the deck's last slide and `PITCH-VIDEO.md` (2026-10-06). The video package's `TeamCard` in `video/src/pitch/Pitch.tsx` still needs the same values (video session).
- [ ] Videos ≤ 2:00 each (pitch 1:58, demo 1:58); Solami demo 2:30.
- [ ] Fee payer topped up (≥ 0.1 SOL) and the x402 test buyer holds ≥ 0.50 USDC, so judges who scan the QR or run the bot see it work.
- [ ] Leave the demo data as it is after the last recording (judges will open the live app).

## Colosseum portal entry

**Project name:** Kutip

**One-liner (≤ 100 chars):** AI collections and settlement agent for Malaysian exporters, on Solana. Get paid like a message.

**Tagline (50 words):** Kutip gets Malaysian exporters paid like a message. The buyer scans a QR from any Solana wallet, pays zero gas, and the exact USD lands in the exporter's own Squads treasury: Seen to Paid in 0.15 seconds on mainnet. An AI agent chases the rest and asks before moving money.

**Description (150 words):** Kutip is an AI collections and settlement agent for Malaysian exporters, built on Solana. A furniture exporter in Muar sends an invoice with one pay link. The overseas buyer scans it from any Solana wallet and pays the exact USD amount with zero gas, in USDC or in SOL converted inside the same transaction. The exporter watches it go Seen, Paid, Settled in under eight seconds on mainnet, in ringgit, with no refresh. The money lands in a Squads multisig the exporter owns; Kutip's agent can only sweep buyer accounts into that treasury under an on-chain daily cap, and everything else, including cashing out to ringgit, is a proposal the owner approves with Touch ID. The agent sends reminders in the buyer's hours, drafts replies to buyer questions, cancels reminders and emails the receipt when money arrives. Buyers' AP bots pay over x402. Detection runs on a Solami gRPC stream.

**Track / category:** Payments (also fits: AI agents, DeFi/stablecoins). Side tracks: Superteam MY "Build Global, Buatan Malaysia"; Solami prize.

**Country:** Malaysia

**Team:** Jian Wei · Web3 engineer, Solana builder since 2024 · GitHub 0xJian21 · TODO email · TODO X/Telegram handle. Solo: yes.

**Repository:** https://github.com/0xJian21/kutip

**Demo / live link:** https://kutip-app.vercel.app

**Pitch video:** TODO link · **Demo video:** TODO link

**Technical description (if asked):** pnpm monorepo, TypeScript, Node 22. `apps/web` Next.js 16 on Vercel: owner app, buyer pay page, `/api/pay` (Solana Pay transaction request, fee-payer partial signing, Jupiter v1 ExactOut for SOL), `/api/x402` (x402 v2 `exact` SVM scheme, self-hosted facilitator). `apps/worker` Node on Fly: Solami Yellowstone gRPC listener (processed/confirmed/finalized → Seen/Paid/Settled, verified from tx meta), RPC catch-up, collections scheduler, BNM rate, daily randomised sweep. `packages/solana`: tx builders, OFAC screening, Squads v4 provisioning (one multisig per buyer + treasury, agent spending limits), sweeps, proposals. `packages/agent`: rules engine (final authority), Jev via OpenRouter for classification, Claude Haiku for writing and PDF extraction, buyer-scoped context. `packages/db`: Drizzle on Supabase Postgres, RLS, Realtime Broadcast triggers. Privy passkeys as the Squads owner with transaction MFA (Touch ID). Money is `bigint` base units everywhere.

**What's next (if asked):** verified sending domain → first 10 exporters in Muar and Batu Pahat → MyInvois e-invoice export → team roles and a second Squads approver → MYRC when BNM approves → confidential transfers → more corridors. Proposed pricing: 0.5 % per settled invoice, capped at RM 100.

**Solana programs / addresses (if asked):** Squads v4 (`SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf`), USDC mint `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`, Jupiter v1 Swap API, Memo program. Demo treasury multisig `CUp1Xqm42HL3WfZgYAm8BtNccTBiBx54k1nvmQckCd9d`.

## Superteam Earn: "Build Global, Buatan Malaysia" track listing

**Project name:** Kutip

**Submission link:** https://kutip-app.vercel.app

**GitHub:** https://github.com/0xJian21/kutip

**Pitch video:** TODO · **Demo video:** TODO · **Deck (PDF):** TODO

**Short write-up (paste `WRITEUP.md` sections "One-liner", "The user", "The problem", "Why Solana", "What's next"; or this condensed version):**

*Who:* the finance admin of a 30 to 80 person furniture exporter in Muar or Batu Pahat, Johor, selling to Australia, the US and the Middle East on 30 to 60 day USD terms.
*Pain:* each wire takes 2 to 5 days and costs RM 50 to 150 in fees plus a 1 to 3 % spread (estimates); collections and reconciliation are done by hand from a spreadsheet.
*Product (live on mainnet):* one pay link; the buyer pays from any Solana wallet with zero gas; exact USD lands in the exporter's own Squads treasury, Seen to Paid in 0.15 s and Settled in 7.9 s (29 Sep 2026); an agent sends reminders, drafts replies, cancels reminders and emails receipts on payment, sweeps under an on-chain daily cap, and asks for Touch ID for anything else, including cash-out to ringgit. AP bots pay over x402 (402 → 200 in 4.5 s).
*Why Solana:* Solana Pay transaction requests with Kutip as fee payer; Jupiter ExactOut inside the buyer's transaction; Squads v4 spending limits for a safe non-custodial agent; x402; sub-cent fees; Solami gRPC for detection.
*Path to users:* first 10 customers from the Muar/Batu Pahat furniture cluster via the Muar Furniture Association and Malaysian Furniture Council member lists, the accountants and company secretaries who file for them, and Superteam MY introductions; free until their tenth settled invoice; in-person onboarding. These are targets, not partners; no customers yet.
*Regulatory awareness:* non-custodial (exporter's passkey owns the multisig); no ringgit touches Kutip (cash-out to the owner's own whitelisted address at an SC-registered DAX, HATA), so outside MSBA 2011; stablecoins treated as an agreed settlement asset, not legal tender; OFAC screening on every paying wallet; full audit trail; MyInvois export next; would apply to BNM's Digital Asset Innovation Hub before any custody or MYR conversion; MYRC shown as "when BNM approves".
*Team can keep shipping:* 7 days of commits across spikes, payments, treasury, worker, agent, inbox, hardening and a production rehearsal, with signatures and timings recorded for every session in `docs/PLAN.md`.

**Team member(s) and location:** Jian Wei (solo), Malaysia.

**Pre-existing code:** none before 27 Sep 2026.

**Demo Day:** will attend; date TBC with Superteam MY.

**Contact:** TODO email · TODO Telegram.

## Superteam Earn: Solami prize listing

**Project name:** Kutip

**What Solami does in the project (paste):** Solami is Kutip's data path. The worker holds one Yellowstone gRPC stream on Solami that watches every open invoice's reference key and every buyer vault; processed, confirmed and finalized updates become Seen, Paid and Settled on the exporter's dashboard, each verified from the transaction meta (USDC mint, exact amount, destination vault, memo). Filters are rewritten in place as invoices open and close and resent with every ping; the stream reconnects with backoff and after 20 s of silence. Balances come from the same stream. A catch-up over Solami RPC runs at startup, after every reconnect and every 3 minutes, so a restart never misses a payment. Every transaction Kutip sends (x402 settlements, agent sweeps, cash-out proposals, owner approvals, onboarding) goes through Solami RPC with a Solami blockhash and is confirmed by polling. Measured on mainnet: geyser → worker 19 ms; Seen → Paid 0.15 s; Settled 7.9 s (29 Sep 2026). Not used: SWQoS (the key returned 401 in our spike).

**Live mainnet demo:** TODO link to the Solami demo video (2:30) · live app https://kutip-app.vercel.app

**Clone and run:** `README.md` ("Run it locally"). Three env vars from the Solami dashboard: `SOLAMI_API_KEY`, `SOLAMI_GRPC_URL`, `SOLAMI_RPC_URL`. Nothing else is tied to ours. One worker uses one gRPC stream (the Pro plan allows two).

**Code pointers:** `apps/worker/src/stream.ts` (subscription, filters, reconnect), `apps/worker/src/payments.ts` (status ladder, catch-up), `apps/worker/src/verify.ts` (pure verification, tested on 8 mainnet transactions), `apps/worker/src/balances.ts`, `packages/solana/src/treasury/rpc.ts`, `packages/solana/src/payments/x402.ts`, `packages/solana/src/payments/screen.ts`.

**Interesting use of the stack:** one stream at `processed` plus slot-status updates gives all three commitment levels for every watched account; the filter set is live-edited instead of reconnecting; detection, balances and catch-up share one worker; x402 settlements and agent sweeps are sent and confirmed through the same RPC, so the entire money path (detect, verify, sweep, settle) runs on Solami.

**GitHub:** https://github.com/0xJian21/kutip · **Team:** Jian Wei (solo) · **Country:** Malaysia

## Day-of-submission order

1. Fill in every TODO above (team, links, Demo Day date). Replace `[NAME]` in `WRITEUP.md`, the deck's last slide and `PITCH-VIDEO.md`.
2. Record (SHOT-LIST.md), render (`pnpm render:all` in `video/`), upload the three videos, paste the links here.
3. Export the deck to PDF; attach it.
4. Push `main` so the public repo has `docs/submission/` and the latest README.
5. Submit Colosseum first (base country Malaysia, both side tracks selected), then the two Superteam Earn listings, then confirm in the Telegram builder group.
6. Top up the fee payer and the x402 test buyer one last time; do not run `demo-reset` after that.
