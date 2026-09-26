---
name: Kutip
description: Calm ledger. Cream paper, teal stamp ink, numbers that behave.
colors:
  paper: "oklch(97.5% 0.008 85)"
  paper-2: "oklch(95% 0.01 85)"
  surface: "oklch(99.2% 0.004 85)"
  ink: "oklch(23% 0.015 70)"
  ink-2: "oklch(46% 0.012 70)"
  ink-3: "oklch(54% 0.01 70)"
  line: "oklch(88% 0.01 80)"
  line-strong: "oklch(78% 0.012 80)"
  accent: "oklch(44% 0.085 195)"
  accent-hover: "oklch(38% 0.085 195)"
  accent-soft: "oklch(93% 0.03 195)"
  on-accent: "oklch(97.5% 0.008 85)"
  seen-fg: "oklch(44% 0.12 255)"
  seen-bg: "oklch(93% 0.03 255)"
  paid-fg: "oklch(42% 0.11 150)"
  paid-bg: "oklch(93% 0.05 150)"
  settled-bg: "oklch(44% 0.12 150)"
  settled-fg: "oklch(97.5% 0.008 85)"
  overdue-fg: "oklch(46% 0.15 35)"
  overdue-bg: "oklch(94% 0.04 35)"
  disputed-fg: "oklch(44% 0.16 20)"
  disputed-bg: "oklch(94% 0.04 20)"
  partial-fg: "oklch(46% 0.12 70)"
  partial-bg: "oklch(94% 0.05 70)"
typography:
  money-xl:
    fontFamily: "Source Serif 4, Georgia, serif"
    fontSize: "3.5rem"
    fontWeight: 500
    lineHeight: 1.07
    letterSpacing: "-0.01em"
    fontFeature: "tnum, lnum"
  money-lg:
    fontFamily: "Source Serif 4, Georgia, serif"
    fontSize: "2.5rem"
    fontWeight: 500
    lineHeight: 1.1
    fontFeature: "tnum, lnum"
  headline:
    fontFamily: "Plus Jakarta Sans, system-ui, sans-serif"
    fontSize: "1.75rem"
    fontWeight: 600
    lineHeight: 1.14
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Plus Jakarta Sans, system-ui, sans-serif"
    fontSize: "1.375rem"
    fontWeight: 600
    lineHeight: 1.27
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
    fontFeature: "tnum"
  label:
    fontFamily: "Plus Jakarta Sans, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 500
    lineHeight: 1.38
rounded:
  sm: "4px"
  md: "8px"
  lg: "12px"
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
    rounded: "{rounded.sm}"
    height: "36px"
    padding: "0 16px"
  button-primary-hover:
    backgroundColor: "{colors.accent-hover}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    height: "36px"
    padding: "0 16px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.sm}"
    height: "36px"
    padding: "0 12px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    height: "36px"
    padding: "0 12px"
  status-pill:
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    height: "24px"
    padding: "0 10px"
  panel:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.md}"
    padding: "20px 24px"
---

# Design System: Kutip

## 1. Overview

**Creative North Star: "The Calm Ledger"**

Kutip is read by a finance admin in Muar who trusts two documents: the bank statement and the ledger. This system borrows their calm. Cream paper, dark warm ink, hairline rules, and figures that line up. The only colour that speaks freely is a single teal, the ink of a rubber stamp on a bank slip, taken from the RM50 note. Every other colour is semantic and appears only on a status pill.

Numbers are the hero. Amounts are the largest thing on any screen, set in a serif reserved for money and nothing else. Ringgit comes first and large; USD/USDC second and small; the Bank Negara reference rate is a quiet footnote. Wallet addresses, signatures and Solscan links exist for the audit trail and sit in the smallest type on the page.

The system explicitly rejects crypto app aesthetics (neon on black, purple gradients, glassmorphism, glowing cards, token logos), the generic SaaS template look (identical rounded card grids with the same grey shadow, hero-metric tiles, emoji icons, tracked-out ALL-CAPS eyebrows), and batik clip-art as a "Malaysian touch". The Malaysian touch here is quieter: the RM50 teal, the ringgit-first figures, Malaysian date formatting (3 Oct 2026), MYT timestamps, and a Nusantara-designed typeface.

**Key Characteristics:**
- Paper and ink, in two themes: cream by day, warm charcoal by night. Never pure white or pure black.
- One accent (teal) for actions, links, selection and focus. Never decoration.
- Semantic colour only on status. Every pill also carries a word.
- Serif for money, sans for everything else. Tabular figures everywhere a number appears.
- Flat surfaces separated by hairlines and tonal steps. One shadow, for things that float.
- Still by default. One orchestrated moment: the payment landing (Sent → Seen → Paid → Settled).

Layout: left-aligned, predictable app shell (side nav on desktop, top bar with a sheet on mobile), content column up to 1100px. Amounts always right-aligned in tables. Dense where the user works (invoice list), spacious where they read (dashboard, receipt). Public pay page is a single column built for a 375px phone first.

## 2. Colors: The Ledger Palette

Warm neutrals tinted toward paper, one teal accent, and six semantic pairs that only ever appear on status.

### Primary
- **RM50 Teal** (`accent`, oklch(44% 0.085 195), ≈ #006161): primary buttons, links, focus rings, the active nav item, the live status bar fill. In dark mode it lifts to oklch(74% 0.1 195) with near-black text on it. The colour of the ink stamp on a bank slip; it appears on well under a tenth of any screen.
- **Teal Wash** (`accent-soft`, oklch(93% 0.03 195)): selected rows, highlighted fields, the spacing swatches. Never as a page background.

### Neutral
- **Ledger Paper** (`paper`, oklch(97.5% 0.008 85)): page background. Dark: oklch(17% 0.01 70).
- **Paper 2** (`paper-2`, oklch(95% 0.01 85)): sidebar, table headers, quiet fills, hover rows. Dark: oklch(20% 0.01 70).
- **Surface** (`surface`, oklch(99.2% 0.004 85)): panels and table bodies that sit on paper. Dark: oklch(22.5% 0.01 70).
- **Ink** (`ink`, oklch(23% 0.015 70)): all primary text. Warm, not tinted-black. Dark: oklch(92% 0.01 85).
- **Ink 2** (`ink-2`, oklch(46% 0.012 70)): secondary text, labels, USD lines. 6.6:1 on paper.
- **Ink 3** (`ink-3`, oklch(54% 0.01 70)): timestamps, hints, placeholders. 4.6:1 on paper; never for body copy.
- **Line / Line strong** (`line` oklch(88% 0.01 80), `line-strong` oklch(78% 0.012 80)): hairline dividers; input and secondary-button borders.

### Semantic (status only)
| Status | Pair | Meaning shown to the user |
|---|---|---|
| draft | paper-2 / ink-2 with a line ring | Not sent to the buyer yet |
| sent | paper-2 / ink-2 | Waiting for payment |
| seen | seen-bg / seen-fg (blue) | A payment has appeared and is being checked |
| paid | paid-bg / paid-fg (green tint) | Payment received |
| settled | settled-bg solid / settled-fg (green solid) | Payment final and in your treasury |
| partially_paid | partial-bg / partial-fg (amber) | Some of the amount has been received |
| overdue | overdue-bg / overdue-fg (red-orange) | Past its due date and unpaid |
| disputed | disputed-bg / disputed-fg (red) | The buyer raised a problem; needs you |

Agent actions reuse the same pairs: proposed = amber, approved = blue, executed = green tint, escalated = red-orange, rejected = neutral.

All pairs are ≥ 6:1 in both themes. Verified values live in `apps/web/app/globals.css`.

### Named Rules
**The Stamp Rule.** Teal is a stamp, not a paint. It marks the one thing to press and the one thing that is live. If a screen has two teal buttons, one of them is wrong.

**The Pill Rule.** Semantic colour appears only inside a status pill or on a due date that has passed. Never on row backgrounds, borders, icons or headings. A colour-blind reader loses nothing because every pill carries its word.

**The No-Pure Rule.** No `#000`, no `#fff`. Every neutral carries a trace of paper (chroma 0.004 to 0.015, hue 70 to 85).

## 3. Typography

**Money Font:** Source Serif 4 (with Georgia), optical size axis on, weight 500
**UI and Body Font:** Plus Jakarta Sans (with system-ui), variable weight 400 to 700
**Label/Mono Font:** none. Addresses and signatures use the sans with tabular figures, truncated `7Xk4…q9Zc`.

**Character:** A sturdy humanist sans for everything you read, and a serif that appears only when money is stated. The serif figures are what the boss remembers; the sans keeps the rest of the screen honest and quiet. Plus Jakarta Sans was drawn in Jakarta; it is the region's own face, and the closest thing to a Malaysian voice a Google Font offers.

### Hierarchy
- **Money XL** (serif 500, 56/60, −0.01em, tnum): the single hero figure on the dashboard, invoice detail and pay page. Dashboard "received this month".
- **Money LG** (serif 500, 40/44, tnum): secondary figures (outstanding, overdue, treasury balance) and the invoice amount on detail pages.
- **Money MD** (serif 500, 24/28, tnum): figures inside receipts and treasury account rows.
- **Headline** (sans 600, 28/32, −0.01em): page titles. One per page.
- **Title** (sans 600, 22/28): section titles.
- **Panel title** (sans 500, 18/26): panel and card headings.
- **Body** (sans 400, 16/24): prose on landing, onboarding, agent reasons, receipts. Max 65ch.
- **UI** (sans 400, 14/20, tnum): tables, forms, navigation, list rows. Tables may run wide.
- **Label** (sans 500, 13/18): pill text, meta, timestamps, form labels. Sentence case, never tracked-out caps.
- **Caption** (sans 400, 12/16): footnotes such as "at BNM reference rate 4.2150", addresses, signatures.

### Named Rules
**The Serif-Means-Money Rule.** Source Serif 4 is used only for amounts. A serif heading anywhere in the product is a bug.

**The Tabular Rule.** Every digit in the product is tabular and lining (`tnum`, `lnum`). Columns of amounts, times and invoice numbers must align without effort.

**The Ringgit-First Rule.** Money is shown as `RM48,211.40` first and largest, then `11,437.50 USD` smaller, then the rate as a caption. USDC is named only where the token itself matters (receipts, treasury, accepted tokens on the pay page).

## 4. Elevation

Flat by default. Depth comes from three tonal steps (paper → paper-2 → surface) and hairlines, not shadows. Panels are `surface` with a 1px `line` border on `paper`. Table headers and the sidebar are `paper-2`. The eye reads the page like a printed statement: everything on one plane.

### Shadow Vocabulary
- **Float** (`box-shadow: 0 8px 24px oklch(20% 0.02 70 / 0.14), 0 1px 2px oklch(20% 0.02 70 / 0.08)`): menus, popovers, the mobile navigation sheet, the drag-over state of the PDF drop zone. Nothing that sits in the page flow.

### Named Rules
**The One-Plane Rule.** If a thing does not float above the page, it has no shadow. Cards at rest never have shadows. Hover on a row is a `paper-2` tint, not a lift.

## 5. Components

One button shape, one input shape, one pill shape, everywhere.

### Buttons
- **Shape:** softly squared (4px radius), 36px tall, 14px medium text, 16px side padding.
- **Primary:** teal fill with paper text. One per view: the thing to do next ("Create invoice", "Approve", "Open in wallet").
- **Secondary:** surface fill, `line-strong` 1px border, ink text. Hover tints to `paper-2`.
- **Ghost:** no fill, `ink-2` text, 12px side padding. Hover tints to `paper-2` and darkens text to ink. Used for "Reject", "Cancel", table row actions.
- **Focus:** 2px teal outline, 2px offset, on every button and link. Transitions 150ms ease-out on colour only.
- **Disabled:** 50% opacity, no hover change. **Loading:** label swaps to a plain verb-ing ("Approving…"), button stays the same width.
- **Links:** teal, medium weight, underline on hover with 4px offset. Solscan links are links, never buttons.

### Status pills
- **Style:** 24px tall, fully rounded, 13px medium sentence-case text, 10px side padding. Tinted background with a dark foreground of the same hue; `settled` alone is a solid fill because it is the end state.
- **Behaviour:** a `title` carries the one-line meaning. Pills never truncate.

### Panels
- **Corner style:** 8px radius. Pay page and mobile sheets use 12px.
- **Background:** `surface` on `paper`, 1px `line` border, no shadow.
- **Internal padding:** 20px vertical, 24px horizontal on desktop; 16px on mobile.
- **Use:** a panel groups one idea (a money figure, a receipt, a buyer's messages). Never nest a panel in a panel. Lists inside panels are divided by hairlines, not more panels.

### Tables and rows
- **Header:** `paper-2` background, 13px `ink-2` medium text, left-aligned except amounts.
- **Rows:** 12px vertical padding, hairline dividers, hover `paper-2` at 60%. Amounts right-aligned, MYR bold on top and USD small beneath. Overdue rows show the due date in `overdue-fg` medium; the rest of the row stays ink.
- **Mobile:** tables under 640px become stacked rows: buyer and invoice number on the left, amount and pill on the right.

### Inputs
- **Style:** 36px tall, `surface` fill, `line-strong` 1px border, 4px radius, 12px side padding, 14px text with tabular figures. Labels are 13px `ink-2` above the field.
- **Focus:** border becomes teal plus a 2px teal ring at 30%.
- **Error:** border `disputed-fg`, 13px message beneath in `disputed-fg` that says what to change ("Enter an amount above 0"). **Disabled:** `paper-2` fill, `ink-3` text.

### Navigation
- **Desktop:** 232px side rail in `paper-2`, 14px items, active item ink text on `surface` with a 2px teal mark on the left edge inside the rail (a bookmark tab, not a stripe on content). Exporter name at top, theme toggle and owner at bottom.
- **Mobile:** 56px top bar with the page title and a menu button that opens a full-height sheet from the right (float shadow). Bottom of the sheet holds the theme toggle.

### Live status bar (signature)
Four segments, Sent → Payment seen → Paid → Settled, each a 6px rounded track with a label and a tabular timestamp beneath. A segment fills teal over 450ms ease-out as its stage lands. The payment moment is the only choreographed motion in the product; with reduced motion it snaps.

### Execution receipt (signature)
A panel headed "Payment received" with a definition list: paid (token and amount the buyer sent), received (exact USDC with all six decimals), quoted, effective rate vs BNM rate as a signed percentage, network fee ("paid by Kutip, RM0.00 to the buyer"), then a caption row: signature truncated, "View on Solscan" link, and the finality time.

## 6. Do's and Don'ts

### Do:
- **Do** show ringgit first and largest, USD second and smaller, the BNM rate as a caption. Every amount, every screen.
- **Do** use the serif (Source Serif 4, weight 500) only for money figures, and tabular lining figures on every number.
- **Do** keep teal (oklch(44% 0.085 195)) to one primary action per view, links, focus rings and the live status fill.
- **Do** write status in plain English: "Payment received", "Waiting for payment", "Settled". Every pill carries its word.
- **Do** give the agent a reason, a confidence and a rule id in one line: "Sent reminder 2 of 3 · rule C2 · 0.91".
- **Do** shorten addresses to `7Xk4…q9Zc` in caption size, and put chain links last, as "View on Solscan".
- **Do** ship loading (skeleton in `paper-2`), empty ("No invoices yet. Create your first one.") and error ("Couldn't load invoices. Try again.") states for every data view.
- **Do** respect `prefers-reduced-motion`: the status bar snaps, nothing else moves anyway.

### Don't:
- **Don't** use crypto app aesthetics: neon on black, purple gradients, glassmorphism, glowing cards, token logos as decoration.
- **Don't** build the generic SaaS template look: identical rounded cards in a grid with the same soft grey shadow, hero-metric tiles with gradient accents, emoji icons, tracked-out ALL-CAPS eyebrow labels.
- **Don't** add batik, wau or hibiscus clip-art as a "Malaysian touch".
- **Don't** say "tx confirmed", "finalized", "on-chain", "signature" or "wallet" in a headline. Those words live in captions and the audit trail.
- **Don't** use `#000`, `#fff`, or an untinted grey anywhere.
- **Don't** put semantic colour on row backgrounds, borders, icons or headings. Status colour lives in the pill and on a passed due date only.
- **Don't** use `border-left` thicker than 1px as a coloured stripe on cards, callouts or alerts.
- **Don't** put a shadow on anything that sits in the page. Only menus, sheets and the drag-over drop zone float.
- **Don't** animate anything except the payment landing and 150 to 250ms colour transitions on hover and focus.
- **Don't** use a monospace face for data, addresses or labels. Tabular sans does that job.
- **Don't** use em dashes in copy. Commas, colons and full stops.
