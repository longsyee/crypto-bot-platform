# QA Backend Code Review Report

**Reviewer:** QA Agent Beta  
**Date:** 2026-05-29  
**Scope:** API routes, middleware, encryption, wallet HD generation, DCA engine, fee applier  

---

## Summary

| Metric | Count |
|--------|-------|
| Issues Found | 19 |
| Critical | 5 |
| High | 7 |
| Medium | 4 |
| Low / Info | 3 |

---

## Issues Table

| File | Line | Issue | Severity | Status |
|------|------|-------|----------|--------|
| `apps/api/src/routes/bots.ts` | 27 | `zValidator` applies `BotConfigSchema` to the entire request body, but the body shape is `{ connectionId, name, mode, config }`. Valid requests are rejected. Handler also redundantly re-parses `body.config`. | Critical | Open |
| `apps/api/src/routes/admin.ts` | 82 | `/refund` reads `amount` from raw JSON with zero validation. A negative value is passed to `tokenBalance: { increment: amount }`, decrementing the victim's wallet (fund theft). | Critical | Open |
| `apps/wallet/src/services/hd-wallet.ts` | 4 | Hardcoded fallback mnemonic (`abandon abandon ...`). If `WALLET_MNEMONIC` is unset, every wallet derives from a publicly known seed, compromising all private keys. | Critical | Open |
| `apps/worker/src/engine/dca-loop.ts` | 53-92 | DCA `botStates` is in-memory only. On worker restart, `startDcaLoop` places a brand-new base order instead of restoring previous VWAP / position state, causing duplicate entries and incorrect math. | Critical | Open |
| `apps/worker/src/services/fee-applier.ts` | 18-34 | Fee deduction is not atomic. `transaction.create` and `wallet.update` are separate calls; a crash between them leaves a recorded fee with no balance deduction. | Critical | Open |
| `apps/api/src/routes/auth.ts` | 89 | `/refresh` has no Zod validation (`await c.req.json()` directly) and no rate-limit middleware. Refresh tokens can be brute-forced. | High | Open |
| `apps/api/src/routes/bots.ts` | 74 | PATCH `/:id/mode` accepts `mode` from raw JSON without validation. Any string can be persisted, bypassing the `paper` / `live` enum. | High | Open |
| `apps/api/src/middleware/rate-limit.ts` | 13 | Rate-limit key uses raw `x-forwarded-for` header. Clients can spoof arbitrary IPs to rotate keys and bypass limits entirely. | High | Open |
| `apps/api/src/middleware/ip-allowlist.ts` | 7 | Same `x-forwarded-for` spoofing: an attacker can set the header to a whitelisted IP and bypass the admin IP gate. | High | Open |
| `apps/api/src/routes/admin.ts` | 45 | POST `/bots/:id/kill` calls `prisma.bot.update` without checking existence. A missing ID triggers an unhandled `RecordNotFound` (500 response + stack leak risk). | High | Open |
| `apps/api/src/routes/admin.ts` | 26-27 | `parseInt` on `page` / `limit` query params with no validation. `page=abc` yields `NaN`, which propagates to Prisma `skip` and causes a database error. | High | Open |
| `apps/worker/src/engine/dca-loop.ts` | 64 | Code references `bot.configJson`, but the Prisma model names the field `config` (`@map("config_json")` only renames the DB column). The property is `undefined`, so all DCA parameters fall back and the bot is misconfigured. | High | Open |
| `apps/api/src/routes/bots.ts` | 35 | `connectionId` is not verified to belong to the current user before bot creation. A user can link a bot to another user's exchange connection. | Medium | Open |
| `apps/api/src/routes/bots.ts` | 29 | After `zValidator`, handler uses `await c.req.json()` instead of `c.req.valid("json")`, bypassing the typed validated value. | Medium | Open |
| `apps/worker/src/services/fee-applier.ts` | 45 | `fee.mul(referral.commissionRate.toNumber())` coerces a Prisma `Decimal` to JS `number`, losing precision before multiplication. Should multiply Decimals directly. | Medium | Open |
| `apps/api/src/services/encryption.ts` | 16 | `encryptedText.split(":")` on malformed input produces `undefined` buffers, causing a runtime throw. No explicit error handling inside `decrypt`. | Medium | Open |
| `apps/api/src/routes/admin.ts` | 55, 76, 103 | Audit logs record `c.req.header("x-forwarded-for")` which is client-spoofable, reducing log integrity. | Low | Open |
| `apps/worker/src/engine/dca-loop.ts` | 67-70 | Live-mode key decryption is only a placeholder comment; `connector.connect` is never called, so live DCA bots would fail silently. | Low | Open |
| `apps/api/src/routes/auth.ts` | 63 | Register endpoint returns both access and refresh tokens. Acceptable, but increases token exposure surface. | Info | Open |

---

## Per-File Assessment

### `apps/api/src/routes/auth.ts`
- **Input validation (Zod):** Partial. Register and login use `zValidator`. `/refresh` does not.
- **Auth middleware:** N/A (public routes).
- **SQL injection:** Prisma only — good.
- **Rate limiting:** `/register` and `/login` limited. `/refresh` is unprotected.
- **Encrypted keys:** N/A.
- **Fee calculation:** N/A.
- **DCA math:** N/A.

### `apps/api/src/routes/bots.ts`
- **Input validation (Zod):** Broken. POST `/` validates the wrong schema. PATCH `/:id/mode` has no validation.
- **Auth middleware:** Present on all routes. Admin sub-routes also use `roleMiddleware`.
- **SQL injection:** Prisma only — good.
- **Rate limiting:** N/A on these routes.
- **Encrypted keys:** N/A.
- **Fee calculation:** N/A.
- **DCA math:** N/A.

### `apps/api/src/routes/admin.ts`
- **Input validation (Zod):** Missing on all routes. `/refund` is especially dangerous.
- **Auth middleware:** Global `admin.use("/*", authMiddleware, roleMiddleware("admin"), ipAllowlistMiddleware)` — good.
- **SQL injection:** Prisma only — good.
- **Rate limiting:** N/A.
- **Encrypted keys:** N/A.
- **Fee calculation:** N/A.
- **DCA math:** N/A.

### `apps/api/src/middleware/*.ts`
- **auth.ts:** Standard Bearer JWT flow. Verifies token, fetches user, sets context.
- **role.ts:** Checks `c.get("user")` against required roles.
- **rate-limit.ts:** Redis-backed counter. Vulnerable to `x-forwarded-for` spoofing.
- **ip-allowlist.ts:** Static IP list. Vulnerable to `x-forwarded-for` spoofing.

### `apps/api/src/services/encryption.ts`
- **Encrypted keys:** AES-256-GCM with IV + authTag. No key material is logged or returned. The `WALLET_MASTER_KEY` is validated for length (64 hex chars) in `config.ts`. Good.

### `apps/wallet/src/services/hd-wallet.ts`
- **Encrypted keys:** Hardcoded fallback mnemonic is a critical key-compromise risk. Otherwise the function returns `privateKey` as expected for an internal service.

### `apps/worker/src/engine/dca-loop.ts`
- **DCA math accuracy:**
  - `calculateVwap`: `totalCost / totalAmount` — correct.
  - `getNextSafetyOrderSize`: `baseSize * volumeScale^filled` — correct.
  - `getNextDeviationTrigger`: `initialDeviation * stepScale^filled` — correct.
  - `shouldTriggerTakeProfit`: `vwap * (1 + tp%/100)` — correct.
- **State persistence:** In-memory `Map` only. No recovery on restart, causing duplicate base orders.
- **Config access:** Uses wrong Prisma property name (`configJson` vs `config`).

### `apps/worker/src/services/fee-applier.ts`
- **Fee calculation correct (20% on wins only):** Yes. `pnl <= 0` returns early. Fee = `pnl * GLOBAL_FEE_RATE`.
- **Atomicity:** Not atomic — `transaction.create` and `wallet.update` are separate calls.
- **Commission precision:** `commissionRate.toNumber()` loses Decimal precision.

---

## Recommendations

1. Fix `bots.ts` POST schema: create a wrapper Zod object for `{ connectionId, name, mode, config }` and validate `connectionId` ownership.
2. Add Zod validation to `/refresh`, `/admin/refund`, and all admin mutation routes.
3. Add rate limiting to `/refresh`.
4. Replace raw `x-forwarded-for` usage with a trusted-proxy IP extraction helper (e.g., use the last untrusted hop or require a `X-Real-IP` set by the edge proxy).
5. Remove the hardcoded mnemonic fallback; fail startup if `WALLET_MNEMONIC` is missing.
6. Persist DCA state to Redis/DB and reload it in `startDcaLoop` before placing any orders.
7. Wrap fee deduction in `prisma.$transaction`.
8. Fix `bot.configJson` to `bot.config` in the DCA engine.
9. Add existence checks before `prisma.bot.update` in admin kill route.
10. Coerce/validate query params with Zod instead of naked `parseInt`.
