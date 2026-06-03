# MCP / AI Agent Integration Guide

## Overview

NexusBot supports the **Model Context Protocol (MCP)** — an open standard by Anthropic that lets AI agents (Claude Desktop, Cursor, Cline, OpenClaw, Hermes, etc.) connect to external tools and data sources.

With our MCP server, an AI agent can:
- Create and manage DCA / Signal bots
- Send trading signals to signal bots
- Start/stop bots
- Check wallet balances and exchange balances
- Read market data (tickers, trading pairs)
- Monitor bot logs and order history

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

### Step 1: Generate an API Key

1. Log in to your NexusBot dashboard
2. Go to **Settings → API Keys**
3. Click **New Key**, give it a name (e.g., "Claude Desktop")
4. **Copy the key immediately** — it is shown only once
5. Format: `nb_xxxxxxxx_xxxxxxxx...`

### Step 2: Configure Your AI Client

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

## Available Tools

| Tool | What It Does | Example Prompt |
|------|--------------|----------------|
| `get_me` | Show user profile + wallet | "What's my balance?" |
| `list_bots` | List all bots | "Show my bots" |
| `get_bot` | Bot details and config | "Tell me about my BTC bot" |
| `create_bot` | Create DCA or Signal bot | "Create a DCA bot for ETH/USDT" |
| `start_bot` | Start a stopped bot | "Start my signal bot" |
| `stop_bot` | Stop a running bot | "Stop the BTC bot" |
| `delete_bot` | Delete a bot | "Delete my old bot" |
| `list_bot_orders` | Order history | "Show orders for bot X" |
| `list_bot_logs` | Recent logs | "Any errors on my DCA bot?" |
| `send_signal` | Send signal to signal bot | "BUY 0.5 BTC at market" |
| `get_wallet` | Wallet balances | "How much USDT do I have?" |
| `list_transactions` | Transaction history | "Show my deposits" |
| `list_connections` | Exchange connections | "Which exchanges are connected?" |
| `get_connection_balance` | Live exchange balance | "Check my Binance balance" |
| `get_markets` | Available pairs | "What can I trade on Bybit?" |
| `get_ticker` | Current price | "What's the BTC price?" |

---

## Example Conversations

### Create and Start a DCA Bot

> **You**: Create a DCA bot called "BTC Accumulator" on my Binance connection for BTC/USDT with 10x cross leverage. Base order 100 USDT, safety order 50 USDT, take profit 3%.

> **AI**: *(calls `create_bot` with DCA config)* Done. Bot "BTC Accumulator" created with ID `abc-123`.

> **You**: Start it.

> **AI**: *(calls `start_bot`)* Bot started successfully.

### Send a Trading Signal

> **You**: Send a BUY signal for 0.3 ETH to my signal bot.

> **AI**: *(calls `send_signal`)* Signal queued: BUY ETH/USDT.

### Monitor

> **You**: Show me all running bots and their latest logs.

> **AI**: *(calls `list_bots` then `list_bot_logs` for each)*
- BTC Accumulator (DCA) | running | Pair: BTC/USDT | [3 logs...]
- ETH Signal (SIGNAL) | running | Pair: ETH/USDT | [2 logs...]

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
