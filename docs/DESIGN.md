---
name: Kutip
description: Daylight ledger. Grey canvas, white cards, bold ringgit, one violet card that says the money is on chain.
colors:
  paper: "oklch(96.2% 0.006 290)"
  paper-2: "oklch(93.4% 0.009 290)"
  surface: "oklch(99.4% 0.002 290)"
  well: "oklch(97.6% 0.004 290)"
  ink: "oklch(21% 0.025 290)"
  ink-2: "oklch(44% 0.02 290)"
  ink-3: "oklch(53% 0.018 290)"
  line: "oklch(90.5% 0.008 290)"
  line-strong: "oklch(82% 0.012 290)"
  accent: "oklch(52% 0.21 292)"
  accent-hover: "oklch(46% 0.21 292)"
  accent-soft: "oklch(94.5% 0.035 292)"
  accent-soft-2: "oklch(90% 0.07 292)"
  accent-2: "oklch(34% 0.17 278)"
  on-accent: "oklch(99% 0.005 292)"
  hero: "linear-gradient(135deg, oklch(54% 0.22 300) 0%, oklch(46% 0.22 290) 42%, oklch(31% 0.16 276) 100%)"
  on-hero: "oklch(99% 0.005 292)"
  on-hero-2: "oklch(93% 0.025 292)"
  seen-fg: "oklch(44% 0.13 255)"
  seen-bg: "oklch(93% 0.035 255)"
  paid-fg: "oklch(42% 0.12 150)"
  paid-bg: "oklch(93% 0.05 150)"
  settled-bg: "oklch(44% 0.13 150)"
  settled-fg: "oklch(99% 0.005 150)"
  overdue-fg: "oklch(46% 0.16 35)"
  overdue-bg: "oklch(94% 0.04 35)"
  disputed-fg: "oklch(44% 0.17 20)"
  disputed-bg: "oklch(94% 0.04 20)"
  partial-fg: "oklch(46% 0.12 70)"
  partial-bg: "oklch(94% 0.05 70)"
typography:
  money-2xl:
    fontFamily: "Plus Jakarta Sans, system-ui, sans-serif"
    fontSize: "3.5rem"
    fontWeight: 700
    lineHeight: 1.07
    letterSpacing: "-0.025em"
    fontFeature: "lnum"
  money-xl:
    fontFamily: "Plus Jakarta Sans, system-ui, sans-serif"
    fontSize: "2.75rem"
    fontWeight: 700
    lineHeight: 1.09
    letterSpacing: "-0.025em"
  money-lg:
    fontFamily: "Plus Jakarta Sans, system-ui, sans-serif"
    fontSize: "2.125rem"
    fontWeight: 700
    lineHeight: 1.12
    letterSpacing: "-0.025em"
  money-md:
    fontFamily: "Plus Jakarta Sans, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1.17
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "Plus Jakarta Sans, system-ui, sans-serif"
    fontSize: "2.25rem"
    fontWeight: 600
    lineHeight: 1.11
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Plus Jakarta Sans, system-ui, sans-serif"
    fontSize: "1.375rem"
    fontWeight: 600
    lineHeight: 1.27
    letterSpacing: "-0.01em"
  card-title:
    fontFamily: "Plus Jakarta Sans, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.44
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Plus Jakarta Sans, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  ui:
    fontFamily: "Plus Jakarta Sans, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.43
  label:
    fontFamily: "Plus Jakarta Sans, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 500
    lineHeight: 1.38
rounded:
  xs: "6px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  2xl: "24px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  2xl: "48px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.on-accent}"
    typography: "{typography.ui}"
    rounded: "{rounded.full}"
    height: "40px"
    padding: "0 20px"
  button-secondary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    rounded: "{rounded.full}"
    height: "40px"
    padding: "0 20px"
  button-outline:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.full}"
    height: "40px"
    padding: "0 20px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    height: "40px"
    padding: "0 14px"
  status-pill:
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    height: "24px"
    padding: "0 10px 0 8px"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.xl}"
    padding: "24px"
  hero-card:
    backgroundColor: "{colors.hero}"
    textColor: "{colors.on-hero}"
    rounded: "{rounded.2xl}"
    padding: "28px"
---

# Design System: Kutip

## 1. Overview

**Creative North Star: "The Daylight Ledger"**

Kutip is read by a finance admin in Muar who trusts two documents: the bank statement and the ledger. Session 2 borrowed their calm with cream paper and a serif. Session 8 keeps the calm and changes the room: a light grey canvas, white cards, bold sans numerals, and one violet card. It should feel like a modern finance product a non-crypto admin would open next to Maybank2u, with exactly one hint that the money moves on Solana.

Numbers are still the hero. Ringgit first and large; USD/USDC second and small; the Bank Negara rate a caption. Money is set in the same sans as everything else, bold and tight, with the sen in a lighter ink so the integer is what the eye lands on. Wallet addresses, signatures and Solscan links exist for the audit trail and sit in chips and captions.

Colour has one job at a time. The canvas and cards are neutral, tinted a few points toward violet so the accent belongs. Violet marks the one thing to press, the focus ring, and money that has landed on a chart. Status colour lives only in pills and on a passed due date. The treasury card is the single gradient, violet to indigo, and the only dark surface on a light screen: it is where the on-chain money is, so it is where the on-chain feel is.

The system rejects the dark neon crypto app (ref 02's page, not its card), vanity charts, gamification, upsell cards, batik clip-art, and the flat template kit where every card, radius and shadow is the same regardless of what it holds. Hierarchy comes from size and weight, not from decoration.

**Key Characteristics:**
- Grey canvas, white cards at 20px radius with one soft shadow. Cards are for one idea each; never nest them.
- One typeface. Bold for money, semibold for titles, regular for everything you read. Tabular figures only in columns.
- Violet is a stamp, not a paint: the primary button, focus, selection, the live fill. Near-black is the strong alternative.
- Status colour only in pills. Every pill carries a dot and a word.
- Charts in one hue: solid where money has landed, hatched where it is still owed, grey where nothing happened.
- One gradient surface in the product: the treasury card.
- Still by default. Motion answers an action or shows state (a payment landing, a step completing).

Layout: left-aligned app shell (side rail on desktop with pill nav items, top bar with a sheet on mobile), content column up to 1180px. Dashboard is a grid of cards with the treasury card and "Agent needs you" on the right. Amounts right-align in tables. Public pay page is a single column built for a 375px phone: the invoice document first, the action second.

## 2. Colours: Daylight

Cool neutrals tinted toward violet, one violet accent, indigo only inside the hero gradient, and six semantic pairs that appear only on status.

Token names are unchanged from Session 2 so screens built in parallel restyle themselves on merge: `paper` is the canvas, `paper-2` the quiet fill, `surface` a card, `well` (new) an inset inside a card.

### Primary
- **Violet** (`accent`, oklch(52% 0.21 292), ≈ #6d43f2): primary buttons, links, focus rings, the active state, the solid chart fill, the stepper's completed nodes. 6.0:1 on white, 5.4:1 on the canvas. Dark mode lifts it to oklch(77% 0.14 292) with near-black text on it (8.1:1 on the dark card, 9.0:1 for text on the button).
- **Violet wash** (`accent-soft`, `accent-soft-2`): selected rows, hover on suggestion chips, the "Verified on Solana" chip, spacing swatches. Never a page background.
- **Indigo** (`accent-2`, oklch(34% 0.17 278)): the far end of the hero gradient. Nowhere else.

### Neutral
- **Canvas** (`paper`, oklch(96.2% 0.006 290)): page background. Dark: oklch(14% 0.014 290).
- **Quiet fill** (`paper-2`, oklch(93.4% 0.009 290)): table headers, segmented tracks, meter tracks, hover rows, the sidebar's active pill background is `surface` on this. Dark: oklch(19.5%).
- **Card** (`surface`, oklch(99.4% 0.002 290)): cards, inputs, the white pill. Dark: oklch(21.5%).
- **Well** (`well`, oklch(97.6% 0.004 290)): QR frame, invoice paper preview, code and link fields. Dark: oklch(17.5%).
- **Ink** (`ink`, oklch(21% 0.025 290)): text, the black button. Dark: oklch(94%).
- **Ink 2** (`ink-2`, oklch(44% 0.02 290)): labels, secondary text, USD lines. 7.7:1 on white.
- **Ink 3** (`ink-3`, oklch(53% 0.018 290)): captions, decimals, placeholders. 5.2:1 on white, 4.7:1 on the canvas; never body copy.
- **Line / Line strong**: hairline dividers; input borders.

### The hero
`hero` is a 135° gradient from violet (oklch 54% 0.22 300) through deeper violet (46% 0.22 290) to indigo (31% 0.16 276), with `shadow-hero`, a violet glow. Text on it is `on-hero` (near-white, 5.5:1 at the bright corner) and `on-hero-2` (pale lavender, 4.6:1, for labels and USD lines). Chips and the outline button on it use `hero-line` / `hero-fill` (white at 18% / 12%). The white button on it uses `hero-button-fg`, deep indigo in both themes. Two decorative blurred discs of `hero-fill` give the card depth; they are the one piece of decoration in the system.

### Semantic (status only)
| Status | Pair | Meaning shown to the user |
|---|---|---|
| draft | paper-2 / ink-2 with a line ring | Not sent to the buyer yet |
| sent | paper-2 / ink-2 | Waiting for payment |
| seen | seen (blue), dot pulses | A payment has appeared and is being checked |
| paid | paid (green tint) | Payment received |
| settled | settled (green solid) | Payment final and in your treasury |
| partially_paid | partial (amber) | Some of the amount has been received |
| overdue | overdue (red-orange) | Past its due date and unpaid |
| disputed | disputed (red) | The buyer raised a problem; needs you |

Agent actions reuse the pairs: proposed = amber, approved = blue, executed = green tint, escalated = red-orange, rejected = neutral. Deltas reuse paid/overdue by direction × whether up is good.

All pairs are ≥ 6:1 in light and ≥ 7.6:1 in dark (computed from the OKLCH values, WCAG 2.x). Verified values live in `apps/web/app/globals.css`.

### Named Rules
**The Stamp Rule.** Violet marks the one thing to press and the one thing that is live. If a screen has two violet buttons, one of them is wrong. The strong alternative is the black pill.

**The Pill Rule.** Semantic colour appears only inside a status pill, a delta pill, or on a due date that has passed. Never on row backgrounds, card borders, icons or headings.

**The One Gradient Rule.** The treasury card is the only gradient and the only dark surface on a light screen. Landing, onboarding and the pay page may show it as a picture of the product, never as a second live surface.

**The No-Pure Rule.** No `#000`, no `#fff`. Every neutral carries a trace of violet (chroma 0.002 to 0.025, hue 290).

## 3. Typography

**One family:** Plus Jakarta Sans (with system-ui), variable weight 400 to 700. Drawn in Jakarta; the region's own face.
**Money:** the same family at 700, letter-spacing −0.025em, lining figures. Decimals in `ink-3`, the "RM" at half size and semibold. Proportional figures at display sizes; tabular only inside columns.
**No serif, no mono.** Addresses and signatures use the sans with tabular figures, truncated `7Xk4…q9Zc`, inside a chip or a well.

### Hierarchy
- **Money 2XL** (700, 56/60): the treasury balance on the hero card. Steps down to XL under 640px.
- **Money XL** (700, 44/48): the single hero figure on a screen (received this month, invoice total on the pay page).
- **Money LG** (700, 34/38): receipt totals, the invoice amount on detail pages.
- **Money MD** (700, 24/28): KPI tiles, funnel stage values, treasury rows.
- **Money SM** (700, 20/24): compact figures inside cards.
- **Headline** (600, 36/40, −0.01em): page titles. One per page.
- **Title** (600, 22/28): section titles.
- **Card title** (600, 18/26): card headings, with an optional 13px caption beneath.
- **Body** (400, 16/24): prose on landing, onboarding, agent reasons. Max 65ch.
- **UI** (400, 14/20): tables, forms, navigation, rows.
- **Label** (500, 13/18): pill text, meta, timestamps, form labels. Sentence case, never tracked-out caps.

## 4. Layout and elevation

- **Radius carries hierarchy:** hero 24, cards 20, inner blocks and mobile sheets 16, inputs and wells 12, chips and skeletons 8, swatches 6. Buttons, pills, tabs and avatars of people are fully round; company logos are 8px squares.
- **Three shadows, each for one thing:** `shadow-card` under every card (a 1px contact shadow plus a soft 32px drop at 16% that reads as a lift, not a glow); `shadow-float` for menus, sheets, tooltip pills and the drag-over drop zone; `shadow-hero` for the treasury card only. Buttons carry `shadow-pill`, a whisper.
- **Spacing:** 4px grid. Cards pad 24 (20 on mobile). Card grids gap 16; page sections gap 24 to 32. Vary it: a KPI row is tight, a receipt is generous.
- **Grid:** app content column 1180px max. Dashboard: `[2fr_1fr]` on desktop, single column under 1024px. Forms with preview: `[1fr_1fr]`, the preview sticky.

## 5. Components

### Buttons
- **Primary:** violet pill, 40px, 20px side padding, `on-accent` text. Hover darkens. One per view.
- **Secondary:** near-black pill (`ink` on `paper`). The strong alternative: Send invoice next to Save draft, Approve next to Reject, Cash out next to Sweep.
- **Outline:** white pill with a hairline and `shadow-pill`. Quiet actions on cards (Import from PDF, Choose file, Try again).
- **Ghost:** text only, hover fill. Cancel, Reject, row links.
- **Hero / Hero outline:** the white pill and the translucent pill that live on the treasury card.
- **Icon button:** 40px (32px small) round, outline or ghost. Card menus, close, copy. Always labelled.
- Sizes: sm 32px / md 40px / lg 48px (the pay page's Confirm and pay). Focus: 2px violet outline offset 2px.
- **Disabled** is a quiet fill (`paper-2` with `ink-3` text; on the hero, the translucent fill), never a faded accent: an enabled violet button must always read as enabled. A disabled button that waits on something says why in a `title` and, where a phone user needs it, in a caption beneath.

### Cards
- **Card:** `surface`, 20px radius, `shadow-card`, 24px padding. `CardHeader` gives a title, an optional caption and an aside slot (link, pill, icon button). One idea per card; lists inside divide by hairline. Tables use `padded={false}`.
- **Inset:** the `well` fill at 16px radius inside a card for QR codes, invoice paper, link and code fields.
- **HeroCard:** the gradient at 24px radius with two blurred discs. Only the treasury.

### Stat (KPI tile)
Label (13px, ink-2), money MD in ink with muted decimals (SM on phones), then one line of `USD figure · delta pill`, then an optional footer (a count link, a caption). Four across on wide screens, 2×2 below, inside one card with hairlines. The delta pill is signed, tinted by direction × whether up is good, and names the period ("+7.9% vs Aug"); it is hidden when the previous period is under a tenth of the current, because "+365%" tells the reader nothing.

### Status pills and chips
- **Status pill:** 24px, fully round, a 6px dot then the word, 13px medium. Tinted background with a dark foreground of the same hue; `settled` alone is solid. The `seen` dot pulses. Pills never truncate.
- **Chip:** 24px, 12px text, neutral (`paper-2`), accent (violet wash) or hero (translucent white). Rule ids, confidence, tokens, "Verified on Solana ↗".
- **Delta:** the signed change pill, 24px, with a trend arrow.

### Tables
- Header on `paper-2` at 70%, 13px ink-2 medium, left-aligned except amounts. Rows 12px vertical padding, hairline dividers, hover `paper-2` at 50%. First cell has a buyer logo (28px square initials) beside the name; the name column absorbs spare width and wraps to two lines (with a title for the rest). Invoice numbers, dates and status words ("6 days overdue", "Disputed") never wrap or truncate: a cut status is a wrong status. Amounts right-aligned, MYR semibold above USD in ink-3.
- **Mobile:** under 640px a table becomes stacked rows: logo, buyer and number on the left, amount and pill on the right.

### Tabs
- **Pills:** free-standing white pills with `shadow-pill`; the active one is solid ink with paper text. Status filters, top-level nav in the rail. Counts sit inside at 12px; the overdue count turns red-orange when above zero.
- **Segmented:** a `paper-2` track with a white active segment and `shadow-pill`. View switches (Week / Month), pay-in token (USDC / SOL), invoice tab (Form / Preview on mobile).

### Inputs
- 40px, `surface` fill, `line-strong` border, 12px radius, 14px side padding, 14px text with tabular figures. Hover darkens the border; focus is a violet border with a 3px 25% ring. Labels are 13px medium ink above; a required mark is violet. Hints in ink-3 and errors in disputed-fg beneath, the error saying what to change.
- **Prefixed input** carries a unit (USD, USDC, RM, %) in flow before the value, so any prefix length fits; the wrapper carries the border and focus ring. **Select** has a chevron. **DateInput** has a calendar mark and uses the native picker. **Textarea** grows. **Checkbox** is 18px with the label in the same tap target.
- **Logo upload:** a dashed `line-strong` box on `well`, the current logo or initials at 56px, one line of copy, an outline Choose file button. Drag-over turns the border violet and floats.

### Avatars and logos
Initials from the name, with legal suffixes (Sdn Bhd, Pty Ltd, LLC, Co.) dropped. The tint is hashed from the name across six soft pairs, so a buyer always looks the same and there is no list to maintain. Circles for people, 8px squares for companies. Sizes 24 / 32 / 40 / 56 / 80. When a logo file exists it replaces the initials at the same size.

### Charts
One hue. Solid violet (a light vertical gradient) where money has landed; a 45° hatch of violet at 70% over an 8% wash where it is still owed; `paper-2` where nothing happened. Marks are labelled; every mark has a hover pill (`TipPill`: white, floating, 12px). Text never wears the data colour.
- **Funnel:** Sent → Seen → Paid → Settled as a stepped area; each column flat then sloping to the next over its last 22%. Stage labels and values above; the emphasised stage solid, the rest hatched.
- **Dot matrix:** one column of 10px dots per period, 8 rows; the peak column solid with a "Peak:" pill, the rest at 35%.
- **Stacked columns:** received solid at the base, outstanding hatched above, a 2px surface gap between; legend always drawn.
- **Meter:** a 10px track with a hatched fill for a limit (swept today of the daily cap). On the hero card the track is `hero-fill` and the hatch white.

### Stepper
Nodes of 32px (24px small) joined by 2px rails. Complete: violet with a check. Current: violet ring on white, pulsing when something is in flight. Upcoming: line ring with the step number in ink-3. Labels beneath at 13px, optional tabular caption (a timestamp). Used for the invoice life on detail and pay pages and for onboarding (Account → Company → Treasury → Agent permissions).

### Dialogs and sheets
A flow that needs the owner's full attention (Sweep now, Cash out, Log a message) opens a native `<dialog>` (`components/ui/dialog.tsx`): a 24px-radius card centred on desktop at up to 34rem, a full-width bottom sheet with rounded top corners on phones, `shadow-float`, a 30% ink backdrop. Title and caption top-left, a round close button top-right, a small `Stepper` under the caption when the flow has stages, primary action bottom-right with Cancel as ghost beside it. Step labels are one or two words ("Quote", "Proposed", "Touch ID", "On Solana") so they fit at 375px; the Stepper wraps labels to two lines rather than cutting them.

### Command bar
A full-round white field with a violet sparkle mark, a placeholder in the user's words, and a round ink submit button. Suggestion chips beneath. Until Session 8c wires `onSubmit` the input is disabled and a caption says so. It sits under the dashboard's KPI row.

### Navigation
- **Desktop:** 248px side rail on the canvas, full height of the page, with the wordmark, the exporter's logo and name, pill nav items (active: white pill with `shadow-pill`, violet icon), a New invoice primary button, and at the bottom the owner's avatar, name and "Owner · passkey" beside the theme toggle. Padding-bottom of 64px keeps the row clear of Next's dev badge.
- **Mobile:** 56px top bar with the wordmark and page title, and a menu button that opens a full-height sheet from the right (`shadow-float`, 16px radius on the leading edge).

### Live moments (signature)
- **Payment landing:** the stepper's rail fills violet over 450ms ease-out as each stage lands; the current node pulses while a payment is being checked. With reduced motion it snaps.
- **Treasury sweep:** the meter's fill grows over 450ms.

### Execution receipt (signature)
A card headed "Payment received" with a settled pill, the ringgit figure at Money LG, then a definition list: paid (token and amount the buyer sent), received (exact USDC with six decimals), quoted, execution vs quote as a signed percentage, network fee ("paid by Kutip · buyer paid 0 SOL"), then a well with the finality time, slot and a Solscan link.

## 6. Do's and Don'ts

### Do:
- **Do** show ringgit first and largest, USD second and smaller, the BNM rate as a caption. Every amount, every screen.
- **Do** set money in the sans at 700 with muted decimals. Use `Amount` and `MoneyFigure`; never hand-roll a figure.
- **Do** keep violet to one primary action per view, links, focus rings, the live fill and the solid chart mark. Black is the second button.
- **Do** give every status a dot and a word. Every chart mark a label and a hover pill.
- **Do** give the agent a reason, a confidence and a rule id in chips: `Rule C2` `91% confidence`.
- **Do** put the on-chain proof in a chip or a well: `Verified on Solana ↗`, `7Xk4…q9Zc`, "View on Solscan" last.
- **Do** ship loading (skeleton on `paper-2`), empty ("No invoices yet. Create your first one.") and error ("Couldn't load invoices. Try again.") states for every data view.
- **Do** respect `prefers-reduced-motion`: the stepper snaps, the pulse stops, nothing else moves anyway.

### Don't:
- **Don't** use a second gradient, a dark full-page theme, glass blur on cards, token logos as decoration, or neon.
- **Don't** put the same shadow and radius on everything: the hero, cards, wells and chips are different sizes on purpose.
- **Don't** use `border-left` thicker than 1px as a coloured stripe on cards, callouts or alerts.
- **Don't** put semantic colour on row backgrounds, borders, icons or headings.
- **Don't** add vanity charts, streaks, badges, "insights" upsells, or numbers on every data point.
- **Don't** use a serif or a monospace face anywhere. Tabular sans does that job.
- **Don't** use `#000`, `#fff`, or an untinted grey.
- **Don't** say "tx confirmed", "finalized", "on-chain", "signature" or "wallet" in a headline. Those words live in chips and captions.
- **Don't** use em dashes in copy. Commas, colons and full stops.
