# Trading Guide — Copy-Paste Cookbook

> Practical signal payloads, common trading patterns, and TradingView webhook templates.
> Use this as a quick reference when building bots or sending signals.

---

## 1. Signal Bot Config Templates

### Template A: Bracket Strategy (Recommended Default)

```json
{
  "name": "BTC Bracket Bybit",
  "connectionId": "<conn_id>",
  "tradingPair": "BTC/USDT",
  "mode": "paper",
  "config": {
    "type": "signal",
    "strategy": "bracket",
    "symbol": "BTCUSDT",
    "leverage": 10,
    "marginMode": "cross",
    "bracket": {
      "stopLossPercent": 2.0,
      "takeProfitPercent": 6.0,
      "trailingStop": false
    },
    "risk": {
      "maxPositionSizeUsdt": 500,
      "maxTotalExposureUsdt": 2000,
      "maxDailyLossUsdt": 500,
      "maxOpenPositions": 5,
      "slippageMaxPercent": 0.5,
      "requireConfirmation": false,
      "cooldownSeconds": 30
    },
    "webhook_secret": "whsec_xxxxxxxx"
  }
}
```

### Template B: Scaled Entry Strategy

```json
{
  "name": "ETH Scaled Binance",
  "connectionId": "<conn_id>",
  "tradingPair": "ETH/USDT",
  "mode": "paper",
  "config": {
    "type": "signal",
    "strategy": "scaled",
    "symbol": "ETHUSDT",
    "leverage": 5,
    "marginMode": "cross",
    "scaled": {
      "tiers": [
        { "percent": 40, "offsetPercent": 0 },
        { "percent": 35, "offsetPercent": -0.75 },
        { "percent": 25, "offsetPercent": -1.5 }
      ],
      "cancelRemainingOnFillPercent": 80
    },
    "bracket": {
      "stopLossPercent": 2.5,
      "takeProfitPercent": 7.5
    },
    "risk": {
      "maxPositionSizeUsdt": 1000,
      "maxTotalExposureUsdt": 3000,
      "cooldownSeconds": 60
    }
  }
}
```

### Template C: Breakout Strategy

```json
{
  "name": "SOL Breakout OKX",
  "connectionId": "<conn_id>",
  "tradingPair": "SOL/USDT",
  "mode": "paper",
  "config": {
    "type": "signal",
    "strategy": "breakout",
    "symbol": "SOLUSDT",
    "leverage": 3,
    "marginMode": "cross",
    "breakout": {
      "confirmationOffsetPercent": 0.15,
      "confirmationCandles": 1,
      "timeoutSeconds": 300
    },
    "bracket": {
      "stopLossPercent": 3.0,
      "takeProfitPercent": 9.0
    },
    "risk": {
      "maxPositionSizeUsdt": 300,
      "cooldownSeconds": 120
    }
  }
}
```

### Template D: Pullback Strategy

```json
{
  "name": "AVAX Pullback Gate",
  "connectionId": "<conn_id>",
  "tradingPair": "AVAX/USDT",
  "mode": "paper",
  "config": {
    "type": "signal",
    "strategy": "pullback",
    "symbol": "AVAXUSDT",
    "leverage": 5,
    "marginMode": "cross",
    "pullback": {
      "pullbackPercent": 1.5,
      "timeInForce": "GTC",
      "cancelTimeoutSeconds": 1800
    },
    "bracket": {
      "stopLossPercent": 2.0,
      "takeProfitPercent": 5.0
    },
    "risk": {
      "maxPositionSizeUsdt": 400,
      "cooldownSeconds": 45
    }
  }
}
```

---

## 2. Signal Payloads (MCP / API)

### Market Buy (Long)

```json
{
  "symbol": "BTCUSDT",
  "direction": "long",
  "side": "buy",
  "amount": 0.01,
  "amountType": "fixed_coin",
  "orderType": "market",
  "metadata": {
    "source": "mcp_agent",
    "message": "User requested market entry"
  }
}
```

### Limit Sell (Short Entry)

```json
{
  "symbol": "ETHUSDT",
  "direction": "short",
  "side": "sell",
  "amount": 500,
  "amountType": "fixed_usdt",
  "orderType": "limit",
  "price": 3200.00,
  "timeInForce": "GTC",
  "metadata": {
    "source": "mcp_agent",
    "message": "Limit short at resistance"
  }
}
```

### Stop Market (Breakout Entry)

```json
{
  "symbol": "SOLUSDT",
  "direction": "long",
  "side": "buy",
  "amount": 0.5,
  "amountType": "fixed_coin",
  "orderType": "stop_market",
  "price": 155.00,
  "metadata": {
    "source": "mcp_agent",
    "message": "Breakout above $155"
  }
}
```

### Close Position

```json
{
  "symbol": "BTCUSDT",
  "direction": "close",
  "amount": 100,
  "amountType": "percent_position",
  "orderType": "market",
  "metadata": {
    "source": "mcp_agent",
    "message": "User requested exit"
  }
}
```

### Flip Direction

Two signals sent sequentially:

**Signal 1 — Close:**
```json
{
  "symbol": "BTCUSDT",
  "direction": "close",
  "orderType": "market",
  "metadata": { "source": "mcp_agent" }
}
```

**Signal 2 — Open Opposite:**
```json
{
  "symbol": "BTCUSDT",
  "direction": "short",
  "side": "sell",
  "amount": 0.01,
  "amountType": "fixed_coin",
  "orderType": "market",
  "metadata": { "source": "mcp_agent" }
}
```

---

## 3. TradingView Webhook Templates

### Pine Script Alert Message (JSON)

```pinescript
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

### Direction Mapping

TradingView `{{strategy.order.action}}` emits:
- `buy` → mapped to `direction: "long"`
- `sell` → mapped to `direction: "short"`

The webhook handler does this mapping automatically.

### Webhook URL Format

```
POST https://api.nexusbot.trade/webhooks/signal/{botId}
```

Headers:
```
Content-Type: application/json
x-signature: <HMAC-SHA256 of body using webhook_secret>
```

---

## 4. Common Risk Configs by Profile

### Conservative (Beginner)

```json
{
  "leverage": 1,
  "strategy": "bracket",
  "bracket": { "stopLossPercent": 1.5, "takeProfitPercent": 3.0 },
  "risk": {
    "maxPositionSizeUsdt": 100,
    "maxTotalExposureUsdt": 300,
    "maxDailyLossUsdt": 100,
    "maxOpenPositions": 2,
    "slippageMaxPercent": 0.3,
    "cooldownSeconds": 60
  }
}
```

### Moderate (Regular Trader)

```json
{
  "leverage": 5,
  "strategy": "bracket",
  "bracket": { "stopLossPercent": 2.0, "takeProfitPercent": 6.0 },
  "risk": {
    "maxPositionSizeUsdt": 500,
    "maxTotalExposureUsdt": 2000,
    "maxDailyLossUsdt": 500,
    "maxOpenPositions": 5,
    "slippageMaxPercent": 0.5,
    "cooldownSeconds": 30
  }
}
```

### Aggressive (Experienced)

```json
{
  "leverage": 10,
  "strategy": "scaled",
  "bracket": { "stopLossPercent": 2.5, "takeProfitPercent": 8.0 },
  "risk": {
    "maxPositionSizeUsdt": 2000,
    "maxTotalExposureUsdt": 8000,
    "maxDailyLossUsdt": 2000,
    "maxOpenPositions": 8,
    "slippageMaxPercent": 0.8,
    "cooldownSeconds": 15
  }
}
```

---

## 5. Quick Decision Matrix

| User Says | Strategy | Order Type | Bracket? |
|-----------|----------|------------|----------|
| "Buy BTC now" | `bracket` | `market` | Yes (auto) |
| "Short ETH at $3200" | `bracket` | `limit` | Yes (auto) |
| "Build a position slowly" | `scaled` | `limit` | Yes (on total) |
| "Wait for breakout above $155" | `breakout` | `stop_market` | Yes (auto) |
| "Buy if it dips 1%" | `pullback` | `limit` | Yes (auto) |
| "Just close everything" | `direct` | `market` | N/A |

---

## 6. Claude's Pre-Trade Checklist

Before executing ANY trade, Claude must confirm:

1. ✅ Bot exists and is `running`
2. ✅ Mode is appropriate (paper unless user said live)
3. ✅ Exchange connection is active
4. ✅ Symbol is valid on this exchange (`get_markets`)
5. ✅ Amount ≤ `maxPositionSizeUsdt`
6. ✅ New total exposure ≤ `maxTotalExposureUsdt`
7. ✅ Cooldown has elapsed
8. ✅ Spread ≤ `slippageMaxPercent` (for market orders)
9. ✅ User has sufficient exchange balance (for live mode)
10. ✅ `reduceOnly` set for all close orders

---

*End of Trading Guide.*
