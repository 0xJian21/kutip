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

## D7 — Deadline: demo-ready Oct 3, 5pm MYT
- Superteam MY track text: submissions close Oct 3 5pm; Demo Day Oct 4 KL. Colosseum main closes Oct 12.
- **Open:** confirm with Superteam MY. If Oct 12, use extra days for stretch goals — plan does not change.

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

## Spike results (Session 1)
<!-- Append: spike id, date, PASS/FAIL, evidence (tx signatures, logs), consequence for the plan -->
