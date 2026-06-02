# Design Spec: Exchange Pairs + Paper/Live Trading Mode

## 1. Research Summary: How Top Platforms Do It

### 3Commas
- **Pairs**: Fetched dynamically from connected exchange via CCXT. Cached in Redis with 5-min TTL.
- **Paper trading**: Separate "Paper Trading" toggle at bot creation. Uses real market data but simulated orders. Paper balances are virtual and isolated per bot.
- **Live trading**: Bot reads real balance from exchange API before each trade. Validates sufficient balance before placing order.

### Cryptohopper
- **Pairs**: User selects exchange first, then pair list loads from `/exchange/markets` endpoint. Searchable dropdown with 1000+ pairs.
- **Paper trading**: "Simulator" mode. Uses backtesting engine with real price feeds. Starting paper balance configurable.
- **Live trading**: Direct exchange API calls. No balance caching — fetches fresh on every signal.

### Pionex
- **Pairs**: Built-in grid bot pairs are hardcoded for supported exchanges. DCA bot allows free pair selection from exchange's spot markets.
- **Paper trading**: Not offered. All bots are live by default (lower barrier = higher risk).

### TradeSanta
- **Pairs**: Dynamically loaded per exchange. Filters: USDT pairs only, volume > $1M, exclude leveraged tokens.
- **Paper trading**: "Demo" mode with $10,000 virtual USDT. Runs on real exchange data.

## 2. Our Implementation Plan

### A. Exchange Pair Listing

**Backend (API)**
- New endpoint: `GET /exchange-connections/:id/markets`
  - Uses CCXT to fetch markets from the connected exchange
  - Filter: `type === 'spot'`, `quote === 'USDT'` (default), active
  - Cache in Redis for 5 minutes per exchange
  - Returns: `{ success: true, data: [{ symbol, base, quote, minAmount, maxAmount, precision }] }`

**Frontend**
- New component: `ExchangeMarketSelect`
  - Async searchable dropdown (react-select style)
  - Loads markets when exchange connection is selected
  - Shows symbol, base/quote, min trade size
  - Group by quote currency (USDT, BTC, ETH)

### B. Paper Trading vs Live Trading

**Backend (Worker)**
- Bot schema already has `mode: enum("paper", "live")`
- Paper trade engine:
  - Uses CCXT `fetchTicker` / `fetchOHLCV` for price data (real market data)
  - Maintains virtual balance in a new `paperBalance` JSON column on bot table
  - Virtual orders are stored in `paperTrades` table (already exists)
  - No real API calls to exchange
- Live trade engine:
  - Uses CCXT `createOrder` with real API credentials
  - Fetches real balance via `fetchBalance` before each trade
  - Stores real orders in `orders` table

**Frontend**
- Bot wizard Step 2: Add mode selector toggle
  - Paper: "Practice with virtual funds using real market data"
  - Live: "Trade with real funds from your exchange account"
- Show paper balance on bot detail page when in paper mode
- Show real exchange balance on bot detail page when in live mode

### C. Real Exchange Balance Fetching

**Backend (Worker)**
- New service: `ExchangeBalanceService`
  - `fetchBalance(connectionId)` → uses CCXT with decrypted API keys
  - Returns balances per currency
  - Cached for 30 seconds
- Bot engine calls this before each trade to validate sufficient balance

**Frontend**
- New hook: `useExchangeBalance(connectionId)`
- Display on bot creation and bot detail pages

## 3. Database Changes

```sql
-- Add paper balance tracking to bots
ALTER TABLE Bot ADD COLUMN paperBalance JSONB DEFAULT '{}';
-- e.g. { "USDT": 10000, "BTC": 0 }

-- Add selected market symbol to bot config
ALTER TABLE Bot ADD COLUMN tradingPair VARCHAR(50);
```

## 4. Files to Modify

| File | Change |
|------|--------|
| `apps/api/src/routes/exchange-connections.ts` | Add `GET /:id/markets` endpoint |
| `apps/api/src/services/ccxt-markets.ts` | CCXT market fetcher with caching |
| `apps/worker/src/engine/dca-loop.ts` | Paper vs live mode switch |
| `apps/worker/src/engine/signal-handler.ts` | Paper vs live mode switch |
| `apps/worker/src/services/exchange-balance.ts` | Fetch real balances |
| `apps/worker/src/exchange/ccxt-connector.ts` | Add paper trade methods |
| `apps/web/src/components/bots/bot-wizard.tsx` | Add mode toggle + pair select |
| `apps/web/src/components/bots/bot-detail.tsx` | Show paper/live balance |
| `apps/web/src/hooks/use-api.ts` | Add `useExchangeMarkets`, `useExchangeBalance` |
| `packages/prisma/schema.prisma` | Add `paperBalance`, `tradingPair` fields |

## 5. API Design

```
GET /exchange-connections/:id/markets?quote=USDT
→ { success: true, data: [ { symbol, base, quote, minAmount, maxAmount, precision, active } ] }

GET /exchange-connections/:id/balance
→ { success: true, data: { USDT: { free: 1000, used: 200, total: 1200 }, BTC: { ... } } } }

POST /bots
→ body now includes: { ..., mode: "paper" | "live", tradingPair: "BTC/USDT", paperInitialBalance: { USDT: 10000 } }
```

## 6. Security

- `fetchBalance` and `fetchMarkets` both require `authMiddleware`
- Balance endpoint is scoped to the user's own connection
- CCXT credentials are decrypted only in-memory, never logged
- Paper balances are isolated per bot (not shared)
