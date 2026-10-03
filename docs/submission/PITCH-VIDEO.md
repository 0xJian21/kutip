# Pitch video script (≤ 2:00)

Target length **1:58**. 1920×1080, 30 fps. Built in `video/` as the `Pitch` composition; the video session owns the timeline constants (`PITCH` in `video/src/pitch/Pitch.tsx`) and should move them to the timestamps below. Voice-over goes to `docs/video/vo-pitch.mp3`, captions to `docs/video/captions/pitch.srt`.

Voice-over: one calm voice, no hype. Total ≈ 335 words, which is a brisk 165 words a minute; the hook lines (0:00–0:25, fixed wording) are the fastest part and need a crisp read with the music carrying the pauses. If the read runs long, cut the lines marked **(cut first)**, or let the hook run to 0:30 and shorten "The user" to 10 s. Every number is from `docs/REHEARSAL.md` (29 Sep 2026 production walk-through) or `docs/PLAN.md`; wire costs are estimates and the caption says "est.".

Clips referenced by name are defined in `SHOT-LIST.md` (file name, device, what must be visible).

| Time | Segment | Voice-over | On-screen text | Visual / what to record |
|---|---|---|---|---|
| 0:00–0:03 | Hook 1 | A furniture maker in Muar just shipped to Sydney. | Muar, Johor → Sydney, NSW | Motion hook (video session): shipment arc over the grey map, still `01-muar-sydney` |
| 0:03–0:05 | Hook 2 | Now the waiting begins. | Sent · Day 1 · Day 2 · Day 3 | Day axis fills to day 3 (hook scene S2) |
| 0:05–0:09 | Hook 3 | Three days for the wire. About a hundred and fifty ringgit in fees. A spreadsheet of who still owes. | 3 days · ~RM150 in fees (est.) · who still owes: 4 rows | Still `02-fees-est`; the overdue table rows drop in (Harbourline, Meridian, Najd, Kobayashi; demo data) |
| 0:09–0:12 | Hook 4 | What if getting paid… took one second? | What if getting paid took one second? | Grey world shifts to violet (still `03-colour-shift`) |
| 0:12–0:13 | Hook 5 | Kutip. | Kutip | Wordmark on violet |
| 0:13–0:16 | Hook 6 | The buyer scans. Pays from any wallet. Zero gas. | Scan · any wallet · 0 gas | Still `04-phone-qr`: phone with the real QR, Phantom approve sheet showing network fee 0 |
| 0:16–0:19 | Hook 7 | Exact USD lands on Solana. Paid in point one five seconds. | 1.000000 USDC · Paid +0.15 s · Settled +7.86 s | Flip card: Payment seen → Paid → Settled with the real timings |
| 0:19–0:22 | Hook 8 | An AI agent chases the rest, and asks you before it moves a cent. | …and asks you before it moves a cent. | Still `05-agent-touch-id`: treasury card, "Agent needs you" row, Touch ID prompt |
| 0:22–0:24 | Hook 9 | Kutip. Get paid like a message. | Get paid like a message. | Wordmark + tagline |
| 0:24–0:25 | Hook 10 | Built in Malaysia. For every exporter. | Built in Malaysia. For every exporter. | Still `06-end-frame` |
| 0:25–0:40 | The user | This is the finance admin of a furniture exporter in Muar. Teak to Sydney and the Gulf, sixty-day terms. Every wire: days of waiting, a hundred ringgit or more in fees, estimates every exporter recognises. And someone still chases the rest by hand. | **Who it is for.** The finance admin of a furniture exporter in Muar. 30–80 people · USD invoices · 30–60 day terms · wires 2–5 days, RM 50–150 fees (est.) | Kit `TitleCard` ("Who it is for"), then cross-fade to `clip-01-overview.mp4` at 0:34 with lower third "Live on Solana mainnet · kutip-app.vercel.app" |
| 0:40–0:52 | Product: send the invoice | Kutip. Sign in with Touch ID. Drop the PDF you already send; the agent reads it, you check it, one pay link goes out. | Touch ID · PDF → fields in ~4 s · one pay link | `clip-01-overview.mp4` (sign-in moment) → `clip-02-new-invoice.mp4` (PDF drop, fields fill, Create & send, pay link + QR) |
| 0:52–1:08 | The money moment | The buyer opens it on a phone and pays in SOL. Zero gas. Exactly one dollar lands as USDC. Seen. Paid in point one five seconds. Settled in under eight. Live on mainnet, no refresh. | Phantom: network fee 0 · Seen → Paid +0.15 s → Settled +7.86 s · Solscan 5GDG…3AMV | Left: `clip-03-phone-pay.mp4` in the phone frame. Right: `clip-04-live-flip.mp4` (invoice page stepper flipping). Kit `ProofCard` id `pay-sol` from 1:02 for 6 s |
| 1:08–1:18 | Inbox | A buyer asks a question. The agent classifies it, drafts a reply from the invoice's facts, and you approve. Nothing goes out on its own. | Draft ready in 4.2 s · Rule C7 · approved by you | `clip-06-inbox-draft.mp4` (thread jumps to top → Draft ready → Approve & send). Lower third "The agent proposes, you decide" |
| 1:18–1:26 | x402 | When the buyer is a machine, the invoice is an HTTP endpoint. Four-oh-two, pay, two-hundred. Four and a half seconds. | HTTP 402 → 200 in 4.5 s · Solscan 5taD…1AWm | Left: kit `LogTerminal` playing `x402-bot.log`. Right: `clip-09-x402-flip.mp4` (INV-0155 flips Paid). `ProofCard` id `x402` |
| 1:26–1:40 | Why Solana / Solami | Why Solana? Solana Pay builds the payment; Kutip pays the fee. Jupiter turns SOL into exact USDC inside the buyer's transaction. Squads holds the treasury: the owner's passkey has the keys, the agent an on-chain daily limit. And a Solami gRPC stream is how we see it land. **(cut first: "the agent an on-chain daily limit")** | Solana Pay tx requests · Jupiter ExactOut · Squads v4 · x402 · sub-cent fees · Solami gRPC 19 ms | Kit `WhySolanaCard` (six points from `video/src/data/proof.ts`) |
| 1:40–1:48 | Go-to-market | First ten customers: furniture exporters in Muar and Batu Pahat, through the Muar Furniture Association, their accountants, and Superteam MY. Free until their tenth settled invoice. | First 10: Muar & Batu Pahat · MFA / MFC · accountants · Superteam MY · free until invoice #10 | Kit `GtmCard`. Footnote on screen: "Targets to approach, not partners" |
| 1:48–1:54 | Trust | Non-custodial. Touch ID on every approval. Wallets screened. Ringgit never touches Kutip: you cash out at an SC-registered exchange. | Non-custodial Squads · Touch ID · OFAC screening · cash-out at an SC-registered DAX · MYRC when BNM approves | Kit `TrustCard` |
| 1:54–1:58 | Team | [NAME], [role]. Built in Malaysia, [solo,] in seven days of commits. **(cut first: "in seven days of commits")** | [NAME] · [role] · [city], Malaysia · first commit 27 Sep 2026 | Kit `TeamCard` (`members` prop, see below) |
| 1:58–2:00 | Close | Kutip. Get paid like a message. | kutip-app.vercel.app · github.com/0xJian21/kutip | Kit `EndCard` |

## Team card (for `TeamCard` in `video/src/pitch/Pitch.tsx`)

<!-- TODO owner: fill in; the video session reads this block. -->
```
members: [
  { name: "[NAME]", role: "[ROLE] · [city], Malaysia", note: "GitHub 0xJian21 · built [solo] for this hackathon, first commit 27 Sep 2026" },
]
```

## Rules for the edit

- Music under everything, ducked to 30 % under the voice. The hook is cut at 124 BPM; the rest can be free.
- Captions burned in from `pitch.srt`; the "On-screen text" column is for cards and lower thirds, not the captions.
- No invented customers, logos, testimonials or metrics. The exporter on screen is the seeded demo company ("Teratai Woodworks Sdn. Bhd."); the first time it appears, the lower third says "demo data".
- Every proof card carries the Solscan URL in full on screen for at least 4 s.
- Phone clips: Phantom, not Solflare (Solflare currently flags the domain). The approve sheet must show the network fee line.
