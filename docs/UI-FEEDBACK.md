# UI revision brief (Session 8a)

Owner feedback 2026-09-28 + 7 Dribbble references in `docs/ui-refs/`. This replaces the "calm ledger" direction in `docs/DESIGN.md` where they conflict. Feature work (new flows) is in `docs/IMPROVEMENTS.md`; this file is about how things look and feel.

## What's wrong today (seen on `.playwright-mcp/s7-cp-dashboard.png`)
- Feels empty and text-heavy: one big number, a table, a long feed. No charts, no visual hierarchy between cards.
- Serif money figures read "old bank statement", not "modern finance product".
- Bugs: sidebar background stops at ~900px height; user avatar overlaps the name/"signed in with passkey" text.
- Register / onboarding form looks unfinished; no company logo anywhere.
- New invoice page has no real invoice representation.

## Direction: "simplified web3 finance"
A clean, light fintech dashboard that non-crypto finance admins trust, with a *touch* of web3 (one glowing wallet/treasury card, on-chain proof chips) — not a dark neon crypto app.

| Take | From | Where in Kutip |
|---|---|---|
| Light grey canvas, white cards, 20–24px radius, soft shadow, generous padding | 01 Outcrowd, 03 ACRU, 04 Shakuro | Everywhere |
| Big bold **sans** numerals with muted decimals (`$528,976`**`.82`**), small delta pills (+7.9%) | 04 Shakuro, 05 LoopAI | Dashboard KPIs, treasury, invoice totals |
| Pill navigation / segmented tabs, black primary button | 01, 06 | Top-level nav or sidebar items, status filters |
| Hatched / striped bars, dot-matrix activity charts, tooltip pills | 01, 03, 05 | "Received vs outstanding" over time, payments per day, collections funnel (Sent → Seen → Paid → Settled) |
| AI prompt bar inside the dashboard ("What would you like to explore next?") with ✦ icon | 01 Outcrowd | Agent command bar (see IMPROVEMENTS A1) |
| One gradient "hero" card with wallet actions | 02 Stakent (right card) | Treasury card: balance, "Sweep now", "Cash out", on-chain badge. The only dark/gradient element. |
| Priority tasks column with AI labels | 05 LoopAI | "Agent needs you" panel: approvals, disputes, escalations |
| Form left + **live invoice preview** right, Save draft / Send invoice | 06 Miawmiaw, 07 Cansaas | New invoice page (+ "Import from PDF" as an option, not the only path) |
| Avatars / logos for customers | 04, 05 | Buyer logos/initials in tables and inbox |

Don't take: dark full-page theme (02), vanity charts with fake data, gamification ("Sales streak 🔥"), upsell cards.

## Rules that stay
- **MYR first**, USD/USDC second, BNM rate as a caption.
- Plain English for finance people ("Payment received", not "tx confirmed"). On-chain detail lives in small "Verified on Solana ↗" chips.
- Status colours only in status pills; one accent colour for actions.
- Mobile-first pay page; light + dark mode; WCAG AA; tabular figures.

## Decided (owner, 2026-09-28)
- **Accent: violet** (refs 02 Stakent, 05 LoopAI) — closest to the Solana / web3 feel. Violet for primary actions, focus and the treasury hero card gradient (violet → deep indigo); near-black for secondary emphasis; status colours unchanged. Check AA contrast for violet text on white and in dark mode.

## Screens to redo (priority order)
1. **Dashboard**: KPI row (received this month, outstanding, overdue, in treasury) with deltas; collections chart; agent command bar; "Agent needs you" panel; recent payments with buyer logos; treasury hero card.
2. **Register / sign-in / onboarding**: proper multi-step form with progress, company logo upload + preview, clean passkey step (see IMPROVEMENTS R1–R4).
3. **New invoice**: form + live preview (exporter logo, billed by/to, line items, totals in USD with MYR equivalent, pay-with-USDC note, QR on the preview).
4. **Pay page**: invoice view first (logo, line items, totals), then "Confirm & pay" → QR / Open in wallet (IMPROVEMENTS P1).
5. **Invoice detail**: status timeline as a horizontal stepper; receipt card; thread.
6. **Treasury**: hero card + sweep flow + cash-out flow (IMPROVEMENTS T2–T4 UI).
7. **Inbox, Calendar, Agent activity, Rulebook/Settings**: same system.

Process for 8a: produce a new `/design` style tile with the chosen accent, show screenshots, wait for OK, then roll out screen by screen with `impeccable` critique at desktop + 375px, light + dark.
