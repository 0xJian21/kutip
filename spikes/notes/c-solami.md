# Spike C — Solami as the data path (research + draft scripts)

Status: **drafted, not yet run** (nothing sent to mainnet). Scripts typecheck (tsc 7.0.2, strict) against
`@solana/web3.js@1.99.0`, `@solana/spl-token@0.4.15`, `bs58@6.0.0`, `@triton-one/yellowstone-grpc@7.0.1`.
Date: 2026-09-27.

## TL;DR

- Solami has **two surfaces that disagree**: the docs site (`solami.mintlify.app` = `docs.solami.fast`, hostnames
  `*.solami.fast`) and the product site/SDKs (`solami.dev`, hostnames `*.solami.dev`). Both hostname families resolve to the
  same IP and both RPC hosts answer `401 unauthorized` without a key. `solami.fast` 301-redirects to `solami.dev`.
- **gRPC** = stock Yellowstone at `https://grpc.solami.dev` (docs: `https://grpc.solami.fast`), regional
  `https://ams.grpc.solami.dev` / `https://grpc-ams.solami.fast`. Auth: the docs show `?api_key=KEY` in the URL, but Solami's
  own Rust starter template and JS SDK pass the key as the gRPC **`x-token`** header. The v7 napi client (tonic) drops URL
  query strings, so `listen.ts` uses `x-token`. Needs a **gRPC-type key** (keys are typed; wrong type → 403).
- **"Beam" = Solami's SWQoS product name.** Stake-weighted transaction landing over **QUIC** (`beam.solami.dev:11000`, ALPN
  `solana-tpu`), backed by ">5M SOL of validator stake", **tip ≥ 0.0001 SOL required** to one of Solami's tip accounts
  (`GET https://api.solami.dev/onchain/tip-addresses`). Nothing says it routes via Jito. The docs site additionally documents
  an HTTP path: plain `sendTransaction` on the RPC URL with a **SWQoS-type key**, `skipPreflight: true, maxRetries: 0`.
- **Webhooks exist but are undocumented**: the dashboard bundle has Webhooks view/manage/stream, `max_webhooks` per plan in
  the public pricing API, and a WebSocket delivery URL `wss://{region}.ws.solami.dev/webhooks/stream/{id}?api_key=`.
- **"Decoded DEX market data"** is a product called **Blur** ("Trades, tokens, prices, and pools" over WebSocket/gRPC) plus
  "Parsed Data" (coming soon) and "Decoded Shreds" (pre-block parsed txs, paid add-on). None of it is on the docs site.
- **Jito**: only `simulateBundle` (all plans) and "Jito-Solana" as the validator client on dedicated nodes. No bundle sending.
- gRPC pricing: Pro $99/mo (docs: 1 connection; pricing API + site: **2 streams**), or **PAYG $0.08/GB** with a **2-day free
  trial** (solami.dev only). Free/Dev have no gRPC.

## Sources read

Docs site (all 35 sitemap URLs; the key ones):
- https://solami.mintlify.app/ , /quickstart , /authentication , /guides/api-keys
- https://solami.mintlify.app/infrastructure/grpc , /guides/streaming-data , /infrastructure/websocket
- https://solami.mintlify.app/infrastructure/swqos , /guides/sending-transactions , /api-reference/rpc/send-transaction
- https://solami.mintlify.app/infrastructure/rpc , /infrastructure/regions , /infrastructure/shredstream , /infrastructure/dedicated-nodes
- https://solami.mintlify.app/pricing/plans , /pricing/add-ons , /pricing/billing , /api-reference/introduction , /api-reference/rest/usage
- Raw markdown of each page is available at `<page-url>.md` (Mintlify); sitemap at https://solami.mintlify.app/sitemap.xml
- The docs `llms.txt` link (https://docs.solami.fast/llms.txt) does **not** resolve (no DNS for docs.solami.fast).

Product site / machine-readable:
- https://solami.dev/llms.txt (authoritative overview — quotes below), https://solami.dev/sitemap.xml
- https://api.solami.dev/pricing (live plan limits, no auth), https://api.solami.dev/onchain/tip-addresses (no auth)
- SPA bundle `https://solami.dev/assets/index-BW30jqGh.js` (all page copy is client-rendered; grepped for product names)
- npm `solami@0.1.56` (https://github.com/useSolami/solami-js-sdk), crate `solami@0.1.58` (docs.rs source),
  https://github.com/useSolami/grpc-starter-template , https://github.com/useSolami/benchmark-geyser-yellowstone
- Yellowstone: `@triton-one/yellowstone-grpc@7.0.1` tarball (`dist/types/**`), https://github.com/rpcpool/yellowstone-grpc
  (README, `examples/typescript/src/client.ts`, `yellowstone-grpc-geyser/config.json`), context7 `/rpcpool/yellowstone-grpc`.

## Endpoints and auth (as documented vs as shipped)

| Service | Docs site (solami.fast) | solami.dev / SDK | Probe (no key) |
|---|---|---|---|
| RPC | `https://rpc.solami.fast/sol?api_key=KEY` | `https://rpc.solami.dev/sol?api_key=KEY`; regional `ams.`/`fra.`/`nyc.` prefix | both → `401 {"message":"unauthorized"}` |
| WebSocket | `wss://rpc.solami.fast/ws/sol?api_key=KEY` | `wss://rpc.solami.dev/ws/sol?api_key=KEY` | resolves |
| gRPC | `https://grpc.solami.fast?api_key=KEY` | `https://grpc.solami.dev` + `x-token`; regional `https://ams.grpc.solami.dev`, starter uses `https://grpc-ams.solami.fast` | resolves (HTTP 200 on `/`) |
| SWQoS (HTTP) | `https://rpc.solami.fast/sol?api_key=SWQOS_KEY` + `sendTransaction {skipPreflight:true,maxRetries:0}` | — | — |
| Beam (QUIC) | — | `beam.solami.dev:11000`, ALPN `solana-tpu`, client cert derived from a **keypair-type SWQoS key** (`SOLAMI_SWQOS_KEY` base58) | resolves; HTTPS on 443 → 404 |
| Beam (HTTP) | — | llms.txt says `beam-http.solami.dev` | **does not resolve** |
| REST | `https://api.solami.fast` | `https://api.solami.dev` (`/v1/usage`, `/pricing`, `/onchain/*`) | `api.solami.dev` → `{"api":"ok"}` |

Auth: "Query parameter `api_key=`" or "`Authorization: Bearer YOUR_API_KEY`" (https://solami.mintlify.app/authentication).
Key types: RPC Key, gRPC Key, SWQoS Key — "Using the wrong key type for an endpoint returns a `403` error."
Note the two different SWQoS "keys": docs = API key string; JS/Rust SDK Beam = base58 **keypair** used for QUIC client TLS.

Regions: AMS, FRA, NYC live; Dallas, London, Singapore, Tokyo, Bangkok "coming" (https://solami.mintlify.app/infrastructure/regions).
No SG/Tokyo yet → from Malaysia expect ~180–250 ms RTT to AMS/FRA; the listener measures `geyser→us ms` from `createdAt`.

## Rate limits / plans (three sources, three answers)

| Plan | Price | RPS (docs / API) | sendTx/s (docs / API) | gRPC (docs / API+site) | WS conns | Webhooks (API) |
|---|---|---|---|---|---|---|
| Free | $0 | 5 / 5 (site: 10) | 1 / 1 | 0 / 0 | 0 | 1 |
| Dev | $49 | 50 / 50 | 5 / **2** | 0 / 0 | 2 | 3 |
| Pro | $99 | 200 / 200 | 20 / **5** | **1 / 2** | 5 | 10 |
| Ultra | $199 | 500 / 500 | 50 / **10** | 5 / 5 | 10 | 20 |
| Shared Metal | $499 | 2000 / 2000 | 200 / **15** | 10 / 10 | 30 | 50 |
| Titan (API/site only) | $999 | 5000 | 20 | 30 | 60 | 100 |

- Docs: https://solami.mintlify.app/pricing/plans , https://solami.mintlify.app/authentication ; API: https://api.solami.dev/pricing
  (`tiers[].limits.grpc_streams`, `method_limits.sendTransaction`, `max_webhooks`, `included_decoded_shred_connections`).
- Extra gRPC connection: $10/day or $100/month, max 100 (https://solami.mintlify.app/pricing/add-ons).
- PAYG (solami.dev/llms.txt only): RPC "$3 per 1M compute units", gRPC "$0.08/GB", min prepaid balance $5, "2-day free trial" on gRPC.
- 429 on overage; "Sustained bursts that far exceed your limit may result in temporary key suspension."
- Dedicated bare metal from $1,500/mo (unlimited RPS, optional Yellowstone plugin).

## Yellowstone gRPC — what the TS client looks like today

Package: `@triton-one/yellowstone-grpc` **7.0.1** (published 2026-08-31; `latest`). Since v5 the transport is a native
**napi-rs** binding (optional deps `@triton-one/yellowstone-grpc-napi-{darwin-arm64,darwin-x64,linux-x64-gnu,linux-x64-musl}`
0.2.1), not `@grpc/grpc-js`. Node ≥ 20.18. Runtime deps: `@bufbuild/protobuf`, `@solana/{addresses,rpc-api,rpc-types}@^7`
(types only for `txEncode`). Fine next to web3.js v1.

```ts
import Client, { CommitmentLevel, SlotStatus, type SubscribeRequest, type SubscribeUpdate } from "@triton-one/yellowstone-grpc";
const client = new Client(endpoint, xToken, channelOptions /* e.g. { grpcMaxDecodingMessageSize: 64<<20 } */, reconnectOptions?);
await client.connect();
const stream = await client.subscribe();            // Node Duplex (objectMode)
stream.on("data", (u: SubscribeUpdate) => ...);     // u.transaction | u.slot | u.ping | u.pong | ... , u.filters[], u.createdAt: Date
await new Promise((res, rej) => stream.write(request, (e) => (e ? rej(e) : res())));
```

- `SubscribeRequest` needs every map present: `{ accounts:{}, slots:{}, transactions:{}, transactionsStatus:{}, blocks:{},
  blocksMeta:{}, entry:{}, accountsDataSlice:[], commitment?, ping?, fromSlot? }`.
- Transaction filter: `{ vote?, failed?, signature?, accountInclude: string[], accountExclude: string[], accountRequired: string[],
  cuckooAccountInclude?, tokenAccounts?: TokenAccountExpansionControlFlag }`. `accountInclude` is OR; matches against static
  keys **and** ALT-loaded keys. `tokenAccounts: BALANCE_CHANGED|ALL` additionally matches token-balance **owners** (so we could
  watch the vault *owner* instead of each ATA).
- **Commitment is per request/stream, not per filter** → one stream per level, or one processed stream + `slots:{k:{filterByCommitment:false}}`
  and read `SlotStatus.SLOT_CONFIRMED/SLOT_FINALIZED/SLOT_DEAD` for the tx's slot (what `listen.ts --mode=slots` does; Yellowstone
  emits confirmed/finalized tx messages at exactly the slot-status transition, so timings are equivalent).
- `fromSlot` = replay from a past slot (bounded by server retention), not a commitment selector.
- **Updating filters without reconnecting: yes.** Write a new `SubscribeRequest` on the same stream; it *replaces* the filter set
  (README example does `accounts.insertIntoSubscribeRequest(request,"tracked"); stream.write(request)`).
- **Ping**: "Since we sent a `Ping` message every 15s from the server, you can send a subscribe request with `ping` as a reply and
  receive a `Pong`" — a request with `ping:{id}` set does **not** touch filters. Cloudflare/Fly-style LBs drop idle streams.
  `listen.ts` writes `{...empty, ping:{id:1}}` every 10 s. `client.ping(n)` is the unary variant.
- **accountInclude max is server-configured** (`filter_limits.transactions.account_include_max`, default example **10**;
  `filter_limits.transactions.max` default **1** filter). Providers raise these; Solami publishes nothing → ask. v7 adds
  `CompressedAccountFilterSet` (cuckoo filter, "for large account sets", capacity e.g. 2,000,000) with a local exact-match check.
- Parsing `SubscribeUpdateTransaction`: `slot: string`; `transaction.signature: Uint8Array` (64 B → **needs `bs58`**),
  `transaction.transaction.message.{accountKeys: Uint8Array[], instructions[{programIdIndex, accounts: Uint8Array, data: Uint8Array}]}`,
  `transaction.meta.{err, fee, preTokenBalances[], postTokenBalances[], logMessages[], innerInstructions[], loadedWritableAddresses[], loadedReadonlyAddresses[]}`;
  `TokenBalance = { accountIndex, mint: string, owner: string, programId, uiTokenAmount: { amount: string, decimals } }` — amounts as
  decimal strings → `BigInt`. Index token balances into `[...accountKeys, ...loadedWritable, ...loadedReadonly]`.
  Alternative: `txEncode.encode(info, txEncode.encoding.JsonParsed, 0, false)` gives the RPC `jsonParsed` shape (heavier).
- Reconnect: 4th ctor arg `{ backoff:{initialIntervalMs,multiplier,maxRetries}, slotRetention, policy:'RecoverMissedData'|'SkipMissedData' }`
  — native reconnect + gap backfill. Worth turning on in the worker.
- Solami's own benchmark (their repo) shows AMS slot delivery avg 7.8 ms / p50 4.1 ms vs Shyft — from an EU box.

## Solami answers matrix

| Topic | Exists? | Evidence |
|---|---|---|
| "Beam" | **Yes = SWQoS.** "Beam: Stake-weighted priority transaction routing. Free to use with a 0.0001 SOL minimum tip. Endpoints at beam.solami.dev:11000 (QUIC) and beam-http.solami.dev (HTTP)." "Over 5 million SOL of validator stake backs the Beam routing lane." SDK: `client.beam(tx)` (alias `landTransaction`), rejects txs without a tip. | https://solami.dev/llms.txt ; https://solami.dev/swqos ; npm `solami` README; `src/swqos/client.ts` |
| Beam via Jito? | **Not mentioned anywhere.** Beam is a direct QUIC TPU-style lane (ALPN `solana-tpu`) into Solami's staked validators. | SDK source; docs |
| SWQoS HTTP path | **Yes (docs).** Same RPC URL with SWQoS key; "Set `skipPreflight: true` and `maxRetries: 0`. The staked connection manages retry logic". Tip only "required to participate in the tip revenue share program" (up to 6%). | https://solami.mintlify.app/guides/sending-transactions ; /infrastructure/swqos |
| Beam HTTP host | **Unclear** — `beam-http.solami.dev` has no DNS record today. | probe 2026-09-27 |
| Webhooks | **Exists, undocumented.** Pricing API `max_webhooks` per tier; dashboard perms "Manage webhooks: Create, edit, enable/disable, and delete webhooks", "Stream webhooks: Connect to a webhook WebSocket stream to consume events"; delivery URL `wss://{region}.ws.solami.dev/webhooks/stream/{id}?api_key=`; event kinds seen in bundle: `swap, liquidity, token_create, pool_create, transfer, mint, burn, memo`. Docs site: "No webhooks are mentioned". | https://api.solami.dev/pricing ; SPA bundle ; https://solami.mintlify.app/infrastructure/websocket |
| Decoded DEX market data | **Exists as "Blur"** — "Decoded trades, launches & token data", transport "WebSocket / gRPC", "Trades, tokens, prices, and pools"; "Blur Stream Prebuilt" (soon): "The event, with an unsigned transaction attached" over "WebSocket / gRPC / Webhook". Also "Parsed Data — Decoded transactions & events" (**coming soon**), "Decoded Shreds — Parsed transactions before the block" ($39/day, $499/mo via pricing API `decoded_shreds`). No API shape, DEX list or latency published. | SPA bundle (`/docs/blur`, `/parsed-data`, `/decoded-shreds`, `/terminal`) ; https://api.solami.dev/pricing |
| gRPC max accounts per `accountInclude` | **Not published.** Docs only say "Filtered transaction streams by program or account". | https://solami.mintlify.app/infrastructure/grpc |
| Update subscription without reconnect | **Yes (protocol).** Yellowstone replaces filters on a new `SubscribeRequest` on the same stream. Solami runs stock Yellowstone ("Solami's gRPC endpoint uses the Yellowstone protocol"); proxy behaviour unverified. | rpcpool README ; Solami gRPC page |
| gRPC stream cap | Docs: Pro 1 / Ultra 5 / Shared Metal 10 connections. Pricing API + site: Pro **2** / Ultra 5 / SM 10 / Titan 30 `grpc_streams`. Add-on $10/day or $100/mo each. Unclear whether a "connection" = TCP channel or one subscribe stream. | /infrastructure/grpc ; api.solami.dev/pricing |
| Rate limits / tiers | Yes — table above; disagreements between docs and pricing API on sendTx/s. | /authentication ; /pricing/plans ; api.solami.dev/pricing |
| RPC endpoint format | `https://rpc.solami.fast/sol?api_key=` (docs) ≡ `https://rpc.solami.dev/sol?api_key=` (SDK); Bearer header also accepted. | /quickstart ; SDK `config.ts` |
| Jito bundles | **Simulation only**: "Solami supports Jito bundle simulation on all plans via the `simulateBundle` RPC method." Dedicated nodes choose validator client "Jito-Solana, the default. Required for simulateBundle." No `sendBundle`. | /guides/sending-transactions ; SPA bundle |
| Other products spotted | ShredDirect (UDP shreds, $30/day–$350/mo), Mirage ("Yellowstone frames over plain WebSocket"), Index Engine (GraphQL), Leader Tracking, Track Transaction ("Look up any Beam transaction by signature"), Edge anycast, Kanal validator network, `POST /onchain/build-unsigned`, `/onchain/solana/build-and-execute-instructions`, `/onchain/solana/sign-prebuilt-transaction`. | https://solami.dev/llms.txt ; SPA bundle |

## Draft message to Solami (Discord discord.gg/EGyCHpphtt · Telegram t.me/useSolami)

Questions already answered by the docs/SDK and therefore dropped: *what Beam is* (SWQoS over QUIC, tip ≥ 0.0001 SOL) and
*whether filters can be updated without reconnecting* (Yellowstone protocol: yes). Narrowed the rest:

> Hi Solami team — we're building Kutip (AI collections agent for Malaysian exporters; Solana track + your prize) on your
> gRPC + Beam. A few things we couldn't find in docs.solami.fast:
> 1. gRPC: what's the max number of pubkeys per `accountInclude` on a transaction filter, and how many filters per stream?
>    Our worker watches every open invoice's reference key + vault ATA (hundreds → low thousands). Does Pro's "1 connection"
>    (pricing API says 2 `grpc_streams`) count TCP channels or subscribe streams?
> 2. Beam: is the HTTP path (`sendTransaction` on the RPC URL with a SWQoS key, `skipPreflight:true,maxRetries:0`) the same
>    staked lane as QUIC `beam.solami.dev:11000`? Is the 0.0001 SOL tip required on the HTTP path too? `beam-http.solami.dev`
>    from llms.txt doesn't resolve for us.
> 3. Webhooks show up in the dashboard and pricing API (`max_webhooks`), but there are no docs. Can we get HTTP POST delivery
>    (not just the WS stream) filtered by account / `transfer` + `memo` events, and what's the payload?
> 4. gRPC keepalive: on your geyser (15.2.1) a `SubscribeRequest` carrying only `ping` (empty filter maps) replaced our
>    filters and the stream went silent. The rpcpool README example sends exactly that. Is that intended on your side?
>    We now resend the full filters with every ping — fine, but worth a doc note.
> 5. Our SWQoS-type key returns `401 unauthorized` on `rpc.solami.dev/sol?api_key=…` while the RPC key works. Is SWQoS
>    included in our plan, and is the endpoint the same host?
> 6. Blur / Parsed Data: is there a doc for the decoded trade/price stream — API shape, which DEXes, typical latency? We'd use
>    it for the execution receipt on Jupiter ExactOut payments.
> Thanks — happy to share latency numbers from our spike (KL → AMS) in return.

## Scripts (this directory)

| File | What it does | Mainnet write? |
|---|---|---|
| `listen.ts` | Yellowstone subscription through Solami on N pubkeys. `--mode=slots` (default, 1 stream: tx@processed + slot statuses) or `--mode=streams` (3 streams, one per commitment). Logs `Date.now()` per level, prints table (t_processed / t_confirmed / t_finalized / deltas / geyser→client lag), verifies mint = USDC, amount delta, destination ATA + owner, memo utf8, failed flag. Ping every 10 s. | no |
| `trigger.ts` | 0.1 USDC `transferChecked` TEST_BUYER ATA → `--to-ata`/`--to-owner`, fresh reference pubkey as read-only key, Memo `k_test01`, fee payer = FEE_PAYER, v0 tx, CU limit 40k / price 10k µlamports. Prints reference first, read-only preflight (ATAs exist, USDC mint, balances; never creates ATAs), waits for `y`, sends via normal RPC, polls statuses → processed/confirmed/finalized ms, slot landed, Solscan link. | **yes** (0.1 USDC + ~5.4k lamports fee) |
| `send-compare.ts` | `--rounds N` × {normal RPC `sendTransaction` skipPreflight=false/maxRetries=3, SWQoS key `skipPreflight=true/maxRetries=0` + 0.0001 SOL tip (`--no-tip`)} of 1000-lamport FEE_PAYER → TEST_BUYER transfers, order alternated per round, waits for `y`, table of →processed / →confirmed ms and slots elapsed. | **yes** (≈ 2×6k lamports + 100k tip per round) |

Run (after deps are installed — see below):
```
pnpm --filter @kutip/spikes exec tsx c-solami/trigger.ts --to-owner <destOwner>   # prints reference + listener command, then waits
pnpm --filter @kutip/spikes exec tsx c-solami/listen.ts <reference> <destAta>     # in a second terminal, then answer `y` in the first
pnpm --filter @kutip/spikes exec tsx c-solami/send-compare.ts --rounds 3
```
Env from repo-root `.env` via `process.loadEnvFile` (Node 22; no dotenv). Existing vars used: `SOLAMI_RPC_URL`, `SOLAMI_API_KEY`,
`SOLAMI_GRPC_URL`, `USDC_MINT`, `FEE_PAYER_SECRET`, `TEST_BUYER_SECRET`. **New vars to add to `.env.example`** (outside this
spike's lane): `SOLAMI_GRPC_KEY` (gRPC-type key; falls back to `SOLAMI_API_KEY`), `SOLAMI_SWQOS_KEY` (SWQoS-type key),
optional `SOLAMI_SWQOS_RPC_URL`. Secrets are never printed.

## npm deps to add to `spikes/package.json` (not installed by this agent)

```
pnpm --filter @kutip/spikes add @solana/web3.js@1.99.0 @solana/spl-token@0.4.15 bs58@6.0.0 @triton-one/yellowstone-grpc@7.0.1
```
- `@solana/web3.js` 1.99.0 (latest v1; already in the workspace store), `@solana/spl-token` 0.4.15, `bs58` 6.0.0 (ESM, default
  export; needed for 64-byte signatures and for decoding the base58 secret keys), `@triton-one/yellowstone-grpc` 7.0.1
  (pulls a platform napi binary; darwin-arm64 + linux-x64 are published, so Mac dev and Fly/Railway are covered — **Alpine needs
  the musl build**, which exists).
- Not used: `solami` npm SDK 0.1.56 (pins old `@triton-one/yellowstone-grpc@^1.4.0` + `@matrixai/quic`). Only needed if we want
  Beam over QUIC: `builder().withRpc(tok).withSwqos(keypairB58).build()` → `client.beam(tx)`; it warns the process must stay alive
  ~2 s after send or QUIC drops the FIN.

## Caveats before running

1. gRPC needs a **Pro plan or PAYG balance** (Free/Dev = 0 streams); the 2-day free trial is on solami.dev PAYG.
2. Use `--mode=slots` on Pro — the 3-stream mode may exceed the per-plan stream count (2 per pricing API).
3. Solami hasn't published its `filter_limits`; if the subscription is rejected with a "limit exceeded"/INVALID_ARGUMENT status,
   that answers question 1 for us.
4. The worker's real design follows from this spike: one processed stream + slot statuses (cheap, ordered, exactly what
   `processed → Seen / confirmed → Paid / finalized → Settled` needs), `tokenAccounts: BALANCE_CHANGED` on vault owners as an
   alternative to enumerating ATAs, native reconnect with `RecoverMissedData`.

## Results — mainnet run 2026-09-27 → **PASS (detection), PARTIAL (SWQoS)**

Endpoint `https://grpc.solami.dev`, `x-token` auth accepted. Server: `yellowstone-grpc-geyser 15.2.1`, proto 12.7.0, solana 4.2.2, hostname `Amsnode` (Amsterdam; we are in KL).

### Run 1 — MISSED (bug in our keepalive)
Payment `5LsZT1GTvkUDhnSqhwsbT7oKT1NkMLFHgUKtG88b7MDSEaazSAxVMR65QH6DSHQ1ZNgrjkSwsY6qfNQEeuCW5XTb` (0.1 USDC, reference `EjhV2n9JfptaaMs19E7dieXE9VXBD6c41XDrbfAKx1mn`) landed in slot 450774272 (RPC polling: confirmed +1481 ms, finalized +9618 ms) but the stream logged nothing.
Diagnosis with `--debug` on the Memo program: 5 676 tx updates in the first 11 s, then **silence from the moment the first 10 s keepalive fired**. On Solami's geyser a `SubscribeRequest{ping, <empty filters>}` **replaces the filters** (the rpcpool README example sends exactly that and implies it is filter-neutral — not true here). Fix: send the ping *with the full filter set*. Worth telling Solami.

### Run 2 — CAUGHT
Payment `dcjRjvhqds1qSRKmyKYCtXN4efPaY9sZZic7BvyBh3MacT6NQ7oi8ySxB7PZe6xouTGB83EGzMJwPhE8RQP5r6i`, reference `F8JhQa4Tvta6ptnR77nyUva7aQ9uq1whdWp2oH8ngwX`, destination buyer vault ATA `FQ1kmSvQqNzdqaKspuaY4XL7D53ZUFQGoPyzRL1WdATS`, sent 19:59:55.622Z (slot at send 450775707), landed slot 450775710. Listener had been up 45 s (two keepalives) before the send.

| level | stream timestamp | from send | note |
|---|---|---|---|
| processed | 19:59:56.160 | **+538 ms** | `createdAt` lag geyser→us 60 ms; both `accountInclude` keys matched |
| confirmed | 19:59:56.353 | +731 ms (proc→conf 193 ms) | via slot-status on the same stream (RPC polling saw confirmed at +751 ms) |
| finalized | 20:00:04.866 | +9 244 ms (conf→fin 8 513 ms) | |

Parsed from `meta`: `mint=USDC amount=+100000 dest=FQ1k…dATS destOwner=4kns…YDte memo="k_test01" status=ok`. Everything F6 needs is in the processed update.

### Send-path comparison (`send-compare.ts`)
- normal `sendTransaction` via `rpc.solami.dev`: `5AGnAKtVUEVjHPvd8Ur8Nn3AqTyvjSk8xzj8qrMWrwLk4M4qxC4FSEdFr3JT6htQbMh4BGknJqtAgxrtTFxRcUs9`, **confirmed +808 ms, 4 slots**.
- SWQoS path (same host, `?api_key=<SOLAMI_SWQOS_KEY>`, `skipPreflight:true, maxRetries:0`): **`401 {"message":"unauthorized"}`** — the key in `.env` is not accepted as a SWQoS key (docs: wrong *type* gives 403, so this is not-a-valid-key or SWQoS not enabled on the plan). Not measured. Re-run `send-compare.ts --yes` once a SWQoS-type key exists.
