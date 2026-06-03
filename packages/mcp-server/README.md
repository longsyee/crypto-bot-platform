# @crypto-bot-platform/mcp-server

MCP (Model Context Protocol) server for connecting AI agents to **NexusBot Trading Platform**.

## What This Does

This package exposes your NexusBot account as a set of AI-native **tools**. AI agents like Claude Desktop, Cline, or Cursor can use these tools to:

- Create and manage DCA / Signal trading bots
- Start / stop bots
- Send trading signals to signal bots
- Check wallet balances and transaction history
- Read live exchange balances and market data
- Monitor bot logs and order history

## Quick Start

### 1. Generate an API Key

In the NexusBot web app, go to **Settings → Integrations → API Keys** and generate a key. Copy it immediately — it is shown only once.

### 2. Install the MCP Server

```bash
# Global install (recommended)
npm install -g @crypto-bot-platform/mcp-server

# Or run via npx (no install)
npx -y @crypto-bot-platform/mcp-server
```

### 3. Configure Your AI Client

#### Claude Desktop (macOS / Windows)

Edit `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%/Claude/claude_desktop_config.json` (Windows):

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

#### Cline (VS Code extension)

Add to Cline's MCP settings:

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

Add to Cursor's MCP config:

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

### 4. Alternative: Config File

Instead of env vars, create `~/.nexusbot/mcp-config.json`:

```json
{
  "apiBaseUrl": "https://api.nexusbot.trade",
  "apiKey": "nb_xxxxx_xxxxx"
}
```

## Available Tools

| Tool | Description |
|------|-------------|
| `get_me` | User profile and wallet overview |
| `list_bots` | List all bots |
| `get_bot` | Bot details and config |
| `create_bot` | Create DCA or Signal bot |
| `start_bot` | Start a bot |
| `stop_bot` | Stop a bot |
| `delete_bot` | Delete a bot |
| `list_bot_orders` | Order history for a bot |
| `list_bot_logs` | Recent logs for a bot |
| `send_signal` | Send trading signal to signal bot |
| `get_wallet` | Wallet balances |
| `list_transactions` | Transaction history |
| `list_connections` | Exchange connections |
| `get_connection_balance` | Live exchange balance |
| `get_markets` | Available trading pairs |
| `get_ticker` | Current price ticker |

## Example Prompts for AI Agents

> "Create a DCA bot called 'BTC Long' on my Binance connection for BTC/USDT with 10x cross leverage, base order 100 USDT, safety order 50 USDT, and 5% take profit."

> "Start my signal bot and then send a BUY signal for ETH/USDT with 0.5 ETH."

> "Show me my live Binance balance and the current BTC/USDT ticker."

> "List all my running bots and their recent logs."

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXUSBOT_API_URL` | Yes | Platform API base URL |
| `NEXUSBOT_API_KEY` | Yes | Your API key (nb_xxx) |

## Security Notes

- The MCP server never stores your API key on disk (unless you use the config file).
- API keys are hashed with SHA-256 on the server side.
- Keys can be revoked instantly from the web app.
- Set an expiration date on keys for temporary access.
