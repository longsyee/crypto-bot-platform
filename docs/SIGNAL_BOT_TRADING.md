# Signal Bot Trading — MCP & Webhook Integration Guide

> **Scope:** Signal-driven trading only. No DCA+ or martingale logic. Event-driven execution: TradingView alerts or MCP agent calls trigger the bot, which applies its configured strategy to place real orders.
> **Last updated:** 2026-06-04

---

## 1. What Signal Bot Trading Does

Unlike the DCA+ engine (which runs a persistent loop and self-triggers), the **Signal Bot** is **event-driven**:

1. Receives a signal (buy / sell / close / flip)
2. Applies its **strategy** to decide *how* to execute
3. Places the order on the exchange via CCXT
4. Optionally attaches bracket SL/TP, scales entries, or TWAP-slices
5. Logs the result and publishes real-time events

The signal source can be:
- **TradingView webhook alert**
- **MCP AI agent** (Claude Desktop, Cursor, Cline, etc.)
- **Manual API call**

---

## 2. Supported Operations (Real Trading)

These are the concrete order types the Signal Bot can place via CCXT:

| Operation | CCXT Method | Typical Use |
|-----------|-------------|-------------|
| **Market Buy / Sell** | `createMarketBuyOrder` / `createMarketSellOrder` | Immediate signal execution |
| **Limit Buy / Sell** | `createLimitBuyOrder` / `createLimitSellOrder` | Pullback entry, better fill price |
| **Stop Market** | `createStopMarketOrder` | Breakout entry, hard SL execution |
| **Stop-Limit** | `createStopLimitOrder` | Precise SL on illiquid pairs |
| **Trailing Stop** | Exchange-specific or `editOrder` | Dynamic SL that follows price |
| **OCO (One-Cancels-Other)** | Exchange-native or simulated pair | Bracket: SL + TP linked to entry |
| **Close Position** | Market order with `reduceOnly=true` | Full or partial exit |
| **Set Leverage** | `setLeverage` | Pre-trade leverage setup |
| **Cancel Order** | `cancelOrder` | Stale limit or reversal cleanup |

**Real trading rules enforced by the bot:**
- Leverage is pre-set when the bot starts (`setLeverage`)
- All **close** orders use `reduceOnly` to prevent accidental position flips
- Before placing any order, the bot checks `free` balance on the exchange
- Position is reconciled with the exchange every 30 seconds
- Slippage guard rejects market orders if spread exceeds configured max

---

## 3. Signal Payload

### From TradingView Webhook

```json
{
  "symbol": "BTCUSDT",
  "direction": "long",
  "side": "buy",
  "price": 65000.50,
  "amount": 0.01,
  "amountType": "fixed_coin",
  "orderType": "market",
  "timeInForce": "GTC",
  "strategy": "bracket",
  "metadata": {
    "source": "tradingview",
    "alert_name": "EMA Cross 15m",
    "interval": "15m",
    "message": "BTC crossed above EMA50"
  }
}
```

### From MCP Agent

Same JSON structure, sent via the MCP `send_signal` tool or directly via API:

```json
{
  "symbol": "ETHUSDT",
  "direction": "short",
  "amount": 500,
  "amountType": "fixed_usdt",
  "orderType": "limit",
  "price": 3200.00,
  "strategy": "scaled",
  "metadata": {
    "source": "mcp_agent",
    "message": "AI detected bearish divergence on RSI"
  }
}
```

**Field reference:**

| Field | Required | Description |
|-------|----------|-------------|
| `symbol` | Yes | Trading pair, e.g. `BTCUSDT` |
| `direction` | Yes | `long`, `short`, `close`, `flip` |
| `side` | No | Inferred from `direction` unless overridden (`buy` / `sell`) |
| `amount` | No | Quantity or notional value |
| `amountType` | No | `fixed_usdt`, `fixed_coin`, `percent_balance` |
| `price` | No | Required for `limit` and `stop-limit` |
| `orderType` | No | `market` (default), `limit`, `stop_market`, `stop_limit`, `oco` |
| `timeInForce` | No | `GTC`, `IOC`, `FOK` |
| `strategy` | No | Overrides bot's default strategy for this signal only |
| `metadata` | No | Source, alert ID, free-text context (logged, not executed) |

---

## 4. Bot Strategies (How the Bot Executes)

Each Signal Bot runs one of these strategies. The strategy decides *how* a raw signal is translated into exchange orders.

### `direct` — Execute Exactly as Signaled
1. Place the order specified in the signal (`market`, `limit`, etc.)
2. If the bot config has `bracket: true`, immediately attach SL/TP after fill
3. Done. No additional logic.

### `bracket` — Entry + Auto SL/TP
1. Place entry order (market or limit)
2. On full or partial fill, auto-place:
   - Stop-market SL at configured `%` below entry
   - Limit TP at configured `%` above entry
3. If the exchange supports OCO, group SL+TP as OCO
4. On partial fills, adjust bracket sizes to match remaining position

### `scaled` — Tiered Entry / Exit
Example signal: BUY BTC at $65,000
1. Bot splits total amount into 3 limit orders:
   - $65,000 — 40%
   - $64,500 — 35%
   - $64,000 — 25%
2. Cancel unfilled tiers if:
   - N% of total target amount has filled, or
   - An opposing signal (`flip` or `close`) is received
3. If entry completes, attach bracket SL/TP on total filled position

### `twap` — Time-Weighted Execution
1. Divide total amount into M slices
2. Execute one slice every N seconds as market or limit
3. Cancel remaining slices on opposing signal
4. Used for large orders where slippage matters

### `breakout` — Wait for Confirmation
1. Signal received at trigger price (e.g., $65,000)
2. Bot waits for 1 candle close above confirmation offset (e.g., +0.15%)
3. Then executes market buy
4. If price reverses below trigger before confirmation, cancels intent

### `pullback` — Limit at Pullback
1. Signal received at $65,000
2. Bot places limit buy at `signal_price × (1 - pullback_pct)`
3. Good-Till-Cancelled; if not filled within timeout, cancels
4. Bracket attached on fill

---

## 5. Risk Management (Lightweight)

Signal bots use a lean risk layer, not the heavy DCA+ guard stack:

```typescript
interface SignalRiskConfig {
  maxPositionSizeUsdt: number;       // Hard cap per trade
  maxTotalExposureUsdt: number;      // Sum of all open signal positions
  maxDailyLossUsdt: number;          // Kill switch threshold
  maxOpenPositions: number;          // Global concurrency limit
  slippageMaxPercent: number;        // Reject market if spread > N%
  requireConfirmation: boolean;       // For breakout strategy
  cooldownSeconds: number;            // Ignore signals within N seconds
}
```

**Kill switches:**
- Daily loss limit hit → stop all signal bots
- Liquidation proximity → emergency close
- Exchange API error N times in a row → pause bot, alert user
- Funding rate > threshold → close before funding (perp only)

---

## 6. MCP Tools for Signal Trading

Expand the MCP server with these tools so AI agents have full control:

| Tool | Purpose |
|------|---------|
| `send_signal` | Fire a raw signal (buy/sell/direction/close/flip) to a bot |
| `place_order` | Direct exchange order: market / limit / stop / stop-limit / OCO |
| `cancel_order` | Cancel open order by exchange order ID |
| `get_open_orders` | List bot's unfilled orders on the exchange |
| `get_position` | Current position: size, entry price, unrealized PnL |
| `set_bracket` | Attach SL/TP to an open position |
| `close_position` | Market close or limit close, partial or full |
| `update_leverage` | Set isolated/cross leverage for the symbol |
| `get_orderbook` | Depth check for signal quality |
| `get_recent_trades` | Last trades for slippage estimation |
| `get_funding_rate` | Funding cost check before holding perp |

**Example agent conversation:**

> **User:** "BTC is breaking out. Place a scaled long on bot_123: 40% at market, 30% at $65,000 limit, 30% at $64,500 limit. Attach 2% SL and 5% TP."
>
> **Agent:** *(calls `place_order` 3x, then `set_bracket`)* Done. 3 entry orders placed. Bracket will attach on fills.

---

## 7. TradingView Webhook Integration

### Endpoint

```
POST /webhooks/signal/:botId
```

### Authentication
1. **Programmatic:** `X-API-Key` or `Authorization: Bearer <JWT>` — requires `signals:write` permission.
2. **External:** `x-signature` HMAC-SHA256 of JSON body using `webhook_secret` configured per bot.

### TradingView Alert Message Template (Pine Script)

```pinescript
// Alert message JSON
{
  "symbol": "{{ticker}}",
  "direction": "{{strategy.order.action}}",
  "price": "{{close}}",
  "time": "{{time}}",
  "interval": "{{interval}}",
  "source": "tradingview",
  "alert_name": "{{alert_name}}"
}
```

Note: `{{strategy.order.action}}` emits `buy` or `sell`. The webhook handler maps:
- `buy` → `direction: long`
- `sell` → `direction: short`

### Webhook Handler Flow

1. Validate signature or API key
2. Map TradingView payload to internal `SignalPayload`
3. Check bot exists, `status = running`, mode matches
4. Risk check: token balance (live), cooldown, max exposure
5. Enqueue `signal-execute` BullMQ job
6. Worker loads bot config + strategy → executes via CCXT
7. Log result, publish Redis event, forward to frontend SSE

**Security notes:**
- Invalid signatures are logged to `security_events` table
- IP is banned after 10 consecutive failed webhook attempts
- TradingView sends once; if your API is down, the signal is lost. Idempotency is handled via `alertId + timestamp` deduplication.

---

## 8. Architecture Flow

```
TradingView Alert          MCP Agent Call
       │                         │
       └────────┬────────────────┘
                ▼
    POST /webhooks/signal/:botId
         or MCP tool: send_signal
                │
                ▼
        [API Validation]
    (HMAC / API Key / JWT)
                │
                ▼
      Enqueue BullMQ Job
      (type: signal-execute)
                │
                ▼
        [Worker Signal Handler]
                │
                ▼
      Load Bot Config + Strategy
                │
                ▼
      [Strategy Engine Decision]
    (direct? bracket? scaled? twap?)
                │
                ▼
      [Risk Guard Check]
   (size, exposure, cooldown, slippage)
                │
                ▼
      [Exchange Execution]
           via CCXT
                │
                ▼
      Persist Order + Position
      Log Event + Notify
```

---

## 9. Configuration Example

```json
{
  "type": "signal",
  "symbol": "BTCUSDT",
  "exchange_connection_id": "conn_abc123",
  "strategy": "bracket",
  "risk": {
    "maxPositionSizeUsdt": 500,
    "maxTotalExposureUsdt": 2000,
    "maxDailyLossUsdt": 500,
    "maxOpenPositions": 5,
    "slippageMaxPercent": 0.5,
    "cooldownSeconds": 30
  },
  "bracket": {
    "stopLossPercent": 2.0,
    "takeProfitPercent": 6.0,
    "trailingStop": false
  },
  "webhook_secret": "whsec_xxxxxxxx",
  "leverage": 10,
  "marginMode": "cross"
}
```

---

## 10. Out of Scope (DCA+ Only)

These features belong to the DCA+ engine, **not** the Signal Bot:
- Martingale safety orders
- VWAP recalculation loops
- Chop-loss or waterfall prevention
- Self-triggering indicator loops (RSI/MACD internal triggers)
- Automatic re-entry after TP without external signal

The Signal Bot requires an **external decision maker** (TradingView, AI agent, or manual user) to send every entry and exit signal.

---

*End of Signal Bot Trading Integration Guide.*
