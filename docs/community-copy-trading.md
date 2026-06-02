# Community Copy-Trading Design Document

> Status: Planned  
> Created: 2026-06-02  
> Scope: Community strategy sharing, copy-trading, dual-token fee model  

---

## 1. Overview

The Community module lets users publish their DCA+ futures strategies publicly. Other users can **copy** a strategy with one click, spawning their own bot instance. The platform monetizes via a **dual-token fee model**:

- **Token A** — Gas / service fee token (bought with USDT, non-convertible back).
- **Token B** — Sharer reward token (earned by strategy creators, convertible to USDT).

---

## 2. Token Definitions

| Token | Name | How Users Get It | Convertible? | Purpose |
|-------|------|-----------------|--------------|---------|
| **Token A** | Platform Gas / Service Token | Buy with USDT (one-way swap) | ❌ No — USDT → A only | Pay bot running fees + profit service charge |
| **Token B** | Sharer Reward Token | Earned when people copy your strategy | ✅ Yes → USDT | Incentive for strategy creators |

---

## 3. Fee Flow (Single Copy Trade)

| Step | Actor | Action | Token | Amount |
|------|-------|--------|-------|--------|
| 1 | **Copier** | Tops up USDT, swaps to **Token A** | Token A | `$X` worth |
| 2 | **Copier** | Copies a strategy from community page | — | — |
| 3 | **Bot** | Runs DCA+ trade, makes profit | USDT | `+$100` profit |
| 4 | **Platform** | Charges service fee on profit | Token A | `20% × $100 = $20` (admin configurable) |
| 5 | **Platform** | Takes gas fee from copier's profit | Token A | `10% × $100 = $10` |
| 6 | **Sharer** | Receives reward for providing strategy | **Token B** | `$10` worth (or 10% of profit) |
| 7 | **Sharer** | Converts Token B → USDT | USDT | `$10` |
| 8 | **Platform Treasury** | Keeps Token A fees | Token A | `$30` total |

### Net Breakdown

| Party | Net Amount | Token |
|-------|-----------|-------|
| **Copier** | `$70` | USDT |
| **Sharer** | `$10` | Token B → USDT |
| **Platform Treasury** | `$30` | Token A |

---

## 4. Community Page Layout

| Module | Feature | Details |
|--------|---------|---------|
| **Discovery** | Strategy Cards | Sharer name, ROI%, win rate, total copies, risk score, token pair, direction (long/short/both), leverage used |
| **Filters** | Search & Sort | By exchange, pair, direction, time horizon (7d / 30d / 90d), popularity (copy count), sharer rating, max drawdown |
| **Preview** | Strategy Detail | Full DCA params (SO count, TP%, SL, leverage), historical PnL chart, copy count, sharer bio/avatar |
| **Copy** | One-Click Copy | Clones config into copier's new bot; copier picks their own exchange connection; pre-flight balance check |
| **Performance** | Leaderboard | Top sharers by monthly Token B earned, follower count, Sharpe ratio, avg copier profit |
| **Sharer Dashboard** | My Strategies | Publish / unpublish, edit description, set max copies, view Token B earnings, withdrawal button |

---

## 5. Guardrails & Gates

| Gate | Rule | Enforcement |
|------|------|-------------|
| **Token A Balance** | Copier must hold enough Token A to cover `N` ticks of projected fees | Pre-copy check; block if insufficient |
| **Minimum USDT Capital** | Copier needs min `$50`–`$500` capital to copy (admin configurable per strategy or globally) | Wallet balance check at copy time |
| **Sharer Tier** | Sharers unlock tiers by Token B earned: Bronze / Silver / Gold / Platinum | Badge on strategy card; higher tiers = lower platform cut (e.g., 15% instead of 20%) |
| **Cooldown** | Copier can only copy / unsubscribe once per `24h` | Rate limit to prevent fee gaming and churn |
| **Max Copies Per Strategy** | Sharer can set max concurrent copiers (e.g., 50, 100, 500) | Creates scarcity = premium positioning |
| **KYC Gate (Future)** | High-volume sharers may require KYC to withdraw Token B → USDT | Off-chain identity hook |

---

## 6. Dual-Token Economics

### Token A (Gas / Service)

| Property | Value |
|----------|-------|
| **Minting** | Sold by platform treasury for USDT (one-way) |
| **Burning** | 100% of profit-service fees are burned (deflationary) or kept in treasury (revenue) — **TBD** |
| **Rate** | Admin-set or AMM-based; initially `$1` USDT = `1` Token A for simplicity |
| **Usage** | Bot tick fees, profit-service fees, withdrawal network fees |

### Token B (Sharer Reward)

| Property | Value |
|----------|-------|
| **Minting** | Minted by platform treasury when copier profit is realized |
| **Burning** | Optional: burn a % on withdrawal to create deflationary pressure |
| **Rate** | Pegged to USDT at mint time (e.g., `$10` profit reward = `10` Token B) |
| **Unlock** | Sharer can convert Token B → USDT instantly or with a vesting cliff (e.g., 7 days) |

---

## 7. Database Schema (New Tables)

### `community_strategies`

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` | PK |
| `userId` | `uuid` | FK → `users.id` (sharer) |
| `configJson` | `jsonb` | Full DCA+ config snapshot at publish time |
| `isPublic` | `boolean` | Published vs draft |
| `copyCount` | `int` | Live copy instances |
| `maxCopies` | `int` | Sharer-defined cap (0 = unlimited) |
| `feeSharePct` | `decimal(5,2)` | % of copier profit the sharer gets (default 10%) |
| `title` | `varchar(120)` | Strategy name |
| `description` | `text` | Sharer-written notes |
| `createdAt` | `timestamp` | |
| `updatedAt` | `timestamp` | |

### `strategy_copies`

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` | PK |
| `strategyId` | `uuid` | FK → `community_strategies.id` |
| `copierUserId` | `uuid` | FK → `users.id` |
| `botId` | `uuid` | FK → `bots.id` (copier's spawned bot) |
| `status` | `enum` | `active`, `paused`, `stopped`, `liquidated` |
| `startedAt` | `timestamp` | |
| `stoppedAt` | `timestamp` | |

### `token_a_ledger`

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` | PK |
| `userId` | `uuid` | FK → `users.id` |
| `type` | `enum` | `deposit`, `fee_tick`, `fee_profit`, `burn`, `admin_adjust` |
| `amount` | `decimal(18,8)` | Token A amount |
| `usdtRate` | `decimal(18,8)` | Rate at transaction time |
| `metadata` | `jsonb` | `botId`, `strategyCopyId`, `reason` |
| `createdAt` | `timestamp` | |

### `token_b_ledger`

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` | PK |
| `userId` | `uuid` | FK → `users.id` (sharer) |
| `type` | `enum` | `earn_copy_reward`, `withdraw`, `referral_bonus` |
| `amount` | `decimal(18,8)` | Token B amount |
| `usdtRate` | `decimal(18,8)` | Rate at transaction time |
| `metadata` | `jsonb` | `strategyCopyId`, `copierUserId`, `profitUsdt` |
| `createdAt` | `timestamp` | |

### `profit_snapshots`

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` | PK |
| `botId` | `uuid` | FK → `bots.id` |
| `strategyCopyId` | `uuid` | FK → `strategy_copies.id` |
| `profitUsdt` | `decimal(18,8)` | Realized profit this cycle |
| `tokenAFee` | `decimal(18,8)` | Deducted for platform |
| `tokenBReward` | `decimal(18,8)` | Credited to sharer |
| `sharerUserId` | `uuid` | FK → `users.id` |
| `createdAt` | `timestamp` | |

---

## 8. Fee Config (Admin-Configurable)

| Config Key | Default | Description |
|------------|---------|-------------|
| `service_fee_pct` | `20%` | Platform cut from copier profit (Token A) |
| `sharer_reward_pct` | `10%` | Of copier profit, given to sharer as Token B |
| `copier_min_usdt` | `100` | Minimum USDT balance to copy a strategy |
| `copier_min_token_a` | `10` | Minimum Token A balance to copy |
| `max_copies_default` | `0` | Default max concurrent copies (0 = unlimited) |
| `token_a_usdt_rate` | `1.0` | Exchange rate: 1 Token A = $1 USDT |
| `token_b_usdt_rate` | `1.0` | Exchange rate: 1 Token B = $1 USDT |
| `sharer_withdrawal_delay_hours` | `0` | Vesting delay before Token B → USDT (0 = instant) |
| `cooldown_hours` | `24` | Hours between copy/unsubscribe actions |

---

## 9. Open Questions (Resolve Before Implementation)

| # | Question | Options |
|---|----------|---------|
| 1 | **Who pays the 10% sharer gas fee?** | A) Taken from copier's profit (copier net = profit − 20% service − 10% gas).  
B) Extra fee on top (copier pays 30% total). |
| 2 | **Token B minting model** | A) Mint fresh on every reward.  
B) Pre-mint treasury pool, distribute from pool. |
| 3 | **Token A rate stability** | A) Fixed `$1` always.  
B) Floats with demand / bonding curve. |
| 4 | **Sharer fee share negotiable?** | A) Fixed 10% for everyone.  
B) Sharer sets 5%–15% to compete for copiers. |
| 5 | **Token A burn vs treasury** | A) Burn 100% of fees (deflationary).  
B) Keep in treasury (revenue model). |

---

## 10. Implementation Checklist (Future)

- [ ] Create `community_strategies`, `strategy_copies`, `token_a_ledger`, `token_b_ledger`, `profit_snapshots` tables
- [ ] Add Token A / Token B balance fields to `users` table
- [ ] Build Community page (discovery grid, filters, strategy detail modal)
- [ ] Build Sharer dashboard (publish strategy, earnings, withdrawal)
- [ ] Build "Copy" flow with pre-flight balance checks
- [ ] Integrate fee deduction into DCA+ engine profit-realization path
- [ ] Integrate Token B reward minting / crediting into engine
- [ ] Build Token A top-up page (USDT → Token A swap)
- [ ] Build Token B withdrawal page (Token B → USDT swap)
- [ ] Admin panel: fee config UI, rate adjustment, treasury view
- [ ] Leaderboard backend (aggregation query)
- [ ] Cooldown & rate-limit logic
- [ ] Unit tests: fee math, ledger consistency, edge cases (zero profit, negative PnL)

---

*End of document.*
