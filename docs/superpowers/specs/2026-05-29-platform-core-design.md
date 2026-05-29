# Platform Core Design — Crypto Trading Bot Platform

**Date:** 2026-05-29
**Scope:** Authentication, database schema, API layer, bot execution infrastructure, USDT wallet system, referral program, admin panel, and local development setup. Everything required before Signal Bot and DCA Martingale Bot features can be built on top.
**Build Order:** Sub-project 1 of 5 (Core → Signal Bot → DCA Bot → Social → Graph/Obsidian).

---

## 1. Architecture

### 1.1 Three-Process Design

| Process | Responsibility | Runtime |
|---------|---------------|---------|
| **Hono API Server** | HTTP entrypoint. Auth, CRUD, admin, billing/webhooks, SSE streaming to frontend. | Node.js / Hono |
| **Bot Worker** | Persistent execution. DCA Engine price watching, signal order execution, CCXT integration, paper trade logging. | Node.js / Worker |
| **Wallet Service** | Blockchain isolation. BSC address generation, deposit monitoring, sweeping, withdrawals. | Node.js / Hono |

**Rationale:** The API must stay responsive under heavy bot execution load. Separating the blockchain wallet logic into its own process keeps cryptographic keys and network polling isolated from user-facing APIs.

### 1.2 Communication Patterns

- **API → Worker:** BullMQ job queues (Redis). Jobs: `bot-start`, `bot-stop`, `webhook-signal`.
- **Worker → API:** Redis Pub/Sub events (`trade-filled`, `bot-error`, `price-update`). API subscribes and forwards to connected frontends via SSE.
- **API → Wallet Service:** Internal HTTP (or Redis Pub/Sub). Requests: `generate-address`, `request-withdrawal`, `get-balance`.
- **Wallet Service → API:** HTTP callback on confirmed deposit. Callback includes `user_id`, `amount`, `tx_hash`, `confirmations`.
- **Frontend → API:** Standard REST/JSON over HTTPS. JWT in `Authorization: Bearer <token>` header.
- **TradingView / External → API:** Webhook POST to `/webhooks/signal/:botId`. Secured by HMAC signature or UUID secret stored in bot config.

### 1.3 Shared State

| Store | Usage |
|-------|-------|
| **PostgreSQL** | Single source of truth for all relational data. All three processes read/write via Prisma ORM (or Drizzle). |
| **Redis** | BullMQ queues, Pub/Sub (real-time events), session cache, rate limit counters, worker heartbeat timestamps. |

---

## 2. Database Schema (PostgreSQL)

### 2.1 Core Tables

**users**
- `id` (UUID PK)
- `email` (unique, verified)
- `password_hash` (bcrypt)
- `role`: `user` | `moderator` | `admin`
- `email_verified` (boolean)
- `referral_code` (unique, auto-generated on signup)
- `referred_by` (FK → users, nullable)
- `totp_secret_encrypted` (varchar, nullable, reserved for v2 2FA)
- `created_at`, `updated_at`

**wallets**
- `id` (UUID PK)
- `user_id` (FK → users, unique)
- `bsc_address_index` (int, HD derivation index)
- `bsc_address` (varchar, the deposit address)
- `usdt_balance` (DECIMAL(20,8))
- `token_balance` (DECIMAL(20,8)) — platform "gas" tokens
- `total_deposited`, `total_withdrawn`, `total_fees_paid`, `total_earned_referral`
- `updated_at`

**transactions**
- `id` (UUID PK)
- `wallet_id` (FK → wallets)
- `type`: `deposit` | `withdraw` | `convert_in` | `convert_out` | `trade_fee` | `referral_payout` | `refund` | `admin_adjust`
- `amount` (DECIMAL(20,8))
- `currency`: `USDT` | `TOKEN`
- `status`: `pending` | `confirmed` | `failed` | `reversed`
- `tx_hash` (varchar, for on-chain deposit/withdraw)
- `metadata_json` (JSONB)
- `created_at`

**exchange_connections**
- `id` (UUID PK)
- `user_id` (FK → users)
- `exchange_id` (e.g., `binance`, `bybit`, `okx`, `kucoin`, `bitget`)
- `name` (user-defined label)
- `api_key_encrypted`, `api_secret_encrypted`, `passphrase_encrypted` (AES-256-GCM)
- `is_testnet` (boolean)
- `is_active` (boolean)
- `created_at`

**bots**
- `id` (UUID PK)
- `user_id` (FK → users)
- `connection_id` (FK → exchange_connections)
- `name`
- `type`: `signal` | `dca`
- `status`: `stopped` | `running` | `paused` | `error`
- `mode`: `paper` | `live`
- `config_json` (JSONB, validated by Zod per type)
- `created_at`, `updated_at`

**bot_orders**
- `id` (UUID PK)
- `bot_id` (FK → bots)
- `exchange_order_id` (varchar)
- `symbol`, `side`, `type`, `amount`, `price`
- `status`, `filled`, `remaining`, `cost`, `fee`, `fee_currency`
- `fee_rate_at_entry` (DECIMAL(5,4), stores the 20% rate at trade open time)
- `raw_ccxt_response_json` (JSONB, full CCXT response for audit)
- `created_at`, `updated_at`

**bot_logs**
- `id` (UUID PK)
- `bot_id` (FK → bots)
- `level`: `info` | `warn` | `error`
- `message` (text)
- `metadata_json` (JSONB)
- `created_at`

**paper_trades**
- `id` (UUID PK)
- `bot_id` (FK → bots)
- `symbol`, `side`, `amount`, `price`
- `simulated_fee` (DECIMAL(20,8))
- `total_cost`, `pnl`
- `created_at`

### 2.2 Referral Tables

**referrals**
- `id` (UUID PK)
- `referrer_id` (FK → users)
- `referred_user_id` (FK → users, unique)
- `tier`: `bronze` | `silver` | `gold` | `platinum` | `pending_kol` | `kol`
- `commission_rate` (DECIMAL(5,4))
- `total_commission_earned`
- `status`
- `created_at`

**commission_ledger**
- `id` (UUID PK)
- `referral_id` (FK → referrals)
- `transaction_id` (FK → transactions)
- `source_user_id` (FK → users, the referred user who generated the trade fee)
- `commission_amount` (DECIMAL(20,8))
- `status`: `pending` | `paid` | `reversed`
- `created_at`

### 2.3 Community & Audit Tables

**bot_comments**
- `id` (UUID PK)
- `bot_id` (FK → bots)
- `user_id` (FK → users)
- `content` (text)
- `is_public` (boolean)
- `rating` (int, 1–5, nullable)
- `parent_id` (self-FK, nullable, for threaded replies)
- `created_at`, `updated_at`

**admin_audit_log**
- `id` (UUID PK)
- `admin_user_id` (FK → users)
- `action`: `kill_bot` | `refund` | `approve_kol` | `change_fee` | `edit_config` | `suspend_user` | `override_commission`
- `target_type`, `target_id`
- `old_value_json`, `new_value_json`
- `ip_address`
- `created_at`

**security_events**
- `id` (UUID PK)
- `user_id` (nullable)
- `event_type`: `failed_webhook` | `invalid_login` | `suspicious_referral` | `rate_limit_exceeded` | `insufficient_balance_block`
- `ip_address`
- `details_json` (JSONB)
- `created_at`

### 2.4 Wallet Service Tables

These live in a **separate lightweight SQLite database** inside the Wallet Service (self-contained, no Postgres dependency for the wallet process). Alternatively, they can share Postgres with a `wallet_` schema prefix.

**deposit_addresses**
- `id` (UUID PK)
- `user_id` (UUID, matches Main API user)
- `address_index` (int, HD derivation path index)
- `bsc_address` (varchar, unique)
- `status`: `active` | `archived`
- `created_at`

**blockchain_events**
- `id` (UUID PK)
- `tx_hash` (varchar)
- `from_address`, `to_address`
- `amount` (DECIMAL(20,8))
- `token_contract` (varchar, USDT BEP20 contract address)
- `block_number` (bigint)
- `confirmations` (int)
- `status`: `pending` | `confirmed` | `invalid`
- `matched_user_id` (UUID, nullable)
- `created_at`

**withdrawal_requests**
- `id` (UUID PK)
- `user_id` (UUID)
- `amount` (DECIMAL(20,8))
- `to_address` (varchar)
- `tx_hash` (varchar, nullable)
- `status`: `pending` | `processing` | `completed` | `failed`
- `fee_estimate` (DECIMAL(20,8))
- `processed_at` (nullable)
- `created_at`

### 2.5 Indexing Strategy

- `users(email)` — login lookup
- `users(referral_code)` — referral resolution
- `wallets(user_id)` — unique, fast balance lookup
- `transactions(wallet_id, type, created_at DESC)` — wallet history
- `transactions(tx_hash)` — prevent double credit
- `bots(user_id, status)` — dashboard listing
- `bots(connection_id)` — cascade checks
- `bot_orders(bot_id, created_at DESC)` — trade history
- `bot_logs(bot_id, created_at DESC)` — log viewer
- `referrals(referrer_id)` — tier calculation
- `referrals(referred_user_id)` — unique constraint
- `blockchain_events(tx_hash)` — unique, prevent replays
- `blockchain_events(to_address, status)` — deposit matching

---

## 3. Auth & Roles

### 3.1 Roles

| Role | Permissions |
|------|-------------|
| `user` | Manage own bots, connections, wallet, view community. |
| `moderator` | All user permissions + review/approve public strategies, moderate comments, view flagged security events. |
| `admin` | Full platform control. Kill any bot, edit configs, issue refunds, approve KOL applications, adjust global fee rates, view all admin audit logs. |

### 3.2 Auth Flow

1. **Registration:** Email + password (bcrypt). Auto-generate `referral_code`. If registration includes `referral_code` param, set `referred_by`.
2. **Login:** Email + password → JWT access token (15 min) + refresh token (7 days, stored in httpOnly cookie).
3. **Middleware:** `authMiddleware` validates JWT, attaches `user` to context. `roleMiddleware(role)` checks `user.role`.
4. **Admin Panel Access:** Admin routes require `role='admin'`. IP allowlist configurable via env (`ADMIN_ALLOWED_IPS`).
5. **2FA (Future):** Schema supports `totp_secret` (encrypted). Not required for MVP but field reserved.

### 3.3 Password Policy

- Minimum 10 characters.
- Must contain uppercase, lowercase, number.
- Rate limit: 5 failed attempts per 15 minutes per IP.

---

## 4. USDT Wallet & Token Model

### 4.1 Concept

Users deposit USDT (BEP20) to a unique BSC address. After 12 block confirmations, their `wallets.usdt_balance` is credited. They convert USDT → Platform Tokens (1:1) to use as "gas" for bot trading fees. Tokens are internal ledger entries only.

### 4.2 Deposit Flow

1. User registers → Main API calls Wallet Service `POST /internal/generate-address` → returns BSC address.
2. User sends USDT (BEP20) from MetaMask/exchange to their address.
3. Wallet Service monitors BSC Transfer events via WebSocket (QuickNode/Ankr) + BscScan API fallback.
4. On match: wait 12 confirmations → update `blockchain_events.status='confirmed'`.
5. HTTP callback to Main API: `POST /internal/deposit-confirmed` with `user_id`, `amount`, `tx_hash`.
6. Main API: `wallets.usdt_balance += amount`, create `transactions` type='deposit'.

### 4.3 Conversion Flow

1. User clicks "Convert to Tokens" in UI.
2. API validates `usdt_balance >= amount`.
3. Atomically: `usdt_balance -= amount`, `token_balance += amount`.
4. Create two `transactions`: `convert_out` (USDT) + `convert_in` (TOKEN).

### 4.4 Fee Deduction

1. On winning trade fill: Bot Worker calculates realized PnL.
2. If PnL > 0: fee = PnL × `global_fee_rate` (default 20%).
3. Check `token_balance >= fee`. If no: pause bot + create `security_events` + alert user.
4. If yes: atomically deduct `token_balance`, create `transactions` type='trade_fee'.
5. Commission: lookup `referrals` for `source_user_id`. If found: commission = fee × referrer's `commission_rate`. Credit referrer's `token_balance`, create `transactions` type='referral_payout' + `commission_ledger` entry.

### 4.5 Withdrawal Flow

1. User requests USDT withdrawal to external BSC address.
2. API validates: `usdt_balance >= amount + min_withdrawal`.
3. API calls Wallet Service `POST /internal/withdraw` with `user_id`, `amount`, `to_address`.
4. Wallet Service signs tx from hot wallet (holds BNB for gas). Estimates gas, checks hot wallet BNB balance.
5. On broadcast: returns `tx_hash`. On confirmation: callback to Main API.
6. Main API: `usdt_balance -= amount`, create `transactions` type='withdraw'.

### 4.6 Sweeping

- Wallet Service periodically consolidates deposit addresses to central hot wallet.
- Sweep only if balance > `SWEEP_MIN_THRESHOLD` (default $2 worth of USDT, to justify BNB gas cost).
- Track `bnb_gas_balance` in Wallet Service. Alert admin if < 0.01 BNB.

---

## 5. Referral Tier System

### 5.1 Tiers

| Tier | Commission Rate | Requirement |
|------|-----------------|-------------|
| Bronze | 5% | 0–2 active referrals |
| Silver | 12% | 3–5 active referrals |
| Gold | 20% | 6–10 active referrals |
| Platinum | 28% | 11–20 active referrals |
| KOL | 35% | 21+ active referrals + admin approval |

**Active referral** = referred user who has deposited USDT at least once (`transactions` type='deposit' exists).

### 5.2 Promotion & Demotion

- **Auto-promote:** Bronze→Silver→Gold→Platinum triggers immediately when active referral count crosses threshold. Calculated by a scheduled job (every 6 hours) or on each deposit event.
- **KOL gate:** Reaching 21+ active referrals sets `tier='pending_kol'`. Admin reviews in panel and clicks "Approve KOL". Commission held at Platinum rate until approval.
- **Demotion grace:** If active count drops below tier threshold for 30 consecutive days, demote one tier. Notified via email.
- **Commission calculation:** `realized_pnl × global_fee_rate × referrer_commission_rate`. Example: Gold referrer, $100 winner, 20% fee = $100 × 0.20 × 0.20 = $4.00 to referrer.

### 5.3 Fraud Prevention

- `referrals.referred_user_id` is unique — one user can only be referred once.
- Circular referral blocked by DB FK + application-level check (cannot enter your own referrer's chain).
- Security panel flags: multiple referrals from same IP, same deposit pattern, or suspicious timing.

---

## 6. Bot Execution Model (Hybrid)

### 6.1 Signal Bot (Webhook-Driven)

- TradingView / external system sends webhook POST to `/webhooks/signal/:botId`.
- Webhook body contains: `action` (buy/sell), `symbol`, `price` (optional), `volume` (optional), `timestamp`, `signature`.
- API validates HMAC signature against `bots.config_json.webhook_secret`.
- API checks: bot exists, `status='running'`, `mode` matches, token balance sufficient for projected fee.
- API enqueues `signal-execute` BullMQ job with payload.
- Worker consumes job → loads `exchange_connections` encrypted keys → calls CCXT → places order.
- On fill: write `bot_orders`, compute PnL, apply fee logic, publish Redis event.

### 6.2 DCA Martingale Bot (Persistent Worker)

- User starts bot via API → enqueues `dca-start` job.
- Worker picks up job → registers bot loop in **Redis** (`worker:bot-loops` Set or Hash) so all workers know which bots are running.
- Loop polls CCXT `watchTicker` or REST ticker for configured symbol at configured interval.
- On trigger condition (e.g., price drops X% from base order, or time-based safety order): place safety order.
- Track all filled base + safety orders. Recalculate volume-weighted average price (VWAP) and take-profit target dynamically.
- On full fill at take-profit: realize PnL, apply fee if winner, stop loop, mark `status='stopped'`.
- If max martingale levels reached without hitting take-profit: stop loop, mark `status='stopped'`, alert user.
- All state synced to DB every 30 seconds or on every order event.

### 6.3 Paper Mode

- When `mode='paper'`, CCXT calls are replaced with a `PaperExchange` class that simulates order fills against real price data.
- No token fees deducted. `simulated_fee` tracked in `paper_trades` for transparency.
- Paper trade PnL computed same as live. Users can view "what I would have earned" reports.
- Toggling `mode='live'` archives current paper session to a `paper_session_summaries` table (not in core schema, added later) and resets unrealized PnL.

---

## 7. Exchange Integration

### 7.1 Supported Exchanges (Launch)

Binance, Bybit, OKX, KuCoin, Bitget.

### 7.2 Connector Registry

- `ExchangeConnector` interface: `connect(credentials)`, `placeOrder(params)`, `cancelOrder(id)`, `getTicker(symbol)`, `watchTicker(symbol)`.
- `CCXTConnector` implements interface using CCXT unified API.
- `PaperConnector` implements interface using simulated fills.
- Registry maps `exchange_id` string to connector factory.

### 7.3 API Key Security

- Encrypted at rest with AES-256-GCM. Master key from `WALLET_MASTER_KEY` env variable.
- Keys never returned in API responses. API only returns `exchange_connections.id`, `name`, `exchange_id`, `is_testnet`, `is_active`.
- Admin can view `is_active` status but never decrypted keys.

---

## 8. Data Flow Diagrams

### 8.1 Signal Bot

```
TradingView ──POST webhook──▶ Hono API ──validate──▶ BullMQ ──job──▶ Bot Worker
                                                                    │
                                                                    ▼
                                                               CCXT Connector
                                                                    │
                                                                    ▼
                                                            Real Exchange
                                                                    │
                                                                    ▼
                                                            Redis Pub/Sub ──▶ API SSE ──▶ Frontend
                                                            Postgres (orders, logs, fees)
```

### 8.2 DCA Bot

```
User ──POST start──▶ Hono API ──enqueue──▶ Bot Worker ──spawn loop──▶ CCXT watchTicker
                                                                              │
                                                                              ▼
                                                                    On trigger: place safety
                                                                              │
                                                                              ▼
                                                                    Track VWAP + levels
                                                                              │
                                                                              ▼
                                                                    On exit: fee + Redis event + DB
```

### 8.3 Wallet Deposit

```
User ──send USDT──▶ BSC Blockchain ──Transfer event──▶ Wallet Service (WebSocket)
                                                              │
                                                              ▼
                                                    Wait 12 confirmations
                                                              │
                                                              ▼
                                                    HTTP callback ──▶ Hono API
                                                              │
                                                              ▼
                                                    wallets.usdt_balance += amount
                                                    transactions type='deposit'
```

---

## 9. Error Handling & Edge Cases

### 9.1 Bot Execution

| Scenario | Handling |
|----------|----------|
| Exchange API failure | Exponential backoff (3 retries: 1s, 3s, 9s). Then pause bot + `bot_logs` error + alert. |
| Rate limit hit | Read CCXT `Retry-After` header. Delay next job by that amount + 1s buffer. Queue depth alert if >100. |
| Invalid webhook secret | 401 rejection. Log to `security_events` type='failed_webhook'. Ban IP after 10 failures. |
| Worker crash / restart | On startup, reconcile: read all `bots.status='running'` from DB, respawn loops. DB is source of truth. |
| Duplicate order | Idempotency key: `bot_id + signal_id + timestamp` (or `bot_id + dca_level + symbol + side + timestamp`) stored in `bot_orders` unique constraint. |
| Insufficient token balance | Before placing any live order: check `token_balance`. If < projected fee: block order, set `status='paused'`, alert user, log `security_events` type='insufficient_balance_block'. Paper mode unaffected. |
| Exchange connection invalid | CCXT "Invalid API key" or "Permission denied" → mark `exchange_connections.is_active=false`, notify user, pause all bots using this connection. |
| Exchange maintenance / delisted pair | CCXT "Market not found" or "Trading suspended" → pause all bots on that `exchange_id+symbol`. Admin bulk-resume endpoint available. |

### 9.2 Wallet

| Scenario | Handling |
|----------|----------|
| Wrong token sent (not USDT) | `blockchain_events.status='invalid'`. Not credited. Admin can manually refund if user contacts support with proof. |
| Send to wrong address | Irrecoverable. UI displays bold warning: "Only send USDT (BEP20) to this exact address. Wrong network = lost funds." |
| Dust deposit (< sweep threshold) | Not swept. Displayed in "pending deposits" with note. User can send more USDT to same address to reach threshold. Admin can manually sweep if support ticket opened. |
| Double deposit (same tx hash) | `blockchain_events.tx_hash` unique constraint prevents double credit. |
| Wallet Service offline during deposit | Events persist on blockchain. On restart, Wallet Service replays from `last_processed_block` stored in its DB. BscScan API used to catch up. |
| Hot wallet out of BNB for gas | Alert admin via `security_events`. Withdrawals pause. Deposits still accepted. Auto-sweeping pauses. |
| Withdrawal to exchange address | API checks destination against known exchange deposit address list → warns user: "This looks like an exchange address. Withdrawals to exchange addresses may be delayed or lost." Requires explicit confirmation. |

### 9.3 Admin & Platform

| Scenario | Handling |
|----------|----------|
| Admin changes fee % mid-trade | New rate applies to trades filled after the change. In-flight trades use `fee_rate_at_entry` captured at order creation time. |
| User dispute / refund request | Admin reviews trade in panel. If approved: `transactions` type='refund' credits user's `token_balance`. Commission ledger entries for that trade are reversed (referrer loses commission). All actions logged to `admin_audit_log`. |
| Bot stale heartbeat | Worker writes `bot:heartbeat:{botId}` to Redis every 30s. Admin panel shows healthy/stale/dead. Stale > 2 min = auto-alert + mark `status='unknown'`. Dead > 5 min = auto-pause. |
| KOL approval fraud | Admin must verify referrer's legitimacy (social presence, non-circular referrals) before approving KOL. `pending_kol` referrals shown in admin queue with referral tree preview. |
| Admin impersonation / action audit | Every admin action writes to `admin_audit_log` with `old_value_json` and `new_value_json`. Immutable. Admin cannot delete logs. |

---

## 10. Admin Panel

### 10.1 Control Surface

| Section | Capabilities |
|---------|-------------|
| **Users** | Search/filter by email, role, balance. Suspend/activate. Reset 2FA. Impersonate (read-only, logged). View all wallets & transactions. |
| **Bots** | List all bots across users with filters (type, status, exchange). Start/stop/pause any bot. Emergency kill switch (`POST /admin/bots/:id/emergency-stop`) bypasses queues, cancels open orders. View logs & orders inline. Edit `config_json` with audit trail. |
| **Pricing & Tokens** | Adjust `global_fee_rate` (default 20%). Adjust `token_price_usdt` (default 1:1). Set referral tier thresholds. Override commission rate for individual users. View revenue dashboard (daily fees, referrals, deposits, withdrawals). |
| **Referrals** | View all referral trees. Approve/reject KOL applications. See top earners. Flag suspicious patterns (same IP, circular). |
| **System Health** | Worker queue depth (BullMQ). Redis memory usage. DB connection pool stats. Exchange API status (up/down per exchange, last response time). Error rate trends (per bot, per exchange). Active bot count. |
| **Security & Audit** | `security_events` feed with filters. `admin_audit_log` immutable history. IP allowlist for admin routes. Force global password reset. |
| **Wallet Ops** | View hot wallet BNB balance. View pending sweep queue. Manual sweep trigger. View blockchain event feed. Handle invalid deposit refunds. |

### 10.2 Admin Route Middleware

```
authMiddleware → roleMiddleware('admin') → ipAllowlistMiddleware → routeHandler
```

---

## 11. Frontend (TanStack)

### 11.1 Stack

- **TanStack Router** — file-based routing, type-safe.
- **TanStack Query** — server state fetching, caching, mutations.
- **TanStack Form** — form state management.
- **shadcn/ui** — component library built on Tailwind CSS.
- **Tailwind CSS** — utility-first styling.
- **Lightweight Charts** or **TradingView Charting Library** — chart display (integration with CCXT OHLCV data).

### 11.2 Key Screens

| Screen | Purpose |
|--------|---------|
| `/login`, `/register` | Auth forms with referral code input. |
| `/dashboard` | Overview: wallet balance, active bots, recent orders, PnL summary. |
| `/wallet` | Deposit (show QR + address), convert USDT↔Tokens, withdrawal, transaction history. |
| `/bots` | List user's bots. Create new bot wizard (Signal or DCA). Start/stop/pause. Toggle paper/live. |
| `/bots/:id` | Bot detail: config editor, active orders, trade history, logs stream, chart overlay. |
| `/bots/:id/comments` | Community comments and strategy sharing. |
| `/referrals` | Referral dashboard: code, link, tier progress, earnings history, referred users list. |
| `/admin` | Admin panel (protected). |

### 11.3 Real-Time Updates

- API opens SSE stream at `/events` for authenticated users.
- Events: `trade-filled`, `bot-status-changed`, `balance-updated`, `log-entry`.
- TanStack Query cache invalidation on relevant events.

---

## 12. Redis Usage

| Purpose | Data Structure / Pattern |
|---------|-------------------------|
| BullMQ queues | `bull:bot-start`, `bull:bot-stop`, `bull:signal-execute`, `bull:dca-start` |
| Pub/Sub events | `events:trade`, `events:bot-status`, `events:balance` |
| Session cache | `session:{refreshToken}` → userId (TTL 7 days) |
| Rate limiting | `ratelimit:{ip}:{endpoint}` (TTL 15 min) |
| Worker heartbeat | `bot:heartbeat:{botId}` (TTL 2 min) |
| Worker state | `worker:bot-loops` — Set of running bot IDs, used for reconciliation |
| Deposit address cache | `wallet:address:{userId}` → bsc_address (to avoid redundant generation) |

---

## 13. Docker Compose Setup (Local Dev)

### 13.1 Services

```yaml
# docker-compose.yml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: botuser
      POSTGRES_PASSWORD: botpass
      POSTGRES_DB: botdb
    ports:
      - "5444:5432"  # Non-default port to avoid conflicts
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6390:6379"  # Non-default port
    volumes:
      - redis_data:/data

  api:
    build: ./apps/api
    depends_on: [postgres, redis]
    env_file: .env
    ports:
      - "3000:3000"

  worker:
    build: ./apps/worker
    depends_on: [postgres, redis]
    env_file: .env
    # Scales horizontally: docker compose up --scale worker=3

  wallet:
    build: ./apps/wallet
    depends_on: [redis]
    env_file: .env
    ports:
      - "3001:3001"

volumes:
  postgres_data:
  redis_data:
```

### 13.2 Environment Variables

```env
# Database
DATABASE_URL=postgresql://botuser:botpass@localhost:5444/botdb

# Redis
REDIS_URL=redis://localhost:6390

# Auth
JWT_SECRET=...
JWT_REFRESH_SECRET=...

# Encryption
WALLET_MASTER_KEY=...  # AES-256-GCM master key for exchange API keys

# Wallet Service
BSC_RPC_URL=wss://bsc.getblock.io/...  # or QuickNode/Ankr
BSCSCAN_API_KEY=...
HOT_WALLET_PRIVATE_KEY=...  # BSC hot wallet (encrypted at rest in Wallet Service)
SWEEP_MIN_THRESHOLD=2.0

# Platform
GLOBAL_FEE_RATE=0.20
MIN_WITHDRAWAL=5.0
ADMIN_ALLOWED_IPS=127.0.0.1,::1
```

### 13.3 Dev Workflow

```bash
# Start infrastructure
docker compose up -d postgres redis

# Run migrations
pnpm db:migrate

# Start services (in separate terminals)
pnpm --filter=api dev
pnpm --filter=worker dev
pnpm --filter=wallet dev

# Or all at once via Turborepo
pnpm dev
```

---

## 14. Testing Strategy

### 14.1 Unit Tests

- **Zod schema validation** for `bots.config_json` (Signal config, DCA config).
- **Fee calculation logic** (winning trade 20%, losing trade 0%, referral commission split).
- **Encryption/decryption** round-trips for API keys.
- **Referral tier promotion** rules (edge: exactly at threshold).

### 14.2 Integration Tests

- **API routes:** Supertest against Hono app with test database (testcontainers Postgres on random port).
- **Webhook validation:** HMAC signature verification, replay attack prevention.
- **CCXT Paper connector:** Simulate trades and verify `paper_trades` PnL math.
- **Wallet Service:** Mock BSC WebSocket events, verify deposit callback flow.

### 14.3 E2E Tests

- **User journey:** Register → deposit → convert → create bot → paper trade → view PnL → withdraw.
- **Admin journey:** Login → approve KOL → kill bot → issue refund → view audit log.
- **Bot resilience:** Start bot → simulate exchange downtime → verify auto-pause → resume → verify recovery.

### 14.4 Test Database

- Use `testcontainers` to spin up Postgres on a random port per test suite.
- Seed with fixtures via Prisma migrate + seed script.
- Redis mocked or use testcontainers Redis.

---

## 15. Security Checklist

- [ ] All passwords hashed with bcrypt (cost factor 12).
- [ ] JWT access tokens short-lived (15 min), refresh tokens httpOnly secure cookies.
- [ ] API keys encrypted at rest (AES-256-GCM). Master key never committed.
- [ ] Webhook endpoints protected by HMAC signature verification.
- [ ] Rate limiting on auth endpoints (5 attempts / 15 min / IP).
- [ ] Admin routes protected by role + IP allowlist.
- [ ] `security_events` table logs suspicious activity.
- [ ] `admin_audit_log` is immutable (no DELETE/UPDATE routes).
- [ ] Hot wallet private key encrypted in Wallet Service. Backup seed phrase in cold storage (env or HSM).
- [ ] Withdrawal requires email confirmation or 2FA (MVP: email confirmation; 2FA in v2).
- [ ] BSC deposit addresses generated deterministically from master seed. Seed never stored in Main API.

---

## 16. Open Questions (Resolved in Design)

| Question | Decision |
|----------|----------|
| Auth roles | `user`, `moderator`, `admin` |
| Billing | USDT wallet + token model, not Stripe subscriptions |
| Bot execution | Hybrid: Signal = webhook, DCA = persistent worker |
| Exchange scope | Launch with 5 (Binance, Bybit, OKX, KuCoin, Bitget), extensible registry |
| API key storage | Per user per exchange, AES-256-GCM encrypted |
| Wallet architecture | Dedicated Wallet Service with HD addresses (BEP20) |
| Referral commission | Performance-based tiers, 5% → 35% KOL, admin approval |
| Paper mode | Simulated trades, no fees, toggle to live flushes session |
| Dev infra | Docker Compose with Postgres on port 5444, Redis on 6390 |

---

## 17. Out of Scope (Future Sub-Projects)

- Signal Bot details (webhook format, order types, strategy documentation) → **Sub-project 2**
- DCA Martingale Bot details (calculator, safety order levels, take-profit math) → **Sub-project 3**
- Community / strategy comments, rating, copying → **Sub-project 4**
- Graphify + Obsidian graph view integration → **Sub-project 5**
- Social login (Google/GitHub) → v2
- 2FA (TOTP) → v2
- Mobile app → v2
- Multi-chain deposits (ETH, TRON, SOL) → v2
- On-chain smart contract gateway → v2

---

*End of Platform Core Design Spec.*
