# Improvement backlog (after Session 7)

Owner feedback 2026-09-28, checked against the product, the regulations and the time left (build until Oct 2, submit Oct 3 noon). Each item: what the owner asked, verdict, how, effort (S ≤ ½ day, M ≈ 1 day, L > 1 day), priority (P0 must, P1 should, P2 if time, ✗ not now). Visual direction is in `docs/UI-FEEDBACK.md`; hardening items stay in `docs/FOLLOWUPS.md`.

## Payment (buyer side)
- **P1 Pay link shows the invoice, then confirm.** ✅ Valid. `/pay/[id]` first shows the invoice document (exporter logo, billed by/to, line items, totals, due date), then "Confirm & pay" → QR / Open in wallet (USDC or SOL). Privacy is fine: the link is unguessable and scoped to that one invoice. Needs `getPayInvoice` to return line items + logo. **S · P0**

## Treasury
- **T1 Team / finance team.** ✅ Valid, two layers:
  - App access: invite by email → Privy sign-in → role `owner | finance | viewer` (`users.role` exists). **M · P2**
  - On-chain approver: owner can make a teammate a Squads member with Vote permission (config tx approved with Touch ID). Shows real multisig value (2 people approve large cash-outs). **M · P2**
- **T2 Sweep with a quote and a visible process.** ✅ Valid. "Sweep now" opens a preview: which buyer accounts, amounts, destination (treasury), network fee (paid by Kutip, ~0.00002 SOL), rule check (T2 daily cap). Then a stepper: Checked → Signed by agent → On Solana → Recorded. Within limits it runs; otherwise it becomes an approval. **S–M · P0**
- **T3 "Convert everything to USD when we receive."** ✅ Already how it works: every payment lands as **USDC**. SOL is swapped to exact USDC inside the buyer's own transaction (Jupiter ExactOut). Only needs saying clearly in the UI ("All payments arrive as USD (USDC)"). **S · P0 (copy only)**
- **T4 Cash out to ringgit (Luno / HATA / MYRC).** ✅ Valid, with a correction:
  - ⚠️ **Luno Malaysia does not appear to offer USDC to Malaysian users** (Luno help centre). The demo currently says "Luno MYR account". Switch the primary cash-out to **HATA** (SC-registered DAX, lists USDC and supports the Solana network, instant MYR withdrawal, RM250k/day). *Owner to verify in the HATA app that USDC deposits on Solana are enabled for their account.*
  - Flow: owner saves their own exchange deposit address once (whitelist, Touch ID) → "Cash out" shows an indicative quote (USDC amount × BNM rate − exchange fee estimate = ~RM) → agent proposal → owner approves with Touch ID → USDC arrives at HATA → owner sells and withdraws to bank in HATA. Kutip never touches MYR (MSBA posture unchanged). **M · P0**
  - **MYRC** (Blox ringgit stablecoin): live on Solana, 1:1 MYR in trust, but **not regulated by the SC or BNM yet**; BNM expects a ringgit-stablecoin framework by end-2026 via its Digital Asset Innovation Hub. Show it as a disabled "MYRC — when BNM approves" option + a roadmap slide. That scores on regulatory awareness without taking the risk. **S · P1**

## Messages
- **M1 One unified inbox.** ✅ Valid. All threads across buyers (reminders sent, buyer replies, receipts, agent drafts), filters by buyer / needs-reply / disputed, one thread per invoice. The owner may see everything; every agent call stays scoped to one buyer (L4). **M · P1**
- **M2 Agent drafts replies, owner confirms.** ✅ Valid. In a thread: "Draft reply" → Haiku draft with facts from code → owner edits → Send. Never auto-send replies to buyers. **S · P1**

## Register / sign-in
- **R1 Better register form + company logo.** ✅ Valid. Multi-step: account → company (name, SSM no., address, logo upload to Supabase Storage) → treasury → agent permissions. Logo appears on dashboard, invoices, pay page, emails. **M · P0**
- **R2 Email login / 2FA.** ✅ Valid. Privy supports email OTP. Use **email to sign in** + **passkey (Touch ID) to approve money** = real 2-factor where it matters. **S · P0**
- **R3 Existing user should go straight in.** 🐞 Bug. After sign-in: if the Privy user is linked to an exporter → `/dashboard`; only unlinked users see the company step. **S · P0**
- **R4 Agent permissions set up once during onboarding.** ✅ Valid, and strong for judges (clear human-in-the-loop). Onboarding step shows pre-filled permissions (daily sweep cap, allowed destination = treasury, "anything else needs my approval", reminder rules) → owner approves once with Touch ID → spending limits created on-chain → shown later under **Settings → Agent permissions** (changes need Touch ID). Also enrols passkey MFA here, which retires `/treasury-test`. **M · P0**

## Invoices
- **I1 Create invoice with a real preview.** ✅ Valid (refs 06, 07). Form left, live preview right; "Import from PDF" fills the form via the existing extractor. **M · P0** (mostly Session 8a)

## "Contract" / email ownership
- **E1 Reading from the exporter's own mailbox (Gmail/Outlook permission).** ✗ Not now. Gmail's restricted scopes need Google's security assessment (weeks), and it gives Kutip access to all of the exporter's mail. *Owner: confirm this is what "Contract … allow permission then we can read from them" meant.*
- **E2 Recommended instead: Kutip sends and receives on its own domain.** Emails go "from Teratai Woodworks via Kutip" with a per-exporter reply address (e.g. `teratai@reply.<domain>`); buyer replies arrive in the Kutip inbox via Resend inbound and get classified; a copy is forwarded to the exporter. Needs a domain verified in Resend. **M · P1** (P0 if you want live buyer replies in the demo)

## Agent
- **A1 Agent command bar on the dashboard ("agentic all the flows").** ✅ Valid, high demo value (ref 01). Ask in plain words: "Sweep now", "Remind Najd about INV-0141", "What's due this week?", "Cash out RM 10k". The agent (Claude tool use; Jev for routing) calls existing functions, shows a preview card, and **only acts after confirmation** (Touch ID for money). **M–L · P1**
- **A2 Manual "Sweep now" / payout trigger.** ✅ Valid (covered by T2 + A1). **S · P0**
- **A3 Calendar.** ✅ Valid. Month/week view of due dates, buyer promised dates, scheduled reminders, sweeps, rate alerts. "What's on this week?" in A1 answers from the same data. **M · P2**

## Proposed order
| Day | Session (lane) | Items |
|---|---|---|
| Sep 28–29 | **8a UI** (Fable): style tile first, then screens | UI-FEEDBACK.md, I1, P1 UI, R1 UI |
| Sep 28–29 | **8b Accounts & treasury** (Fable) | R2, R3, R4, T2, T3, T4, A2 (+ FOLLOWUPS money/security items) |
| Sep 29–30 | **8c Agent & messages** (Opus) | A1, M1, M2, E2 (if domain), A3 if time |
| Oct 1 | **8d Hardening** (Opus) | FOLLOWUPS.md, security review, full rehearsal |
| Oct 2 | **9 Submission** | deck, videos, write-up |
| P2 if time | — | T1 team, A3 calendar |
