# Kutip

AI collections + settlement agent for Malaysian exporters on Solana. Hackathon build, demo-ready Oct 3.

Read before working: `docs/SPEC.md` (what), `docs/ARCHITECTURE.md` (how), `docs/DECISIONS.md` (why), `docs/PLAN.md` (your session's tasks).

## Rules
- **Stay in your lane.** Only edit the paths your session owns (see PLAN.md). Need an interface change elsewhere? Add it under "Requests" in PLAN.md instead.
- **Money is integers.** USDC amounts are `bigint` base units (6 decimals). No floats for amounts, ever.
- **Mainnet safety.** Never log or commit secrets. Test amounts ≤ 1 USDC / 0.01 SOL unless the user says otherwise. Keys come from env only.
- **Fee payer rules** (DECISIONS D4): we build every tx we co-sign; fee payer never appears in instruction accounts; cap CU price/limit; never create ATAs inside a payment.
- **Privacy rules** (SPEC §5): nothing identifying on-chain (memo = opaque `k_xxxx`); every LLM/Jev call scoped to one `buyer_id`.
- **Agent rules:** Jev and Haiku propose; the rules engine decides. LLMs never compute amounts or dates.
- **Test-first** for `packages/*`. Verify against devnet/mainnet before claiming something works; paste tx signatures as evidence.
- Keep it simple: no abstractions without a second caller. Match surrounding code.

## Git
- Work on your session's `feat/*` branch. Commit only when the user allowed it for that run. Author is set repo-locally.
- Use `git -C <path>` rather than `cd X && <destructive git>`.

## Commands
- `pnpm install` · `pnpm -r typecheck` · `pnpm -r test` · `pnpm --filter web dev`
- Secrets live only in the root `.env`. In a worktree: `ln -s ~/own/kutip/.env .env`. Next.js only reads env from `apps/web`, so also `ln -s ../../.env apps/web/.env.local` (both gitignored). Without it the build fails on Privy pages.
