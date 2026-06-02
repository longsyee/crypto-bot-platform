# Orchestration DAG: Frontend MVP + Awwwards UI/UX with GSAP

**Feature:** Complete frontend MVP with top-tier Awwwards-level design, GSAP animations, dark mode, and all user-facing screens.

**Stack:** TanStack Router + Query + Form, React 18, Tailwind CSS, shadcn/ui patterns, GSAP (ScrollTrigger, Flip), Lucide icons.

**Base Refs:**
- Existing routes: `apps/web/src/routes/*`
- Existing components: `apps/web/src/components/*`
- Existing hooks: `apps/web/src/hooks/*`
- API client: `apps/web/src/lib/api-client.ts`
- Design tokens: `apps/web/src/styles/design-tokens.ts`

---

## Phase 1: Foundation — Design System + GSAP Infrastructure
**Goal:** Establish the visual language, animation system, and reusable primitives before any screen is built.

**Agents:**
- **UI/UX Designer** — refine design tokens, spacing scale, elevation/shadow system, typography hierarchy (Inter or Geist), color palette for dark mode.
- **Coder Zeta** — install GSAP + @gsap/react, create animation utilities (`usePageTransition`, `useScrollReveal`, `useStagger`), wrap layout with AnimatePresence-like patterns.
- **Coder Zeta** — build base component primitives: Button, Input, Card, Dialog, Badge, Tooltip, Skeleton, Tabs, Accordion, all with GSAP entrance animations.

**Deliverables:**
- `apps/web/src/lib/gsap-utils.ts` — page transitions, scroll triggers, stagger helpers
- `apps/web/src/components/ui/*.tsx` — polished primitives with hover/entrance animations
- `apps/web/src/styles/design-tokens.ts` — updated tokens
- `apps/web/src/components/layout/page-wrapper.tsx` — GSAP page transition wrapper

---

## Phase 2: Auth Screens
**Goal:** Login and Register with cinematic entrance animations.

**Agents:**
- **Coder Zeta** — Login page with GSAP staggered entrance (form fields slide up with opacity fade)
- **Coder Zeta** — Register page with referral code field, same animation language
- **UI/UX Designer** — micro-interactions: input focus glow, button ripple, error shake animation

**Deliverables:**
- `apps/web/src/routes/login.tsx` — fully functional with API integration
- `apps/web/src/routes/register.tsx` — fully functional with API integration

---

## Phase 3: Dashboard
**Goal:** The home screen — stats, bot overview, recent activity, wallet widget.

**Agents:**
- **Coder Zeta** — Dashboard layout with bento-grid style stat cards
- **Coder Zeta** — Bot overview component (mini cards showing status, PnL, mode)
- **Coder Zeta** — Recent activity feed with scroll-triggered reveal
- **UI/UX Designer** — card hover states, gradient borders, glow effects on active bots

**Deliverables:**
- `apps/web/src/routes/dashboard.tsx` — complete dashboard

---

## Phase 4: Bot Management (The Core)
**Goal:** Bot list, creation wizard, Signal config, DCA config, and the DCA Calculator.

**Agents:**
- **Coder Zeta** — Bot list page with status indicators, filters, sort
- **Coder Zeta** — Bot creation wizard (stepper: choose type → connect exchange → configure → review)
- **Coder Zeta** — Signal bot configuration form (webhook secret, default symbol, TP/SL)
- **Coder Zeta** — DCA bot configuration form (all 7 parameters from the Freqtrade image)
- **Coder Zeta** — **DCA Calculator** — interactive calculator showing:
  - Starting capital input
  - Safety order count slider
  - Volume scale + step scale inputs
  - Live preview table: each SO level with size, deviation, cumulative cost
  - Total capital required
  - Estimated take-profit price
  - Risk/reward ratio
  - Animated bars/charts for capital allocation
- **UI/UX Designer** — calculator animations: bars grow on input change, numbers count up, table rows stagger in

**Deliverables:**
- `apps/web/src/routes/bots/index.tsx` — bot list
- `apps/web/src/routes/bots/$botId.tsx` — bot detail
- `apps/web/src/components/bots/bot-wizard.tsx` — creation wizard
- `apps/web/src/components/bots/dca-calculator.tsx` — THE calculator

---

## Phase 5: Wallet + Referrals
**Goal:** Wallet management and referral program dashboard.

**Agents:**
- **Coder Zeta** — Wallet page with deposit card (address display + QR), convert form, transaction history table
- **Coder Zeta** — Referrals page: tier progress bar, commission rate badge, referral link copy button, earnings chart, referred users list
- **UI/UX Designer** — tier card glow effects (Bronze → Silver → Gold → Platinum → KOL), progress bar liquid animation

**Deliverables:**
- `apps/web/src/routes/wallet.tsx`
- `apps/web/src/routes/referrals.tsx`

---

## Phase 6: Admin Panel Screens
**Goal:** Admin dashboard for kill switch, audit logs, user management.

**Agents:**
- **Coder Zeta** — Admin layout with sidebar navigation
- **Coder Zeta** — Dashboard stats (total users, bots, fees, active bots)
- **Coder Zeta** — Audit log table with pagination
- **Coder Zeta** — User management table with role editing
- **Coder Zeta** — Kill bot button with confirmation modal

**Deliverables:**
- `apps/web/src/routes/admin.tsx`

---

## Phase 7: QA + Polish
**Goal:** Animation performance, responsive check, accessibility, component audit.

**Agents:**
- **QA Gamma** — Frontend component audit: check all components render, forms validate, API calls succeed
- **QA Gamma** — Animation performance: GSAP ScrollTrigger cleanup, no memory leaks, 60fps on animations
- **QA Gamma** — Responsive check: mobile (<768px), tablet (768-1024), desktop (>1024)

---

## Context Budget
- **/compact** triggers at ~2500 lines per agent
- **Phase barriers** — no frontend Phase 3 until Phase 1 reports are merged
- **Design system** must be shared via `apps/web/src/components/ui/` and `apps/web/src/lib/gsap-utils.ts`

## Timeline Estimate
- Phase 1: ~15 min (parallel agents)
- Phase 2: ~10 min (parallel agents)
- Phase 3: ~15 min (parallel agents)
- Phase 4: ~25 min (parallel agents, calculator is heaviest)
- Phase 5: ~15 min (parallel agents)
- Phase 6: ~10 min (parallel agents)
- Phase 7: ~10 min (parallel QA agents)
- **Total: ~100 min**

## Critical Dependencies
1. API server must be running on `localhost:3010` (already verified)
2. All backend routes must return correct data shapes (already verified via smoke test)
3. TanStack Router must auto-generate `routeTree.gen.ts` (already configured)
