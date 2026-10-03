# Shot list (recording day)

Every clip the three videos need, with its file name, the device, where it starts and ends, and what must be visible. Drop the files into `docs/video/clips/` and run `pnpm sync` in `video/`. The "video slot" column is the id the Remotion timelines currently expect (`pnpm record` writes those names); the video session either renames on sync or updates its manifest. Keep both names in mind; the canonical name for recording day is the `clip-NN` one.

Setup first (once): REHEARSAL.md pre-flight P1–P15. In particular: fee payer ≥ 0.1 SOL; Phantom ≥ 0.02 SOL and ≥ 1 USDC; x402 test buyer ≥ 0.50 USDC (it held 0 after the Sep 29 rehearsal); `demo-reset --warm <phantom>,<bot> --cashout <solflare> --yes`; write down the two invoice ids; owner signed in on the laptop (Safari, Touch ID); "Touch ID for money" **On**; replies mode **Draft — I approve**; warm up `/dashboard`, `/inbox`, `/agent` and one command-bar question. For shot 08 fund the Harbourline and Meridian vaults with 0.20–0.30 USDC each from TEST_BUYER (or record 08 right after 04 while the 1 USDC sits in Harbourline's vault).

Laptop recording: `cd video && pnpm record --inv154 <id> --inv155 <id>` (Chrome 1920×1080, violet pointer dot; it waits for Enter before each shot and asks before anything that moves money). Phone: iOS Control Centre screen recording, portrait, started before the shot and stopped after; AirDrop, then rename. Terminal: `script` or `tee` the bot output to a `.log`.

| # | File | Video slot | Used by | Device | Start | End | Must be visible |
|---|---|---|---|---|---|---|---|
| 01 | `clip-01-overview.mp4` | `D1-dashboard` | Pitch, Demo | Laptop | `/onboarding` with the Sign in button | Dashboard fully loaded, 3 s of hovering | Touch ID prompt; KPI row in RM with USD under it; violet treasury card with "Live on Solana mainnet · demo funds"; command bar; "Agent needs you" list with overdue rows |
| 02 | `clip-02-new-invoice.mp4` | `D2-new-invoice` | Pitch, Demo | Laptop | Click "New invoice" | Pay link + QR shown after Create & send | PDF dropped (`demo-harbourline-inv-0161-usd1.pdf`); fields fill in; live preview on the right; "Send to" field; Create & send; the pay link and QR |
| 03 | `clip-03-phone-pay.mp4` | `P1-phone-pay` | Pitch, Demo | Phone (Phantom) | Pay page of INV-0154 showing the invoice document | Pay page shows "Paid" | Invoice document with logo and lines; Confirm & pay; SOL toggle; Open in wallet; **Phantom approve sheet with network fee 0** and 1.00 USDC to the exporter; Approve; the success state |
| 04 | `clip-04-live-flip.mp4` | `D4-live-flip` | Pitch, Demo, Solami | Laptop | Invoice page of INV-0154 at "Waiting for the buyer to pay", started **before** the phone approves | 5 s after "Settled" | Stepper Sent → Payment seen → Paid → Settled flipping with timestamps, no refresh, pointer still. The recorder waits for "Settled" |
| 05 | `clip-05-receipt.mp4` | `D4b-receipt` | Demo | Laptop | Same page, scroll to the execution receipt | Solscan tab open 2 s, back | Exact USDC received, SOL spent, effective rate vs BNM, Solscan link; the Solscan page with the signature and "Finalized" |
| 05b | `clip-05b-agent-activity.mp4` | `D5-agent-activity` | Demo | Laptop | `/agent` | 2 s on the receipt email (optional) | The C6 "cancelled reminders" row for INV-0154 at the top with reason and rule chip; the receipt email in the owner's Gmail (optional) |
| 06a | `clip-06a-phone-message.mp4` | `P2-phone-message` | Demo | Phone | Pay page of INV-0155, message box | Reply bubble appears under the buyer's message | Typing "Hi, can you resend the invoice? Our AP team needs a copy." → Send → message in the thread → later the seller's reply (keep recording until it arrives, or record a second take) |
| 06 | `clip-06-inbox-draft.mp4` | `D6-inbox` | Pitch, Demo | Laptop | `/inbox`, before the phone sends | "Agent on this thread: C7 · approved by you" | Thread jumping to the top; intent chip "question"; "Draft ready"; the draft; editing one word; Approve & send; the C7 row |
| 07 | `clip-07-command-bar.mp4` | `D8-command-bar` | Demo | Laptop | Dashboard command bar, empty | Reminder preview with Send hovered, not pressed | "What's due this week?" → list with amounts; "Remind Najd about INV-0141" → preview with tone and text; the Send button, untouched |
| 08 | `clip-08-sweep.mp4` | `D8-sweep` (new slot) | Demo | Laptop | "Sweep now" on the dashboard hero | Agent activity shows the sweep | Dialog with the buyer checklist; tick Harbourline only, Meridian unticked; live total, network fee "paid by Kutip", T2 cap check; stepper Choose → Checked → Signed by agent → On Solana → Recorded; the sweep row with its reason |
| 09 | `clip-09-x402-flip.mp4` | `D7-x402-flip` | Pitch, Demo | Laptop | Invoice page of INV-0155 (unpaid) | 3 s after it shows Paid/Settled | The stepper flipping while the bot runs; nothing else needed |
| 09t | `x402-bot.log` | `x402-bot` | Pitch, Demo | Terminal | The exact command | The receipt JSON | `pnpm --filter @kutip/solana bot https://kutip-app.vercel.app/api/x402/invoice/<INV-0155 id> --yes` with its 402 requirements, the payment, the 200 and the receipt with the Solscan link. Capture with `… --yes 2>&1 \| tee docs/video/clips/x402-bot.log` |
| 10 | `clip-10-cash-out.mp4` | `D9-cash-out` | Demo | Laptop | Treasury page | Proposal executed, balance updated | Cash out → amount **0.25** → quote (rate, fee, net RM) → Propose → Approve → **Touch ID prompt visible** → executed; treasury figure drops by 0.25 USDC |
| 11 | `clip-11-catchup.mp4` | `D10-catchup` | Solami (optional) | Laptop | Invoice page of a fresh USD 1 invoice paid while the worker was stopped | After the worker restarts and it shows Paid/Settled | Status appearing without the stream (see SOLAMI-DEMO catch-up recipe) |
| 11t | `worker-catchup.log` | `worker-catchup` | Solami | Terminal | Worker restart | After the `Catch-up` line | `fly logs -a kutip-worker --no-tail \| tail -60` containing `Catch-up inv_… found over RPC (finalized)` |
| 12 | `clip-12-treasury.mp4` | `D11-treasury` | Solami | Laptop | Treasury page after shot 08 | 2 s on the sweep's Solscan link | Buyer receiving accounts with "Waiting" at 0 after the sweep; treasury figure; last sweep row; "Who can do what" card |
| 13t | `worker-stream.log` | `worker-stream` | Solami | Terminal | Right after shot 04 | — | `fly logs -a kutip-worker --no-tail \| tail -80` with `gRPC subscribed: N tx keys, M balance accounts`, then the Seen / Paid / Settled lines for INV-0154's signature |

Hook stills (already rendered by the video session in `docs/video/stills/`): `01-muar-sydney`, `02-fees-est`, `03-colour-shift`, `04-phone-qr`, `05-agent-touch-id`, `06-end-frame`. No recording needed.

Audio still needed from the owner (per `docs/video/README.md`): `music.mp3` (120–128 BPM), `vo-pitch.mp3`, `vo-demo.mp3`, `vo-solami.mp3`, and the three `.srt` caption files (generate from the VO with any transcription tool, then check the numbers).

## Recording order on the day

1. Pre-flight, demo-reset, warm-up. Start the phone recording for 03 and the laptop recorder.
2. 01 → 02 → (start phone) 03 + 04 together → 05 → 05b → **13t** (grab the worker log now, while the Seen/Paid/Settled lines are at the tail).
3. 06a + 06 together (phone first, then laptop).
4. 07 → 08 → 12 (treasury right after the sweep).
5. 09 + 09t together (terminal and the INV-0155 page side by side).
6. 10 (cash out 0.25 with Touch ID).
7. Solami extras: 11t (+ 11) with the stop-pay-start recipe. Scale the worker back to 1 machine afterwards.
8. `cd video && pnpm sync && pnpm dev` to check every slot has a file; render.

Rules: Phantom only (Solflare flags the domain). Amounts ≤ 1 USDC. If a shot fails, finish the others and re-record it; `demo-reset` only before a full re-run (it changes the invoice ids). Leave the data as it is afterwards for judges.
