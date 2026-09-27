# Worker test fixtures (mainnet, read-only recordings)

Raw `getTransaction(sig, { encoding: "json", maxSupportedTransactionVersion: 0 })` results unless noted.
Buyer vault = Spike B's `4knsrL…iYDte`, vault USDC ATA `FQ1kmS…dATS`.

| File | Signature | What it is |
|---|---|---|
| `spike-c-usdc.json` | `dcjRjvhq…r6i` | Spike C: 0.1 USDC TEST_BUYER → vault, memo `k_test01`, reference `F8JhQa4T…gwX` |
| `spike-a-usdc-solflare.json` | `4v6jfSP7…iWJeD` | Spike A: 0.1 USDC from Solflare, fee payer sponsored |
| `spike-a-usdc-phantom.json` | `2zz4Y7Da…hiEed4H` | Spike A: 0.1 USDC from Phantom |
| `spike-a-swap-solflare.json` | `3QsG2Evn…KDagjuEk` | Spike A2: Jupiter ExactOut SOL → 0.5 USDC (Whirlpool), reference = trackingAccount `rmLAT…9xYz` |
| `spike-a-swap-phantom.json` | `2gPKLU8T…Z4ZbPE4` | Spike A2: same via PancakeSwap |
| `spike-b-sweep.json` | `335XEGwi…SBxq` | Spike B: agent spending-limit sweep out of the vault (not a payment) |
| `session3-x402-bot.json` | `5dwTEjSH…DZDN` | Session 3: x402 bot payment, memo `k_jn48bseb` |
| `session4-live-usdc.json` | `2Kr2ZYrP…Pn567` | Session 4 live proof, memo `k_y7yzh7a6`, reference `GN5mg…aSBa` |
| `grpc-2Kr2ZYrP.json` | same | The same tx as the Solami gRPC stream delivered it (`RECORD_GRPC_DIR`; Buffers as `{type:"Buffer",data}`) |
| `bnm-*.json` | — | BNM Open API USD, session 1200, quote rm: latest (2026-09-25) and the Aug/Sep 2026 months |
