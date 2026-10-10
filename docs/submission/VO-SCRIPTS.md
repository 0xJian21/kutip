# Voice-over scripts (read-aloud version)

Plain lines only — timing, visuals and clips live in PITCH-VIDEO.md, DEMO-VIDEO.md, SOLAMI-DEMO.md. Updated 2026-10-10 to match the deck: wires 1–5 days, USD 20–50 deducted, go-to-market without locations.
Read calmly, ~150 words a minute. A pause = one breath. Numbers: "point one five seconds", "four-oh-two".

| Video | Length | Voice |
|---|---|---|
| Pitch | ≤ 2:00 | Your own voice best (team criterion). AI voice OK. |
| Demo | ≤ 2:00 | AI voice fine. |
| Solami | 2:00–2:30 | AI voice fine. |
| Week 4 (Colosseum, Oct 9–12) | 2–3 min | Your face + voice strongly recommended. |

---

## 1. Pitch (matches `docs/video/out/pitch-ai-voice-1920x1080.mp4`)

The first 25 s is the motion hook with music: **don't speak over it**. Then one recording per slide, in this order. Save each as its own file (`vo-pitch-01.m4a` … `vo-pitch-09.m4a`) or one file with a 1-second pause between slides; each slide stays on screen as long as your line lasts.

**1. Who it is for** (slide `user`)  
This is the finance admin of a furniture exporter. Invoices in US dollars, sixty day terms. Every wire takes up to five days, and twenty to fifty dollars disappear on the way. And someone still chases late payers by hand.

**2. How Kutip compares** (slide `compare`)  
Faster ways to get paid exist. But none of them collect for you. With Kutip, nothing is taken on the way, and the money stays in your own treasury.

**3. How it works** (slide `one-sentence`)  
You send the invoice you already have. The buyer pays from any wallet, with zero gas. And the agent does the rest.

**4. The money moment** (slide `money-moment`)  
On Solana mainnet, the buyer scanned and paid in SOL. Exactly one US dollar landed as USDC. Paid in point one five seconds. Settled in under eight. No refresh.

**5. The AI agent** (slide `agent`)  
An AI agent chases late payers in the buyer's own hours, drafts replies from the invoice, and asks you before it moves a cent. A rules engine always has the final say.

**6. Why Solana** (slide `why-solana`)  
Why Solana? Solana Pay builds the payment, and Kutip pays the fee. Jupiter turns SOL into exact USDC. Squads holds the treasury. And a Solami gRPC stream sees every payment land.

**7. Trust** (slide `trust`)  
It is non-custodial. Touch ID approves every cash-out, every wallet is screened, and ringgit never touches Kutip.

**8. First customers** (slide `gtm`)  
Our first ten customers are exporters already paid in US dollars, reached through trade associations, their accountants, and Superteam Malaysia.

**9. Team + close** (slide `team`)  
I'm Jian Wei, a Web3 engineer in Malaysia, and I built Kutip solo. Kutip. Get paid like a message.

---

## 2. Demo (matches `docs/video/out/demo-draft-1920x1080.mp4`, 1:59)

One recording per line, or one file with a 1-second pause between lines. The time in brackets is how long that scene is on screen: stay inside it (about 2.5 words a second). The first 3 s is a title card: start speaking at 0:03.

1. **Overview** (0:03, 6 s): This is Kutip, live on Solana mainnet. Signed in with Touch ID.
2. **New invoice** (0:09, 12 s): Drop the PDF you already send. The agent reads it, you check the lines, and one pay link goes out.
3. **Overdue + rulebook** (0:21, 12 s): Late payers get polite reminders in their own hours, each logged with the rule it followed.
4. **Live payment** (0:33, 20 s): The buyer scans the QR and pays from Phantom. Kutip pays the network fee. Watch the page: payment received in a tenth of a second, final in under seven. No refresh.
5. **Receipt** (0:53, 7 s): Exactly one dollar received, zero gas, and the Solscan link.
6. **Agent activity** (1:00, 6 s): The agent stops the reminders and logs why.
7. **Inbox** (1:06, 14 s): A buyer asks a question on the pay page. The agent drafts a reply from that invoice only. You approve, and it sends.
8. **x402** (1:20, 13 s): When the buyer is software, the invoice is an endpoint. The bot gets a four-oh-two, pays, and gets a two-hundred.
9. **Command bar** (1:33, 10 s): Ask in plain words. What's due this week? Nothing moves until you confirm.
10. **Cash out** (1:43, 12 s): Cash out to ringgit. The agent prepares it, you approve with Touch ID, and it goes to your own exchange account.
11. **End card** (1:55, 4 s): Kutip. Get paid like a message.

---

## 3. Solami demo (save as `docs/video/vo-solami.mp3`)

1. This is the part of Kutip that runs on Solami: the worker that moves an invoice from Seen to Paid to Settled, live on Solana mainnet.
2. One Yellowstone gRPC stream on Solami watches every open invoice and every buyer vault. Processed becomes Seen. Confirmed becomes Paid. Finalized becomes Settled. Every payment is checked: real USDC, exact amount, the right vault, the right memo.
3. On the left, the worker's log reading the Solami stream. On the right, the invoice page. The buyer pays from a phone. Seen, nineteen milliseconds after the geyser. Paid, a fifth of a second later. Settled, under eight seconds. The page updates by itself.
4. Now stop the worker, pay an invoice, and start it again. On startup it checks every watched account over Solami RPC and finds the payment it missed. It repeats every three minutes, so a restart never loses a payment.
5. The treasury balances come from the same stream. Here is a sweep landing in the treasury.
6. To run it on your own key you need three values from your Solami dashboard: the API key, the gRPC endpoint and the RPC endpoint. Clone the repo, fill in the env file, migrate, seed, and start the web app and the worker.
7. Kutip on Solami. The repo is public, and the README is the whole setup.

---

## 4. Week 4 video for Colosseum (talk to camera, ~2:30)

**Who + what (0:00–0:30)**
Hi, I'm Jian Wei, a Web3 engineer from Malaysia. This is Kutip, an AI collections agent for exporters. Malaysian exporters wait days for overseas payments and lose fees on every wire. With Kutip the buyer pays from any wallet with zero gas, and exact US dollars land on Solana in about a second.

**What I built (0:30–1:30)** — over demo clips
Everything you see is live on mainnet. The agent reads invoice PDFs, chases late payers in the buyer's own hours, and drafts replies I approve. Money lands in the exporter's own Squads treasury. Kutip never holds it. Big moves need my Touch ID. And a buyer's accounts-payable bot can pay an invoice over x402.

**What I learned (1:30–2:05)**
Three things. One: on Yellowstone gRPC, an empty keepalive ping silently replaced my subscription, so payments went unseen. Now I resend the full filters on every ping, with a catch-up every three minutes. Two: being the fee payer makes crypto payments feel like a bank transfer to the buyer. Three: keep the AI behind a rules engine. It proposes; code and the owner decide.

**What's next (2:05–2:30)**
Next: a verified email domain so invoices reach real buyers, my first ten exporters, Malaysia's MyInvois e-invoices, and two-person approval for large cash-outs. Thanks for watching. Try it at kutip-app dot vercel dot app.
