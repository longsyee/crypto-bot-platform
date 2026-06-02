# Final QA Audit Report — 2026-06-01

## Critical (fix immediately)

### 1. Wallet internal route crashes with ReferenceError (`crypto` not imported)
- **File + line:** `apps/wallet/src/routes/internal.ts:19`
- **Impact:** `generate-address` endpoint throws at runtime, preventing any new deposit address generation and breaking onboarding.
- **Fix suggestion:** Add `import crypto from "crypto";` at the top of the file.

### 2. Deposit callback target endpoint does not exist
- **File + line:** `apps/wallet/src/services/callback.ts:10` calls `walletConfig.API_CALLBACK_URL` (default `http://localhost:3010/internal/deposit-confirmed`), but no such route is registered in `apps/api/src/index.ts`.
- **Impact:** On-chain deposits are detected by the monitor but never credited to user wallets in the API database. Users deposit funds and see zero balance.
- **Fix suggestion:** Implement `POST /internal/deposit-confirmed` in the API with a shared secret check, idempotency on `txHash`, and a Prisma transaction that updates `wallet.tokenBalance` and creates a `transaction` record.

### 3. DCA loop stacks async callbacks with `setInterval`
- **File + line:** `apps/worker/src/engine/dca-loop.ts:177`
- **Impact:** If `connector.placeOrder` or `getTicker` takes longer than 5 seconds, another interval fires while the first is still executing. Multiple concurrent loops read/write the same `botStates` Map entry, causing duplicate safety orders, incorrect VWAP, and potential over-leveraging.
- **Fix suggestion:** Replace `setInterval` with `setTimeout` at the end of each loop iteration, or use a per-bot `Mutex`/`semaphore` to prevent concurrent executions.

### 4. `startDcaLoop` lacks duplicate-start guard
- **File + line:** `apps/worker/src/engine/dca-loop.ts:58`
- **Impact:** Calling `startDcaLoop` twice for the same bot (e.g., queue retry + manual start) creates multiple overlapping intervals and state maps, compounding the stacking bug above.
- **Fix suggestion:** Check `isBotRunning(botId)` at the top of `startDcaLoop` and return early if already registered.

### 5. Wallet address generation reuses indices after deletion
- **File + line:** `apps/wallet/src/routes/internal.ts:15-17`
- **Impact:** `countRes.length` is used as the next HD index. If a row is deleted, the next generated address collides with an existing one, causing multiple users to share the same deposit address and private key.
- **Fix suggestion:** Query `MAX(address_index)` instead of `COUNT(*)`.

### 6. Inter-service internal calls have no authentication
- **File + line:** `apps/api/src/routes/wallets.ts:62-67` calls wallet service `/internal/generate-address` with no API key or HMAC signature.
- **Impact:** Any internal network actor can generate addresses for arbitrary `userId`s or access other internal endpoints.
- **Fix suggestion:** Add a shared `INTERNAL_API_SECRET` env variable to both services; require it in a header on all `/internal/*` routes.

### 7. Frontend SSE cannot authenticate (EventSource lacks Authorization header)
- **File + line:** `apps/web/src/hooks/use-sse.ts:13` creates `EventSource` with `withCredentials: true` but no Bearer token. `apps/api/src/services/sse.ts:17-21` expects `c.get("user")` set by `authMiddleware`, which relies on the `Authorization` header.
- **Impact:** SSE connection always receives 401, so real-time trade/balance updates never reach the frontend.
- **Fix suggestion:** Switch to `fetch` + `ReadableStream` with manual `Authorization` header, or use an `EventSource` polyfill that supports headers (e.g., `eventsource` package), or implement a cookie-based SSE auth fallback.

### 8. Sweeper is a complete placeholder — funds are never consolidated
- **File + line:** `apps/wallet/src/services/sweeper.ts:18-42`
- **Impact:** USDT deposits land in individual HD-derived addresses but are never swept to the hot wallet. The production code is commented out and private keys are not available to the sweeper. Operational funds are stranded.
- **Fix suggestion:** Persist the deposit-address private key (encrypted) alongside the address in `depositAddresses`, or derive it on-demand from the mnemonic + index. Implement the actual `transfer` call in `runSweep`.

---

## High (fix this week)

### 9. Wallet service uses in-memory SQLite with only SIGINT persistence
- **File + line:** `apps/wallet/src/db/client.ts:12-62`
- **Impact:** If the Node process crashes (uncaught exception, OOM, SIGKILL), the in-memory `wallet.db` is lost. All deposit address mappings and blockchain event history disappear.
- **Fix suggestion:** Replace sql.js with a real SQLite-on-disk file (better-node-sqlite3 or Bun sqlite) with WAL mode, or connect wallet service to the same PostgreSQL instance as the API.

### 10. No input validation on wallet convert endpoint
- **File + line:** `apps/api/src/routes/wallets.ts:14-16`
- **Impact:** `amount` can be negative, zero, `NaN`, or a string. The Prisma transaction happily decrements/increments nonsensical values, corrupting balances.
- **Fix suggestion:** Add a `ConvertSchema` with `z.number().positive()` and `z.enum(["usdt_to_token", "token_to_usdt"])`, and apply `zValidator("json", ConvertSchema)`.

### 11. No input validation on bot mode toggle and patch endpoints
- **File + line:** `apps/api/src/routes/bots.ts:162-180` (`mode` toggle), `apps/api/src/routes/bots.ts:104-115` (PATCH `configJson`)
- **Impact:** Arbitrary JSON can be written to `configJson`, and invalid `mode` strings can be stored. May break worker deserialization or enum constraints.
- **Fix suggestion:** Add `zValidator` schemas for both endpoints; whitelist allowed `mode` values.

### 12. Admin kill-bot only updates DB, does not stop worker loop
- **File + line:** `apps/api/src/routes/admin.ts:47-60`
- **Impact:** Admin clicks "Kill" — DB says `stopped`, but the worker’s `setInterval` continues firing orders. State divergence between DB and runtime.
- **Fix suggestion:** Add `await botQueue.add("bot-stop", { botId: id, emergency: true })` inside the kill handler, or publish a Redis pub/sub kill message that the worker listens to.

### 13. Refund transaction wraps audit log in the same atomic block
- **File + line:** `apps/api/src/routes/admin.ts:109-132`
- **Impact:** If `adminAuditLog.create` fails (e.g., DB constraint issue), the entire Prisma transaction rolls back, undoing the wallet credit and refund transaction record. Financial state becomes inconsistent with audit trail.
- **Fix suggestion:** Use an interactive transaction (`prisma.$transaction(async (tx) => { ... })`) for the wallet update and refund record only. Write the audit log in a separate, best-effort query afterward.

### 14. Email failures are silently swallowed
- **File + line:** `apps/api/src/routes/auth.ts:72`, `apps/api/src/routes/auth.ts:157`, `apps/api/src/routes/auth.ts:221`
- **Impact:** OTP and password-reset emails fail silently. Users wait indefinitely for codes; support has no logs.
- **Fix suggestion:** Replace `.catch(() => {})` with `.catch((err) => { console.error("Email failed", err); throw new Error("Unable to send email"); })` or use a retry queue.

### 15. Webhook signature is order-sensitive / whitespace-sensitive
- **File + line:** `apps/api/src/routes/webhooks.ts:23`
- **Impact:** If the sender serializes JSON with different key ordering or whitespace, the HMAC comparison fails even for legitimate requests.
- **Fix suggestion:** Define a canonical serialization (e.g., alphabetically sorted keys, no whitespace) and document it for integrators. Alternatively, use a raw body buffer for HMAC instead of re-stringifying parsed JSON.

### 16. `CCXTConnector.connect` lacks exchange existence check
- **File + line:** `apps/worker/src/exchange/ccxt-connector.ts:20-21`
- **Impact:** Passing an unsupported `exchangeId` causes `ExchangeClass` to be `undefined`, then `new undefined(...)` throws an opaque error.
- **Fix suggestion:** Guard with `if (!ExchangeClass || !ccxt.exchanges.includes(exchangeId)) throw new Error("Unsupported exchange: " + exchangeId)`.

### 17. Worker startup reconciliation can duplicate loops across instances
- **File + line:** `apps/worker/src/queues/consumer.ts:39-48`
- **Impact:** If multiple worker processes start (horizontal scaling), each calls `reconcile()` and `startDcaLoop` for every running bot, creating duplicate loops on each instance.
- **Fix suggestion:** Use Redis `SET bot-loop:${botId} <workerId> NX EX 60` as a distributed lock before starting a loop. Refresh the lock inside the loop.

### 18. `bots.patch("/:id")` allows arbitrary `configJson` overwrite
- **File + line:** `apps/api/src/routes/bots.ts:104-115`
- **Impact:** A malicious or buggy client can overwrite the entire bot configuration object, potentially injecting invalid fields that crash the worker.
- **Fix suggestion:** Validate `configJson` against the same `CreateBotSchema` subset, or perform a deep-merge with a whitelist.

---

## Medium (fix next sprint)

### 19. Auth middleware masks all errors as "Invalid token"
- **File + line:** `apps/api/src/middleware/auth.ts:21-23`
- **Impact:** Database outages or Prisma connection errors return 401 with "Invalid or expired token", making incident diagnosis difficult.
- **Fix suggestion:** Distinguish JWT verification errors (return 401) from unexpected exceptions (log and return 500).

### 20. Rate-limit IP detection is unreliable in Hono/node-server
- **File + line:** `apps/api/src/middleware/rate-limit.ts:14`
- **Impact:** `c.env?.remoteAddress` is not populated by `@hono/node-server`; `x-real-ip` requires a specific proxy. All requests may collapse to `unknown`, causing global rate-limit sharing.
- **Fix suggestion:** Use `getConnInfo(c)` from `@hono/node-server` to obtain the remote address, falling back to `x-forwarded-for` only behind a trusted proxy.

### 21. IP allowlist middleware lacks CIDR support
- **File + line:** `apps/api/src/middleware/ip-allowlist.ts:4-14`
- **Impact:** Only exact IP strings are matched. Admin teams on dynamic VPC ranges cannot be whitelisted without listing every single IP.
- **Fix suggestion:** Implement CIDR parsing (e.g., `ip-address` npm package) to support ranges like `10.0.0.0/8`.

### 22. Admin update endpoints throw unhandled 500 for missing records
- **File + line:** `apps/api/src/routes/admin.ts:47-60` (kill), `apps/api/src/routes/admin.ts:66-69` (approve-kol)
- **Impact:** If an admin passes a non-existent ID, Prisma throws `RecordNotFound`, resulting in a 500 instead of a clean 404.
- **Fix suggestion:** `findUnique` first, return 404 if null, then `update`.

### 23. Zustand auth store crashes on corrupted localStorage
- **File + line:** `apps/web/src/hooks/use-auth.ts:23`
- **Impact:** If `user` in localStorage is malformed JSON, `JSON.parse` throws on every React render, white-screening the app.
- **Fix suggestion:** Wrap in `try/catch`; default to `null` on parse failure.

### 24. API client over-aggressively clears tokens on any 401
- **File + line:** `apps/web/src/lib/api-client.ts:22-30`
- **Impact:** A 401 from a non-auth endpoint (or a misconfigured route) wipes the user’s session and redirects them to login.
- **Fix suggestion:** Only clear tokens if the response body contains a specific token-invalid code (e.g., `INVALID_TOKEN` or `USER_GONE`), not on every generic 401.

### 25. SSE `subscribers` Map overwrites multi-tab connections
- **File + line:** `apps/api/src/services/sse.ts:24`
- **Impact:** If a user opens two tabs, the second tab overwrites the `subscribers` entry. When the first tab closes, `onAbort` deletes the key, cutting off the second tab.
- **Fix suggestion:** Store an array/set of controllers per `userId`, or use a connection ID key (`${userId}:${connectionId}`).

### 26. Redis pub/sub message handler can crash API on bad JSON
- **File + line:** `apps/api/src/services/sse.ts:36-38`
- **Impact:** A malformed message published to Redis channels `events:trade`, `events:bot-status`, or `events:balance` causes an uncaught exception.
- **Fix suggestion:** Wrap `JSON.parse(message)` in `try/catch` and log the bad message.

### 27. Paper-balance schema fields are unmodeled (`as any`)
- **File + line:** `apps/worker/src/exchange/ccxt-connector.ts:156-158`, `apps/worker/src/exchange/ccxt-connector.ts:191-192`
- **Impact:** `paperBalance` and `paperInitialBalance` are written to Prisma via `as any`, suggesting they are not in the schema. This may break with Prisma client generation or runtime validation.
- **Fix suggestion:** Add `paperBalance Json?` and `paperInitialBalance Json?` to the `Bot` model in `schema.prisma`, or store paper balances in a dedicated table.

### 28. `signal-handler.ts` dereferences `bot.connection` without null check
- **File + line:** `apps/worker/src/engine/signal-handler.ts:16-24`
- **Impact:** If a bot record has `connection: null`, `bot.connection.exchangeId` throws a runtime TypeError.
- **Fix suggestion:** Guard with `if (!bot.connection) throw new Error("Bot missing exchange connection")`.

### 29. `signal-handler.ts` allows zero-volume orders
- **File + line:** `apps/worker/src/engine/signal-handler.ts:47`
- **Impact:** `payload.volume || (bot.configJson as any).default_volume || 0` permits `0` amount orders, which may confuse exchange APIs.
- **Fix suggestion:** Validate `amount > 0` before calling `placeOrder`.

### 30. DCA base order uses hardcoded fallback price 50000
- **File + line:** `apps/worker/src/engine/dca-loop.ts:116`
- **Impact:** If `baseOrder.cost` is missing from the exchange response, the VWAP is computed with a fake $50k BTC price, distorting all downstream safety-order and take-profit math.
- **Fix suggestion:** If `cost` is missing, reject the order and alert instead of assuming a price.

### 31. Blockchain monitor lacks RPC reconnect logic
- **File + line:** `apps/wallet/src/services/monitor.ts:15-44`
- **Impact:** If the BSC RPC websocket/HTTP connection drops, `contract.on("Transfer", ...)` may stop firing without error, and deposits go unnoticed.
- **Fix suggestion:** Attach `provider.on("error", ...)` and `provider.on("close", ...)` handlers that reinitialize the contract listener after an exponential backoff.

### 32. Deposit callback has no retry mechanism
- **File + line:** `apps/wallet/src/services/callback.ts:10-19`
- **Impact:** If the API is restarting when a deposit reaches 12 confirmations, the callback fails once and the deposit is never retried.
- **Fix suggestion:** Implement an outbox pattern: write a `callback_attempts` row in wallet DB, retry with exponential backoff up to N times, and mark done only on HTTP 2xx.

### 33. `hd-wallet.ts` returns private key in the same object as address
- **File + line:** `apps/wallet/src/services/hd-wallet.ts:10-14`
- **Impact:** Any caller that logs the return object or serializes it to JSON will leak the private key to logs/monitoring.
- **Fix suggestion:** Split into two functions: `generateBscAddress(index)` returning only the address, and `derivePrivateKey(index)` returning only the key. Restrict the latter to the sweeper service.

---

## Low (nice to have)

### 34. Login does not enforce email verification
- **File + line:** `apps/api/src/routes/auth.ts:163-183`
- **Impact:** Users can log in immediately after registration without verifying OTP, reducing the value of email verification.
- **Fix suggestion:** Return 403 on login if `!user.emailVerified`, with code `EMAIL_NOT_VERIFIED`.

### 35. Refresh token endpoint lacks body validation
- **File + line:** `apps/api/src/routes/auth.ts:186-199`
- **Impact:** Missing `refresh_token` body causes an unhandled `undefined` error inside `verifyRefreshToken`.
- **Fix suggestion:** Add a minimal `zValidator("json", z.object({ refresh_token: z.string() }))`.

### 36. Admin dashboard stat conflates fees with refunds
- **File + line:** `apps/api/src/routes/admin.ts:18`
- **Impact:** `totalFees` aggregates `type: "trade_fee"` only, ignoring that refunds are negative adjustments. The dashboard overstates revenue.
- **Fix suggestion:** Subtract `type: "refund"` aggregate from the total, or show net vs. gross.

### 37. Frontend convert input lacks client-side validation
- **File + line:** `apps/web/src/routes/wallet.tsx:327-334`
- **Impact:** User can type a negative number; the backend may reject it, but the UX is poor.
- **Fix suggestion:** Add `min="0.00000001"` and a small `onChange` validator that disables the submit button for non-positive values.

### 38. Root `package.json` references undefined workspace scripts
- **File + line:** `package.json:9-11`
- **Impact:** `pnpm run db:migrate` fails because no workspace package defines a `db:migrate` script.
- **Fix suggestion:** Add the scripts to the `prisma` workspace package, or remove them from root.

### 39. Web frontend has unused form-library dependencies
- **File + line:** `apps/web/package.json:13-14`
- **Impact:** `@tanstack/react-form` and `@hookform/resolvers` are installed but never imported, increasing bundle size.
- **Fix suggestion:** Remove unused dependencies.

### 40. `logs/stream` endpoint has no rate-limit or max-client cap
- **File + line:** `apps/api/src/routes/logs.ts:44`
- **Impact:** Each open tab opens a DB-polling SSE stream every 1.5s. Many tabs = many sustained DB queries.
- **Fix suggestion:** Limit concurrent streams per user (e.g., max 3) and increase poll interval to 5s.

---

## Architecture Risks

1. **Dual database architecture (API = PostgreSQL, Wallet = SQLite)** creates two sources of truth for wallet data. Reconciliation relies on HTTP callbacks that are currently unimplemented. Risk of permanent fund-accounting mismatches.
2. **In-memory DCA state + 30s DB persistence** means up to 30 seconds of safety-order state can be lost if the worker crashes. Should write state to Redis (or DB) immediately after every order fill.
3. **No distributed locking for worker bot loops.** Multiple worker instances or restarts can run the same bot concurrently. Redis `SET NX` locks are required.
4. **No circuit breaker on CCXT exchange calls.** Repeated 5-second polling against a failing exchange API will hit rate limits and IP bans.
5. **No dead-letter queue for BullMQ jobs.** Failed `signal-execute` jobs are discarded after default retries. Failed orders should be stored for manual review.
6. **Shared encryption key (`WALLET_MASTER_KEY`) across all services** with no rotation strategy or key versioning. If leaked, all historical and future exchange API credentials and HD private keys are compromised.
7. **No healthcheck endpoints in wallet or worker services.** Orchestrators (Docker, K8s) cannot determine service readiness or liveness.

## Performance Concerns

1. **DCA ticker polling every 5s per bot** scales linearly with active bots. 100 bots = 100 ticker requests every 5s to the exchange. Consider batched polling or WebSocket market data.
2. **`logs/stream` polls Prisma every 1.5s per client.** With 100 admin tabs, this becomes a sustained query storm. Use database `LISTEN/NOTIFY` or Redis pub/sub for log streaming instead.
3. **`ccxt-connector.ts` calls `loadMarkets()` inside `placeOrder`.** This fetches the entire exchange market list on every order. Cache markets after the first `connect()` call.
4. **`admin.ts` `/dashboard` aggregate `totalFees`** scans all `trade_fee` transactions on every admin page load. Add a materialized daily rollup table or cache the value in Redis.
5. **`monitor.ts` pending-event scan** runs a full `select` on `blockchainEvents` every 30s. As the table grows, this scan slows down. Add an index on `(status, token_contract)`.

## Missing Features That Should Exist

1. `/internal/deposit-confirmed` API route (see Critical #2).
2. Actual USDT sweep implementation in wallet service (see Critical #8).
3. Automatic access-token refresh in `api-client.ts` instead of redirecting to login on expiry.
4. Email verification gate on login (see Low #34).
5. Server-side pagination on `/admin/all` bots endpoint to prevent massive payloads.
6. Admin queue integration for kill-bot (see High #12).
7. Outbox + retry logic for deposit callbacks (see Medium #32).
8. Healthcheck endpoints for all three backend services.
9. Database migration / seed scripts in workspace packages (root scripts are broken).
10. `Dockerfile` and `docker-compose.yml` for reproducible local dev and CI.
11. `README.md` with architecture diagram, env setup guide, and API contract documentation.
12. Input sanitization and rate limiting on SSE and log-stream endpoints.
13. Transaction rollback / compensation logic for failed exchange orders (e.g., if fee deduction succeeds but order placement fails).

## Already Fixed

- No prior fix-agent modifications were found in this session. The codebase reflects the state after the `feat: platform core complete` commit (`1ec13bc`).
