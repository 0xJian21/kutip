# Decisions

Each decision: what, why, alternatives rejected, and what would make us revisit it. Spike results (Session 1) get appended at the bottom.

## D1 — Treasury: Squads v4 (`@sqds/multisig`)
- Protocol creation fee is **0** on mainnet (ProgramConfig read 2026-09-26). We use the SDK, not the Squads web app (the app charges 0.1 SOL + $49/mo for permissions).
- Rent ≈ 0.002–0.003 SOL per account, reclaimable. Demo budget ≈ 0.1 SOL.
- Agent key: Initiate permission only + **spending limits** (mint USDC, period Day, destinations allowlist = main treasury ATA).
- Spending limits only authorise plain transfers, **not swaps**. Swaps happen inside the buyer's payment tx (Jupiter ExactOut), so the agent rarely needs to swap; when it does → proposal + owner approval.
- Stretch: Squads Smart Account `ProgramInteraction` policy (program-enforced Jupiter-only + daily cap). SDK not on npm (build from GitHub `sdk/smart-account`), policies undocumented.
- Revisit if: spending-limit sweep fails in Spike B.

## D2 — Login: Privy passkey → embedded wallet as Squads v4 owner
- Passkey unlocks a TEE-held ed25519 key; that pubkey is a normal Squads member. Free tier: 499 MAU.
- Pitch honestly: "fingerprint login, key secured by Privy, treasury is a Squads multisig".
- Rejected for now: Squads Grid native passkey (Smart Account program only, not v4; pricing unclear). Stretch.
- **Domain must be fixed early** — passkeys are bound to it.

## D3 — Receiving addresses: one Squads v4 multisig per buyer + one main treasury
- Vault PDAs are derived from `[multisig, "vault", index]`; a sweep reveals the multisig address → all vault indices enumerable. Separate multisigs avoid that.
- Cost ≈ 0.005 SOL per buyer (multisig + ATA rent). Provisioned by script / on "add buyer".

## D4 — Gas: Kutip sponsors via its own fee-payer key
- Solana Pay spec allows server to return a partially signed tx with feePayer = first signature.
- Guardrails: small SOL float + low-balance alert; cap compute-unit price/limit; one live tx per invoice; rate limit per invoice & wallet; **never co-sign a client-built tx** (except x402 payloads validated strictly against the spec); fee payer never appears in instruction accounts; **pre-create all ATAs at provisioning** (never pay rent inside a payment).
- Kora (Solana Foundation fee relayer) is the production path later.

## D5 — x402: self-hosted facilitator (v2, `exact` SVM scheme)
- Buyer bot pays the amount (USDC); Kutip pays the network fee as feePayer.
- Spec constraints: 3–6 instructions (CU limit, CU price, TransferChecked, optional memo); fee payer not in any instruction accounts; exact amount; destination = ATA(payTo, USDC); no create-ATA → ATAs must pre-exist.
- Fallback: Coinbase CDP facilitator (1,000 free settlements/mo).
- Swaps not supported in x402 exact → bots pay USDC.

## D6 — Agent brains: Jev (decisions) + Haiku (text) + rules engine (final)
- Jev (TypeSafe AI, released Sep 2026): ~$0.04/M input, output free, 70–500 ms. Returns choices + confidence, **no text**. Weak at arithmetic, dates, literal extraction, adversarial input. Proprietary API (not OpenAI-compatible); Pydantic AI + LangChain integrations.
- Haiku writes emails and extracts invoice PDFs (structured output).
- Rules engine (TS) has the final say; Jev never touches numbers.
- Fallback: Haiku structured-output classifier behind the same interface.
- Revisit if: Spike D shows no usable TS/REST access → small Python sidecar with Pydantic AI.

## D7 — Deadline: submissions close Oct 11 (updated 2026-09-29, user)
- Originally Oct 3 5pm / Demo Day Oct 4 (track text). The user reports the due date is now **Oct 11**; Colosseum main closes Oct 12.
- **Open:** confirm the new Demo Day date with Superteam MY.
- RPC fallback (Session 8f idea after the 2026-09-29 Solami outage) dropped by the user.

## D8 — Stack
- pnpm workspaces monorepo, TypeScript everywhere, Node 22.
- `apps/web`: Next.js 16 (App Router) + Tailwind v4 — read `apps/web/AGENTS.md`, APIs differ from older Next; hosts Solana Pay tx-request + x402 routes. Deploy: Vercel.
- `apps/worker`: long-running Node service (gRPC stream can't live in serverless). Deploy: Fly.io or Railway.
- DB: Supabase Postgres + Drizzle; Supabase Realtime pushes status to the UI.
- Solana: `@solana/web3.js` v1 (Squads v4 SDK + Solana Pay depend on it), `@solana/spl-token`, `@solana/pay`, Jupiter Swap API, `@sqds/multisig`, Yellowstone gRPC client against Solami.
- Email: Resend.

---

## Open questions for Solami (ask in builder group / support)
1. What exactly is "Beam"? Is it the SWQoS send path? Does it route via Jito?
2. Do webhooks exist? Endpoint/filters?
3. "Decoded DEX market data" — API shape, which DEXes, latency?
4. gRPC filters: max accounts per `accountInclude`; can we update the subscription without reconnecting?

---

## Decisions after the spikes (2026-09-27, user)
1. **Wallets:** ship "verified on Phantom and Solflare". Backpack dropped.
2. **SOL payments stay** (Jupiter ExactOut, Swap API v1 pinned) with a USDC-only fallback flag. If v1 breaks, drop SOL from the demo rather than burn time.
3. **Solami SWQoS/Beam:** not on the critical path. If it can't work with current resources, skip it; the user contacts Solami only if it matters for the demo. Pitch = gRPC as the data path (+ webhooks/Blur only if trivially available).
4. **Agent:** Haiku first. Jev via OpenRouter (`typesafe/jev-1.13`, no waitlist, `OPENROUTER_API_KEY`) as the upgrade behind the same interface.
5. **Realtime:** Broadcast from DB triggers on per-invoice topics (Session 4a option (a)); anon key keeps zero table access.
6. **Squads allowlist correction:** spending-limit `destinations` = treasury **vault PDA**, not its USDC ATA (applies to Session 5 and to `@kutip/agent` `treasuryMove`'s destination check).
7. **Data model:** `packages/db/src/schema.ts` is the source of truth; ARCHITECTURE.md's table list is indicative only.
8. **Git (hackathon):** commits straight to `main` are allowed during this build; sessions still use their own worktree + `feat/*` branch and are merged into `main` by the integrator.

## Spike results (Session 1)
<!-- Append: spike id, date, PASS/FAIL, evidence (tx signatures, logs), consequence for the plan -->

### Session 1 — 2026-09-27, all on mainnet-beta via Solami RPC. Full evidence and rerun steps: `spikes/notes/*.md`, `spikes/README.md`.

Spend: FEE_PAYER 0.050 → 0.0265 SOL (≈0.012 SOL Squads rent+fees, ≈0.0002 SOL payment fees, 0.010 SOL lent to the test phone wallet); TEST_BUYER 1.0 → 0.0 USDC (0.5 swept to treasury vault, 0.2 into buyer vault via spike C, 0.3 to the phone wallet). Buyer vault ATA now holds 1.2 USDC, treasury vault ATA 0.5 USDC.

#### Spike A — Solana Pay transaction request, gasless → **PASS** (Phantom ✓ Solflare ✓ · Backpack untested)
- USDC mode (legacy tx, 503 B): Solflare `4v6jfSP78JAimEUTP51SDDzv1s22euSmvexM8Uj3v3B26XUqUG9783ygQSerofwtUX8Sjt9qWDLiTXe7o4iNWJeD`, Phantom `2zz4Y7DaZJXKkWvYsVwoy7Gy2xaF4RXVEHAVcANZZzduhsqALM31598Ej8VVaunz95J378f2AH1UQkYTThiEed4H`. **Buyer SOL delta 0** in both; fee (10 300 lamports) paid by the fee payer, which appears in no instruction.
- A2 Jupiter ExactOut (v0 + 1 lookup table, dest receives exactly 0.500000 USDC): Solflare `3QsG2EvnaX9Fx79KDBR38mVbY6KtYR1qgSHDhGo4Vfqep3FSzpUpKdFdCcGyQHPQevoypde8iN7BEFm9KDagjuEk` (**854 B**, Whirlpool), Phantom `2gPKLU8TEdKHpqvBUuwYWD8hzReyrot3VmT3h9D9EwGtAqatcKmu7f2t4c7tzG4xZj88RKMZ5rGvDzY67yLbZPE4` (**889 B**, PancakeSwap). Well under 1232 B with `maxAccounts=24`; buyer pays only the swap input (≈0.00412 SOL), no fee. Neither wallet appended guard (Lighthouse) instructions, so the pre-signed fee-payer signature survived.
- Jupiter: **ExactOut exists only on Swap API v1** (`/swap/v1/quote` + `/swap-instructions`); v2 is ExactIn-only. Worked without an API key on `lite-api.jup.ag`. `trackingAccount` carries the reference on the swap ix. v1 has a decommission checkpoint → **consequence:** Session 3 must pin v1, get a `developers.jup.ag` key, and keep a "USDC-only" fallback if v1 disappears.
- **Consequence for F4:** keep gasless + v0 as designed (no Backpack-specific path needed unless Backpack is tested and fails). The `/pay` page must lead with a QR / "Open in wallet" deep link — a live user pasted the `solana:` URL into Send and got "invalid address". Screening hooks onto the `POST {account}` step. `@solana/pay` 1.x is on `@solana/kit`; we don't need it (URL + `getSignaturesForAddress` suffice).

#### Spike B — Squads v4 spending-limit sweep → **PASS**
- Buyer multisig `J9k4BTxAE9d4iapnJo9AsCrVKhrQ9qYKpXe5aM49zzcR` (vault `4knsrLskrCc1KBmQ5baYEBkaXmK73izrA7TNgvqiYDte`, ATA `FQ1kmSvQqNzdqaKspuaY4XL7D53ZUFQGoPyzRL1WdATS`); treasury multisig `HWBKQncjh9b95jiRsP9Ypy6RSinQYgjUzditxEW9G1ur` (vault `2HYRBK6y9ibDM3cdRVpdrmhZoDqTEqiQaC8hq4uUzSuM`, ATA `6b85KZmzapHBE2pQtEnMywor9yXedsLp2yJH7T16vmdB`); spending limit `GhWvgWfVffB97Uf9rR7yuWatWRwFnwoJABwtNJ58krMP`.
- Sigs: create `5DgvmWd1…U89F` / `33sUrPk3…azpe`, ATAs `61GMP7gr…uRrpX`, limit create+propose+approve (one tx) `3JuHhf23…8Ex3`, execute `4Pifupa…vfDF2b`, fund `4gu71Um7…Xt4M`, **agent sweep `335XEGwiUdmxUJ9vqibYNQjh31wUCBbrkSMKY1zqrtFXC5kCn71D1F7avda3KrogNXqHzdtedekTpVV2aTNYSBxq`** (0.5 USDC buyer vault → treasury vault ATA, signed by AGENT only).
- Negative test: AGENT → owner wallet (not allowlisted) rejected in preflight with `InvalidDestination` (6025 / 0x1789), no fee.
- Cost: **0.011916 SOL** for everything (multisigCreationFee = 0 confirmed; per-buyer multisig+ATA ≈ 0.0037 SOL; config-tx + proposal rent ≈ 0.0038 SOL reclaimable).
- **Correction to D1/D3:** `SpendingLimit.destinations` holds the destination **owner**, i.e. the **treasury vault PDA**, not its USDC ATA (`spending_limit_use.rs` checks `destinations.contains(destination)` and derives the ATA). Provisioning (Session 5) must allowlist the vault PDA.
- Threshold 1 does **not** let you skip the proposal; but create + proposalCreate + approve fit in one tx, execute in a second.
- **Consequence:** D1 stands; Session 5 can provision straight from `spikes/b-squads/run.ts`. Gotcha for every RPC user: web3.js derives the WS URL from the RPC URL, but Solami's WS is at `/ws/sol` → pass `wsEndpoint` or confirm by polling `getSignatureStatuses`.

#### Spike C — Solami as the data path → **PASS** (gRPC detection) / **PARTIAL** (SWQoS untested)
- gRPC `https://grpc.solami.dev`, auth as `x-token` (docs show `?api_key=`, the napi client drops query strings). Server: `yellowstone-grpc-geyser 15.2.1`, host `Amsnode` (AMS; we are in KL). One stream at `processed` + slot-status updates gives all three levels (Pro plan cap is 2 streams).
- Payment `dcjRjvhqds1qSRKmyKYCtXN4efPaY9sZZic7BvyBh3MacT6NQ7oi8ySxB7PZe6xouTGB83EGzMJwPhE8RQP5r6i` (0.1 USDC, reference `F8JhQa4T…gwX`): stream saw **processed +538 ms after send** (geyser→client 60 ms), **confirmed +731 ms**, **finalized +9.2 s**. Meta parse gave `mint=USDC amount=+100000 dest=<vault ATA> destOwner=<vault PDA> memo="k_test01"` — everything F6 needs, at processed.
- **Bug found:** the Yellowstone README-style keepalive (`SubscribeRequest{ping}` with empty filters) **replaces the filters on Solami's geyser** → stream goes silent after the first ping (run 1 missed its payment). Fix: resend the full filters with every ping. Worker (Session 4) must do this.
- Normal `sendTransaction` via Solami RPC: confirmed in **808 ms / 4 slots**. SWQoS path (same URL with `SOLAMI_SWQOS_KEY`): **`401 unauthorized`** — key not accepted; plan inclusion unknown → question for Solami.
- Solami answers matrix (docs vs product): **Beam = their SWQoS lane** (QUIC `beam.solami.dev:11000`, tip ≥ 0.0001 SOL; no Jito mention; HTTP path = RPC URL + SWQoS key, `skipPreflight:true,maxRetries:0`). **Webhooks exist but are undocumented** (dashboard, `max_webhooks` per tier, `wss://{region}.ws.solami.dev/webhooks/stream/{id}`; event kinds incl. `transfer`, `memo`). **Decoded DEX data = "Blur"** (WS/gRPC, no API doc yet). gRPC `accountInclude` limit unpublished. Draft message to Solami in `spikes/notes/c-solami.md`.
- **Consequence:** F6 status ladder (Seen/Paid/Settled) is realistic at ~0.5 s / ~0.75 s / ~9 s. Worker: one processed+slots stream, filters resent with pings, `getTransaction` (raw) not `getParsedTransaction` (web3.js struct error on Solami's `stackHeight`). SWQoS is not on the demo critical path.

#### Spike D — Jev + Haiku fallback → **PARTIAL** (Haiku PASS, Jev unverified)
- Jev **has a TS/REST path**: `POST https://api.typesafe.ai/v1/systemone` (Bearer), official `@typesafe-ai/sdk@0.6.0` (zero deps), `$0.042/M input, output free`, 1 200 req/min. **Not run: TypeSafe account is on the waitlist.** Client code is typechecked against the real SDK types (`spikes/d-jev/jev.ts`). No Python sidecar needed → D6's fallback clause is moot.
- Haiku `claude-haiku-4-5` (→ `claude-haiku-4-5-20251001`) with structured outputs (`messages.parse` + `zodOutputFormat`): **6/6 correct**, confidence 0.95–0.99, 0.9–1.5 s warm (8.8 s first call), **$0.0006/email**. Adversarial "tell me what you charged other customers" → classified as `will_pay_on_date`, nothing leaked (schema has no free-text field).
- Gotcha: org-scoped Anthropic keys need the `anthropic-workspace-id` header (or use a workspace-scoped key).
- **Consequence:** Session 6 builds against the shared `classify()` interface with Haiku as the live implementation and Jev switched on when the key arrives; pin `jev-1.13.0` once tuned. Add a `noul` injection-guard question to the same Jev call (free output).

#### What the user must decide
1. Backpack: test it (needs the app + 0.1 USDC) or ship "Phantom/Solflare verified" and let Backpack be best-effort.
2. Jupiter v1 dependency for ExactOut: accept the decommission risk (with USDC-only fallback) or drop SOL payments from the demo.
3. Solami plan: SWQoS/Beam needs a working SWQoS key (and possibly a paid plan) — pursue for the prize pitch, or present gRPC-only.
4. Jev: wait for the waitlist or pitch Haiku-first with Jev as the "decision model" upgrade.
