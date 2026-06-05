# Feature Spec: DCA Bot Advanced Features

## Goal
Bring our DCA bot to feature parity with the Sample/newrobot reference frontend. Implement all missing toggles, inputs, and backend logic.

## Features (10 total)

### 1. Guard (not "Buddy Guard")
- **Toggle:** `guard_enabled` (default: false)
- **Inputs:**
  - `guard_duration` — monitoring window in minutes (default: 2)
  - `guard_trigger_pct` — price spike % threshold (default: 3)
  - `guard_pause_minutes` — how long to pause bot after trigger (default: 480)
- **Backend:** In the DCA loop, track rolling price window. If price changes > trigger_pct within duration minutes, set bot status to `paused` for pause_minutes, log alert.

### 2. Per-Round DCA Table
- **Replace** global `safety_order_step_scale` + `safety_order_volume_scale` with per-round config.
- **Schema:** Array of rounds. Each round:
  - `price_fluctuation_pct` — trigger deviation for this round
  - `multiplier` — volume multiplier for this round
  - `trailing_enabled` — toggle for trailing exit on this round
  - `ema_enabled` — toggle to use EMA signal for this round's entry
  - `macd_enabled` — toggle to use MACD signal for this round's entry
- **Frontend:** Modal/table in wizard. Default rows: 5 rounds. Preset auto-fills from global values if unchanged.
- **Backend:** Loop reads `rounds[]` instead of global scale. Each SO uses its own round config.

### 3. RSI Trend Signal
- **Toggle:** `rsi_signal_enabled` (default: false)
- **Inputs:** `rsi_upper` (default: 70), `rsi_lower` (default: 30)
- **Backend:** Bot monitors RSI. If RSI < lower → entry signal (buy/long). If RSI > upper → avoid entry / short signal. Works on configured timeframe.

### 4. EMA1 / EMA2
- **Inputs:** `ema_fast` (default: 9), `ema_slow` (default: 26)
- **Backend:** Compute fast/slow EMA on configured timeframe. Fast > Slow = uptrend, Fast < Slow = downtrend.

### 5. Double First Order
- **Toggle:** `double_fo_enabled` (default: false)
- **Backend:** When enabled, base order size is multiplied by 2 on first entry.

### 6. Enable Trend DCA
- **Toggle:** `trend_dca_enabled` (default: false)
- **Backend:** Adjust safety order spacing based on trend. In uptrend, tighten spacing (smaller % drops trigger). In downtrend, widen spacing.

### 7. Reverse-trend DCA Entry
- **Toggle:** `reverse_trend_entry_enabled` (default: false)
- **Backend:** Enter positions against the current trend. E.g., in uptrend, wait for pullback to enter short / avoid long. In downtrend, wait for bounce to enter long.

### 8. Trend-following Mode
- **Toggle:** `trend_following_mode` (default: false)
- **Backend:** Only enter in direction of trend. Long in uptrend, short in downtrend. If trend unclear, skip entry.

### 9. Long-short Ratio
- **Input:** `long_short_ratio` (default: 50) — percentage allocated to long side in dual mode.
- **Backend:** Split capital between long and short based on ratio. 50 = equal, 70 = 70% long / 30% short.

### 10. Rename existing "Waterfall Prevention" → stays as-is, no rename needed. "Chop-Loss" stays as-is.

## Files
- `packages/shared/src/index.ts` — add all fields to DcaBotConfigSchema
- `packages/prisma/prisma/schema.prisma` — add DB fields to Bot model if needed (configJson handles most, but `guard_enabled` etc. may need columns)
- `apps/api/src/routes/bots.ts` — validate new fields in create/update payloads
- `apps/web/src/components/bots/bot-wizard.tsx` — wizard UI sections for all features
- `apps/worker/src/engine/dca-loop.ts` — implement all backend logic

## Batches
- **Batch 1:** Guard + Per-Round DCA Table (features 1-2)
- **Batch 2:** RSI/EMA/Double FO/Trend features (features 3-9)
