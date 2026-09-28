# Demo-day rehearsal (Oct 4)

A minute-by-minute checklist for the live mainnet demo on **https://kutip-app.vercel.app**. It combines SPEC §7 (2 min), the command-bar scene (~45 s) and the buyer-message scene (~60 s), about 3 min 40 s on stage. Every step has the expected result and what to do if it fails. The results of the 8d walk-through are at the end.

People and devices:
- **Laptop (owner):** Safari (Touch ID straight away; Chrome shows a passkey picker first, pick iCloud Keychain), signed in as the production owner (wallet `88YzFSPH…maWJZ`).
- **Phone (buyer):** Solflare (`GSKNT5Pw…k32e`), with the pay link open.
- **Terminal:** repo root, `.env` present, for the x402 bot and the fallbacks.

## T−60 min: pre-flight

| # | Check | Command / where | Pass when | If not |
|---|---|---|---|---|
| P1 | Fee payer SOL | `pnpm --filter @kutip/spikes exec tsx balances.ts` (or Solscan `BGs4mRFb…yr7L`) | **≥ 0.1 SOL** | Send SOL to `BGs4mRFbyXRhfAwNa94cTdeaRASmg9mGSXWWiJaQyr7L`. Under 0.02 SOL, onboarding pauses; under 0.01, the worker raises a T4 alert |
| P2 | Solflare funded | Solflare app | ≥ 0.02 SOL (the USD 1 invoice paid in SOL costs ≈ 0.009 SOL at $120) and ≥ 1 USDC for the USDC fallback | Top up from an exchange; the Jupiter swap needs the SOL |
| P3 | Test buyer (x402 bot) USDC | Solscan `8pkfjBaM…LNq` token balance | ≥ 0.50 USDC | Send USDC to its ATA `25qmoi…yKUr` |
| P4 | Worker healthy | `fly status -a kutip-worker` then `fly logs -a kutip-worker --no-tail \| tail -20` | 1 machine `started`, check passing, recent `stream` lines | `fly machine restart <id> -a kutip-worker`; fallback F4 below |
| P5 | Web up | open https://kutip-app.vercel.app | landing loads < 2 s | `vercel logs kutip-app.vercel.app` |
| P6 | Reset the demo data | `APP_URL=https://kutip-app.vercel.app pnpm --filter @kutip/scripts exec tsx demo-reset.ts --warm GSKNT5PwGNr6Anzq8FoswdKmTeeSGqA9QyDBLuZsk32e --yes` | prints `INV-2026-0154` (USD 1, human) and `INV-2026-0155` (USD 0.50, bot) with pay links; Solflare "already screened (pass)" or screened in < 40 s | Re-run: one transaction, safe to repeat. **Never run it once the rehearsal has started** (new invoice ids) |
| P7 | Write down the ids | from P6 | `INV-0154 = inv_…`, `INV-0155 = inv_…` | — |
| P8 | Owner signed in | laptop Safari → `/onboarding` (Sign in) → passkey | lands on `/dashboard`, hero "Live on Solana mainnet · demo funds" | Sign out from the rail, sign in again; check the Privy user is the production owner |
| P9 | Touch ID for money | Settings → Agent permissions | card "Touch ID for money" shows **On** | "Require Touch ID for approvals" there (passkey MFA). Set the Privy dashboard MFA cache window to the minimum so every approval prompts |
| P10 | Collections mode | `fly.toml` `COLLECTIONS = "on"` (deployed) | `on`: the receipt email and cancelled reminders are part of step 7 | If reminders would be embarrassing mid-demo: `fly secrets set COLLECTIONS=dry -a kutip-worker` (restarts the machine) |
| P11 | Reply mode | Settings → Agent permissions → Replies | **Draft — I approve** (shows the human in the loop) | — |
| P12 | Phone ready | Solflare open; Safari on the phone at `https://kutip-app.vercel.app/pay/<INV-0154 id>`, not yet paid | invoice document + "Confirm & pay" | — |
| P13 | Terminal ready | `pnpm --filter @kutip/solana bot https://kutip-app.vercel.app/api/x402/invoice/<INV-0155 id>` (**dry run**, no `--yes`) | prints 402 requirements, amount 500000 | Check the id; the bot reads `TEST_BUYER_SECRET` from `.env` |
| P14 | Backups open | the rehearsal screen recording (phone + laptop) on the laptop desktop; screenshots in `docs/screenshots/` | one click away | — |
| P15 | Stage PDF | `packages/agent/fixtures/invoices/demo-harbourline-inv-0161-usd1.pdf` on the desktop | USD 1 (mainnet test cap) | `demo-harbourline-inv-0160.pdf` is USD 50: only if the SPEC's number matters more than the cap |

Warm-up (T−10 min): open `/dashboard`, `/inbox`, `/agent` once each, so the first clicks on stage don't cold-start a function and Realtime has a live client (a Realtime partition only exists once a client has connected recently).

## On stage

| Time | Step | Do | Expected | If it fails |
|---|---|---|---|---|
| 0:00 | 1. Sign in | Laptop: "Sign in" → Touch ID | Dashboard in ~2 s: overdue invoices, treasury in MYR, command bar | Already signed in from P8: just show the dashboard |
| 0:15 | 2. PDF → invoice | New invoice → drop the USD 1 PDF | fields filled in ~4 s (Haiku), live preview; "Create & send" gives a pay link + QR; invoice email sent | Type the lines by hand (Harbourline, 1 × USD 1). Or skip and use `INV-2026-0154` from P6 |
| 0:30 | 3. Reminder + rulebook | Invoice detail of an overdue invoice → the agent's drafted reminder; then Rulebook | reminder text, rule ids (C1–C7) | screenshot `docs/screenshots/rulebook-*` |
| 0:40 | 4. Buyer pays in SOL | Phone: pay page → Confirm & pay → SOL → Open in wallet → Solflare approve | Solflare shows **0 SOL network fee** paid by Kutip, USDC 1.00 to the exporter | "Blockhash not found": tap again (the tx is rebuilt). Jupiter error: switch the toggle to USDC. Wallet won't open: scan the QR with Solflare's scanner |
| 0:45 | 5. Live flip | Laptop invoice page | Seen → Paid (+~0.2 s) → Settled (+~8 s), no refresh | Refresh the page (Realtime dropped; the data is there). No Seen within 10 s: F4 |
| 0:55 | 6. Receipt | Execution receipt card | exact USDC received, SOL spent, effective rate vs BNM, Solscan link | Open the Solscan link from the phone's Solflare history |
| 1:10 | 7. Collections stop | Agent activity | "cancelled reminders" (C6) + receipt email in the inbox (~4 s after Paid) | Show the C6 action; the email is a bonus |
| 1:20 | 8. Buyer message (~60 s) | Phone, pay page of `INV-2026-0155` (unpaid): type "Hi, can you resend the invoice? Our AP team needs a copy." → Send | appears in the phone thread at once | Rate limited (5/hour/invoice): use `INV-2026-0154`'s page |
| 1:30 |  | Laptop: `/inbox` | the thread jumps to the top (Realtime), intent chip "question", "Draft ready" within ~5 s | Refresh `/inbox`; the classify + draft runs after the response, ~3–8 s |
| 1:45 |  | Open the thread → agent's draft → edit a word → **Approve & send** | "Agent on this thread: C7 · approved by you" | Redraft once; if Haiku is down, type the reply and send |
| 2:05 |  | Phone: the reply appears under the buyer's message | seller bubble, no refresh | Pull to refresh |
| 2:20 | 9. AP bot (x402) | Terminal: the P13 command **with `--yes`** | HTTP 402 → 200 in ~3–5 s, receipt JSON with the Solscan link; `INV-0155` flips Paid on the laptop | Settle failed: run again once (the 10-minute cooldown only applies after an on-chain failure). Else show the rehearsal's signature |
| 2:40 | 10. Command bar (~45 s) | Dashboard command bar: "What's due this week?" | list with amounts from code, ~2 s | Click the chip instead of typing |
| 2:55 |  | "Remind Najd about INV-0141" (or any overdue one from the list) | reminder preview (tone, text); **Send** | Say "nothing moves until I press Send", don't press it |
| 3:10 |  | "Sweep now" → dialog → Sweep | preview (accounts, amounts, T2 cap, fee paid by Kutip) → stepper Checked → Signed by agent → On Solana → Recorded; Agent activity shows the sweep with reason | Nothing to sweep (vaults empty): the dialog says so; show the rehearsal's sweep signature |
| 3:25 | 11. (optional) Cash out | Treasury → Cash out 0.25 USDC → Propose → **Approve with Touch ID** | proposal # → Touch ID → executed; treasury −0.25 | Only one open proposal at a time: approve or reject the old one first |
| 3:30 | 12. Close | — | "Bank wire: 3 days, ~RM150. Kutip: 1 second, < RM0.05." | — |

## Fallbacks

- **F1 Screen recording:** play the rehearsal recording of the step that failed, then go back to live at the next step.
- **F2 Screenshots:** `docs/screenshots/` covers dashboard, invoices, invoice detail, agent log and rulebook (light/dark, desktop/mobile).
- **F3 Web down:** `pnpm --filter web dev` locally plus `cloudflared tunnel --url http://localhost:3000`. Passkeys are domain-bound, so the laptop signs in with the **localhost** passkey (legacy treasury `GD5F…`) only on `http://localhost:3100` (the Privy allowed origin). Use `PORT=3100 pnpm --filter web dev`.
- **F4 Worker down (no Seen / Paid):** first `fly machine restart`. Otherwise run the worker locally: `fly scale count 0 -a kutip-worker` (**never two workers**: Solami allows 2 streams and both would record), then `pnpm --filter @kutip/worker dev`. Catch-up picks up anything paid meanwhile within 3 minutes (startup runs it immediately). Afterwards stop the local worker and `fly scale count 1 -a kutip-worker`.
- **F5 LLM slow or down:** the command bar and drafts fall back to a holding text; say "the agent drafts, the rules engine decides" and type the reply yourself.
- **F6 Touch ID doesn't prompt:** the MFA cache window is open (it prompted a few minutes ago). Approve anyway; say it prompts on every approval outside that window.

## After the demo

- `fly scale memory 256 -a kutip-worker` (cheaper), and keep one machine.
- Leave the data as it is for judges; `demo-reset` again only before another live run.

## 8d walk-through results

Filled in during the production walk-through with the owner (phone = Solflare).

| Step | Signature | Timing | Notes |
|---|---|---|---|
| _pending_ | | | |
