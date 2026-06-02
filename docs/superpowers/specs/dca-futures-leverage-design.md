# DCA Futures Bot — Leverage + Order Configuration Design

## Research Summary

### How 3Commas Handles This
- **Leverage**: 1x–125x, Cross/Isolated/Exchange-defined
- **Order size INCLUDES leverage**: 100 USDT at 20x = 5 USDT margin
- **Martingale via Volume Multiplier**: Each safety order = previous × multiplier (e.g., 1.7x)
- **Step Multiplier**: Price gaps increase (1%, then 2%, then 4%, etc.)
- **Summary table**: Shows every order's price, size, and total invested BEFORE creation

### How Pionex Handles This
- **Leverage**: Fixed per grid (no dynamic change)
- **Grid coverage**: Upper/lower price bounds
- **No true martingale**: Equal-sized grids (not progressive)

### How TradeSanta Handles This
- **Base + Safety orders**: Similar to 3Commas
- **Martingale**: Optional volume scale
- **Visual ladder**: Shows all orders before launch

---

## Our Design: "Cover Up" Martingale DCA

### Core Concept

User wants: **"Coin requires $30, open order is $1, slowly cover up till martingale level"**

Translation:
- **First order (Base)**: Small position ($1) to test direction
- **Cover orders (Safety)**: Progressive scaling — each dip buys MORE to lower average
- **Total investment**: Sum of base + all safety orders = the "cover up" capital

### Example Walkthrough

| Setting | Value |
|---------|-------|
| Trading Pair | BTC/USDT |
| Base Order | 1 USDT |
| Safety Order Size | 2 USDT |
| Max Safety Orders | 4 |
| Volume Scale | 2.0 (each SO is 2× previous) |
| Price Deviation | 1% |
| Step Scale | 2.0 (each step is 2× wider) |
| Leverage | 10× |
| Take Profit | 1% |

**Order Ladder:**

| Order # | Type | Price Drop | Size (USDT) | Margin (10×) | Cumulative Invested |
|---------|------|-----------|-------------|--------------|---------------------|
| 1 | Base | 0% | 1 | 0.10 | 1 |
| 2 | SO 1 | -1% | 2 | 0.20 | 3 |
| 3 | SO 2 | -3% | 4 | 0.40 | 7 |
| 4 | SO 3 | -7% | 8 | 0.80 | 15 |
| 5 | SO 4 | -15% | 16 | 1.60 | 31 |

**Total required**: 31 USDT → **Actual margin**: 3.10 USDT (with 10× leverage)

When price recovers +1% from the average entry, all orders close in profit.

---

## UI Design: Enhanced DCA Config Form

### Section 1: Leverage (Futures-Only)

```
┌─────────────────────────────────────────────┐
│  Leverage                                    │
│  ┌────────┐  ┌──────┐  ┌──────┐            │
│  │ Cross  │  │ 10× ▼│  │ 20×  │            │
│  └────────┘  └──────┘  └──────┘            │
│                                              │
│  ⚠️ Margin required: 3.10 USDT               │
└─────────────────────────────────────────────┘
```

- **Type**: Cross | Isolated | Exchange-defined
- **Value**: Preset buttons (1×, 2×, 3×, 5×, 10×, 20×, 50×, 100×, 125×) + custom input
- **Margin preview**: Real-time calculation showing actual capital needed

### Section 2: Order Strategy (The "Cover Up" Ladder)

```
┌─────────────────────────────────────────────┐
│  Order Strategy                              │
│                                              │
│  Base Order (First Shot)                     │
│  ┌──────────────────────────────┐  USDT     │
│  │ 1.0                          │           │
│  └──────────────────────────────┘           │
│  The first small position to test direction  │
│                                              │
│  Safety Orders (Cover Ups)                   │
│  ┌──────────────────────────────┐  USDT     │
│  │ 2.0                          │           │
│  └──────────────────────────────┘           │
│  Starting size for averaging down          │
│                                              │
│  Max Safety Orders                           │
│  ┌──────────────────────────────┐          │
│  │ 4             [−]  [+]        │          │
│  └──────────────────────────────┘          │
│                                              │
│  Volume Scale (Martingale)                   │
│  ┌──────────────────────────────┐          │
│  │ 2.0           [−]  [+]        │          │
│  └──────────────────────────────┘          │
│  Each cover order = previous × scale       │
│                                              │
│  Price Deviation (First Step)                │
│  ┌──────────────────────────────┐          │
│  │ 1.0%          [−]  [+]        │          │
│  └──────────────────────────────┘          │
│                                              │
│  Step Scale (Widening)                       │
│  ┌──────────────────────────────┐          │
│  │ 2.0           [−]  [+]        │          │
│  └──────────────────────────────┘          │
│  Each step gap = previous × scale          │
└─────────────────────────────────────────────┘
```

### Section 3: Live Order Preview (The Key Differentiator)

```
┌─────────────────────────────────────────────┐
│  📊 Order Preview                            │
│                                              │
│  #  Type    Price Drop   Order Size   Margin │
│  ─────────────────────────────────────────── │
│  1  Base    Entry        1 USDT      0.10   │
│  2  SO 1    −1.0%        2 USDT      0.20   │
│  3  SO 2    −3.0%        4 USDT      0.40   │
│  4  SO 3    −7.0%        8 USDT      0.80   │
│  5  SO 4    −15.0%       16 USDT     1.60   │
│  ─────────────────────────────────────────── │
│  Total: 31 USDT    Margin: 3.10 USDT         │
│  TP @ +1% from avg = breakeven + profit      │
│                                              │
│  💡 At −15% drawdown, you hold 31 USDT       │
│     position. A +1% recovery closes all.     │
└─────────────────────────────────────────────┘
```

---

## Backend Schema Changes

### Prisma Bot Model Additions

```prisma
model Bot {
  // ... existing fields ...

  // Futures / Leverage
  leverage        Int      @default(1)    // 1x to 125x
  leverageType    String   @default("cross") // cross | isolated | exchange

  // Enhanced DCA
  baseOrderSize           Float   // First order
  safetyOrderSize         Float   // Starting safety order
  safetyOrderMaxCount     Int     @default(3)
  safetyOrderVolumeScale  Float   @default(1.0)  // 1.0 = same size, 2.0 = double
  safetyOrderStepScale    Float   @default(1.0)  // 1.0 = same gap, 2.0 = widening
  priceDeviationInitial   Float   @default(1.0)  // First step %
  takeProfit              Float   @default(1.0)  // TP % from avg entry

  // Order execution
  safetyOrdersPlaced     Int     @default(0)  // How many SOs are on exchange
  maxSafetyOrdersActive    Int     @default(3)  // Simultaneous limit orders
}
```

### Shared Package Schema Update

```typescript
export const DcaBotConfigSchema = z.object({
  type: z.literal("dca"),
  default_symbol: z.string().min(1).optional(),

  // Leverage
  leverage: z.coerce.number().int().min(1).max(125).default(1),
  leverageType: z.enum(["cross", "isolated", "exchange"]).default("cross"),

  // Order sizing
  baseOrderSize: z.coerce.number().positive(),
  safetyOrderSize: z.coerce.number().positive(),
  priceDeviationInitial: z.coerce.number().positive().default(1),
  safetyOrderMaxCount: z.coerce.number().int().min(1).max(50).default(3),
  safetyOrderVolumeScale: z.coerce.number().min(0.1).max(10).default(1),
  safetyOrderStepScale: z.coerce.number().min(0.1).max(10).default(1),

  // Exit
  takeProfit: z.coerce.number().positive().default(1),
  stopLoss: z.coerce.number().positive().optional(),
  maxPositionSize: z.coerce.number().positive().optional(),

  // Execution
  maxSafetyOrdersActive: z.coerce.number().int().min(0).max(50).default(3),
  orderType: z.enum(["market", "limit"]).default("limit"),
});
```

---

## Worker Engine Logic

### DCA Loop (Per-Cycle)

```
1. Check if position is open
   - No → Place BASE order (1 USDT)
   - Yes → Check price against SO levels

2. Price hit SO 1 level (−1%)?
   - Place SO 1 (2 USDT)
   - Update average entry price

3. Price hit SO 2 level (−3%)?
   - Place SO 2 (4 USDT)
   - Update average entry price

4. Continue until max SO count or TP hit

5. TP condition: current price ≥ avg_entry × (1 + tp%)
   - Close ALL positions
   - Reset for next cycle
```

### Paper vs Live

| Mode | Base Order | Safety Orders | Balance Source |
|------|-----------|--------------|----------------|
| **Paper** | Simulated fill at market price | Simulated fill at trigger price | `bot.paperBalance` |
| **Live** | `createOrder()` via CCXT | `createOrder()` via CCXT | Exchange `fetchBalance()` |

---

## Files to Modify

| File | Change |
|------|--------|
| `packages/shared/src/index.ts` | Add leverage, leverageType, stopLoss, orderType, maxSafetyOrdersActive to DcaBotConfigSchema |
| `packages/prisma/schema.prisma` | Add leverage, leverageType, safetyOrdersPlaced, maxSafetyOrdersActive to Bot model |
| `apps/web/src/components/bots/bot-wizard.tsx` | Add Leverage section, enhanced Order Strategy section, Order Preview table |
| `apps/web/src/components/bots/dca-calculator.tsx` | New: Live preview of the order ladder with totals |
| `apps/worker/src/exchange/ccxt-connector.ts` | Add leverage setting, paper order simulation |
| `apps/worker/src/engine/dca-loop.ts` | Use leverage for margin calc, place SOs progressively |
| `apps/api/src/routes/bots.ts` | Accept new fields in POST /bots |

---

## Summary

This design gives users:
1. **Leverage control** (1×–125×) with margin preview
2. **Progressive "cover up" orders** (martingale volume scaling)
3. **Visual order ladder** before they commit funds
4. **Real-time total investment calculation**
5. **Paper mode** to test the full ladder risk-free

The "cover up" concept is now explicit: small first order → progressively larger safety orders → total capital known upfront.
