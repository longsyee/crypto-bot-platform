# Signal Bot Webhook API Documentation

## Overview

Signal bots execute trades instantly when they receive a signal via webhook. You can send signals from:
- **TradingView alerts** (using webhook signature)
- **Your own scripts / MCP clients** (using API key or JWT)
- **Third-party platforms** (using webhook signature)

Both **paper (simulation)** and **live (real exchange)** modes use the **same payload structure**. The only difference is whether real money is used.

> **Key design:** Every order — paper or live — is saved to the **same** `BotOrder` database table. Your bot always knows what is open, closed, or canceled, regardless of mode.

---

## Endpoint

```
POST /api/webhooks/signal/:botId
```

### URL Parameters

| Parameter | Type   | Required | Description                          |
|-----------|--------|----------|--------------------------------------|
| `botId`   | string | Yes      | The UUID of the signal bot to target |

### Base URL Examples

| Environment | Example URL                                             |
|-------------|---------------------------------------------------------|
| Local dev   | `http://localhost:3001/api/webhooks/signal/{botId}`     |
| Production  | `https://api.yourdomain.com/api/webhooks/signal/{botId}` |

---

## Authentication

Two methods are supported:

### 1. API Key / JWT (Programmatic)

Send your **API Key** in the header:

```
X-API-Key: cbp_live_xxxxxxxxxxxxxxxx
```

Or send your **JWT Bearer token**:

```
Authorization: Bearer <jwt_token>
```

> The caller **must own the bot**. A 403 is returned if you try to signal someone else's bot.

### 2. Webhook Signature (TradingView / External)

Send a `x-signature` header containing an **HMAC-SHA256** of the JSON body:

```
x-signature: <hex_hmac_sha256>
```

The secret is configured per-bot inside **Bot Config → Webhook Secret**.

```javascript
const crypto = require("crypto");
const signature = crypto
  .createHmac("sha256", WEBHOOK_SECRET)
  .update(JSON.stringify(body))
  .digest("hex");
```

> If the signature is wrong, the request is rejected and a security event is logged.

---

## Request Payload

### Content-Type

```
Content-Type: application/json
```

### Body Fields

| Field           | Type    | Required | Default Source                     | Description                                                                 |
|-----------------|---------|----------|------------------------------------|-----------------------------------------------------------------------------|
| `side`          | string  | No       | Bot config `default_side`          | Trade direction: `buy` or `sell`                                              |
| `symbol`        | string  | No       | Bot `tradingPair` or config        | Trading pair, e.g. `BTC/USDT`, `ETH/USDT:USDT`                              |
| `order_type`    | string  | No       | Bot config `default_order_type`    | `market` or `limit`                                                         |
| `price`         | number  | No*      | Bot config `default_price`         | **Required only for `limit` orders.** Ignored for `market`.                |
| `volume`        | number  | No       | Bot config `default_volume`        | Order size (contracts / coins)                                               |
| `reduce_only`   | boolean | No       | Bot config `reduce_only`           | If `true`, the order only reduces/closes an existing position (no new open) |
| `position_side` | string  | No       | Bot config `position_side`         | `LONG` or `SHORT` (required for hedge mode on some exchanges)                |
| `trading_pair`  | string  | No       | Bot `name` or config               | Alias for `symbol`. Used if `symbol` is missing.                           |

> **Priority:** Payload field → Bot config → hardcoded fallback (`market`, `0`).  
> This means you can set **defaults in the bot config** and only override what changes per signal.

---

## Example Requests

### 1. Simple Market Buy (API Key)

Uses all defaults from bot config:

```bash
curl -X POST "https://api.yourdomain.com/api/webhooks/signal/123e4567-e89b-12d3-a456-426614174000" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: cbp_live_xxxxxxxxxxxxxxxx" \
  -d '{"side": "buy"}'
```

### 2. Limit Sell with Price & Reduce-Only

```bash
curl -X POST "https://api.yourdomain.com/api/webhooks/signal/123e4567-e89b-12d3-a456-426614174000" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: cbp_live_xxxxxxxxxxxxxxxx" \
  -d '{
    "side": "sell",
    "order_type": "limit",
    "price": 65000.50,
    "volume": 0.5,
    "reduce_only": true,
    "position_side": "LONG"
  }'
```

### 3. TradingView Webhook (Signature)

```bash
# Generate signature first
BODY='{"side":"buy","volume":0.1}'
SIGN=$(echo -n "$BODY" | openssl dgst -sha256 -hmac "my_webhook_secret" | sed 's/^.* //')

curl -X POST "https://api.yourdomain.com/api/webhooks/signal/123e4567-e89b-12d3-a456-426614174000" \
  -H "Content-Type: application/json" \
  -H "x-signature: $SIGN" \
  -d "$BODY"
```

### 4. Python Example

```python
import requests, hmac, hashlib, json

BOT_ID = "123e4567-e89b-12d3-a456-426614174000"
API_KEY = "cbp_live_xxxxxxxxxxxxxxxx"
WEBHOOK_SECRET = "my_webhook_secret"

body = {
    "side": "buy",
    "symbol": "BTC/USDT:USDT",
    "order_type": "market",
    "volume": 0.01,
}

# Signature mode
signature = hmac.new(
    WEBHOOK_SECRET.encode(),
    json.dumps(body).encode(),
    hashlib.sha256
).hexdigest()

res = requests.post(
    f"https://api.yourdomain.com/api/webhooks/signal/{BOT_ID}",
    headers={
        "Content-Type": "application/json",
        "x-signature": signature,
    },
    json=body,
)
print(res.json())
```

---

## Response Format

### Success (200)

```json
{
  "success": true,
  "data": {
    "queued": true
  }
}
```

> The order is **queued**, not instantly confirmed. The worker picks it up within seconds.

### Error Responses

| HTTP | `code`              | Meaning                                                        |
|------|---------------------|----------------------------------------------------------------|
| 401  | `NO_AUTH`           | Missing API key, JWT, or webhook signature                     |
| 401  | —                   | Invalid webhook signature                                      |
| 403  | `NOT_OWNER`         | API key valid, but you do not own this bot                     |
| 404  | —                   | Bot not found or not running                                   |
| 400  | `NO_WEBHOOK_SECRET` | Bot has no webhook secret configured (signature mode)        |
| 400  | `NO_FUNDS`          | Insufficient platform token balance (live mode only)           |
| 500  | —                   | Internal server error                                          |

### Example Error

```json
{
  "success": false,
  "error": "Bot not found or not running"
}
```

---

## Order Lifecycle

After a successful webhook call:

1. **Queue** → Job is added to `botQueue` with type `signal-execute`
2. **Worker** picks up the job and:
   - Resolves the trading symbol
   - Connects to the exchange (live) or simulates (paper)
   - Places the order with `reduceOnly` / `positionSide` passed through
3. **Unified Ledger** — A `BotOrder` row is created **for both paper and live**:
   - `exchangeOrderId` = `paper-{timestamp}` (paper) or exchange native ID (live)
   - `status` = `open` for limit, `closed` for market
   - `rawCcxtResponseJson` stores the full order object
4. **Paper limit orders** stay `open` until market price touches the limit price. The next signal or sync triggers a simulated fill and updates the `BotOrder` status to `closed`.
5. **Live limit orders** stay `open` on the real exchange until filled or canceled.

---

## Paper vs Live Parity

| Feature            | Paper (Simulation)                         | Live (Real Exchange)                        |
|--------------------|--------------------------------------------|---------------------------------------------|
| Auth required      | API key / JWT / Signature                  | API key / JWT / Signature                   |
| Order placement    | Simulated against real market price        | Real CCXT `createOrder`                     |
| Order ID format    | `paper-{timestamp}`                        | Exchange native ID                          |
| Reduce-only        | Respected (closes position, releases margin) | Passed to exchange `reduceOnly` param       |
| Position side      | Updates `longPosition` / `shortPosition`   | Passed to exchange `positionSide` param       |
| Limit order fill   | Triggered when market price hits limit     | Filled by exchange order book               |
| Cancel order       | Returns margin, updates `BotOrder` ledger  | Calls `exchange.cancelOrder()`              |
| Order history      | **Persistent `BotOrder` table** ✅         | **Persistent `BotOrder` table** ✅          |
| Open orders query  | `GET /api/bots/{botId}/orders`             | `GET /api/bots/{botId}/orders`              |
| PnL tracking       | Uses VWAP on simulated state               | Calculated from exchange positions          |
| Webhook payload    | Identical                                  | Identical                                   |

> **Best practice:** Test your signals in **paper mode** first. The payload is exactly the same when you switch to live.

---

## Where Is Paper Data Stored?

Three storage layers work together:

### 1. `BotOrder` table (Unified Order Ledger) ⭐ Primary

**What it stores:** Every paper and live order with `status`, `filled`, `remaining`, `price`, `cost`, `fee`, `rawCcxtResponseJson`.

**Why it matters:** This is the **single source of truth** for the UI, API, and bot state recovery. When you call `GET /api/bots/{botId}/orders`, this is the table that answers.

**When it is updated:**
- On `placeOrder` → row created (`open` for limit, `closed` for market)
- On limit fill → `status` updated to `closed`, `filled` and `cost` populated
- On cancel → `status` updated to `canceled`, `remaining` set to `0`

### 2. `Bot.paperBalance` JSON column (Runtime Engine State)

**What it stores:**
- `USDT` — simulated wallet balance
- `position`, `entryPrice` — legacy single-side position
- `longPosition`, `longEntryPrice`, `shortPosition`, `shortEntryPrice` — dual/hedge mode
- `paperOrders` — the in-memory order book the paper engine uses to evaluate fills
- `totalFees`, `realizedPnl`, `leverage`

**Why it matters:** The paper engine needs fast, in-process state. It does not query `BotOrder` on every tick; it reads `paperBalance`, evaluates fills against live ticker prices, then writes updated state back.

**When it is updated:**
- On every paper order placement
- On every paper limit order fill evaluation
- On every paper cancel
- On DCA bot state persistence

### 3. `PaperTrade` table (Audit Trail)

**What it stores:** One row per **executed** simulated trade: `side`, `amount`, `price`, `simulatedFee`, `totalCost`, `pnl`.

**Why it matters:** Historical audit. It does **not** track open or canceled orders — only completed fills. Legacy DCA bots used this as their primary state source; new bots use `BotOrder` and fall back to `PaperTrade` only if no `BotOrder` records exist.

**Summary:**

| Question | Answer |
|----------|--------|
| Does paper trade save to DB? | **Yes.** `BotOrder` (orders) + `paperBalance` (state) + `PaperTrade` (audit). |
| Can I query paper orders via API? | **Yes.** `GET /api/bots/{botId}/orders` returns `BotOrder` rows for both paper and live. |
| Will paper orders survive a restart? | **Yes.** `BotOrder` rows and `paperBalance` are persisted in Postgres. |
| Why does `paperBalance` also store `paperOrders`? | The engine needs the in-memory order book to check limit fills against live prices every tick. `BotOrder` is the record; `paperOrders` is the engine's working copy. |

---

## Bot Config Defaults

When creating a signal bot, you can set these defaults so your webhooks stay minimal:

| Config Field           | Example Value | Purpose                                    |
|------------------------|---------------|--------------------------------------------|
| `tradingPair`          | `BTC/USDT`    | Default symbol if payload omits it         |
| `default_side`         | `buy`         | Default direction                          |
| `default_order_type`   | `market`      | Default order type                         |
| `default_volume`       | `0.01`        | Default order size                         |
| `default_price`        | `65000`       | Default limit price (used when `order_type: limit`) |
| `reduce_only`          | `false`       | Default reduce-only flag                   |
| `position_side`        | `LONG`        | Default position side (hedge mode)         |
| `webhook_secret`       | `my_secret`   | Required for signature-based webhooks      |

---

## SimFunds & Wallet Endpoints

### Top Up Paper Balance (SimFunds)

```
POST /api/wallets/topup-paper
```

Convert real USDT in your wallet into SimFunds for paper trading. The platform deducts USDT from your wallet and credits SimFunds at the current admin-configured rate (default: **100 SimFunds per 1 USDT**).

> **Paper mode is free** — SimFunds have no real value and no fees are charged on paper trades. The "Real Equivalent" display shows what your profit would be after the live platform fee.

#### Authentication
- JWT `Bearer <token>` (wallet owner only)

#### Request Body

| Field        | Type   | Required | Description                                   |
|--------------|--------|----------|-----------------------------------------------|
| `usdtAmount` | number | Yes      | Real USDT to convert. Must be > 0.           |

#### Example Request

```bash
curl -X POST https://api.yourdomain.com/api/wallets/topup-paper \
  -H "Authorization: Bearer <jwt_token>" \
  -H "Content-Type: application/json" \
  -d '{"usdtAmount": 10}'
```

#### Response

```json
{
  "success": true,
  "data": {
    "simFundsBalance": 2500.00,
    "rate": 100
  }
}
```

- `simFundsBalance` — your new total SimFunds balance.
- `rate` — the conversion rate used (SimFunds per 1 USDT).

#### Error Codes

| Code | Meaning                                                   |
|------|-----------------------------------------------------------|
| 400  | `usdtAmount` must be positive or insufficient USDT balance |
| 401  | Missing or invalid authentication                         |
| 404  | Wallet not found                                          |
| 500  | Database or server error                                  |

### Admin Grant SimFunds

Admins can grant free SimFunds directly via a separate endpoint:

```
POST /api/admin/sim-funds/grant
```

#### Authentication
- `X-API-Key` with `admin` scope

#### Request Body

| Field    | Type   | Required | Description                          |
|----------|--------|----------|--------------------------------------|
| `userId` | string | Yes      | Target user UUID                     |
| `amount` | number | Yes      | SimFunds to grant. Must be > 0.    |
| `reason` | string | No       | Optional reason for audit log        |

```bash
curl -X POST https://api.yourdomain.com/api/admin/sim-funds/grant \
  -H "X-API-Key: cbp_admin_xxxxxxxxxxxxxxxx" \
  -H "Content-Type: application/json" \
  -d '{"userId": "uuid-of-target-user", "amount": 500, "reason": "Welcome bonus"}'
```

#### Response

```json
{
  "success": true,
  "message": "Top-up successful",
  "simFundsBalance": 1500.00,
  "added": 500.00
}
```

- `simFundsBalance` — the user's new total SimFunds balance.
- `added` — the amount that was just added.

#### Error Codes

| Code | Meaning                                                   |
|------|-----------------------------------------------------------|
| 400  | `amount` must be a positive number                        |
| 401  | Missing or invalid authentication                         |
| 403  | Caller is not admin and `userId` does not match caller    |
| 404  | Wallet not found for target user                          |
| 500  | Database or server error                                  |

---

## FAQ

**Q: Can I send signals when the bot is stopped?**  
A: No. The bot status must be `running`. Stopped bots return 404.

**Q: What happens if `volume` is missing and no default is set?**  
A: The order amount becomes `0`, which will likely be rejected by the exchange or paper engine.

**Q: Can I use this for spot trading?**  
A: The current implementation is optimized for **futures / perpetuals** (`defaultType: "swap"`). Spot support requires connector adjustments.

**Q: Is there rate limiting?**  
A: BullMQ naturally rate-limits via queue processing. For high-frequency signals, consider increasing worker concurrency.

**Q: How do I view my orders after sending a signal?**  
A: Use the web UI **Bot Detail → Orders** tab, or query the API:
```
GET /api/bots/{botId}/orders
```
This returns the same `BotOrder` records for **both paper and live**.

**Q: Does a paper limit order expire if the price never hits?**  
A: Paper limit orders stay `open` until the market price touches the limit, or until you explicitly cancel them. There is no automatic expiration. If the bot is stopped and restarted, the order is restored from `BotOrder` + `paperBalance`.

**Q: Why does my paper bot show a position but the order is still `open`?**  
A: For paper limit orders, the position is **not updated** until the price is hit and the order fills. This is the same behavior as a real exchange. If you want instant fill, use `order_type: "market"`.
