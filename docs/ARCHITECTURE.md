# Architecture

## Components

```
                     ┌──────────────────────────── apps/web (Next.js, Vercel) ─────────────────────────────┐
 Owner (passkey) ──► │ Dashboard · Invoices · Agent log · Rulebook · Treasury                              │
                     │ /pay/[invoiceId]            buyer pay page (QR, amount, "no gas needed")             │
 Buyer wallet ─────► │ /api/pay/[invoiceId]        Solana Pay transaction request (GET label, POST build tx)│
 Buyer AP bot ─────► │ /api/x402/invoice/[id]      x402 v2 endpoint + self-hosted facilitator verify/settle │
                     └───────────────┬──────────────────────────────────────────┬───────────────────────────┘
                                     │ packages/solana (tx builders, verify)     │ Supabase Realtime (status)
                                     ▼                                           │
                     ┌──────────────────────── Supabase Postgres (packages/db) ──┴──────────────┐
                     └───────────────▲──────────────────────────────────────────────────────────┘
                                     │
                     ┌───────────────┴──────────── apps/worker (Node, Fly/Railway) ─────────────┐
 Solami gRPC ──────► │ listener: reference keys + vault ATAs → verify → status updates          │
                     │ sweeper: spending-limit sweeps (batched, randomised)                     │
                     │ agent loop: rules engine + Jev + Haiku (packages/agent)                  │
                     │ scheduler: reminders, cash-out alerts, fee-payer health                  │
                     └──────────────────────────────────┬───────────────────────────────────────┘
                                                        ▼
                                        Solami RPC / SWQoS send · Jupiter API · Resend · BNM API
```

## Package ownership

| Path | Owns | Must not |
|---|---|---|
| `apps/web` | UI, API routes (thin: validate → call packages) | Contain tx-building logic inline |
| `apps/worker` | Long-running processes | Serve HTTP beyond a health check |
| `packages/solana` | All transaction construction, Squads helpers, payment verification, Jupiter client, screening | Touch the DB |
| `packages/agent` | Rules engine, Jev client, Haiku client, prompts | Sign transactions |
| `packages/db` | Drizzle schema, migrations, typed queries | Business logic |
| `scripts/` | One-shot provisioning (read-only phase first, skip-if-done) | Be imported by apps |

## Data model (initial)

```
exporters        id, name, owner_user_id, treasury_multisig, treasury_vault, treasury_usdc_ata, rulebook jsonb
users            id, exporter_id, privy_user_id, wallet_pubkey, role
buyers           id, exporter_id, name, email, country, timezone,
                 multisig, vault, usdc_ata, spending_limit_pda
invoices         id, exporter_id, buyer_id, number (off-chain only), line_items jsonb,
                 amount_usdc bigint (base units, 6dp), due_date, status,
                 reference_pubkey, memo_code, created_at
payments         id, invoice_id, signature, payer, mint, amount bigint, input_mint, input_amount,
                 quoted_out, commitment ('processed'|'confirmed'|'finalized'), slot, verified bool, issues jsonb
screenings       id, wallet, invoice_id, result ('pass'|'flag'), reasons jsonb, created_at
agent_actions    id, exporter_id, buyer_id, kind, input_summary, decision, confidence, rule_id,
                 status ('proposed'|'approved'|'executed'|'rejected'|'escalated'), tx_signature, created_at
messages         id, invoice_id, direction ('out'|'in'), channel, body, classification, created_at
sweeps           id, buyer_ids[], amount bigint, signature, scheduled_for, executed_at
```

Amounts: always integer base units (`bigint`), never floats. MYR shown via BNM reference rate at display time.

## Invoice status machine

```
draft → sent → seen(processed) → paid(confirmed) → settled(finalized)
          │                 ↘ partially_paid ↗
          ├→ overdue (due_date passed, unpaid) → paid…
          └→ disputed (agent escalation)
```

## Keys

| Key | Holds | Where |
|---|---|---|
| Owner | Squads member, all permissions | Privy embedded wallet (passkey) |
| Agent | Squads member, Initiate only + spending limits | Server env (KMS later) |
| Fee payer | Small SOL float, pays tx fees | Server env; never appears in instruction accounts |

## Environment variables (see `.env.example`)
`SOLAMI_API_KEY`, `SOLAMI_RPC_URL`, `SOLAMI_GRPC_URL`, `SOLANA_CLUSTER`, `USDC_MINT`, `FEE_PAYER_SECRET`, `AGENT_SECRET`, `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_PRIVY_APP_ID`, `PRIVY_APP_SECRET`, `ANTHROPIC_API_KEY`, `TYPESAFE_API_KEY`, `RESEND_API_KEY`, `APP_URL`.
