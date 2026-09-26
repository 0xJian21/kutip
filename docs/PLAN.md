# Build Plan

Target: demo-ready **Oct 3, 5pm MYT**. Each session = fresh Claude Code session in its own worktree/branch, owning only its listed paths. Check items off as you finish; add blockers under "Requests".

## Session 0 — Foundation (Sep 27) ✅ when all checked
- [x] SPEC.md, ARCHITECTURE.md, DECISIONS.md, PLAN.md, CLAUDE.md
- [x] Monorepo scaffold (pnpm workspaces, TS base config, typecheck; Next.js 16.3 web app)
- [x] `.env.example`

## Session 1 — Risk spikes (Sep 27) · model: Fable · branch `feat/spikes` · owns `spikes/`
- [x] A. Solana Pay tx request: fee payer partial-sign, USDC transfer + reference + memo; tested in Phantom / Solflare (Backpack untested — not installed); Jupiter ExactOut variant fits in a v0 tx (854–889 B)
- [x] B. Squads v4: create multisig (owner + agent), add spending limit (USDC, Day, destination allowlist), `spendingLimitUse` sweep on mainnet
- [x] C. Solami gRPC: subscription detects a payment by reference key; record processed/confirmed/finalized timings; send one tx via Solami SWQoS (SWQoS key → 401, untested; normal send measured)
- [x] D. Jev: TS/REST hello-world classification with confidence (client typechecked; not run — TypeSafe waitlist); Haiku fallback with same interface — 6/6
- [x] Results appended to DECISIONS.md "Spike results"

## Session 2 — Design direction + UI shell on mocks (Sep 27–28) · Fable · `feat/ui-shell` · owns `docs/DESIGN.md`, `docs/PRODUCT.md`, `apps/web/app/**` (except `app/api/**`), `apps/web/components/**`, `apps/web/lib/ui/**`, `apps/web/lib/mock/**`, `apps/web/public/**`, `apps/web/package.json` (UI deps only), `.claude/launch.json`
- [x] DESIGN.md: direction, tokens, type scale, components (+ PRODUCT.md for the impeccable skill; `/design` style tile)
- [x] Typed data layer: `lib/ui/data.ts` interface, `lib/ui/types.ts`, `lib/mock/*` fixtures + simulation store, bigint money helpers with tests
- [x] Screens on mock data: landing, onboarding, dashboard, invoice list/detail (live status bar, execution receipt), new invoice (PDF drop), agent log, rulebook, treasury, buyer pay page (mobile-first); loading/empty/error states (`?mock=empty|error|slow`)
- [x] Screenshots at desktop + mobile, light + dark in `docs/screenshots/`; critique fixes applied; simulate-payment rehearsal (invoice tab + phone tab) verified

## Session 3 — Payments core (Sep 28) · Fable · `feat/payments` · owns `packages/solana`, `apps/web/app/api`
- [ ] Tx-request endpoint (GET/POST), screening, fee-payer guardrails
- [ ] Jupiter ExactOut path
- [ ] x402 endpoint + self-hosted facilitator verify/settle
- [ ] Payment verification function (mint, amount, destination, memo)

## Session 4 — Worker (Sep 28–29) · Opus · `feat/worker` · owns `apps/worker`, `packages/db`
- [x] DB schema + migrations (Session 4a, `feat/db`): Drizzle schema, RLS on every table, Realtime publication on invoices/payments/agent_actions, typed store in `@kutip/db`, `db:seed` loads Session 2 fixtures (query-for-query parity test vs `mockData`). Applied to Supabase 2026-09-27: both migrations applied, demo seeded, RLS on for all 10 tables, Realtime publishing the 3 tables, parity with `mockData` re-checked on the live DB, anon REST read of `invoices` returns `[]`.
- [ ] Solami gRPC listener → verification → status updates (Realtime)
- [ ] Execution receipt, fee-payer health monitor

## Session 5 — Treasury + login (Sep 29) · Fable · `feat/treasury` · owns `scripts/`, treasury parts of `packages/solana`
- [ ] Provision treasury + per-buyer multisigs + ATAs + spending limits
- [ ] Sweeper (batched, randomised), proposals for owner approval
- [ ] Privy passkey login; owner approves proposals from UI

## Session 6 — Agent (Sep 29–30) · Opus · `feat/agent` · owns `packages/agent`
- [x] Rules engine + rulebook schema (6a: `rulebook.ts`, `rules/*`: reminders C1/C2/C4/C5/C6, replies, discount C3, sweep T2–T4, cash-out T5, each returns `{allowed, ruleId, reason}`)
- [ ] Jev classifiers (reply intent, tone, sweep, escalate) + Haiku fallback (6a: `ReplyClassifier` interface + Haiku classifier done, 11/11 on eval; `jevClassifier` is a stub waiting on Spike D → 6b)
- [x] Haiku: reminder emails (friendly/firm/final), receipts, agent-log explanations, PDF extraction (3 fixture PDFs, `pnpm --filter @kutip/agent eval`)
- [x] Buyer-scoped context + leak test (`BuyerContext` branded, one buyer only; `privacy.test.ts` asserts on the HTTP body sent)
- [x] Reminder scheduler, cash-out alert (6a: pure `nextReminder` / `cashOutAlert`; the worker runs them on a timer and fetches the BNM rate, see Requests)

## Session 7 — Integration (Sep 30) · Opus · `feat/integration`
- [ ] UI wired to real data; full demo path end-to-end on mainnet

## Session 8 — Hardening (Oct 1) · Opus
- [ ] code-review, security-review, fixes
- [ ] README runnable by anyone (Solami prize): setup, env vars, pointing at own key
- [ ] impeccable polish/audit: empty/loading/error states, mobile, dark mode

## Session 9 — Submission (Oct 2) · Opus
- [ ] Pitch deck, demo script, 2-min pitch + 2-min demo videos (+ 2–3 min Solami demo)
- [ ] Write-up: 1-liner, user, problem, why Solana, what's next
- [ ] Submit Colosseum + Superteam Earn (both listings) by **Oct 3 noon**

## Requests (cross-session interface changes)
<!-- "Session N needs X from package Y" -->
- **Session 2 → Session 3 (`/api/pay`)**: the pay page (`apps/web/components/pay/pay-card.tsx`) renders from `PayInvoice` in `apps/web/lib/ui/types.ts`. It needs, per invoice: `exporterName`, `invoiceNumber`, `amountUsdc` (bigint base units), `dueDate`, `status`, `solanaPayUrl` (`solana:<url-encoded https://…/api/pay/<id>>`), `acceptedTokens`, and once paid `paidAt`/`settledAt` plus `payment.{signature, amount, inputMint?, inputAmount?}`. Nothing that identifies other buyers. The Solana Pay GET `label` should be the exporter name and `icon` the Kutip mark in `apps/web/public/`.
- **Session 2 → Session 4 (worker / Realtime)**: replace `subscribeInvoice`, `subscribePayInvoice` and `subscribeChanges` in `lib/ui/data.ts` with Supabase Realtime on `invoices`, `payments`, `agent_actions`. The status bar expects `seenAt`/`paidAt`/`settledAt` timestamps on the invoice, and a `Payment` row with `commitment`, `slot`, `inputMint`, `inputAmount`, `quotedInput`, `quotedOut` for the execution receipt (`receipt-card.tsx`).
- **Session 2 → Session 6 (agent)**: `AgentAction` needs a plain-English `decision` and `reason` (one sentence each), `ruleId` (C1–C6, T1–T5, I1 as in `docs/DESIGN.md`/rulebook page), `confidence` 0–1, and `status`. Reply classification on `messages.classification = { intent, confidence }`.
- **Session 2 → Session 7 (integration)**: swap `export const data: KutipData = mockData` in `apps/web/lib/ui/data.ts`. Everything UI-side imports only that interface. Keep `simulatePayment`/`resetSimulation` behind `NEXT_PUBLIC_DEMO_CONTROLS=1` or drop them. `apps/web/tsconfig.json` target is ES2022 (bigint literals).
- **Session 4a (db) → Session 7 (integration)**: `import { connect, createStore } from "@kutip/db"`, then `createStore(connect(process.env.DATABASE_URL).db, { appUrl })`. It's server-only (postgres driver), so never import it into a client component. On Vercel, use the Supabase **transaction pooler** URL (port 6543). The client already sets `prepare: false`. Every owner method takes `exporterId` first and maps 1:1 to `KutipData`: `getExporter`, `getDashboard(E, { now? })`, `listBuyers`, `listInvoices(E, filter)`, `getInvoice(E, id)`, `listAgentActions`, `decideAction(E, id, d)` (only `proposed` → approved/rejected, else `null`), `getRulebook`, `updateRulebook` (= `saveRulebook`), `getTreasury`. The buyer-facing method is `getPayInvoice(id)`, which returns `null` for drafts. Return types in `@kutip/db` are structurally identical to `lib/ui/types.ts` (pinned by `packages/db/src/ui-types.test.ts`), so the UI types can re-export them. New invoice ids are unguessable (`inv_` + 20 base58), and the pay link is the only credential. "Received this month" uses the Malaysian (UTC+8) calendar month.
- **Session 4a (db) → Sessions 4/7 (Realtime)**: `invoices`, `payments`, `agent_actions` are in the `supabase_realtime` publication, but **RLS is on with no policies**, so the public anon key can't read any table through PostgREST. That also means browser `postgres_changes` subscriptions with the anon key get **no events**. Pick one: (a) Realtime **Broadcast** from DB triggers (`realtime.broadcast_changes`) on per-invoice topics, which is the right fit for the public pay page (packages/db can add the trigger migration on request); (b) the server subscribes with the service-role key and relays over SSE; (c) narrow select policies (owner side only, never the pay page).
- **Session 4a (db) → Session 4 (worker)**: use `listWatchedAccounts()` (open-invoice reference keys + every vault ATA) for the gRPC subscription. `getPaymentTarget(reference)` returns amount, received, memo, vault ATA and status for verification. `recordPayment(event)` is idempotent by signature: commitment only moves forward, and in the same transaction it re-derives the invoice's `receivedUsdc`/status/`seenAt`/`paidAt`/`settledAt`. Only `verified` payments at `confirmed`+ count as received. Pass `at` for exact timings. Also available: `updateBalances(E, { treasuryUsdc, vaults })` (the treasury screens read these cached balances), `recordSweep` (schedule, then pass the same `id` to record execution), `setInvoiceStatus(E, id, "overdue")` for the scheduler, and `recordRate({ date, myrPerUsd, avg30dMyrPerUsd })`, where **the worker computes the 30-day average**. Queries that show a rate throw until at least one rate row exists.
- **Session 4a (db) → Session 3 (payments)**: `getPaymentTarget(reference)` / `getPayInvoice(id)` give tx building its inputs. `recordScreening({ wallet, invoiceId, result, reasons })` and `latestScreening(wallet)` are ready. `createInvoice` needs a `referencePubkey` from `packages/solana` (a random keypair's pubkey). It computes the total from line items and generates the id, the `k_xxxxxxxx` memo and the next `INV-YYYY-NNNN`.
- **Session 4a (db) → Session 5 (treasury)**: use `updateTreasuryAccounts(E, …)` and `updateBuyerAccounts(E, buyerId, { multisig, vault, usdcAta, spendingLimitPda })` after provisioning. **The seeded addresses and reference keys are fake base58-shaped strings.** Before the live demo, provision real multisigs, write them back, and create the live demo invoices with `createInvoice` and a real reference key. The seeded `inv_demo`/`inv_bot` can't be paid on-chain. After a rehearsal, run `pnpm --filter @kutip/db db:seed --reset`.
- **Session 4a (db) → Session 6 (agent)**: `getBuyerContext(E, buyerId)` is the L4-scoped context: that buyer's invoices, messages and actions only, with multi-buyer sweep actions excluded. A leak test is in `packages/db/src/buyer-scope.test.ts`. Writes: `recordAgentAction`, `recordMessage` (with `classification`), `setActionStatus(E, id, "executed", txSig)`, `setInvoiceStatus(E, id, "disputed")`.
- **Session 4a (db) → docs owner**: the schema differs from ARCHITECTURE.md "Data model". `exporters.owner_user_id` is replaced by `users.role` (`owner`/`admin`). New additions are the `fx_rates` table, cached `treasury_usdc_balance`/`vault_usdc_balance`, `sweeps.exporter_id`, and UI fields (buyer contact/city, invoice `received_usdc` + `sent/seen/paid/settled_at`, payment `quoted_input`/`via`/timestamps, action `reason`, message `from`/`subject`). Source of truth is `packages/db/src/schema.ts`.
- **Session 6a (agent) → Session 4 (worker / db)**: `@kutip/agent` is pure except the Haiku calls; the worker drives it.
  - Reminders: on a timer, call `nextReminder({invoiceId, dueDate, timezone, status, sent, now, rulebook, promisedDate})` per open invoice. `sent` = every outbound message to that buyer (any invoice) as `{invoiceId, at}`. Send when `sendAt <= now`, with `writeReminder(client, ctx, {invoiceId, tone, now})`. `escalate: true` → insert an `escalate` agent_action (C4) and stop.
  - Needs a column for the buyer's promised date (e.g. `invoices.promised_date date null`), set when `decideReply` returns `action: "pause"` (C5).
  - Replies: `haikuClassifier(client).classifyReply(ctx, {subject, body, receivedAt})` → store `messages.classification = { intent: label, confidence }` (UI calls it `intent`), then `decideReply(...)`; `markDisputed` → invoice status `disputed`.
  - `rulebook` jsonb: bigints (`agentDailyLimitUsdc`, `cashOutAlertMarginBps`) stored as digit strings; read back with `parseRulebook(json)`.
  - agent_actions: `ruleId` and one-sentence `reason` come from every decision; `explainAction(client, ctx, {kind, decision, facts})` gives the UI's `decision`/`reason` pair for buyer-scoped actions. `confidence` = classifier confidence, or 1 for pure rule decisions.
  - BuyerContext: build per call with `buildBuyerContext({exporterName, buyer, invoices, messages})` from a query filtered on ONE `buyer_id`; it throws on any row from another buyer.
  - Cash-out alert: worker fetches the BNM USD/MYR rate + 30-day average (bigint, 4 implied decimals like `BnmRate.myrPerUsd`) and calls `cashOutAlert(...)` (T5).
- **Session 6a → Session 5 (sweeper)**: call `treasuryMove({kind: "sweep", sweep: {amountUsdc, destination, treasuryUsdcAta, sweptTodayUsdc, rulebook}})` before building a sweep: `autonomous` → spending-limit sweep (T2); `proposal` → Squads proposal (T4); `refused` → do nothing. The on-chain spending limit stays the real guard.
- **Session 6a → Session 7 (integration)**: new-invoice PDF drop → `extractInvoice(client, pdfBytes)` returns `lineItems` with bigint `unitPriceUsdc` (same shape as UI `LineItem`), `totalUsdc`, `dueDate`, `warnings[]`, and an I1 decision (`allowed: false` = show warnings, owner checks before sending).
- **Session 6a → Session 6b (Jev)**: implement `jevClassifier()` in `packages/agent/src/classifier.ts` behind the same `ReplyClassifier` interface, falling back to `haikuClassifier` when Jev is unavailable (SPEC §3).
