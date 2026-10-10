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

## 1. Pitch (save as `docs/video/vo-pitch.mp3`)

**Hook (0:00–0:25, fast, music carries it)**
A furniture maker in Muar just shipped to Sydney.
Now the waiting begins.
Days for the wire. Fees taken on the way. A spreadsheet of who still owes.
What if getting paid… took one second?
Kutip.
The buyer scans. Pays from any wallet. Zero gas.
Exact USD lands on Solana. Paid in point one five seconds.
An AI agent chases the rest, and asks you before it moves a cent.
Kutip. Get paid like a message.
Built in Malaysia. For every exporter.

**The user (0:25–0:40)**
This is the finance admin of a furniture exporter. Invoices in US dollars, sixty-day terms. Every wire takes up to five days, and twenty to fifty dollars disappear on the way. And someone still chases late payers by hand.

**Send the invoice (0:40–0:52)**
With Kutip, you sign in with Touch ID. Drop the PDF you already send. The agent reads it, you check it, and one pay link goes out.

**The money moment (0:52–1:08)**
The buyer opens it on a phone and pays in SOL. Zero gas. Exactly one dollar lands as USDC. Seen. Paid in point one five seconds. Settled in under eight. Live on mainnet, no refresh.

**Inbox (1:08–1:18)**
A buyer asks a question. The agent understands it, drafts a reply from the invoice, and you approve. Nothing goes out on its own.

**x402 (1:18–1:26)**
When the buyer is software, the invoice is an endpoint. Four-oh-two, pay, two-hundred. Four and a half seconds.

**Why Solana (1:26–1:40)**
Why Solana? Solana Pay builds the payment and Kutip pays the fee. Jupiter turns SOL into exact USDC in the same transaction. Squads holds the treasury, and only your passkey controls it. And a Solami gRPC stream is how we see every payment land.

**Go-to-market (1:40–1:48)**
Our first ten customers are exporters already paid in US dollars, reached through trade associations, their accountants and Superteam Malaysia. Free for their first ten invoices.

**Trust (1:48–1:54)**
Non-custodial. Touch ID on every approval. Every wallet screened. Ringgit never touches Kutip.

**Team + close (1:54–2:00)**
I'm Jian Wei, a Web3 engineer in Malaysia, and I built this solo. Kutip. Get paid like a message.

---

## 2. Demo (save as `docs/video/vo-demo.mp3`)

1. Sign in with Touch ID. This is the exporter's overview: what came in, what's overdue, and the treasury, in ringgit at Bank Negara's rate.
2. Drop the PDF you already send. The agent reads it, you check the lines, and one pay link goes out with the invoice email.
3. The buyer opens the link on a phone and pays in SOL. Phantom shows the network fee: zero. Kutip pays it. Watch the invoice: payment seen, paid in a fifth of a second, settled in under eight. No refresh.
4. The receipt: exactly one USDC received, what the buyer spent, the rate against Bank Negara's, and the Solscan link.
5. Reminders for this invoice stop, and the receipt is emailed. Every step is logged with the rule the agent followed.
6. A buyer asks a question on the pay page. The agent reads it and drafts a reply from this invoice only. You edit a word, approve, and it appears on the buyer's phone.
7. Ask in plain words. What's due this week? Remind a buyer. The agent shows a preview; nothing goes out until you press Send.
8. Sweep now. Tick the accounts you want, check the amounts and the daily cap. Signed by the agent, on Solana, recorded. The agent can only move money into your own treasury.
9. Cash out to ringgit. The agent prepares a transfer to your own exchange account; you approve with Touch ID. Kutip never holds ringgit.
10. And when the buyer is software, the invoice is an x402 endpoint. The bot gets a four-oh-two, pays, and gets a two-hundred with a receipt.
11. Kutip. Get paid like a message.

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
