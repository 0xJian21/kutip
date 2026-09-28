# Demo-day rehearsal (Oct 4)

A minute-by-minute checklist for the live mainnet demo on **https://kutip-app.vercel.app**. It combines SPEC §7 (2 min), the command-bar scene (~45 s) and the buyer-message scene (~60 s), about 3 min 40 s on stage. Every step has the expected result and what to do if it fails. The results of the 8d walk-through are at the end.

People and devices:
- **Laptop (owner):** Safari (Touch ID straight away; Chrome shows a passkey picker first, pick iCloud Keychain), signed in as the production owner (wallet `88YzFSPH…maWJZ`).
- **Phone (buyer):** **Phantom** (`D7Z7exgV…AxYR`), with the pay link open. **Not Solflare:** on 2026-09-29 Solflare showed "Scam site detected" for `kutip-app.vercel.app` and hard-blocked the transaction (a blocklist false positive on the domain; it worked on Sep 27). Report it (Blowfish blocklist issue + report.blockaid.io) and re-test Solflare before Oct 4; until it is delisted, Phantom is the wallet on stage.
- **Terminal:** repo root, `.env` present, for the x402 bot and the fallbacks.

## T−60 min: pre-flight

| # | Check | Command / where | Pass when | If not |
|---|---|---|---|---|
| P1 | Fee payer SOL | `pnpm --filter @kutip/spikes exec tsx balances.ts` (or Solscan `BGs4mRFb…yr7L`) | **≥ 0.1 SOL** | Send SOL to `BGs4mRFbyXRhfAwNa94cTdeaRASmg9mGSXWWiJaQyr7L`. Under 0.02 SOL, onboarding pauses; under 0.01, the worker raises a T4 alert |
| P2 | Phantom funded | Phantom app | ≥ 0.02 SOL (the USD 1 invoice paid in SOL cost 0.0084 SOL on Sep 29) and ≥ 1 USDC for the USDC fallback | Top up; the Jupiter swap needs the SOL. Solflare (`GSKN…`) holds 2.40 USDC as a reserve |
| P3 | Test buyer (x402 bot) USDC | Solscan `8pkfjBaM…LNq` token balance | ≥ 0.50 USDC (**0 after the Sep 29 rehearsal**: top it up) | Send USDC to `8pkfjBaMRU3sMSbDKYcUQ2kKiwM6QiXRzwSXsfVZwLNq` (its USDC account exists) |
| P4 | Worker healthy | `fly status -a kutip-worker` then `fly logs -a kutip-worker --no-tail \| tail -20` | 1 machine `started`, check passing, recent `stream` lines | `fly machine restart <id> -a kutip-worker`; fallback F4 below |
| P5 | Web up | open https://kutip-app.vercel.app | landing loads < 2 s | `vercel logs kutip-app.vercel.app` |
| P6 | Reset the demo data | `APP_URL=https://kutip-app.vercel.app pnpm --filter @kutip/scripts exec tsx demo-reset.ts --warm D7Z7exgV9xCAWEBgBKRAUrXYug135D8ADYL6QZJ9AxYR,8pkfjBaMRU3sMSbDKYcUQ2kKiwM6QiXRzwSXsfVZwLNq --cashout GSKNT5PwGNr6Anzq8FoswdKmTeeSGqA9QyDBLuZsk32e --yes` (Phantom + the x402 bot wallet; cash-outs land in your Solflare, standing in for HATA) | prints `INV-2026-0154` (USD 1, human) and `INV-2026-0155` (USD 0.50, bot) with pay links; both wallets "already screened (pass)" or "screened: pass" (Solflare's long history takes 30–40 s and Solami sometimes times out; the script tries 3 times). "flag … could not be screened" doesn't block the wallet, but its first payment then waits 2.5 s and passes provisionally. Any other `flag` blocks that wallet: read the reasons | Re-run: one transaction, safe to repeat. **Never run it once the rehearsal has started** (new invoice ids) |
| P7 | Write down the ids | from P6 | `INV-0154 = inv_…`, `INV-0155 = inv_…` | — |
| P8 | Owner signed in | laptop Safari → `/onboarding` (Sign in) → passkey | lands on `/dashboard`, hero "Live on Solana mainnet · demo funds" | Sign out from the rail, sign in again; check the Privy user is the production owner |
| P9 | Touch ID for money | Settings → Agent permissions | card "Touch ID for money" shows **On** | "Require Touch ID for approvals" there (passkey MFA). Set the Privy dashboard MFA cache window to the minimum so every approval prompts |
| P10 | Collections mode | `fly.toml` `COLLECTIONS = "on"` (deployed) | `on`: the receipt email and cancelled reminders are part of step 7 | If reminders would be embarrassing mid-demo: `fly secrets set COLLECTIONS=dry -a kutip-worker` (restarts the machine) |
| P11 | Reply mode | Settings → Agent permissions → Replies | **Draft — I approve** (shows the human in the loop) | — |
| P12 | Phone ready | Solflare open; Safari on the phone at `https://kutip-app.vercel.app/pay/<INV-0154 id>`, not yet paid | invoice document + "Confirm & pay" | — |
| P13 | Terminal ready | `pnpm --filter @kutip/solana bot https://kutip-app.vercel.app/api/x402/invoice/<INV-0155 id>` (**dry run**, no `--yes`) | prints 402 requirements, amount 500000 | Check the id; the bot reads `TEST_BUYER_SECRET` from `.env` |
| P14 | Backups open | the rehearsal screen recording (phone + laptop) on the laptop desktop; screenshots in `docs/screenshots/` | one click away | — |
| P15 | Stage PDF | `packages/agent/fixtures/invoices/demo-harbourline-inv-0161-usd1.pdf` on the desktop | USD 1 (mainnet test cap) | `demo-harbourline-inv-0160.pdf` is USD 50: only if the SPEC's number matters more than the cap |

Warm-up (T−10 min): open `/dashboard`, `/inbox`, `/agent` once each and ask the command bar one question (the first answer took ~10 s in the Sep 29 rehearsal), so the first clicks on stage don't cold-start a function and Realtime has a live client (a Realtime partition only exists once a client has connected recently).

## On stage

| Time | Step | Do | Expected | If it fails |
|---|---|---|---|---|
| 0:00 | 1. Sign in | Laptop: "Sign in" → Touch ID | Dashboard in ~2 s: overdue invoices, treasury in MYR, command bar | Already signed in from P8: just show the dashboard |
| 0:15 | 2. PDF → invoice | New invoice → drop the USD 1 PDF | fields filled in ~4 s (Haiku), live preview; "Create & send" gives a pay link + QR; invoice email sent | Type the lines by hand (Harbourline, 1 × USD 1). Or skip and use `INV-2026-0154` from P6 |
| 0:30 | 3. Reminder + rulebook | Invoice detail of an overdue invoice → the agent's drafted reminder; then Rulebook | reminder text, rule ids (C1–C7) | screenshot `docs/screenshots/rulebook-*` |
| 0:40 | 4. Buyer pays in SOL | Phone: pay page → Confirm & pay → SOL → Open in wallet → Phantom approve | Phantom shows **0 SOL network fee** paid by Kutip, USDC 1.00 to the exporter | "Blockhash not found": tap again (the tx is rebuilt). Jupiter error: switch the toggle to USDC. Wallet won't open: scan the QR with Phantom's scanner. "Scam site" warning: switch wallet (see People and devices) |
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
| 3:25 | 11. (optional) Cash out | Treasury → Cash out **0.25** USDC (check the amount field; the Sep 29 run proposed the whole 1.5 USDC) → Propose → **Approve with Touch ID** | proposal # → Touch ID → executed; treasury −0.25 | Only one open proposal at a time: approve or reject the old one first |
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

Walked on 2026-09-29 (MYT 02:40–03:00) against production (`main` at `6f0bcdf`; the 8d fixes were not deployed yet), laptop Safari + phone.

| Step | Signature | Timing | Notes |
|---|---|---|---|
| P6 demo-reset | — | 55 s | one transaction; INV-0154 `inv_yx7kanQd1nAeBCru762w`, INV-0155 `inv_FkwXn3Ho8a3Z4DNqJEGQ`. Solflare warm-up hit "could not be screened" (Solami history paging timed out at ~40 s, twice); passed on the 3rd try (33 s). demo-reset now retries 3× |
| 4 Phone pays INV-0154 in SOL | `5GDG5XPL8cJwDPJTvvqbgnKcL5SThS9t5GgVDYeVh6fQFgTHJxayc7KqM84KZwBy75by2jBcfdAsA8HHvtjv3AMV` | — | **Solflare: "Scam site detected", blocked.** Paid with Phantom (`D7Z7…`): 0.008360965 SOL → exactly 1.000000 USDC, network fee 0 (Kutip) |
| 5 Live flip | same | Seen → **Paid +153 ms** → **Settled +7.86 s** | laptop flipped live, no refresh |
| 6–7 Receipt, C6, email | — | receipt email +2.9 s after Paid | receipt card, C6 "cancelled reminders", email in the inbox |
| 8 Buyer message → draft → approve | — | draft ready **4.2 s** after the message; reply showed on the phone "very fast" | classified `question` (1.00), logged C4 (hand to owner) → draft; approved & sent → C7 with approver |
| 9 x402 bot pays INV-0155 0.50 USDC | `5taDgww4YGWphCH5rMiGLjM3253HeZa2LbQcbhy9bqNHHAznh58hA7h7J1cuRJ1eB7S5MtdrUVMvD9jXL1sM1AWm` | 402 → 200 in **4.5 s** | C6 recorded |
| 10 Command bar | — | "What's due this week?" ~**10 s** (first query, cold) | reminder to Najd INV-0141 sent (C2, to the owner's inbox) |
| 10 Sweep now (2 vaults, 1.5 USDC) | `47KoPjR6tVT5pLGwfAADGT5LKLXmGcjSeX5hSc6rGGFDdwyF14gSxuPX6QnJyvLR3z74vUPmjrCK4JN4qhkpfobP` | "quite fast" | T2, agent-signed spending-limit sweep |
| 11 Cash-out proposal #3 + Touch ID | `3b7KNHLUENg36RWemfqc6N2nXhTbjZSDeQqu9xkkzeSio9rPojq6JgJGRSXk1wYRtLU2vg3qiwm8duBpcmjYKTq1` | "quite fast" | 1.5 USDC (whole treasury) to the whitelisted TEST_BUYER; moved back to Solflare afterwards with `scripts/return-usdc.ts`: `3f53VYQCAQXYEhcq9R69X37VhCifaKcHREwiA2hcnbkF9cvTzcKSnhd7GUqAT8vRNRxniyfVkTQHLUNvUk7TPMrB` (1.7 USDC) |

Fee payer 0.034056 → 0.029896 SOL over the rehearsal (mostly proposal #3's rent). Fixes from it: demo-reset warm-up retries; Phantom as the stage wallet; warm-up includes one command-bar query.
