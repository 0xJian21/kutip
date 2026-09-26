# Spike A — Solana Pay transaction request, gasless (findings)

Status: **draft, not yet run** (research + code drafted 2026-09-27; no packages installed, no mainnet calls made).
Code: `spikes/a-solana-pay/server.ts`, `spikes/a-solana-pay/watch.ts`.

## 1. Solana Pay transaction-request spec (verified)

Canonical spec now lives at https://solana.com/docs/tools/solana-pay/specification/version1
(`launch.solana.com/docs/solana-pay/...` 308-redirects there). https://docs.solanapay.com/spec still serves the same text.
`github.com/anza-xyz/solana-pay` redirects to `solana-foundation/pay`, whose `master` no longer has `SPEC.md` at the root
(repo description is now "CLI for Agentic payments (x402, MPP, AP2)"; `typescript/` holds the kit-based `@solana/pay` 1.x).

- URL: `solana:<link>`; `<link>` is an absolute **https** URL. "If the URL contains query parameters, it must be URL-encoded ...
  If the URL does not contain query parameters, it should not be URL-encoded." Our link `https://<tunnel>/pay` has no query, so
  the QR is literally `solana:https://<tunnel>/pay`. (Matches `@solana/pay@0.2.6` `encodeURL`, checked on unpkg.)
- GET `<link>` -> `200 {"label": "...", "icon": "<absolute http(s) URL to svg|png|webp>"}`, `Content-Type: application/json`.
  Wallet sends `Accept`/`Accept-Encoding`; gzip/br recommended but optional.
- POST `<link>` body `{"account": "<base58 pubkey>"}` -> `200 {"transaction": "<base64 serialized tx>", "message"?: "<utf-8>"}`.
- Signature rules (this is what makes sponsorship possible):
  - signatures empty: app sets feePayer/blockhash to the account or zero; **wallet overrides feePayer with the account**.
  - signatures non-empty (our case): "The application must set the feePayer to the public key of the first signature" and a
    recent blockhash; "The wallet must not set the feePayer and recentBlockhash"; wallet must verify existing signatures and
    reject if invalid. -> fee payer = our key, signature index 0 = fee payer, blockhash fresh at POST time.
  - "The wallet must only sign the transaction with the account in the request, and must do so only if a signature for the
    account in the request is expected. If any signature except a signature for the account in the request is expected, the
    wallet must reject the transaction as malicious." Our tx expects 2 signatures; the fee payer's is already present, so the
    only *missing* one is the buyer's -> compliant.
  - Wallet must treat the tx as untrusted (simulate, show, may reject).
- Not specified by the spec: CORS (server sends `Access-Control-Allow-Origin: *` anyway), versioned transactions (spec text
  predates v0; wallets deserialize whatever they support), error body shape (issue solana-foundation/pay#150; we return
  non-200 + `{message}`).
- Reference convention (transfer requests): wallet "must include them in the order provided as read-only, non-signer keys to the
  SystemProgram.Transfer or TokenProgram.Transfer/TokenProgram.TransferChecked instruction". For transaction requests the app
  does this itself; `getSignaturesForAddress(reference)` indexes *any* account key in the tx, so placement only matters for
  `validateTransfer`-style checks. In `usdc` mode we append it to `transferChecked`. Memo program v2 rejects non-signer
  accounts, so the reference cannot ride on the memo ix.
- Serialization: legacy `tx.partialSign(feePayer); tx.serialize({ requireAllSignatures: false })` (fee payer signature still
  verified); v0 `new VersionedTransaction(msg); tx.sign([feePayer]); tx.serialize()` (unsigned slots stay zeroed).
  Types checked against `@solana/web3.js@1.99.0` `lib/index.d.ts` (`SerializeConfig`, `VersionedTransaction.sign(signers)`).

## 2. Jupiter Swap API — ExactOut status (verified 2026-09-27, off-chain HTTP probes only)

Docs moved to https://developers.jup.ag (dev.jup.ag 301s). Two generations coexist:

| | v1 (Metis) | v2 |
|---|---|---|
| quote | `GET /swap/v1/quote` (`swapMode=ExactIn|ExactOut`, `maxAccounts`, `onlyDirectRoutes`, `restrictIntermediateTokens`, `asLegacyTransaction`) | folded into `/build` |
| instructions | `POST /swap/v1/swap-instructions` (`quoteResponse`, `userPublicKey`, `destinationTokenAccount`, `trackingAccount`, `wrapAndUnwrapSol`, `dynamicComputeUnitLimit`, `prioritizationFeeLamports`, `payer`, ...) -> `computeBudgetInstructions[]`, `setupInstructions[]`, `swapInstruction`, `cleanupInstruction`, `otherInstructions[]`, `addressLookupTableAddresses[]`, `computeUnitLimit` | `GET https://api.jup.ag/swap/v2/build?inputMint&outputMint&amount&taker[&destinationTokenAccount&payer&maxAccounts&wrapAndUnwrapSol...]` -> same ix arrays + `addressesByLookupTableAddress` (object) + `blockhashWithMetadata`; no CU-limit ix returned |
| ExactOut | yes, but only Orca Whirlpool / Raydium CLMM / Raydium CPMM pools | **no** — "V2 only supports ExactIn. If using ExactOut, redesign the flow" (jup-ag migration skill) |
| auth | docs say `x-api-key` from https://developers.jup.ag/portal; probes on 2026-09-27 returned 200 **without** a key on both `lite-api.jup.ag` and `api.jup.ag` | `x-api-key` "required"; probe without key also returned 200 |
| lifecycle | migration skill: "Review by: 2026-09-01" whether v1 + ultra-api are decommissioned; still live today | current |

Sources: https://developers.jup.ag/docs/swap/build (v2 params), https://claudeskills.info/skills/jup-ag/agent-skills/jupiter-swap-migration/
(v1->v2 migration, ExactOut removal), https://developers.jup.ag/docs/swap/payments-through-swap (ExactOut payment recipe, DEX
limitation, `destinationTokenAccount` must be pre-initialised), https://raw.githubusercontent.com/jup-ag/jupiter-quote-api-node/main/swagger.yaml (v1 schema).

Probe results (SOL -> exactly 500000 USDC base units, `maxAccounts=20`, lite-api, dummy user key):
- quote: `inAmount` 4124884 lamports, route Raydium CLMM, HTTP 200 on both hosts, no key.
- swap-instructions: 4 setup ixs (create-idempotent wSOL ATA, system transfer, syncNative, ...), swap ix with 26 accounts,
  cleanup ix (close wSOL), 1 address lookup table (`EwhVfL6x9bdFnt74jGCeSwBLyodNTFDrmfPA7LH7Yn3H`), `transactionVersion: 0`.
- `trackingAccount=<pubkey>` is appended to the **swap instruction** as read-only non-signer (index 26 of 27). This is how the
  ExactOut variant carries the Solana Pay reference; fallback in code pins it to the ComputeBudget ix (runtime no-op program).
- `computeUnitLimit` in the response falls back to 1_400_000 when Jupiter's simulation fails (dummy user); with a funded buyer it
  is the simulated value. Server uses our own `setComputeUnitLimit(computeUnitLimit)` + capped `setComputeUnitPrice`.
- **Do not pass `payer`** ("Allow a custom payer to pay for the transaction fees and rent of token accounts") — it would put the
  fee payer into the ATA-create ixs as rent payer, violating DECISIONS D4. The buyer stays payer of their temporary wSOL account
  (rent refunded by the cleanup ix). `destinationTokenAccount` is assumed initialised -> no dest ATA creation.
- Size: cannot be measured until run (needs real buyer key + LUT resolution). Estimate: v0 header + 2 sigs (128 B) + ~10 static
  keys + 1 LUT with ~15 indexes + Raydium CLMM route data ≈ 700–900 B, under 1232. Extra memo (8 B data) and reference (+32 B
  static key) are cheap. Server logs `tx <n>/1232 bytes` and refuses >1232.

Risk: v1 may be switched off with little notice. If ExactOut disappears, A2 becomes "ExactIn with slippage + top-up", or the
buyer pays USDC only (mode `usdc`).

## 3. Wallet compatibility — evidence found (and not found)

All three wallets advertise Solana Pay **transaction request** support:
- Phantom + Solflare named in Solana's launch post: https://solana.com/news/solana-pay-transaction-requests-bring-on-chain-interactivity-to-the-off-chain-world
- Backpack: https://learn.backpack.exchange/articles/how-to-pay-with-solana-pay (describes the GET/POST interactive flow and QR scan).
- Phantom's Solana Pay recipe only covers *transfer* requests: https://docs.phantom.com/recipes/payments/request-payment

Sponsored fee payer / pre-signed tx inside a transaction request — **no wallet documents this either way**:
- Phantom docs say it supports versioned + legacy transactions generally
  (https://docs.phantom.com/developer-powertools/solana-versioned-transactions) but nothing about v0 in Solana Pay QR flows.
- Phantom "domain and transaction warnings" (https://docs.phantom.com/developer-powertools/domain-and-transaction-warnings):
  simulation-failure remediation says "Ensure only one signer is involved" and for multi-signer "use `signTransaction` with
  Phantom first, then collect other signatures" — i.e. Phantom's documented happy path is *Phantom signs first*, the opposite
  of a Solana Pay sponsored tx where the fee payer signs first.
- Phantom Lighthouse guards (https://docs.phantom.com/developer-powertools/lighthouse, https://phantom.com/learn/blog/anti-spoofing-security):
  Phantom appends Lighthouse assertion instructions; "the onchain transaction differs from the originally submitted version".
  Appending an instruction changes the message bytes, which would invalidate our fee-payer signature -> "Signature verification
  failed". Not stated whether Phantom skips this for already-partially-signed txs. Same failure class documented in Kora
  (fee-payer RPC) PR https://github.com/solana-foundation/kora/pull/675: "A buyer signature over the 566-byte message is over
  the wrong bytes; submitting it gets signature verification failure". Old unanswered report of partial-sign +
  `signAndSendTransaction` failing in Phantom: https://github.com/phantom/docs/issues/32 (2022).
  -> `watch.ts` prints every program id in the landed tx and flags Lighthouse (`L2TExMFKdjpN9kozasaurPirfHy9P8sbXoAN1qA3S95`).
- Backpack v0 / sponsored: nothing found in coral-xyz/backpack issues or docs (searched 2026-09-27). Treat as unknown; test.
- Solflare: listed as supporting transaction requests; nothing on sponsorship/v0. Test.
- `@solana/pay` `validateTransfer` mis-handled v0 + LUT payments until PR https://github.com/solana-foundation/pay/pull/481
  (open at time of writing) — evidence that wallets do produce v0 Solana Pay payments in the wild, and that our own validation
  should use `meta.loadedAddresses` (watch.ts does).

What the run must answer (fill in after the demo): per wallet (Phantom/Solflare/Backpack, iOS/Android): (a) does the QR scan
open a tx request at all, (b) legacy sponsored USDC: signs & lands with buyer SOL delta 0?, (c) v0 sponsored USDC
(`TX_VERSION=v0`), (d) jup-exactout v0 with LUT, (e) any Lighthouse ix appended / signature-verification failure.
If (e) bites, options: return the tx unsigned and let the buyer pay fees (spec default), or move sponsorship off the QR path
(wallet signs first via wallet-adapter/MWA on a web page, our relayer co-signs and submits — the Phantom-documented order).

## 4. `@solana/pay` package status

`@solana/pay@1.0.x` (Jul 2026) is a rewrite on `@solana/kit` v6 (peer deps `@solana/kit ^6.9`, `@solana-program/*`); it does
not work with the `@solana/web3.js` v1 stack this repo uses (Squads SDK). `0.2.6` is the last web3.js-v1 release
(deps `@solana/web3.js ^1.98.2`, `@solana/spl-token ^0.4.13`). Spike A does not need it: URL encoding is one line,
`findReference` is `getSignaturesForAddress`. If installed later for `validateTransfer`, pin `@solana/pay@0.2.6` exactly.

## 5. Dependencies to add to `spikes/package.json` (not installed yet)

```
pnpm --filter @kutip/spikes add @solana/web3.js@^1.99.0 @solana/spl-token@^0.4.15 bs58@^6.0.0 qrcode@^1.5.4
pnpm --filter @kutip/spikes add -D @types/qrcode@^1.5.6
```
- `qrcode` renders both PNG (`toFile(..., {type:'png'})`) and terminal (`toString(..., {type:'terminal', small:true})`), so
  `qrcode-terminal` is unnecessary. `hono` unnecessary (`node:http`). Memo ix built by hand (`MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr`).
- `bs58@6` is ESM, default export `{ encode, decode }` (base-x converter).
- `process.loadEnvFile` needs Node >= 20.12 (repo requires >= 22); path resolved relative to the script via `import.meta.url`.
- Both scripts type-check (tsc 7, strict, repo base config) against `@solana/web3.js@1.99.0`, `@solana/spl-token@0.4.15` and
  `bs58@6.0.0` already present in the pnpm store, plus `@types/qrcode@1.5.6`; only `qrcode` itself is not yet installed.
  Nothing has been executed against RPC or mainnet.

## 6. Run book

```
# .env: FEE_PAYER_SECRET, SOLAMI_RPC_URL, DEST_USDC_ATA, PUBLIC_URL=https://<tunnel>, MODE=usdc, AMOUNT_USDC=100000
cloudflared tunnel --url http://localhost:3000        # or ngrok; PUBLIC_URL must be https
pnpm --filter @kutip/spikes exec tsx a-solana-pay/server.ts   # prints fee payer, dest ATA, reference, solana: URL, QR, writes qr.png
pnpm --filter @kutip/spikes exec tsx a-solana-pay/watch.ts    # second terminal; reads .reference
# scan QR with Phantom / Solflare / Backpack; repeat with TX_VERSION=v0, then MODE=jup-exactout AMOUNT_USDC=500000
```
Server logs per request: method, path, wallet User-Agent, buyer, each instruction's program + account keys (S=signer,
W=writable), asserts the fee payer is in no instruction, tx size vs 1232, required/present signatures.

## 7. Results — mainnet, 2026-09-27 → **PASS** (Phantom ✓, Solflare ✓, Backpack untested)

Server behind `cloudflared` quick tunnel, `DEST_USDC_ATA` = spike-B buyer vault ATA `FQ1kmSvQqNzdqaKspuaY4XL7D53ZUFQGoPyzRL1WdATS`, fee payer `BGs4mRFbyXRhfAwNa94cTdeaRASmg9mGSXWWiJaQyr7L`. Every tx: fee payer pre-signed, `requiredSigs=2`, fee payer in **no** instruction (server asserts), CU price capped.

| Wallet (UA) | Mode | Tx | Size | Buyer SOL Δ | Fee (payer) | Notes |
|---|---|---|---|---|---|---|
| Solflare (`Solflare-Mobile-2.11.1`) | USDC 0.10, legacy | `4v6jfSP78JAimEUTP51SDDzv1s22euSmvexM8Uj3v3B26XUqUG9783ygQSerofwtUX8Sjt9qWDLiTXe7o4iNWJeD` slot 450781357 | 503 B | **0** | 10 300 lamports | no extra programs appended |
| Phantom Android (`okhttp/4.12.0`) | USDC 0.10, legacy | `2zz4Y7DaZJXKkWvYsVwoy7Gy2xaF4RXVEHAVcANZZzduhsqALM31598Ej8VVaunz95J378f2AH1UQkYTThiEed4H` slot 450782225 | 503 B | **0** | 10 300 | no Lighthouse guard appended |
| Solflare | Jupiter ExactOut → 0.5 USDC, **v0 + 1 LUT** | `3QsG2EvnaX9Fx79KDBR38mVbY6KtYR1qgSHDhGo4Vfqep3FSzpUpKdFdCcGyQHPQevoypde8iN7BEFm9KDagjuEk` slot 450783559 | **854 B** | −0.004120 (swap input only) | 10 792 | Whirlpool route; vault ATA 500000 → 1000000 (exact) |
| Phantom Android | Jupiter ExactOut → 0.5 USDC, **v0 + 1 LUT** | `2gPKLU8TEdKHpqvBUuwYWD8hzReyrot3VmT3h9D9EwGtAqatcKmu7f2t4c7tzG4xZj88RKMZ5rGvDzY67yLbZPE4` slot 450784529 | **889 B** | −0.004129 | 11 338 | PancakeSwap route, 17 static keys |
| Backpack | — | — | — | — | — | not installed on the test phone |

Observations
- Both wallets accepted a **pre-signed fee payer that is not the user** and a **v0 tx with lookup tables** inside a transaction request; neither appended guard instructions (Phantom's Lighthouse worry from §3 did not materialise for these txs).
- Jupiter v1 `/swap/v1/quote` + `/swap-instructions` with `swapMode=ExactOut`, `destinationTokenAccount`, `trackingAccount=<reference>` worked without an API key on `lite-api.jup.ag`; the reference rides on the swap instruction (last key). wSOL temp account rent is paid by the buyer, closed by the cleanup ix (buyer's net = swap input).
- Sizes 854–889 B leave ~350 B headroom; `maxAccounts=24` was enough (24–27 keys on the swap ix). Not tested: multi-hop routes for illiquid pairs.
- Wallet UX gotcha seen live: users try to paste `solana:https://…` into *Send*; the `/pay` page must lead with a QR + "Open in wallet" button (Solana Pay deep link), never a copyable string that looks like an address.
- The Solana Pay `POST {account}` gives us the paying pubkey **before** we build — that is where F4 screening goes.
- Both wallets fetched `/icon.svg` from a second UA (`Dart/3.7` for Solflare) — icon must be publicly reachable, no auth.
- web3.js v1 `getParsedTransaction` throws a superstruct error on Solami responses (`innerInstructions[].stackHeight`); use `getTransaction` (raw) or the gRPC meta instead.
- Helper `fund-phone.ts` (test only) funds a phone wallet from the spike keys; not part of the payment path.
