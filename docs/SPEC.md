# Kutip — Product Spec

> **One-liner:** An AI agent that chases a Malaysian exporter's overseas invoices, knows the second the money lands on Solana, and settles it into their treasury — within rules the owner sets and without ever holding the keys.

Hackathon: Colosseum Crypto World's Fair (Solana track) + Superteam MY "Build Global, Buatan Malaysia" side track + Solami prize.
Deadline assumption: **demo-ready Oct 3, 5pm MYT** (Demo Day KL Oct 4). See `DECISIONS.md` D7.

---

## 1. User & problem

**Primary user:** the finance admin (and owner) of a 30–80 person furniture exporter in Muar / Batu Pahat, selling to buyers in Australia, the US and the Middle East on 30–60 day terms.

**Pain today** (validate with 2–3 real exporter interviews before the pitch):
- Chasing overdue invoices by hand across time zones.
- Telegraphic transfers take 2–5 days; wire fee + 1–3% FX spread.
- Manual reconciliation ("which invoice was this RM48,211.40 for?").
- No discipline on when to convert USD → MYR.

**Secondary users:** the overseas buyer (human paying from a wallet) and the buyer's accounts-payable bot (paying via x402).

---

## 2. Core flows

### F1 — Exporter onboarding
1. Sign up with email + **passkey** (Privy). An embedded wallet is created; the user never sees a seed phrase.
2. Kutip creates the **main treasury** Squads v4 multisig: owner = the Privy wallet (all permissions), agent key = Initiate only. Threshold 1.
3. Kutip pre-creates the treasury's USDC token account.
4. Owner sets up the **rulebook** (defaults provided; see §4).

### F2 — Add a buyer
1. Owner adds buyer (company name, contact email, country, timezone).
2. Kutip provisions a **per-buyer receiving multisig** (same owner + agent), pre-creates its USDC ATA, and adds a spending limit: `members=[agent]`, `mint=USDC`, `period=Day`, `destinations=[main treasury USDC ATA]`.
   - Why a separate multisig per buyer (not vault indices of one multisig): vault PDAs are derivable from the multisig address, and any sweep reveals that address → a buyer could enumerate every other buyer's vault. See §5.

### F3 — Create invoice
1. Owner uploads a PDF (AI extracts buyer, line items, total, due date) or fills a form.
2. Line items stay **off-chain**. Kutip generates: a random `reference` pubkey, an opaque memo code (`k_xxxx`), a pay link, and an x402 URL.
3. Invoice is "sent" by email with the pay link.

### F4 — Buyer pays (human, Solana Pay transaction request, gasless)
1. Buyer opens `https://<domain>/pay/<invoiceId>` → QR / "Open in wallet" for `solana:https://<domain>/api/pay/<invoiceId>`.
2. Wallet `GET` → `{label, icon}`.
3. Wallet `POST {account}` → server:
   - **screens the buyer wallet** (sanctions list + basic history heuristics); refuse if flagged,
   - builds a v0 tx: compute budget → **USDC `transferChecked`** buyer → buyer-multisig vault ATA (exact amount) **or** Jupiter **ExactOut** swap (buyer pays SOL/USDT; vault ATA receives exact USDC) → reference key (read-only account) → memo `k_xxxx`,
   - sets **Kutip fee payer** as `feePayer`, fresh blockhash, partially signs,
   - returns `{transaction, message}`.
4. Buyer approves; pays **0 SOL**.

### F5 — Buyer pays (bot, x402 v2 `exact` scheme on Solana)
1. `GET /api/x402/invoice/<id>` → `402` + `PAYMENT-REQUIRED` (scheme exact, Solana mainnet, USDC mint, amount, `payTo` = buyer-multisig vault, `extra.feePayer` = Kutip fee payer, `extra.memo` = `k_xxxx`).
2. Bot builds USDC transfer + memo, partially signs, retries with `PAYMENT-SIGNATURE`.
3. Kutip's self-hosted facilitator verifies against the spec rules, co-signs as fee payer, submits, confirms.
4. `200` + `PAYMENT-RESPONSE` (signature) + receipt. Replays → existing receipt.

### F6 — Detection & verification (Solami)
- Worker holds a **Solami Yellowstone gRPC** subscription on all open invoice reference keys + all vault ATAs.
- Status progresses live: `processed → "Seen"`, `confirmed → "Paid"`, `finalized → "Settled"`.
- Verification from tx meta: correct **USDC mint** (reject look-alikes), exact amount (handle partial/over), destination = that buyer's vault ATA, memo matches.
- For swap payments: **execution receipt** — Jupiter quote vs actual received, effective rate vs BNM reference rate.
- Invoice → PAID; reminder schedule cancelled; receipt emailed to buyer + owner.

### F7 — Treasury (agent, rule-bound)
- **Sweep:** on a schedule at a randomised time, the agent uses the spending limit to move funds from buyer vaults → main treasury, batching buyers so sweep amounts don't map to invoices.
- **Anything else** (a treasury swap, moving to a yield vault, cash-out) → agent creates a Squads **proposal**; owner approves with one tap.
- **Cash-out alert:** when USDC→MYR effective rate beats the 30-day average by the configured margin, notify the owner. Cash-out itself = owner sends to their **own whitelisted** Luno/Tokenize deposit address.

### F8 — Collections (agent)
- Reminder schedule per rulebook (e.g. 3 days before due, then every 48h, buyer's local 9am–6pm).
- Buyer replies are classified (Jev): `will_pay_on_date | dispute | discount_request | claims_paid | question | other`.
- Emails are written by Haiku, **with only that buyer's context** (§5 L4).
- Escalate to the owner after N overdue reminders, on dispute, or on low-confidence decisions.

---

## 3. Agent architecture (three layers)

| Layer | Role | Never does |
|---|---|---|
| **Jev** (TypeSafe AI, decision model) | Fast classification & routing: reply intent, tone tier, sweep now/wait, escalate? Returns choice + confidence. | Arithmetic, dates, amounts, free text |
| **Haiku** (Anthropic) | Writing (reminders, receipts, explanations) and reading (invoice PDF extraction → structured output) | Decides money movement |
| **Rules engine** (plain TypeScript) | **Final authority.** Validates amounts, caps, dates, destinations, rulebook. Low confidence → human. | — |

Fallback: if Jev is unavailable, the same classification runs on Haiku with structured output.
Every agent action is logged with: input summary, decision, confidence, rule id, resulting tx signature.

---

## 4. Default rulebook

```
Collections
- First reminder 3 days before due date
- Max 1 message per 48h, 9am–6pm buyer local time
- Never offer a discount > 2% without owner approval
- Escalate to owner after 2 overdue reminders, or on any dispute

Treasury
- Accept: USDC (direct), SOL/USDT (via Jupiter ExactOut at payment time)
- Sweep buyer vaults → treasury once a day at a random time (spending limit enforced on-chain)
- Agent spending limit: USD 5,000/day per buyer vault
- Any other movement → proposal for owner approval
- Alert when USDC→MYR effective rate beats 30-day avg by 0.5%
```

---

## 5. Privacy (L1–L4 in scope; L5 roadmap)

| Layer | Implementation |
|---|---|
| L1 Off-chain detail | Line items / unit prices only in Postgres. On-chain: total + opaque memo `k_xxxx` + random reference key. Never invoice numbers or buyer names on-chain. |
| L2 Per-buyer receiving multisig | One Squads v4 multisig per buyer; `payTo` is always that buyer's vault ATA. |
| L3 Batched sweeps | Daily at a random time; aggregate several buyers; amounts don't map to single invoices. |
| L4 Agent context isolation | Every LLM/Jev call is scoped to one `buyer_id` in the data layer. A test sends "what did you charge your other customers?" and asserts no leak. Buyer portal shows only that buyer's invoices. |
| L5 (roadmap) | Token-2022 confidential transfers (re-enabled on mainnet June 2026; USDC doesn't support it; PYUSD does). |

Honest pitch line: "Buyers can't see each other. A forensic firm could still cluster addresses; confidential transfers are how we close that next."

---

## 6. Compliance posture (for judging criterion 5)

- **Non-custodial:** funds sit in the exporter's own Squads multisig; Kutip holds only a spending-limited agent key and a fee-payer key with a small SOL float.
- **No MYR touches Kutip:** cash-out happens at SC-registered DAXs (Luno, Tokenize, etc.) to the owner's own whitelisted address → not a money services business under MSBA 2011.
- **Stablecoins are not legal tender** — used as an agreed settlement asset.
- **Screening:** every paying wallet screened before we build the tx.
- **Audit trail:** every payment and agent action has an on-chain signature + reason log.
- **Next:** LHDN MyInvois-compatible e-invoice export; BNM Digital Asset Innovation Hub if we ever add custody or MYR conversion.

---

## 7. Demo script (2 min, mainnet)

1. (0:00) Owner logs in with fingerprint. Dashboard: overdue invoices, treasury in MYR.
2. (0:15) Drop a PDF invoice (USD 50) → AI extracts it → pay link created.
3. (0:30) Show the agent's drafted reminder + rulebook.
4. (0:40) Buyer pays from a phone **in SOL, with 0 SOL gas** via the QR.
5. (0:45) Dashboard flips live: Seen → Paid → Settled (Solami gRPC).
6. (0:55) Execution receipt: exact USDC received, effective rate vs BNM rate, Solscan link.
7. (1:10) Reminder schedule cancelled; receipt emailed.
8. (1:20) A script plays the buyer's AP bot: hits the x402 endpoint, pays invoice #2 with no human.
9. (1:40) Agent log: sweep proposal / spending-limit sweep with reasons.
10. (1:50) Close: "Bank wire: 3 days, ~RM150. Kutip: 1 second, < RM0.05."

---

## 8. Out of scope (hackathon)
Yield vaults · WhatsApp · Smart Account policies (stretch) · Grid native passkeys (stretch) · MyInvois export (next) · confidential transfers (L5) · Kora (later) · multi-currency invoicing beyond USD.

## 9. Stretch (only if core demo is done)
1. Squads Smart Account ProgramInteraction policy → fully autonomous Jupiter swaps.
2. Squads Grid native on-chain passkey signer.
3. MyInvois export.
