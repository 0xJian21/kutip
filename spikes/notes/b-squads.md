# Spike B — Squads v4 spending-limit sweep: findings

Sources checked (2026-09-27): `@sqds/multisig` 2.1.4 on npm (= `sdk/multisig` in
Squads-Protocol/v4 at `af94153`, 2026-08-20), program source
`programs/squads_multisig_program/src/instructions/{spending_limit_use,config_transaction_execute,multisig_create,proposal_create,proposal_vote}.rs`,
the official example `tests/suites/examples/spending-limits.ts`, and docs.squads.so
(context7 `/websites/squads_so_main_development`). Not from memory.

Script: `spikes/b-squads/run.ts` (state in `spikes/b-squads/state.json`, public keys + signatures only).

## Dependencies (not installed yet — add to `spikes/package.json`)

| package | version | note |
|---|---|---|
| `@sqds/multisig` | `^2.1.4` (latest; `canary` tag is 1.11.0-canary, ignore) | depends on `@solana/web3.js ^1.70.3` and `@solana/spl-token ^0.3.6` (caret, **not pinned**); pnpm may install its own spl-token 0.3.x copy next to ours, harmless (only `getAssociatedTokenAddressSync` is used internally) |
| `@solana/web3.js` | `^1.99.0` (v1 line; do not use 2.x) | shared with Solana Pay |
| `@solana/spl-token` | `^0.4.15` | peer `@solana/web3.js ^1.95.5` |
| `bs58` | `^6.0.0` | decode base58 secret keys |

No `dotenv`: Node 22 `process.loadEnvFile(path)` is used. Run: `pnpm --filter @kutip/spikes exec tsx b-squads/run.ts`.
Mainnet program id: `SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf` (`multisig.PROGRAM_ID`).

## Key finding: allowlist semantics (owner vs token account)

**`destinations` holds the destination OWNER wallet, not the token account.** DECISIONS.md D1
currently says "destinations allowlist = main treasury ATA" — that is wrong; it must be the
treasury **vault PDA** (or whichever wallet owns the receiving ATA).

From `spending_limit_use.rs`:

```rust
#[account(mut)]
pub destination: AccountInfo<'info>,                       // the owner
#[account(mut, token::mint = mint, token::authority = destination)]
pub destination_token_account: Option<InterfaceAccount<'info, TokenAccount>>,
...
if !spending_limit.destinations.is_empty() {
    require!(spending_limit.destinations.contains(&self.destination.key()),
             MultisigError::InvalidDestination);
}
```

The SDK (`instructions/spendingLimitUse.ts`) takes `destination: PublicKey` (owner) and derives
`destinationTokenAccount = getAssociatedTokenAddressSync(mint, destination, allowOwnerOffCurve=true)`.
So the receiving ATA must be the canonical ATA of the owner (pre-create it; the program does not
create it) and the allowlist entry is the owner. Empty `destinations` = any address allowed.

Consequences:
- Buyer spending limit: `destinations: [treasuryVaultPda]`, agent calls
  `spendingLimitUse({ destination: treasuryVaultPda, mint: USDC })`; funds land in the treasury vault's USDC ATA.
- A non-canonical token account owned by the treasury cannot be targeted through the SDK helper (it always
  derives the ATA); the raw instruction could pass any token account whose authority is the allowlisted owner.

## Expected error for a disallowed destination

`MultisigError::InvalidDestination` — Anchor code **6025 = 0x1789**, message `Invalid destination`.
SDK class `InvalidDestinationError` (`name === 'InvalidDestination'`), reachable via
`multisig.errors.translateAndThrowAnchorError(errWithLogs)` (cusper over `err.logs`).

Caveat: Anchor evaluates the `#[account(...)]` constraints before `validate()`. If the disallowed
destination has **no USDC ATA**, the tx fails earlier with Anchor `AccountNotInitialized` (3012 / 0xbc4),
not `InvalidDestination`. The script therefore uses the OWNER wallet (which has a USDC ATA) as the
non-allowlisted destination. Other relevant errors: `Unauthorized` 6004/0x1774 (signer not in
`spending_limit.members`), `SpendingLimitExceeded` 6026/0x178a, `InvalidMint` 6024/0x1788,
`DecimalsMismatch` 6027/0x178b.

With preflight on (`skipPreflight: false`, the default) the negative tx is rejected in simulation and
no fee is paid.

## Exact SDK surface used (all verified in 2.1.4 source)

```ts
import * as multisig from "@sqds/multisig";
const { Permission, Permissions, Period } = multisig.types;   // Period enum: OneTime | Day | Week | Month
multisig.PROGRAM_ID
multisig.getProgramConfigPda({})                 -> [PublicKey, bump]
multisig.getMultisigPda({ createKey })          -> [PublicKey, bump]
multisig.getVaultPda({ multisigPda, index })    -> [PublicKey, bump]   // index 0..255
multisig.getSpendingLimitPda({ multisigPda, createKey })
multisig.getTransactionPda({ multisigPda, index: bigint })
multisig.getProposalPda({ multisigPda, transactionIndex: bigint })
multisig.accounts.ProgramConfig.fromAccountAddress(connection, pda)  // .treasury, .multisigCreationFee (bignum)
multisig.accounts.Multisig.fromAccountAddress(...)       // .transactionIndex (bignum), .members
multisig.accounts.SpendingLimit.fromAccountAddress(...)  // .amount, .remainingAmount, .members, .destinations
```

Instruction builders (`multisig.instructions.*`, return `TransactionInstruction`; `multisig.rpc.*` has the
same params plus `connection`/`feePayer: Signer` and sends without confirming, so the script builds its own tx):

```ts
multisigCreateV2({ treasury, createKey, creator, multisigPda, configAuthority: null, threshold: 1,
                   members: Member[], timeLock: 0, rentCollector, memo? })
  // signers: creator (pays rent + creation fee) and createKey (ephemeral, must sign to prevent front-running).
  // program_config PDA is derived internally; `treasury` must equal ProgramConfig.treasury.
configTransactionCreate({ multisigPda, transactionIndex: bigint, creator, rentPayer?, actions, memo? })
  // creator must be a member with Initiate. actions: [{ __kind: 'AddSpendingLimit', createKey, vaultIndex,
  //   mint, amount: beet.bignum (number|BN — NOT bigint), period: Period.Day, members: PublicKey[], destinations: PublicKey[] }]
  // Only for autonomous multisigs (configAuthority null); controlled ones use multisigAddSpendingLimit instead.
proposalCreate({ multisigPda, transactionIndex, creator, rentPayer?, isDraft? })   // creator needs Initiate or Vote
proposalApprove({ multisigPda, transactionIndex, member, memo? })                  // member needs Vote
configTransactionExecute({ multisigPda, transactionIndex, member, rentPayer?, spendingLimits?: PublicKey[] })
  // member needs Execute; spendingLimits are passed as writable remaining accounts; rentPayer + system program
  //   are required for AddSpendingLimit (account is created here).
spendingLimitUse({ multisigPda, member, spendingLimit, mint?, vaultIndex, amount: number, decimals,
                   destination, tokenProgram?, memo? })
  // member must be in spending_limit.members (need NOT be a multisig member). Omit mint for SOL.
```

`Member = { key: PublicKey, permissions: Permissions }`; `Permissions.all()`,
`Permissions.fromPermissions([Permission.Initiate])` (Initiate=1, Vote=2, Execute=4).

## Flow / can threshold 1 skip the proposal?

No. `config_transaction_execute` requires a `Proposal` account in status `Approved`; `proposal_approve`
requires status `Active`; so create → proposalCreate → proposalApprove → execute is mandatory even at
threshold 1. What you *can* do (and the official example does) is put `configTransactionCreate`,
`proposalCreate` and `proposalApprove` in a single transaction; execute goes in a second transaction.
(`timeLock: 0` means execute could technically follow in the same tx too; kept separate for clarity.)
Adding a spending limit does **not** invalidate prior transactions (no `stale_transaction_index` bump).

`spending_limit.members` is tracked independently of multisig membership: a wallet removed from the
multisig can still use the limit until the limit is removed (`RemoveSpendingLimit` config action).
Period reset: `Day` = 86400 s from `last_reset`; `remaining_amount` resets on first use after the period.

## Rent estimates (mainnet, 6960 lamports/byte incl. 128-byte overhead; script prints live numbers)

| account | size | rent | reclaimable |
|---|---|---|---|
| Multisig (2 members) | 198 B | 0.002269 SOL | no |
| USDC ATA | 165 B | 0.002039 SOL | no (close manually) |
| ConfigTransaction (1 AddSpendingLimit, 1 member, 1 dest) | 232 B | 0.002506 SOL | yes, `configTransactionAccountsClose` to `rentCollector` |
| Proposal (2 members) | 262 B | 0.002714 SOL | yes, same |
| SpendingLimit (1 member, 1 dest) | 203 B | 0.002304 SOL | yes, on `RemoveSpendingLimit` (to rentPayer) |

Per buyer onboarding: 1 multisig + 1 ATA + limit (config tx + proposal + limit) ≈ **0.0118 SOL**, of which
≈ 0.0052 SOL comes back if we close the config tx + proposal (we set `rentCollector = FEE_PAYER`).
Whole spike (2 multisigs, 2 ATAs, 1 limit, 7 txs at 5k lamports + ≤10k priority each) ≈ **0.0165 SOL**.
Creation fee: `ProgramConfig.multisigCreationFee` was 0 on 2026-09-26 (D1); step 0 re-reads it and the
prompt shows the live value before creating anything.

## Things to watch in the run

- Every `multisig.instructions.*` here is signed by FEE_PAYER (tx fee + rent) plus the acting member; the fee payer
  does appear as `creator`/`rent_payer` in Squads instruction accounts. That is fine for admin txs we run
  ourselves; D4 ("fee payer never in instruction accounts") is about customer payment txs we co-sign.
- `amount` at the SDK boundary is `number` (spendingLimitUse) / `beet.bignum` (config action). We keep bigint
  internally and `Number()` it with a MAX_SAFE_INTEGER assert.
- The idempotent ATA instruction is used only in the admin step 3, never inside a payment (D4).
- `state.json` lives next to the script; it holds only public data. Consider adding it to `.gitignore`.

## Results — mainnet run 2026-09-27 (Solami RPC) → **PASS**

All 8 steps completed; every address/signature is in `state.json` (gitignored) and reproduced here.

| Step | What | Signature / result |
|---|---|---|
| 1 | buyer multisig `J9k4BTxAE9d4iapnJo9AsCrVKhrQ9qYKpXe5aM49zzcR` (vault `4knsrLskrCc1KBmQ5baYEBkaXmK73izrA7TNgvqiYDte`, USDC ATA `FQ1kmSvQqNzdqaKspuaY4XL7D53ZUFQGoPyzRL1WdATS`) | `5DgvmWd14qrCAya6dUJ98QYsp3UHBQXYQpQn8QqoCjKVnfHgQzMip9B9GvTGiS2Zc92ZxeUfGoxHS8wFWAZcU89F` |
| 2 | treasury multisig `HWBKQncjh9b95jiRsP9Ypy6RSinQYgjUzditxEW9G1ur` (vault `2HYRBK6y9ibDM3cdRVpdrmhZoDqTEqiQaC8hq4uUzSuM`, USDC ATA `6b85KZmzapHBE2pQtEnMywor9yXedsLp2yJH7T16vmdB`) | `33sUrPk3jJdMfZ2LnPkQCyMhiXfDAcqgkGDrrrwfE9dqkLEBtduNF26epFbTQsoTiBdar2HPvqoVNU2Qd9JQazpe` |
| 3 | both vault USDC ATAs (idempotent create, payer FEE_PAYER) | `61GMP7grJhemZDFqgMWQL4TthJSucLahbnbr3gfc4ZE4jr8UkQ2t43pKJKE9sAVDPJVZoE9xwL5vQu46rk6uRrpX` |
| 4a | configTransactionCreate + proposalCreate + proposalApprove in ONE tx (owner) | `3JuHhf23AwtQh8p3c7qdKxv9wkegCiJxYFZNh6zg6iFHswxenJ3YDkZAfifbgKd2K2pXzuCAvLVNdVW3omFX8Ex3` |
| 4b | configTransactionExecute → SpendingLimit `GhWvgWfVffB97Uf9rR7yuWatWRwFnwoJABwtNJ58krMP` (1 USDC / Day, members=[AGENT], destinations=[treasury **vault PDA**]) | `4PifupaJj6Cj6CHnfRBEVw8HzYSw4ufNhHEZroTfGxBnw981wGSrR3ZKD3v94gCtcPkVdeMNtwATAzC8zvfvDF2b` |
| 5 | 0.5 USDC TEST_BUYER → buyer vault ATA | `4gu71Um7P8cbown4VRLM7caEM3GsLFx54SRkV4yc37RVFTRdoc4dP5DRMGjaTzeodeo18p48Mqk328EVscArXt4M` |
| 6 | AGENT `spendingLimitUse` 0.5 USDC → treasury vault ATA (buyer vault 500000 → 0, treasury 0 → 500000) | `335XEGwiUdmxUJ9vqibYNQjh31wUCBbrkSMKY1zqrtFXC5kCn71D1F7avda3KrogNXqHzdtedekTpVV2aTNYSBxq` |
| 7 | AGENT `spendingLimitUse` 0.1 USDC → OWNER wallet (not allowlisted) | **rejected in preflight**: `AnchorError … spending_limit_use.rs:125 … InvalidDestination (6025 / 0x1789)`; no fee charged |
| 8 | SOL spent (FEE_PAYER 0.050000 → 0.038084) | **0.011916 SOL** total = rent for 2 multisigs + 2 ATAs + config tx + proposal + spending limit + 7 tx fees; multisigCreationFee = 0 |

Observations
- `SpendingLimit.destinations` = destination **owner** (vault PDA), confirmed on-chain: `destinations [2HYRBK…zSuM]`, and the SDK derived the ATA `6b85…vmdB` itself.
- Rent per buyer (multisig + ATA) ≈ 0.0037 SOL; the config-tx + proposal rent (≈0.0038 SOL) is reclaimable via `rentCollector` after execution.
- web3.js `confirmTransaction` failed against Solami because it derives the WS URL from the RPC URL (`wss://rpc.solami.dev/sol…` → HTTP 405); Solami's WS lives at `/ws/sol`. Step 1's tx had actually landed. Fixed by passing `wsEndpoint` and confirming via `getSignatureStatuses` polling.
- First tx (step 1) fee was 20 000 lamports with CU price 50 000 µL × 200k CU cap: the cap is fine but lower the CU limit per tx type in production.
