# Follow-ups after Session 7

Known gaps left open on purpose (2026-09-27). Each has where, what goes wrong, and the fix. Tick them off as they land.

## From the final code review (minor)

- [ ] **Submit route can mark an unrelated action executed.** `apps/web/app/api/treasury/proposals/[index]/submit/route.ts` sets `actionId` to `executed` with the signature without checking that the action is `proposed` and belongs to proposal `#index`. An owner could overwrite the audit trail of a rejected action or an escalation. Fix: require `status = 'proposed'` and `inputSummary` starting with `proposal #<index>` (better: an `agent_actions.proposal_index` column).
- [ ] **Raw error messages can reach the browser.** `apps/web/lib/data/result.ts` only masks errors starting with "Failed query". Postgres connection errors (Supabase project ref), `Privy user lookup: HTTP 401`, Anthropic SDK errors and `exporter not found: …` are shown as they are, and a thrown non-Error crashes `err.message.startsWith`. Fix: a `UserError` class for messages meant for users; everything else becomes "Something went wrong".
- [ ] **PDF size limit vs Vercel.** `lib/data/actions.ts` allows 8 MB and `next.config.ts` sets `bodySizeLimit: "10mb"`, but Vercel functions cap request bodies at 4.5 MB, so a 4.5–8 MB PDF gets a platform 413 instead of the friendly message. Fix: cap at 4 MB in the client and the action.
- [ ] **Realtime can switch off silently.** `apps/web/next.config.ts` maps `SUPABASE_URL` / `SUPABASE_ANON_KEY` into `NEXT_PUBLIC_*` at build time. If they are missing in the Vercel build, live updates quietly stop. Fix: fail the build or log a warning when they are empty.
- [ ] **Mock mode in production bypasses auth on treasury routes.** With `NEXT_PUBLIC_KUTIP_MOCK=1`, `getSession()` returns a demo session with no cookie, and `/api/treasury/*` still uses the real DB and fee payer. Fix: ignore `MOCK` when `NODE_ENV === "production"`, or make `treasuryMultisig()` throw in mock mode.
- [ ] **Reused screenings leave no per-invoice record.** `app/api/pay/[invoiceId]/route.ts` records a screening row only for fresh screens, so the compliance trail can't show which check covered which invoice. Fix: record a row pointing at the reused screening.
- [ ] **Mock fixtures ship to the browser.** Client components import `@/lib/mock` statically. Fix: dynamic import only when `MOCK` is on.
- [ ] **`/treasury-test` is public in production.** It is a `(dev)` route. Fix: `notFound()` unless `NEXT_PUBLIC_DEMO_CONTROLS=1`, or move MFA enrolment into Settings.
- [ ] **`demo-reset` seed is not transactional.** The seed runs as a child process. A failure after step 1 leaves placeholder multisig addresses until a re-run. Recoverable; re-run the script.

## Behaviour to know about

- [ ] **Provisional screening pass.** A wallet-history check that runs over 2.5 s lets the payment through and finishes afterwards (your requirement). A bad late result escalates (rule T1), and the recorded flag now blocks that wallet from then on. Only its first attempt can still get a transaction built. Revisit if a judge's wallet ever shows up as flagged.
- [ ] **`after()` lifetime on Vercel.** The late screening runs in `after()`. If the function hits its max duration first (a slow screen can take 12–37 s), the verdict is lost silently. Check the project's Fluid / maxDuration setting, or move late screening to the worker.
- [ ] **Per-instance caches on serverless.** `InFlight`, `LiveTxCache` and the rate limiters live per Vercel instance, so parallel wallet POSTs that land on different instances can build two transactions. Safe (keys include invoice, wallet and token), just less deduplication.
- [ ] **Worker catch-up looks at the last 20 signatures per reference.** A reference flooded with more than 20 dust transactions could hide a real payment from catch-up. The gRPC stream is still the primary path.
- [ ] **Rejecting a Squads proposal only updates the database.** The on-chain proposal stays Active. Fix: add a `proposalReject` owner transaction, or cancel stale proposals from a script.
- [ ] **Sign-in requires a linked Kutip user.** New passkeys are refused unless `DEMO_FALLBACK=1` is set on Vercel. Decide before judging whether judges should get read access to the demo.
- [ ] **Resend test sender.** It only delivers to `jianwei2102@gmail.com` exactly (no `+aliases`, no other people). To email real buyers, verify a domain in Resend and set `EMAIL_FROM` on Fly and Vercel.
- [ ] **Receipt wording.** Haiku wrote the date as "twenty-seventh September two thousand twenty-six" in a receipt (`packages/agent/src/writer.ts`). Ask for a numeric date, or pass the formatted date in the facts.
- [ ] **Privy allowed origins** list only `https://kutip-app.vercel.app`. Add `http://localhost:3000` (and `:3200`) back for local sign-in.

## Money and accounts

- [ ] **Old treasury funds.** The first treasury `GD5Fhhy1icASgqD5oz4Zh88SRSMZdYVpo1pfDybhZShY` (owner `23FK…`, the localhost passkey) still holds about 1.25 USDC, plus 0.50 USDC in its Meridian vault. Only that passkey can move them, and only on `localhost`.
- [ ] **Fee payer balance.** `BGs4mR…yr7L` has about 0.053 SOL. Each proposal costs about 0.0041 SOL rent (refundable after execution), each re-provision about 0.027 SOL, and each payment about 0.00001 SOL. Top up before demo day if you plan more rehearsals.
- [ ] **Fly bill.** `kutip-worker` is shared-cpu-1x, 512 MB, in Tokyo: $0.00000075/s CPU plus $0.00000193/GB/s for the extra 0.25 GB, both ×1.3077 for the region, which comes to about **US$4.17 per 30 days**. Inbound data (the gRPC stream) is free; outbound is $0.04/GB (cents). The machine uses about 127 MB. After the demo, `fly scale memory 256 -a kutip-worker` brings it to about US$2.54.
- [ ] **Fly machine count.** Keep exactly one machine: the Solami Pro plan allows 2 gRPC streams, and two workers would double-process payments.

## Later (after the hackathon)

- [ ] **Move to Singapore, all together or not at all.** The database decides where the servers go: Supabase is in ap-northeast-1 (Tokyo), so Vercel (`hnd1`) and Fly (`nrt`) sit next to it. Moving only the servers to Singapore would add ~70 ms to every DB round trip, and pages make 5–9 of them. For Malaysian users, create a Supabase project in `ap-southeast-1`, run `db:migrate` and `demo-reset`, swap `DATABASE_URL` / `SUPABASE_URL` / `SUPABASE_ANON_KEY` in `.env`, Vercel and Fly, then set Vercel `regions: ["sin1"]` and Fly `primary_region = "sin"`. Gain: ~60 ms faster page loads from KL.
