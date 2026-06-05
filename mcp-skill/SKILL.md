# MCP Trading Skill

> **Purpose:** Teach Claude Code how to execute crypto trades via the NexusBot MCP Server and API.
> **Audience:** This skill file is consumed by Claude Code (the agent) — not by human users.
> **Scope:** Signal bot trading only. No DCA+.

---

## What This Skill Enables

When this skill is loaded, Claude Code can:

1. **Create and configure signal bots** on behalf of the user
2. **Send trading signals** (buy / sell / limit / stop / close / flip) to those bots
3. **Query positions, open orders, and balances** to make informed decisions
4. **Read market data** (ticker, orderbook, funding rate) before acting
5. **Manage risk** by respecting the bot's configured limits

All trading happens through the **NexusBot MCP Server** (`@crypto-bot-platform/mcp-server`) which acts as a secure bridge to crypto exchanges (Binance, Bybit, OKX, etc.). The user never shares raw exchange API keys with Claude — only a NexusBot API key.

---

## MCP Server Connection

The MCP server runs locally via `npx` with stdio transport:

```json
{
  "mcpServers": {
    "nexusbot": {
      "command": "npx",
      "args": ["-y", "@crypto-bot-platform/mcp-server"],
      "env": {
        "NEXUSBOT_API_URL": "https://api.nexusbot.trade",
        "NEXUSBOT_API_KEY": "nb_xxxxx_xxxxx"
      }
    }
  }
}
```

The MCP server exposes tools that map directly to the API endpoints documented in `docs/SIGNAL_BOT_TRADING.md`.

---

## Claude's Trading Workflow

When the user asks Claude to trade, follow this **exact decision tree**:

### Step 1: Gather Context

Always start by fetching the user's current state:

| MCP Tool | Why |
|----------|-----|
| `get_me` | Confirm identity, check wallet/token balance |
| `list_bots` | See what signal bots already exist |
| `list_connections` | See which exchanges are connected |
| `get_connection_balance` | Check free USDT on the exchange |

**Never trade blindly.** If the user says "buy BTC" without specifying which bot or exchange, ask which one or offer to create a new bot.

### Step 2: Ensure a Signal Bot Exists

Signal bots are the user's trading agent. Each bot is bound to:
- One exchange connection
- One trading pair (symbol)
- One strategy (`direct`, `bracket`, `scaled`, `twap`, `breakout`, `pullback`)
- One risk profile

If no suitable bot exists, create one:

```
User: "I want to trade BTC on Bybit"
Claude: (calls create_bot)
  {
    name: "BTC Bybit Signal",
    connectionId: "<bybit_conn_id>",
    tradingPair: "BTC/USDT",
    mode: "paper",           // Default to paper unless user says "live"
    config: {
      type: "signal",
      strategy: "bracket",
      symbol: "BTCUSDT",
      leverage: 10,
      marginMode: "cross",
      bracket: { stopLossPercent: 2.0, takeProfitPercent: 6.0 },
      risk: { maxPositionSizeUsdt: 500, cooldownSeconds: 30 }
    }
  }
```

### Step 3: Read Market Data (Before Acting)

Before placing any order, fetch:

| MCP Tool | Use Case |
|----------|----------|
| `get_ticker` | Current price, spread |
| `get_orderbook` | Depth, liquidity check |
| `get_recent_trades` | Slippage estimate |
| `get_funding_rate` | If holding perp overnight |

If spread > bot's `slippageMaxPercent`, warn the user and suggest limit instead of market.

### Step 4: Execute the Trade

Route the user's intent through the correct MCP tool:

| User Intent | MCP Tool | Notes |
|-------------|----------|-------|
| "Buy BTC now" | `send_signal` | Direction: `long`, orderType: `market` |
| "Sell BTC at $66k limit" | `send_signal` | Direction: `short`, orderType: `limit`, price: 66000 |
| "Set stop-loss at 2%" | `set_bracket` | Attach to existing position |
| "Close half my position" | `close_position` | Partial close with reduceOnly |
| "Flip to short" | `close_position` then `send_signal` (direction: `short`) |
| "Cancel that order" | `cancel_order` | By exchange order ID |
| "What's my position?" | `get_position` | Size, entry, unrealized PnL |

### Step 5: Report Results

After any trade action, always report:
- What was done (order type, amount, price, symbol)
- Current position state (if any)
- Risk status (remaining exposure vs max limits)
- Any warnings (cooldown active, funding soon, etc.)

---

## Strategy Decision Logic

The **bot's strategy** decides *how* to execute a signal. Claude does not need to implement strategy logic — the bot does. But Claude **must** choose the right strategy when creating the bot.

| Strategy | When to Use | What the Bot Does |
|----------|-------------|-----------------|
| `direct` | Simple signals, user manages SL/TP manually | Executes exactly as signaled |
| `bracket` | User wants auto SL/TP on every trade | Entry + auto SL/TP after fill |
| `scaled` | Large position, wants better average entry | Splits into tiered limit orders |
| `twap` | Very large order, minimize market impact | Time-sliced execution |
| `breakout` | Waiting for confirmation candle | Delays until price confirms |
| `pullback` | User wants better fill than signal price | Limit at pullback % from signal |

**Default recommendation:** Use `bracket` for most users. It gives auto risk management.

---

## Risk Guard Rules (Claude Must Enforce)

Before every trade, verify:

1. **Position size ≤ `maxPositionSizeUsdt`**
   - If user's request exceeds it, ask for confirmation or reduce size.

2. **Total exposure ≤ `maxTotalExposureUsdt`**
   - Sum of all open signal positions across all bots.
   - If a new trade would exceed, warn and ask which position to close first.

3. **Cooldown respected**
   - If `cooldownSeconds` hasn't passed since last trade on this bot, wait or skip.

4. **Funding rate check**
   - If holding perp and funding rate is high (>0.01%), warn user before holding through funding.

5. **Paper mode first**
   - If user hasn't traded a strategy before, strongly recommend paper mode first.
   - Never switch a bot to live mode without explicit user confirmation.

---

## Example Conversations (Claude's Internal Playbook)

### Scenario 1: New User Wants to Trade

> **User:** "I want to trade BTC. Can you help me set it up?"
>
> **Claude:**
> 1. `get_me` → user has 500 USDT wallet balance, no signal bots yet
> 2. `list_connections` → user has Bybit connected
> 3. "I see you have Bybit connected. I'll create a **paper** signal bot for BTC/USDT with bracket strategy (auto SL/TP). You can switch to live after testing."
> 4. `create_bot` → paper, bracket, 10x cross, 2% SL / 6% TP
> 5. `start_bot`
> 6. "Your paper bot is running. Try sending a signal: 'buy 0.01 BTC at market' and I'll show you how it works."

### Scenario 2: Execute a Signal

> **User:** "Buy 0.02 BTC at market"
>
> **Claude:**
> 1. `list_bots` → finds BTC Bybit Signal bot (running, paper)
> 2. `get_position` → no open position yet
> 3. `get_ticker` → BTC/USDT last = $65,000, spread = 0.02%
> 4. `send_signal`:
>    ```json
>    {
>      "symbol": "BTCUSDT",
>      "direction": "long",
>      "amount": 0.02,
>      "amountType": "fixed_coin",
>      "orderType": "market",
>      "metadata": { "source": "mcp_agent" }
>    }
>    ```
> 5. `get_position` → position opened, size 0.02, entry $65,000
> 6. "Done. Bought 0.02 BTC at ~$65,000. Your bracket SL/TP is now active: SL at $63,700 (-2%), TP at $68,900 (+6%)."

### Scenario 3: Limit Entry (Pullback Strategy)

> **User:** "BTC is at $65k but I think it'll dip to $64k. Set a limit buy there."
>
> **Claude:**
> 1. Check bot strategy — currently `bracket`, not ideal for limit-only entries
> 2. "Your current bot uses bracket strategy (auto SL/TP on market fills). For a limit entry at $64k, I'll send a limit signal. If you want the bot to *always* use limit entries, we can change the strategy to `pullback`."
> 3. `send_signal`:
>    ```json
>    {
>      "symbol": "BTCUSDT",
>      "direction": "long",
>      "orderType": "limit",
>      "price": 64000,
>      "amount": 500,
>      "amountType": "fixed_usdt"
>    }
>    ```
> 4. "Limit buy placed at $64,000 for ~$500 worth. It will sit until filled or cancelled."

### Scenario 4: Close / Flip

> **User:** "The trend reversed. Get me out of BTC long and flip short."
>
> **Claude:**
> 1. `get_position` → 0.02 BTC long open
> 2. `close_position` → reduceOnly market sell 0.02 BTC
> 3. Wait for fill confirmation
> 4. `send_signal` → direction: `short`, market sell 0.02 BTC
> 5. "Flipped. Closed 0.02 BTC long at ~$65,500 (+$10 unrealized). Opened 0.02 BTC short at same price. New bracket: SL at $66,810 (+2%), TP at $61,570 (-6%)."

### Scenario 5: Scaled Entry

> **User:** "BTC looks strong. Build a position: 30% at market, 40% at $64,500, 30% at $64,000."
>
> **Claude:**
> 1. Check bot strategy — `bracket` won't auto-scale. Options:
>    - A) Use `scaled` strategy (bot handles all scaling)
>    - B) Manually place 3 signals
> 2. "I'll use the scaled strategy so the bot manages all 3 tiers. First, I'll update the bot strategy to `scaled`, then send the signal."
> 3. `update_bot` config → strategy: `scaled`
> 4. `send_signal` → direction: `long`, total amount $1,000, strategy: `scaled` (bot auto-splits into tiers)
> 5. "Scaled entry active. 3 limit tiers placed. Bracket attaches when total fills."

---

## MCP Tool Schema Reference

### Bot Management

**`create_bot(name, connectionId, tradingPair, mode, config)`**
- `config.type`: `"signal"`
- `config.strategy`: `"direct" | "bracket" | "scaled" | "twap" | "breakout" | "pullback"`
- `config.symbol`: Exchange symbol (e.g. `"BTCUSDT"`)
- `config.leverage`: number (e.g. 10)
- `config.marginMode`: `"cross" | "isolated"`
- `config.bracket.stopLossPercent`: number
- `config.bracket.takeProfitPercent`: number
- `config.risk.maxPositionSizeUsdt`: number
- `config.risk.maxTotalExposureUsdt`: number
- `config.risk.maxDailyLossUsdt`: number
- `config.risk.cooldownSeconds`: number

**`send_signal(botId, symbol, direction, side?, amount?, amountType?, price?, orderType?, strategy?, metadata?)`**
- `direction`: `"long" | "short" | "close" | "flip"`
- `orderType`: `"market" | "limit" | "stop_market" | "stop_limit" | "oco"`
- `amountType`: `"fixed_usdt" | "fixed_coin" | "percent_balance"`

**`start_bot(botId)` / `stop_bot(botId)` / `delete_bot(botId)`**

### Direct Exchange Operations

**`place_order(connectionId, symbol, side, type, amount, price?, timeInForce?, reduceOnly?)`**
- `side`: `"buy" | "sell"`
- `type`: `"market" | "limit" | "stop_market" | "stop_limit" | "oco"`
- `reduceOnly`: boolean (required for all close orders)

**`cancel_order(connectionId, orderId)`**

**`get_position(connectionId, symbol)`** → `{ size, side, entryPrice, unrealizedPnl, leverage }`

**`get_open_orders(connectionId, symbol?)`** → array of orders

**`set_bracket(connectionId, symbol, stopLossPercent, takeProfitPercent, trailingStop?)`**

**`close_position(connectionId, symbol, amount?, type?)`**
- `type`: `"market" | "limit"` (default market)
- Always uses `reduceOnly` internally

**`update_leverage(connectionId, symbol, leverage, marginMode)`**

### Market Data

**`get_ticker(connectionId, symbol)`** → `{ last, bid, ask, change24hPct }`

**`get_orderbook(connectionId, symbol, limit?)`** → `{ bids: [[price, size], ...], asks: [...] }`

**`get_recent_trades(connectionId, symbol, limit?)`** → array of recent fills

**`get_funding_rate(connectionId, symbol)`** → `{ fundingRate, nextFundingTime }`

### Account Data

**`get_connection_balance(connectionId)`** → `{ USDT: { free, used, total }, ... }`

**`get_wallet()`** → `{ usdtBalance, tokenBalance, bscAddress }`

---

## Error Handling

When MCP tools return errors, Claude should:

| Error | Response |
|-------|----------|
| `NO_FUNDS` (insufficient token balance) | "You need platform tokens to run live bots. Go to Wallet → Convert to top up." |
| `RATE_LIMIT` | "The exchange rate-limited us. Waiting 1s and retrying." |
| `INVALID_SYMBOL` | "That symbol isn't available on this exchange. Try `get_markets` to see valid pairs." |
| `INSUFFICIENT_BALANCE` (exchange side) | "Your exchange balance is too low for this order. Current free USDT: $X." |
| `POSITION_NOT_FOUND` | "No open position to close. Are you already flat?" |
| `COOLDOWN_ACTIVE` | "Bot is in cooldown. Next signal available in N seconds." |

---

## Safety Defaults

Unless the user explicitly overrides, always use these defaults when creating bots:

| Setting | Default | Reason |
|---------|---------|--------|
| `mode` | `paper` | Protect user's capital |
| `strategy` | `bracket` | Auto risk management |
| `leverage` | `1` (spot) or `5` (perp) | Conservative |
| `stopLossPercent` | `2.0` | Tight risk control |
| `takeProfitPercent` | `6.0` | 3:1 reward ratio |
| `maxPositionSizeUsdt` | `500` | Small position size |
| `cooldownSeconds` | `30` | Prevent overtrading |
| `slippageMaxPercent` | `0.5` | Reject bad fills |

---

## Related Documentation

- `docs/SIGNAL_BOT_TRADING.md` — Full signal bot architecture & TradingView webhook guide
- `docs/MCP_INTEGRATION.md` — MCP server setup for human users
- `apps/web/src/routes/api-docs.tsx` — Live API docs in the web app

---

*End of MCP Trading Skill.*
