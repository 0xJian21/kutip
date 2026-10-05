# Kutip — submission write-up

Colosseum Crypto World's Fair (Solana) · Superteam MY "Build Global, Buatan Malaysia" · Solami prize.
Live app: https://kutip-app.vercel.app · Repo: https://github.com/0xJian21/kutip · Base country: Malaysia.

Every number below is from the repo: `docs/REHEARSAL.md` (production walk-through on Solana mainnet, 29 Sep 2026), `docs/PLAN.md` (per-session mainnet proofs) and `docs/DECISIONS.md` (spike results). Wire costs are **estimates** and are labelled as such. Nothing here names a real customer; the exporter in the demo (Teratai Woodworks Sdn. Bhd.) is seeded demo data. See "Customer evidence" at the end.

---

## One-liner

**Kutip is an AI collections and settlement agent for Malaysian exporters: it chases overseas invoices, sees the payment land on Solana within a second, and settles it into the exporter's own treasury, inside rules the owner sets and without ever holding the keys.**

## The user

The finance admin, and the owner behind them, of a 30 to 80 person furniture exporter in **Muar or Batu Pahat, Johor**. They sell teak and rubberwood furniture to buyers in Australia, the United States and the Middle East on 30 to 60 day terms, invoiced in USD. They live in Excel, email and Maybank2u. They are not crypto people and do not want to become one.

Their week today:
- Chasing overdue invoices by hand across four time zones, from a spreadsheet of who still owes.
- Waiting on telegraphic transfers: the money sits with correspondent banks for **2 to 5 days**.
- Losing a slice of every invoice: **RM 50 to 150** in wire fees from both banks and a **1 to 3 %** exchange spread hidden in the bank's rate (estimates of typical Malaysian bank charges for an inbound USD transfer; they vary by bank).
- Reconciling by hand: "which invoice was this RM 48,211.40 for?"
- No discipline on when to convert USD to ringgit.

Secondary users: the overseas buyer (a person paying from a phone wallet) and, increasingly, the buyer's accounts-payable software (a bot paying over HTTP).

## The problem

Getting paid from abroad is slow, expensive and manual, and the work of collecting falls on one person. A bank wire takes days, eats fees and spread, and gives the exporter no live view of what has arrived. Chasing and reconciliation are manual, so cash sits idle and invoices slip overdue. Stablecoin rails fix the speed and cost on paper, but an exporter will not touch them if it means managing gas, seed phrases, custody risk or compliance uncertainty.

Kutip's answer: the buyer pays from any Solana wallet by scanning a QR, pays **zero gas** (Kutip is the fee payer), and the **exact USD amount** lands in a receiving account the exporter owns. The exporter sees it flip Seen, Paid, Settled on the dashboard without a refresh, in ringgit at the Bank Negara reference rate. An agent sends reminders in the buyer's hours, answers buyer questions with a draft the owner approves, cancels reminders and emails the receipt when the money lands, and sweeps buyer accounts into the main treasury under an on-chain daily cap. Anything beyond that cap, including cashing out to ringgit, is a proposal the owner approves with Touch ID.

## Why Solana

Solana is the product, not a wallet button bolted onto a SaaS. Each piece of the stack does a job a bank cannot:

- **Speed and finality.** On the 29 Sep 2026 production walk-through the buyer's payment went **Seen to Paid in 0.15 s** (153 ms) and **Settled in 7.9 s**, on mainnet, in the same browser tab, no refresh. Signature `5GDG5XPL…3AMV`.
- **Cost.** The network fee per payment is **under RM 0.05**, and Kutip pays it. The buyer's SOL balance changes by exactly zero on a USDC payment (proven on Phantom and Solflare, `docs/PLAN.md` Session 3).
- **Solana Pay transaction requests.** The server builds every payment: screens the paying wallet against the OFAC list, sets Kutip as fee payer, attaches a random reference key and an opaque memo, and the wallet shows the exact amount before the buyer approves.
- **Jupiter ExactOut, inside the buyer's own transaction.** A buyer holding SOL still pays the exact invoice amount: the swap happens in the same transaction, the vault receives exactly 1.000000 USDC, and the receipt shows the effective rate against BNM's.
- **Squads v4 treasury.** One multisig per buyer plus a main treasury, all owned by the exporter's passkey wallet (Privy). Kutip's agent key has Initiate permission and a program-enforced **spending limit** (USDC, per day, destination fixed to the treasury). It cannot send anywhere else: the negative test fails on chain with `InvalidDestination`.
- **x402 for machines.** An invoice is also an HTTP endpoint. A buyer's AP bot gets a `402`, pays, and gets a `200` with a receipt: **4.5 s** end to end on mainnet, self-hosted facilitator. Signature `5taDgww4…1AWm`.
- **Solami Yellowstone gRPC as the data path.** One stream watches every open invoice's reference key and every vault. Processed, confirmed and finalized become Seen, Paid and Settled. Measured geyser-to-worker latency: 19 ms. A catch-up over Solami RPC every 3 minutes and at startup means a worker restart never loses a payment.
- **Composability.** Privy passkeys, Squads, Jupiter, Solana Pay, x402, Solami, Supabase Realtime and two LLMs behind a plain TypeScript rules engine, assembled in 7 days of commits (first commit 27 Sep 2026).

## What is live today (mainnet proofs)

| Step | Signature | Measured |
|---|---|---|
| Buyer pays INV-2026-0154 in SOL from Phantom; exactly 1.000000 USDC lands; buyer fee 0 SOL | `5GDG5XPL8cJwDPJTvvqbgnKcL5SThS9t5GgVDYeVh6fQFgTHJxayc7KqM84KZwBy75by2jBcfdAsA8HHvtjv3AMV` | Seen → Paid +153 ms, Settled +7.86 s; receipt email +2.9 s |
| AP bot pays INV-2026-0155 over x402 | `5taDgww4YGWphCH5rMiGLjM3253HeZa2LbQcbhy9bqNHHAznh58hA7h7J1cuRJ1eB7S5MtdrUVMvD9jXL1sM1AWm` | HTTP 402 → 200 in 4.5 s |
| Agent sweep, two buyer accounts → treasury, agent-signed under the on-chain limit | `47KoPjR6tVT5pLGwfAADGT5LKLXmGcjSeX5hSc6rGGFDdwyF14gSxuPX6QnJyvLR3z74vUPmjrCK4JN4qhkpfobP` | network fee 0.00002 SOL, paid by Kutip |
| Ticked sweep: Harbourline only, Meridian left untouched | `3JHKFK1fyKtAXVGbi7jAeRzbEMQAWakEwfwY9LHsDzBHiwi3nsHGDDac6wP3xEb9bjxUmR1KHAPeTWGA2dPzaNAR` | slot 451650272, finalized |
| Cash-out proposal approved with Touch ID (approve + execute in one tx) | `3b7KNHLUENg36RWemfqc6N2nXhTbjZSDeQqu9xkkzeSio9rPojq6JgJGRSXk1wYRtLU2vg3qiwm8duBpcmjYKTq1` | Squads proposal → executed |
| Buyer question on the pay page → classified → draft in the inbox | — | draft ready 4.2 s after the message |

Known limits, stated plainly: Solflare currently flags `kutip-app.vercel.app` as a scam site (a blocklist false positive reported for review), so Phantom is the demo wallet. Emailing real buyers needs a verified sending domain; until then invoices email only the owner's inbox and the pay link is shared by copy or WhatsApp. Ringgit cash-out is to the owner's own whitelisted address at an SC-registered exchange (HATA); a ringgit stablecoin (MYRC) is shown as "when BNM approves". The Jev decision model runs via OpenRouter; the rules engine makes every money decision regardless of which model answers.

## Regulatory posture (BNM and SC)

- **Non-custodial.** Funds sit in the exporter's own Squads multisig. Kutip holds a sweep-only agent key and a fee-payer key with a small SOL float.
- **No ringgit touches Kutip.** Cash-out is USDC to the owner's own whitelisted deposit address at a Securities Commission-registered digital asset exchange; the owner sells there. Kutip never converts or holds MYR, so it does not act as a money services business under the Money Services Business Act 2011.
- **Stablecoins are not legal tender** in Malaysia; Kutip treats USDC as an agreed settlement asset between exporter and buyer.
- **Screening and audit trail.** Every paying wallet is screened against the OFAC SDN list before a transaction is built; every payment, sweep and approval has an on-chain signature; every agent decision has a written reason and a rule id.
- **Next:** LHDN MyInvois-compatible e-invoice export; an application to Bank Negara Malaysia's Digital Asset Innovation Hub before Kutip ever adds custody or ringgit conversion; MYRC as a payment option when BNM's ringgit-stablecoin framework allows it.

## What's next

1. **First 10 customers** (Oct to Dec 2026): furniture and wood-product exporters in Muar and Batu Pahat, reached through the Muar Furniture Association and Malaysian Furniture Council member lists, the accountants and company secretaries who already file for these firms, and the Superteam MY builder network for warm introductions. Offer: free until their first ten settled invoices; we onboard them in person and run the first invoice with them.
2. **Verified sending domain** so invoices, reminders and receipts reach real buyers (one DNS change plus two env vars; documented in the README).
3. **MyInvois e-invoice export** so every Kutip invoice is also LHDN-compliant.
4. **Team roles**: finance and viewer logins, and a second Squads approver for large cash-outs.
5. **MYRC** as a pay-in option when BNM approves; **Token-2022 confidential transfers** for the last privacy gap; **Kora** as the production fee relayer; Solami webhooks and SWQoS send once available on our plan.
6. **More corridors**: gloves, electronics parts, food and services exporters; then SMEs across emerging markets that lose days and margin to correspondent banking.

Proposed business model (not yet charged to anyone): **0.5 % of each settled invoice, capped at RM 100**, so Kutip is always cheaper than the wire fee it replaces. The network fee stays on Kutip.

## Team

<!-- TODO: fill in from the owner. Nothing below should be submitted until it is. -->
- **Jian Wei** — Web3 engineer, Solana builder since 2024, Malaysia. Built solo. GitHub: 0xJian21.
- Pre-existing code: none. The first commit is 27 Sep 2026; everything was built for this hackathon.

---

## 150-word project description (for the forms)

Kutip is an AI collections and settlement agent for Malaysian exporters, built on Solana. A furniture exporter in Muar sends an invoice with one pay link. The overseas buyer scans it from any Solana wallet and pays the exact USD amount with zero gas, in USDC or in SOL converted inside the same transaction. The exporter watches it go Seen, Paid, Settled in under eight seconds on mainnet, in ringgit, with no refresh. The money lands in a Squads multisig the exporter owns; Kutip's agent can only sweep buyer accounts into that treasury under an on-chain daily cap, and everything else, including cashing out to ringgit, is a proposal the owner approves with Touch ID. The agent sends reminders in the buyer's hours, drafts replies to buyer questions, cancels reminders and emails the receipt when money arrives. Buyers' AP bots pay over x402. Detection runs on a Solami gRPC stream.

(150 words)

## 50-word tagline version

Kutip gets Malaysian exporters paid like a message. The buyer scans a QR from any Solana wallet, pays zero gas, and the exact USD lands in the exporter's own Squads treasury: Seen to Paid in 0.15 seconds on mainnet. An AI agent chases the rest and asks before moving money.

(50 words)

## One line for the form's "What problem does it solve"

An exporter in Muar waits 2 to 5 days and loses RM 50 to 150 plus a 1 to 3 % spread (est.) on every wire from Sydney or Dallas, then chases and reconciles by hand; Kutip makes getting paid instant, gasless for the buyer, and handled by an agent the owner controls.

---

## Customer evidence

**None yet: labelled estimates are used.** The user profile comes from the Malaysian furniture export cluster in Muar and Batu Pahat (SPEC §1); the pain points are the standard ones for USD telegraphic transfers and were not yet validated in recorded exporter interviews. Before submission, if the owner has 2 or 3 exporter conversations, replace the estimates above with the quoted figures and attribute them ("a Muar exporter told us…", no names unless permitted). Nothing in this pack should be read as a customer, partner or testimonial claim.
