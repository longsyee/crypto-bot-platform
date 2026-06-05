# MCP Trading Skill — README

> **For Claude Code:** Load `mcp-skill/SKILL.md` as your primary trading instruction set.
> **For human users:** This folder contains the skill definition that teaches Claude how to trade via MCP.

---

## What This Is

This folder contains a **Claude Code skill** that enables AI-driven crypto trading through the NexusBot MCP Server. It defines:

1. **How Claude connects** to the MCP server
2. **How Claude should think** before placing trades
3. **Exact workflows** for common trading scenarios
4. **Risk guard rules** that Claude must enforce
5. **MCP tool schemas** with all parameters

---

## Files

| File | Purpose |
|------|---------|
| `SKILL.md` | **Main skill file** — Claude Code consumes this. Contains decision trees, tool schemas, example conversations, risk rules. |
| `TRADING_GUIDE.md` | **Practical cookbook** — Copy-pasteable signal payloads, common strategies, and TradingView webhook templates. |
| `README.md` | This file — overview for humans. |

---

## Quick Start (For Claude)

1. **Ensure MCP server is connected:**
   ```json
   {
     "mcpServers": {
       "nexusbot": {
         "command": "npx",
         "args": ["-y", "@crypto-bot-platform/mcp-server"],
         "env": {
           "NEXUSBOT_API_URL": "http://localhost:3010",
           "NEXUSBOT_API_KEY": "nb_xxxxx_xxxxx"
         }
       }
     }
   }
   ```

2. **Test connectivity:**
   ```
   User: "What's my balance?"
   Claude: (calls get_me) "You have 500 USDT and 200 platform tokens."
   ```

3. **Create a paper signal bot:**
   ```
   User: "Create a BTC signal bot on Bybit"
   Claude: (follows SKILL.md Step 1-2) → Bot created, started in paper mode.
   ```

4. **Send your first signal:**
   ```
   User: "Buy 0.01 BTC at market"
   Claude: (follows SKILL.md Step 3-5) → Signal sent, position opened.
   ```

---

## Trading Strategies Supported

| Strategy | Use Case | Auto SL/TP |
|----------|----------|------------|
| `direct` | Manual SL/TP management | No |
| `bracket` | Auto risk on every trade | Yes |
| `scaled` | Tiered limit entries | Yes (on total fill) |
| `twap` | Large order slicing | Optional |
| `breakout` | Wait for confirmation | Yes |
| `pullback` | Better-than-signal fills | Yes |

**Recommended default:** `bracket` — gives automatic stop-loss and take-profit on every trade.

---

## Risk Guard (Claude Enforces These)

- ✅ **Paper mode first** — always default to paper
- ✅ **Max position size** — never exceed `maxPositionSizeUsdt`
- ✅ **Max total exposure** — sum across all bots
- ✅ **Cooldown** — respect `cooldownSeconds` between signals
- ✅ **Slippage check** — warn if spread > `slippageMaxPercent`
- ✅ **Funding rate** — warn before high-funding holds
- ✅ **ReduceOnly** — all closes use reduce-only

---

## Example Scenarios

See `SKILL.md` for full Claude internal monologues. Here are the headlines:

1. **New user setup** → Create bot + paper test
2. **Market buy/sell** → `send_signal` with direction
3. **Limit entry** → `send_signal` with orderType `limit`
4. **Close position** → `close_position` with reduceOnly
5. **Flip direction** → Close then open opposite
6. **Scaled entry** → Use `scaled` strategy or 3 `send_signal` calls
7. **Bracket SL/TP** → Set on bot creation, auto-attaches
8. **Check PnL** → `get_position` → report unrealized
9. **Cancel order** → `cancel_order` by ID
10. **Emergency exit** → `close_position` 100% market

---

## MCP Tools Available

### Bot Management
`create_bot` · `start_bot` · `stop_bot` · `delete_bot` · `send_signal` · `list_bots` · `get_bot` · `list_bot_orders` · `list_bot_logs`

### Exchange Operations
`place_order` · `cancel_order` · `get_open_orders` · `get_position` · `set_bracket` · `close_position` · `update_leverage` · `get_connection_balance`

### Market Data
`get_ticker` · `get_orderbook` · `get_recent_trades` · `get_funding_rate` · `get_markets`

### Account
`get_me` · `get_wallet` · `list_connections` · `list_transactions`

---

## Related Docs

- `../docs/SIGNAL_BOT_TRADING.md` — Architecture & webhook guide
- `../docs/MCP_INTEGRATION.md` — Human-facing MCP setup guide
- `../apps/web/src/routes/api-docs.tsx` — Live API reference

---

*Created: 2026-06-04*
