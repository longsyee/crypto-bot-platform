# CTO Orchestrate: Full Platform QA & Paper Trading Fix

## Objective
Run a comprehensive QA audit + security review across the entire crypto bot trading platform. Fix the **paper trading DCA balance error** shown in the screenshot (insufficient BTC balance when paper balance is in USDT). Identify all bugs, edge cases, missing validation, and race conditions.

## Scope
1. **Paper Trading** — balance checking logic for buy orders (checking base currency instead of quote)
2. **DCA Loop** — error handling when balance insufficient, loop should stop bot instead of spamming errors
3. **Signal Bot** — webhook signature validation, payload parsing, queue handling
4. **Auth Flows** — login, register, OTP verify, forgot password, reset password, token refresh
5. **Wallet** — deposit address generation, HD wallet derivation, BSC monitoring, sweeper
6. **Exchange Connections** — API key encryption, balance fetching, market listing
7. **Admin Dashboard** — role middleware, IP allowlist, audit logging
8. **Referral System** — tier calculation, commission ledger, payout accuracy
9. **Fee Calculation** — trade fee application, global fee rate enforcement
10. **Log Server** — ingestion, streaming, query performance, auth
11. **SSE** — connection handling, reconnection, memory leaks

## Must Fix Now
- `apps/worker/src/exchange/ccxt-connector.ts` line 143: paper `buy` orders check base currency balance instead of quote currency
- `apps/worker/src/engine/dca-loop.ts`: catch insufficient balance → stop bot gracefully instead of infinite error loop

## Files to Audit
- `apps/worker/src/exchange/ccxt-connector.ts`
- `apps/worker/src/engine/dca-loop.ts`
- `apps/worker/src/engine/signal-handler.ts`
- `apps/worker/src/exchange/connector.ts`
- `apps/api/src/routes/auth.ts`
- `apps/api/src/routes/bots.ts`
- `apps/api/src/routes/webhooks.ts`
- `apps/api/src/routes/wallets.ts`
- `apps/api/src/middleware/auth.ts`
- `apps/api/src/middleware/role.ts`
- `apps/api/src/services/email.ts`
- `apps/web/src/hooks/use-api.ts`
- `apps/web/src/lib/api-client.ts`
- `apps/wallet/src/services/hd-wallet.ts`
- `apps/wallet/src/services/monitor.ts`
- `apps/wallet/src/services/sweeper.ts`
- `packages/shared/src/index.ts`
- `packages/prisma/prisma/schema.prisma`

## Deliverables
- Bug report with severity (critical/high/medium/low)
- Edge case list
- Race condition analysis
- Suggested fixes with file/line references
- Paper trading balance fix (implemented)
