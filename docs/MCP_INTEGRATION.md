# MCP / AI Agent Integration Guide

## Overview

NexusBot supports the **Model Context Protocol (MCP)** — an open standard by Anthropic that lets AI agents (Claude Desktop, Cursor, Cline, OpenClaw, Hermes, etc.) connect to external tools and data sources.

With our MCP server, an AI agent can:
- **Create and manage Signal bots** (event-driven, webhook/MCP-triggered)
- **Send trading signals** (buy / sell / limit / stop / OCO / close / flip)
- **Place, cancel, and monitor orders** directly on connected exchanges
- **Query positions, open orders, orderbook, and funding rates**
- **Check wallet and exchange balances**
- **Read market data** (tickers, trading pairs, recent trades)
- **Start/stop bots and monitor logs**

The AI agent uses **your** NexusBot account as a secure bridge to crypto exchanges. You never share exchange API keys with the AI — only a NexusBot API key.

---

## Architecture

```
┌─────────────┐      MCP (stdio)      ┌─────────────────────┐      HTTPS      ┌─────────────────┐
│  AI Agent   │  ═══════════════════>  │  @crypto-bot-platform│  ═════════════>  │  NexusBot API   │
│  (Claude)   │   JSON-RPC over stdin │  /mcp-server         │   X-API-Key     │  (Your Account) │
└─────────────┘                       └─────────────────────┘                 └─────────────────┘
                                                                                       │
                                                                                       │ Encrypted
                                                                                       ▼
                                                                                ┌──────────────┐
                                                                                │  Exchange    │
                                                                                │  (Binance,   │
                                                                                │   Bybit...)  │
                                                                                └──────────────┘
```

---

## Quick Start (3 minutes)

### Step 1: Open the AI Integration Page

1. Log in to your NexusBot dashboard
2. Go to **Profile → AI Agent Integration**
3. Review the **Default Trading Mode** banner at the top
   - **Paper Trading** (recommended for beginners) — simulated orders, no real funds
   - **Live Trading** — real orders on real exchanges

### Step 2: Generate an API Key

1. In the AI Integration page, go to the **API Keys** tab
2. Click **New Key**, give it a name (e.g., "Claude Desktop")
3. **Copy the key immediately** — it is shown only once
4. Format: `nb_xxxxxxxx_xxxxxxxx...`

### Step 3: Configure Your AI Client

#### Claude Desktop

Edit your Claude Desktop config:

- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%/Claude/claude_desktop_config.json`

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

Restart Claude Desktop. The NexusBot tools will appear in the tool picker.

#### Cline (VS Code)

Open Cline settings and add:

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

#### Cursor

Add to Cursor's MCP server config with the same JSON structure.

#### Alternative: Config File

Instead of env vars in each client, create `~/.nexusbot/mcp-config.json`:

```json
{
  "apiBaseUrl": "https://api.nexusbot.trade",
  "apiKey": "nb_xxxxx_xxxxx"
}
```

Then use `"env": {}` or omit it entirely in the client config.

---

## Paper Trading vs Live Trading

When you ask an AI agent to create a bot, it will use the **default trading mode** you set in the AI Integration page.

| Mode | What Happens | Requirements |
|------|--------------|--------------|
| **Paper** | Simulated orders, fake balance, no real funds | None |
| **Live** | Real orders on the connected exchange | Active exchange connection + token balance |

### How to Control It
- **Set the default** in Profile → AI Agent Integration. We strongly recommend keeping it on **Paper** until your strategy is proven.
- **Override per bot** by explicitly telling the AI: *"Create a LIVE signal bot for BTC/USDT"* or *"Create a PAPER signal bot"*.
- **Switch after creation**: The AI can call `update_bot` to change the mode, but the bot must be stopped first.

### Safety Gates
- Live bots require an active exchange connection with valid API keys.
- Starting a live bot checks your token balance. If zero, the start is blocked.
- All bots are created in **stopped** state. The AI must explicitly call `start_bot` to begin trading.
- Signal bots enforce `maxPositionSizeUsdt`, `maxTotalExposureUsdt`, and cooldown between signals.

---

## Available Tools

### Bot & Signal Management

| Tool | What It Does | Example Prompt |
|------|--------------|----------------|
| `get_me` | Show user profile + wallet | "What's my balance?" |
| `list_bots` | List all bots | "Show my bots" |
| `get_bot` | Bot details and config | "Tell me about my BTC bot" |
| `create_bot` | Create a Signal bot | "Create a signal bot for ETH/USDT" |
| `start_bot` | Start a stopped bot | "Start my signal bot" |
| `stop_bot` | Stop a running bot | "Stop the BTC bot" |
| `delete_bot` | Delete a bot | "Delete my old bot" |
| `send_signal` | Send a trading signal to a signal bot | "BUY 0.5 BTC at market with bracket SL/TP" |
| `list_bot_orders` | Order history | "Show orders for bot X" |
| `list_bot_logs` | Recent logs | "Any errors on my signal bot?" |

### Direct Exchange Operations

| Tool | What It Does | Example Prompt |
|------|--------------|----------------|
| `place_order` | Place market / limit / stop / OCO orders | "Place a limit sell at $66,000" |
| `cancel_order` | Cancel an open order by ID | "Cancel order abc-123" |
| `get_open_orders` | List active unfilled orders | "What orders are open?" |
| `get_position` | Current position size, entry, unrealized PnL | "What's my BTC position?" |
| `set_bracket` | Attach SL/TP to an open position | "Set 2% stop-loss and 5% take-profit" |
| `close_position` | Market or limit close, partial or full | "Close half my ETH position" |
| `update_leverage` | Set isolated/cross leverage | "Set BTC leverage to 10x cross" |
| `get_connection_balance` | Live exchange balance | "Check my Binance balance" |
| `get_orderbook` | Current depth | "Show me the BTC orderbook" |
| `get_recent_trades` | Recent fills for slippage estimate | "Recent BTC trades?" |
| `get_funding_rate` | Funding rate for perp holds | "What's the funding rate on BTC?" |

### Market & Account Data

| Tool | What It Does | Example Prompt |
|------|--------------|----------------|
| `get_wallet` | Wallet balances (USDT + platform token) | "How much USDT do I have?" |
| `list_transactions` | Transaction history | "Show my deposits" |
| `list_connections` | Exchange connections | "Which exchanges are connected?" |
| `get_markets` | Available pairs | "What can I trade on Bybit?" |
| `get_ticker` | Current price | "What's the BTC price?" |

---

## Example Conversations

### Create a Signal Bot with Bracket Strategy

> **You**: Create a signal bot called "BTC Bracket" on my Bybit connection for BTCUSDT. Use bracket strategy with 2% stop-loss and 6% take-profit. Max position $500.

> **AI**: *(calls `create_bot` with strategy: "bracket", mode: "paper")* Done. Signal bot "BTC Bracket" created with ID `sig-123`.

### Send a Trading Signal

> **You**: Send a BUY signal for 0.01 BTC to my bracket bot.

> **AI**: *(calls `send_signal`)* Signal queued: market buy 0.01 BTC. SL/TP bracket will attach on fill.

### Scaled Entry via MCP

> **You**: BTC is breaking out. Place a scaled long: 40% at market, 30% limit at $65,000, 30% limit at $64,500. Attach 2% SL and 5% TP.

> **AI**: *(calls `place_order` 3x, then `set_bracket`)*
- Order 1: market buy 0.004 BTC — placed
- Order 2: limit buy 0.003 BTC @ $65,000 — placed
- Order 3: limit buy 0.003 BTC @ $64,500 — placed
- Bracket SL/TP will attach on total fill.

### Close / Flip Position

> **You**: The trend reversed. Flip my BTC position to short.

> **AI**: *(calls `close_position` reduce-only, then `place_order` sell)*
- Closed 0.01 BTC long position
- Opened 0.01 BTC short at market

### Monitor

> **You**: Show me all running bots and their latest logs.

> **AI**: *(calls `list_bots` then `list_bot_logs` for each)*
- BTC Bracket (SIGNAL) | running | Pair: BTC/USDT | [3 logs...]
- ETH Scaled (SIGNAL) | running | Pair: ETH/USDT | [2 logs...]

---

## Security

### API Key Design
- **Format**: `nb_<prefix>_<64-char-secret>`
- **Storage**: Only SHA-256 hash is stored server-side. The prefix is stored for display.
- **Revocation**: Instant. Revoking a key immediately blocks all requests.
- **Expiration**: Optional. Set an expiry date when creating the key.
- **Scope**: Future versions will support permission scopes (e.g., `bots:read` only).

### Best Practices
1. **Generate a separate key per AI agent** — if one is compromised, others are safe.
2. **Use Paper Trading first** — test bot strategies in paper mode before live trading.
3. **Set expiration dates** on keys for temporary access.
4. **Revoke unused keys** regularly from Settings.
5. **Never share your API key in public chats** — it has the same power as your session.

### What the AI CANNOT Do
- Withdraw funds (wallet withdrawals are not exposed via MCP)
- Access your raw exchange API keys (they are encrypted at rest)
- Change your password or email
- Access admin functions
- Exceed the bot's `maxPositionSizeUsdt` or `maxTotalExposureUsdt` limits
- Place orders during cooldown or after a kill-switch trigger

---

## Troubleshooting

### "Missing API key format" error
- Ensure your key starts with `nb_` and has the full 64-character secret.

### "Invalid API key"
- The key may be revoked or expired. Generate a new one in Settings.

### MCP server not appearing in Claude Desktop
- Check the config file path (case-sensitive on macOS).
- Restart Claude Desktop after editing the config.
- Check Claude Desktop logs for spawn errors.

### "Connection refused" or timeout
- Verify `NEXUSBOT_API_URL` points to the correct API server.
- For local development: `http://localhost:3010`

---

## For Developers: Custom Integrations

If your AI agent (OpenClaw, Hermes, etc.) does not support MCP, you can call our REST API directly using the same API key:

```bash
curl -H "X-API-Key: nb_xxxxx" \
  https://api.nexusbot.trade/bots
```

All standard REST endpoints (`/bots`, `/wallets/me`, `/exchange-connections`, `/webhooks/signal/:botId`) accept `X-API-Key` in place of `Authorization: Bearer <jwt>`.

---

## Support

For issues or feature requests:
- GitHub Issues: `https://github.com/longsyee/crypto-bot-platform/issues`
- Email: support@nexusbot.trade
