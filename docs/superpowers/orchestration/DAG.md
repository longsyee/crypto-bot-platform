# Platform Core Implementation — Task DAG (v2)

**Orchestrator:** CTO (Claude)
**Workers:** Parallel Coder Agents + UI/UX Agent + QA Agents
**Output:** `docs/superpowers/orchestration/reports/YYYY-MM-DD-HHMM-phase-N.md`
**Context Management:** Agents must `/compact` when conversation exceeds ~3000 lines or reasoning degrades.

---

## Phase 0: Contracts (Pre-requisite)

**Done in brainstorming/spec phase.** Shared interfaces, database schema, env vars, API contracts are locked.

**Contract files:**
- `packages/shared/src/schemas/*` — Zod schemas (BotConfig, Auth, DCA params)
- `packages/shared/src/constants/*` — Referral tiers, exchange IDs
- `packages/shared/src/types/*` — TypeScript types
- `packages/prisma/prisma/schema.prisma` — Database schema
- `docker-compose.yml` — Infra contracts (Postgres 5444, Redis 6390)
- `.env.example` — All env vars each service needs
- `docs/superpowers/specs/2026-05-29-platform-core-design.md` — Full spec
- `docs/superpowers/plans/2026-05-29-platform-core.md` — Implementation plan

---

## Phase 1: Foundation (Parallel — 2 tracks)

### Task 1A: Monorepo Scaffold + Docker Compose
**Dependencies:** None
**Assignee:** Coder Agent Alpha
**Context Budget:** ~2000 lines before `/compact`
**Deliverables:**
- Root `package.json`, `pnpm-workspace.yaml`, `turbo.json`
- `docker-compose.yml` (Postgres 5444, Redis 6390)
- `.env.example`
- `packages/config/*` (tsconfig, eslint, tailwind presets)
- Verify: `docker compose up -d` works, services healthy

### Task 1B: Prisma Schema + Migration + Seed
**Dependencies:** None
**Assignee:** Coder Agent Beta
**Context Budget:** ~2000 lines before `/compact`
**Deliverables:**
- `packages/prisma/prisma/schema.prisma` (full schema per spec)
- `packages/prisma/src/seed.ts`
- First migration `init`
- Prisma client package config
- Verify: `prisma migrate dev` + `prisma generate` + `seed.ts` runs

**Phase 1 Gate:** Both 1A and 1B must be `completed` before Phase 2 starts.

---

## Phase 2: Backend Services (Parallel — 3 tracks)

**Precondition:** Phase 1 contracts are in `main` branch (or shared worktree).

### Task 2A: API Server — Auth + Middleware + Core Routes
**Dependencies:** Phase 1 (schema + scaffold)
**Assignee:** Coder Agent Gamma
**Context Budget:** ~3000 lines before `/compact`
**Deliverables:**
- `apps/api/src/config.ts` — env validation
- `apps/api/src/services/jwt.ts` — token generation/validation
- `apps/api/src/services/encryption.ts` — AES-256-GCM
- `apps/api/src/middleware/*` — auth, role, rate-limit, ip-allowlist
- `apps/api/src/routes/auth.ts` — register, login, refresh
- `apps/api/src/routes/users.ts` — me, list, role update
- `apps/api/src/routes/wallets.ts` — balance, convert, history
- `apps/api/src/routes/exchange-connections.ts` — encrypted CRUD
- `apps/api/src/routes/bots.ts` — CRUD, start/stop, mode toggle, admin kill
- `apps/api/src/routes/referrals.ts` — dashboard
- `apps/api/src/services/fee.ts` — fee calculation
- `apps/api/src/services/referral-tier.ts` — tier auto-promotion
- `apps/api/src/services/sse.ts` — real-time event streaming
- `apps/api/src/queues/bullmq.ts` — queue producer
- `apps/api/src/index.ts` — Hono app wiring
- Tests: `apps/api/tests/auth.test.ts`, `bots.test.ts`
- Verify: `curl http://localhost:3000/health` returns `ok`

### Task 2B: Wallet Service — BSC Deposits + Withdrawals
**Dependencies:** Phase 1 (schema + scaffold)
**Assignee:** Coder Agent Delta
**Context Budget:** ~2500 lines before `/compact`
**Deliverables:**
- `apps/wallet/src/config.ts`
- `apps/wallet/src/db/schema.ts` — SQLite tables (Drizzle)
- `apps/wallet/src/db/client.ts`
- `apps/wallet/src/services/hd-wallet.ts` — bip39/bip32 address generation
- `apps/wallet/src/services/monitor.ts` — BSC WebSocket + confirmation poller
- `apps/wallet/src/services/callback.ts` — HTTP callback to Main API
- `apps/wallet/src/services/sweeper.ts` — periodic consolidation
- `apps/wallet/src/routes/internal.ts` — `/internal/generate-address`, `/withdraw`
- `apps/wallet/src/routes/health.ts`
- `apps/wallet/src/index.ts`
- Tests: `apps/wallet/tests/hd-wallet.test.ts`, `monitor.test.ts`
- Verify: `curl http://localhost:3001/health` returns `wallet-ok`

### Task 2C: Bot Worker — CCXT Connectors + DCA Engine + Signal Handler
**Dependencies:** Phase 1 (schema + scaffold)
**Assignee:** Coder Agent Epsilon
**Context Budget:** ~3000 lines before `/compact`
**Deliverables:**
- `apps/worker/src/config.ts`
- `apps/worker/src/exchange/connector.ts` — interface
- `apps/worker/src/exchange/ccxt-connector.ts` — CCXT wrapper
- `apps/worker/src/exchange/paper-connector.ts` — simulated exchange
- `apps/worker/src/exchange/registry.ts` — factory mapping
- `apps/worker/src/engine/bot-registry.ts` — Redis-backed tracker
- `apps/worker/src/engine/signal-handler.ts` — webhook job executor
- `apps/worker/src/engine/dca-loop.ts` — price-watching martingale loop
- `apps/worker/src/services/fee-applier.ts` — deduct token + commission
- `apps/worker/src/services/heartbeat.ts` — Redis heartbeat
- `apps/worker/src/queues/consumer.ts` — BullMQ worker setup
- `apps/worker/src/index.ts`
- Tests: `apps/worker/tests/paper-connector.test.ts`, `dca-engine.test.ts`

**Phase 2 Gate:** All 2A, 2B, 2C must be `completed` before Phase 3.

---

## Phase 3: Frontend (Parallel — 2 tracks)

**Precondition:** Phase 2A API routes are functional (API contract stable).

### Task 3A: TanStack Frontend — Auth + Dashboard + Wallet + Bots + Admin
**Dependencies:** Phase 2A (API routes exist and return expected shapes)
**Assignee:** Coder Agent Zeta
**Context Budget:** ~3000 lines before `/compact`
**Deliverables:**
- `apps/web/package.json` — TanStack Router/Query/Form, shadcn/ui, Tailwind
- `apps/web/vite.config.ts`, `apps/web/tailwind.config.ts`
- `apps/web/src/main.tsx`, `apps/web/src/router.ts`
- `apps/web/src/lib/api-client.ts` — fetch wrapper with JWT
- `apps/web/src/hooks/use-auth.ts` — Zustand auth store
- `apps/web/src/hooks/use-api.ts` — TanStack Query wrappers
- `apps/web/src/hooks/use-sse.ts` — SSE listener
- Routes:
  - `login.tsx` — form + API call
  - `register.tsx` — form + referral code
  - `dashboard.tsx` — balance cards, bot count, PnL summary
  - `wallet.tsx` — deposit QR, convert, withdrawal, history
  - `bots/index.tsx` — bot list + create wizard (Signal vs DCA toggle)
  - `bots/$botId.tsx` — bot detail, config editor, orders, logs, chart overlay
  - `referrals.tsx` — referral dashboard (uses UI/UX components from 3B)
  - `admin.tsx` — admin panel shell (user table, bot control, audit log)
- Layout:
  - `components/layout/sidebar.tsx`
  - `components/layout/header.tsx`
- Verify: Vite dev server runs on `localhost:5173`, login page renders

### Task 3B: UI/UX Agent — Referral Tier Design System + Premium Visuals
**Dependencies:** Phase 2A (API routes exist), shared design tokens from Phase 1 config
**Assignee:** UI/UX Agent Eta
**Context Budget:** ~2500 lines before `/compact`
**Deliverables:**
- **Design System File:** `apps/web/src/styles/design-tokens.ts`
  - Color palette: Bronze `#CD7F32`, Silver `#C0C0C0`, Gold `#FFD700`, Platinum `#E5E4E2`, KOL `#FF4500`
  - Typography scale, spacing scale, border-radius tokens
  - Dark mode support (trading apps are dark by default)
- **Referral Tier Cards:** `apps/web/src/components/referral/tier-card.tsx`
  - Visual progression: Bronze → Silver → Gold → Platinum → KOL
  - Each card shows: tier name, commission %, active referrals count, progress bar to next tier
  - KOL card has "Pending Approval" / "Approved" badge with admin-gated lock icon
  - Animated progress bar using Framer Motion or CSS transitions
- **Referral Dashboard Page:** `apps/web/src/components/referral/dashboard.tsx`
  - Top section: referral code copy button + social share buttons
  - Middle: tier cards grid (current tier highlighted, others dimmed)
  - Bottom: earnings history table + referred users list with avatar placeholders
  - "Upgrade Progress" visualization: how many more active referrals to reach next tier
- **Wallet UI Polish:** `apps/web/src/components/wallet/deposit-card.tsx`
  - QR code display for BSC address (use `qrcode.react` or SVG)
  - "Copy Address" button with tooltip
  - Network warning banner: "Only send USDT (BEP20) to this address"
  - Transaction history with status badges (pending/confirmed/failed)
- **Bot Wizard UX:** `apps/web/src/components/bots/bot-wizard.tsx`
  - Step indicator: Choose Type → Connect Exchange → Configure → Review
  - DCA config form with Freqtrade parameter labels:
    - `base_order_size` → "Initial Base Order Size"
    - `safety_order_size` → "Safety Order Size"
    - `price_deviation_initial` → "Price Deviation (Initial)"
    - `safety_order_max_count` → "Max Safety Orders"
    - `safety_order_volume_scale` → "Safety Order Volume Scale"
    - `safety_order_step_scale` → "Safety Order Step Scale"
    - `take_profit` → "Take-Profit Target %"
  - Live calculator: show "If price drops X%, you invest Y more, breakeven at Z"
  - Paper/Live mode toggle with warning modal
- **Admin Panel Layout:** `apps/web/src/components/admin/layout.tsx`
  - Tabbed interface: Users | Bots | Referrals | System Health | Security Events
  - Data tables with sorting, filtering, pagination
  - Kill switch button: red, with confirmation modal, admin audit log preview
- **Global Components:**
  - `apps/web/src/components/ui/badge.tsx` — tier badges (Bronze/Silver/Gold/Platinum/KOL)
  - `apps/web/src/components/ui/progress.tsx` — animated progress bars
  - `apps/web/src/components/ui/data-table.tsx` — reusable sortable/filterable table
  - `apps/web/src/components/ui/confirm-modal.tsx` — confirmation dialogs for destructive actions
- Verify: All components render without errors, dark mode default, responsive (mobile + desktop)

**Phase 3 Gate:** Both 3A and 3B must be `completed` before Phase 4.

---

## Phase 4: QA & Integration (Parallel — 3 tracks)

**Precondition:** All backend services (2A, 2B, 2C) + frontend (3A, 3B) are done.

### Task 4A: Integration Tests + Docker Compose Full Stack
**Dependencies:** Phase 2A, 2B, 2C, 3A, 3B
**Assignee:** QA Agent Alpha
**Context Budget:** ~2500 lines before `/compact`
**Deliverables:**
- Root `vitest.workspace.ts`
- `apps/api/vitest.config.ts` + `tests/setup.ts` (testcontainers)
- `apps/worker/vitest.config.ts`
- `apps/wallet/vitest.config.ts`
- Docker compose with `api`, `worker`, `wallet`, `web` services
- E2E test: register → deposit → convert → create bot → paper trade → view PnL
- Verify: `pnpm test` passes in all packages

### Task 4B: QA Code Review — Backend
**Dependencies:** Phase 2A, 2B, 2C
**Assignee:** QA Agent Beta
**Context Budget:** ~3000 lines before `/compact`
**Deliverables:**
- Review all `apps/api/src/routes/*` for:
  - Input validation (Zod on every route)
  - Auth middleware on all protected routes
  - SQL injection prevention (Prisma only, no raw queries)
  - Rate limiting on auth endpoints
  - Encrypted API keys never leaked in responses
- Review `apps/wallet/src/services/hd-wallet.ts` for:
  - Master seed security (never logged)
  - Address derivation correctness
- Review `apps/worker/src/engine/dca-loop.ts` for:
  - PnL math accuracy
  - Fee application logic matches spec (20% on wins only)
  - Redis cleanup on stop
- Report: `reports/qa-backend-review.md` with pass/fail per file

### Task 4C: QA Code Review — Frontend + UI/UX + Security
**Dependencies:** Phase 3A, 3B
**Assignee:** QA Agent Gamma
**Context Budget:** ~3000 lines before `/compact`
**Deliverables:**
- Review `apps/web/src/lib/api-client.ts` for:
  - JWT stored securely (localStorage acceptable for MVP, flagged for v2 httponly)
  - CSRF protection (not needed for JWT bearer, verified)
- Review `apps/web/src/components/referral/*` for:
  - Tier progression math matches `packages/shared/src/constants/referral-tiers.ts`
  - KOL badge correctly shows pending vs approved state
  - Commission % display matches backend calculation
- Review all admin routes for:
  - `roleMiddleware('admin')` present
  - `ipAllowlistMiddleware` present
  - `admin_audit_log` written on every mutating action
- Review `apps/api/src/services/encryption.ts` for:
  - AES-256-GCM with random IV per encryption
  - Auth tag verification on decrypt
- Review `apps/web/src/components/bots/bot-wizard.tsx` for:
  - DCA parameter labels match Freqtrade naming from spec
  - Calculator math is accurate
- Report: `reports/qa-frontend-security-review.md`

**Phase 4 Gate:** All 4A, 4B, 4C must be `completed`.

---

## Phase 5: CTO Merge + Final Report

**Dependencies:** Phase 4
**Assignee:** CTO (Claude)
**Actions:**
1. Merge all agent branches into `main`
2. Run full test suite
3. Verify Docker compose full stack starts cleanly
4. Write final report: `reports/FINAL-YYYY-MM-DD-HHMM.md`
5. Commit: `git commit -m "feat: platform core complete"`

---

## Context Management Policy (/compact)

**When to `/compact`:**
- Conversation exceeds **2500–3000 lines** (check with `claude` status or when responses slow down)
- Agent feels reasoning quality degrading (repeating code, missing imports, losing track of file structure)
- Before starting a new major subsystem within a task (e.g., after finishing auth routes, before starting wallet routes)
- After completing ~5–7 files in one go

**How to `/compact`:**
1. Type `/compact` in the prompt
2. Wait for Claude to summarize the current state
3. Continue with the next subtask

**CTO Checkpoints:**
- After Phase 1: Review + `/compact` before Phase 2 dispatch
- After Phase 2: Review + `/compact` before Phase 3 dispatch
- After Phase 3: Review + `/compact` before Phase 4 dispatch
- After Phase 4: Review + `/compact` before Phase 5 merge

---

## DAG Visualization

```
Phase 0 (Contracts) ──────────────────────────────────────────┐
                                                                │
Phase 1 (Foundation) ───────────────────────────────────────────┤
  ├── 1A: Scaffold  ───────→ Coder Alpha                      │
  └── 1B: Prisma Schema ───→ Coder Beta                       │
                                                                │
Phase 2 (Backend) ──────────────────────────────────────────────┤
  ├── 2A: API Server ────────→ Coder Gamma                     │
  ├── 2B: Wallet Service ────→ Coder Delta                    │
  └── 2C: Bot Worker ────────→ Coder Epsilon                  │
                                                                │
Phase 3 (Frontend) ─────────────────────────────────────────────┤
  ├── 3A: TanStack Shell ────→ Coder Zeta                     │
  └── 3B: UI/UX Design ──────→ UI/UX Agent Eta                │
       (referral tiers, wallet polish, bot wizard, admin)     │
                                                                │
Phase 4 (QA) ───────────────────────────────────────────────────┤
  ├── 4A: Integration Tests ─→ QA Alpha                      │
  ├── 4B: Backend Review ─────→ QA Beta                        │
  └── 4C: Frontend/Security ─→ QA Gamma                       │
                                                                │
Phase 5 (CTO Merge) ────────────────────────────────────────────┘
  └── Final Report + Commit
```

---

## Communication Protocol

### Coder Agent → CTO Report Format

When a task is `completed`, the agent MUST send a report with:

```markdown
## Task Report: [Task ID]
**Agent:** [Agent Name]
**Started:** [ISO timestamp]
**Completed:** [ISO timestamp]
**Status:** completed | failed | blocked
**Branch:** [git branch name]
**Files Created/Modified:**
- `path/to/file.ts` — [one-line purpose]
**Tests:**
- [x] Unit tests pass
- [x] Integration tests pass (if applicable)
- [ ] E2E tests (if Phase 4)
**Context Compactions:** [N] times
**Known Issues / TODOs:**
- [optional]
**Needs Review From:**
- QA Agent [X] for [aspect]
```

### QA Agent → CTO Report Format

```markdown
## QA Report: [Task ID]
**Agent:** [QA Agent Name]
**Reviewed Files:**
- `path/to/file.ts` — PASS / FAIL — [notes]
**Bugs Found:**
- [Severity] `file.ts:line` — [description] — [suggested fix]
**Security Issues:**
- [Severity] `file.ts:line` — [description]
**Recommendations:**
- [optional improvements]
```

---

## File Naming Convention for Reports

Saved in `docs/superpowers/orchestration/reports/`:

- `2026-05-29-1430-phase-1.md` — Foundation phase report
- `2026-05-29-1530-phase-2.md` — Backend phase report
- `2026-05-29-1630-phase-3.md` — Frontend phase report
- `2026-05-29-1730-phase-4.md` — QA phase report
- `2026-05-29-1800-FINAL.md` — CTO merge + final summary
