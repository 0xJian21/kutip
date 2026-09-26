# Product

## Register

product

## Users

**Primary: the finance admin of a Malaysian furniture exporter** (30–80 staff, Muar / Batu Pahat). Sells to buyers in Australia, the US, the Middle East and Japan on 30–60 day terms. Uses the app several times a day at a desk, on a laptop, in an office with fluorescent light. State of mind: checking whether money has arrived and which buyers need chasing. Fluent in bank statements, Excel and Maybank2u. Not a crypto person and does not want to become one.

**Secondary: the owner (the boss).** Opens the dashboard a few times a week, often on a phone, to see one thing: how much came in this month in ringgit, and whether anything is overdue. Approves agent proposals with one tap.

**Tertiary: the overseas buyer.** Receives a pay link, opens it on a phone, scans a QR with their wallet. Wants to pay and leave. May be an accounts-payable bot rather than a person.

**Judges** at Colosseum / Superteam MY will scan the pay page QR on their own phones during the demo.

## Product Purpose

Kutip (Malay: *to collect*) is an AI collections and settlement agent. It chases a Malaysian exporter's overseas invoices, knows the second the money lands on Solana, and settles it into the exporter's own treasury within rules the owner sets, without ever holding the keys.

Success for the user: they trust the numbers on the screen the way they trust a bank statement. They know instantly what came in, what is late, and what the agent did on their behalf and why. The buyer pays in one scan with no gas fee. The blockchain is an audit trail detail, never the headline.

## Brand Personality

Calm, precise, accountable.

Voice: a careful bookkeeper, not a startup. Plain English, sentence case, short sentences. Numbers first, explanations second. The agent explains itself in one line with a reason and a rule it followed. Never hype, never jargon.

Emotional goal: relief. "It's handled, and I can see exactly how."

## Anti-references

- Crypto app aesthetics: neon on black, purple gradients, glassmorphism, glowing cards, wallet-address-as-headline, "tx confirmed" language, token logos everywhere.
- Generic SaaS template look: identical rounded cards in a grid with the same soft grey shadow, hero-metric tiles with gradient accents, emoji icons, tracked-out ALL-CAPS eyebrow labels.
- Batik or wau clip-art as a "Malaysian touch".
- Dense fintech dashboards that show every metric at once.

## Design Principles

1. **Numbers are the hero.** Amounts are the largest, best-aligned thing on any screen. Ringgit first, USD/USDC second and smaller. Everything else supports the figure.
2. **Bank statement, not block explorer.** Every screen should feel like a document the user already trusts. Chain details (addresses, signatures, Solscan) are present for audit but visually secondary.
3. **Say what happened, in plain English.** "Payment received", not "tx confirmed". "Waiting for payment", not "pending". The agent always gives its reason, its confidence and the rule it followed.
4. **Status is the only place colour talks.** One accent for actions; semantic colour is reserved for invoice and agent status so a glance at a list tells the whole story.
5. **Calm by default, alive at the moment that matters.** The one orchestrated moment is the payment landing: seen → paid → settled. Everything else is still.

## Accessibility & Inclusion

- WCAG 2.2 AA contrast for text and status pills in both light and dark themes.
- Visible keyboard focus on every interactive element.
- `prefers-reduced-motion` respected: the status animation collapses to instant state changes.
- Status never conveyed by colour alone: every pill has a text label.
- The buyer pay page must be fully usable at 375px width, one-handed, in bright daylight (high contrast, large tap targets).
- Dates shown with explicit timezone where ambiguity matters (buyer local vs MYT).
