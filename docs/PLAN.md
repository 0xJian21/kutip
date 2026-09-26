# Build Plan

Target: demo-ready **Oct 3, 5pm MYT**. Each session = fresh Claude Code session in its own worktree/branch, owning only its listed paths. Check items off as you finish; add blockers under "Requests".

## Session 0 — Foundation (Sep 27) ✅ when all checked
- [x] SPEC.md, ARCHITECTURE.md, DECISIONS.md, PLAN.md, CLAUDE.md
- [x] Monorepo scaffold (pnpm workspaces, TS base config, typecheck; Next.js 16.3 web app)
- [x] `.env.example`

## Session 1 — Risk spikes (Sep 27) · model: Fable · branch `feat/spikes` · owns `spikes/`
- [ ] A. Solana Pay tx request: fee payer partial-sign, USDC transfer + reference + memo; tested in Phantom / Solflare / Backpack; Jupiter ExactOut variant fits in a v0 tx
- [ ] B. Squads v4: create multisig (owner + agent), add spending limit (USDC, Day, destination allowlist), `spendingLimitUse` sweep on mainnet
- [ ] C. Solami gRPC: subscription detects a payment by reference key; record processed/confirmed/finalized timings; send one tx via Solami SWQoS
- [ ] D. Jev: TS/REST hello-world classification with confidence; Haiku fallback with same interface
- [ ] Results appended to DECISIONS.md "Spike results"

## Session 2 — Design direction + UI shell on mocks (Sep 27–28) · Fable · `feat/ui-shell` · owns `docs/DESIGN.md`, `docs/PRODUCT.md`, `apps/web/app/**` (except `app/api/**`), `apps/web/components/**`, `apps/web/lib/ui/**`, `apps/web/lib/mock/**`, `apps/web/public/**`, `apps/web/package.json` (UI deps only), `.claude/launch.json`
- [ ] DESIGN.md: direction, tokens, type scale, components
- [ ] Screens on mock data: onboarding, dashboard, invoice list/detail (live status bar, execution receipt), new invoice (PDF drop), agent log, rulebook, treasury, buyer pay page (mobile-first)
- [ ] Browser-pane screenshots at desktop + mobile, impeccable critique pass

## Session 3 — Payments core (Sep 28) · Fable · `feat/payments` · owns `packages/solana`, `apps/web/app/api`
- [ ] Tx-request endpoint (GET/POST), screening, fee-payer guardrails
- [ ] Jupiter ExactOut path
- [ ] x402 endpoint + self-hosted facilitator verify/settle
- [ ] Payment verification function (mint, amount, destination, memo)

## Session 4 — Worker (Sep 28–29) · Opus · `feat/worker` · owns `apps/worker`, `packages/db`
- [ ] DB schema + migrations
- [ ] Solami gRPC listener → verification → status updates (Realtime)
- [ ] Execution receipt, fee-payer health monitor

## Session 5 — Treasury + login (Sep 29) · Fable · `feat/treasury` · owns `scripts/`, treasury parts of `packages/solana`
- [ ] Provision treasury + per-buyer multisigs + ATAs + spending limits
- [ ] Sweeper (batched, randomised), proposals for owner approval
- [ ] Privy passkey login; owner approves proposals from UI

## Session 6 — Agent (Sep 29–30) · Opus · `feat/agent` · owns `packages/agent`
- [ ] Rules engine + rulebook schema
- [ ] Jev classifiers (reply intent, tone, sweep, escalate) + Haiku fallback
- [ ] Haiku: reminder emails, PDF extraction
- [ ] Buyer-scoped context + leak test
- [ ] Reminder scheduler, cash-out alert (BNM rate)

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
