# DAG: Frontend v2 — NexusBot Premium UI/UX Rebuild

**Date:** 2026-05-30
**Feature:** Research 3Commas / Pionex / Cryptohopper / Bitsgap interfaces and rebuild all frontend screens to match industry-standard UX with Awwwards-tier GSAP animations.

---

## Context

- Existing infra: TanStack Router v1, React 18, Tailwind, GSAP (@gsap/react), design tokens, premium sidebar/header
- Existing components: `dca-calculator.tsx`, `bot-wizard.tsx`, `tier-card.tsx`, `deposit-card.tsx`, `data-table.tsx`, `button.tsx`, `card.tsx`, `badge.tsx`
- Current route files are **basic stubs** restored from git — they need full rebuilds
- Backend API is fully functional at `localhost:3010`
- Wallet service at `localhost:3011`

---

## Phase 0: Competitive Research

**Goal:** Extract UI/UX patterns from top platforms.

| Agent | Task | Deliverable |
|-------|------|-------------|
| Research Alpha | Search 3Commas dashboard, bot creation, portfolio UI patterns | Markdown report with screenshots + pattern list |
| Research Beta | Search Pionex + Cryptohopper bot detail, DCA config, referral UI | Markdown report with screenshots + pattern list |
| Research Gamma | Search Bitsgap + general crypto bot admin panel patterns | Markdown report with screenshots + pattern list |

**Merge:** Synthesize into `docs/superpowers/specs/frontend-v2-spec.md`

---

## Phase 1: Foundation

**Goal:** Fix structural issues before screen rebuild.

| Agent | Task | Files |
|-------|------|-------|
| Foundation Alpha | Add `/` → `/dashboard` redirect, ensure `routeTree.gen.ts` is valid, add missing nav links (calculator, admin) to sidebar | `routes/index.tsx`, `components/layout/sidebar.tsx` |
| Foundation Beta | Verify `use-auth.ts`, `use-api.ts`, `api-client.ts` have all needed hooks and types for new screens | `hooks/use-auth.ts`, `hooks/use-api.ts`, `lib/api-client.ts` |
| Foundation Gamma | Ensure `design-tokens.ts` and `gsap-utils.ts` are complete and exported correctly; add any missing tokens | `styles/design-tokens.ts`, `lib/gsap-utils.ts` |

---

## Phase 2: Screen Rebuild (Parallel)

**Goal:** Rebuild every route file to premium standard. Each agent may also create/modify sub-components.

| Agent | Screen | Key Requirements |
|-------|--------|-------------------|
| Screen Alpha | **Dashboard** (`routes/dashboard.tsx`) | Portfolio summary cards (token/USDT/active bots), recent transactions list, quick-action buttons, GSAP entrance animations, responsive grid |
| Screen Beta | **Bots List** (`routes/bots/index.tsx`) | Data table with sorting/search, status badges, start/stop actions, filter tabs (all/running/stopped), link to create + detail, empty state |
| Screen Gamma | **Bot Detail** (`routes/bots/$botId.tsx`) | Bot header with status + mode toggle, config editor (JSON), live orders table, logs stream, performance placeholder, GSAP tab transitions |
| Screen Delta | **Bot Create** (`routes/bots/create.tsx`) | Full-screen wizard integration: select type → exchange → configure DCA or Signal → review → submit. Must use existing `BotWizard` component and wire to real API |
| Screen Epsilon | **Wallet** (`routes/wallet.tsx`) | Deposit address card with copy + QR placeholder, balance cards (token/USDT/total deposited), convert form, transaction history with status badges, responsive |
| Screen Zeta | **DCA Calculator** (`routes/calculator.tsx`) | Full-screen `DCACalculator` integration with page wrapper, title, GSAP entrance. Ensure `dca-math.ts` is accurate |
| Screen Eta | **Referrals** (`routes/referrals.tsx`) | Tier progression visual (Bronze→KOL), referral code copy card, stats cards, referred users table, commission rate display, GSAP tier card animations |
| Screen Theta | **Admin** (`routes/admin.tsx`) | Health stats cards, users table with pagination, all bots table, admin-only layout, audit log placeholder, responsive tabs |

---

## Phase 3: Integration & Polish

**Goal:** Wire everything together, add premium animations, ensure responsive.

| Agent | Task | Files |
|-------|------|-------|
| Polish Alpha | Add `page-wrapper.tsx` with GSAP entrance to all screens; verify ScrollReveal on scrollable content | `components/layout/page-wrapper.tsx`, all route files |
| Polish Beta | Ensure responsive breakpoints work on all screens (mobile sidebar, stacked cards, scroll tables) | All route files |
| Polish Gamma | Verify all `Link` components use proper TanStack Router `to` props; fix any `any` casts if possible; ensure no broken navigation | All route files, sidebar |

---

## Phase 4: QA & Audit

**Goal:** Type safety, build verification, UX audit.

| Agent | Task | Deliverable |
|-------|------|-------------|
| QA Alpha | Run `pnpm exec tsc --noEmit` in `apps/web`, fix all TS errors, ensure build compiles | Report with error count |
| QA Beta | Run `pnpm exec vite build` (or `pnpm build`) in `apps/web`, verify production build succeeds | Build report |
| QA Gamma | UX Audit: compare each screen against Research Phase findings, identify gaps, list missing animations / responsive issues | UX audit markdown |
| QA Delta | Security Audit: verify no hardcoded secrets in frontend, check auth hooks properly guard admin routes, confirm no sensitive data leaked in client bundle | Security audit markdown |

---

## Phase 5: CTO Merge & Final Report

**Goal:** Merge all changes, write final report.

1. Verify all route files compile
2. Verify dev server starts without errors
3. Write `docs/superpowers/orchestration/reports/FINAL-frontend-v2.md`

---

## Constraints

- **Do NOT modify** backend API (`apps/api/*`), wallet service (`apps/wallet/*`), worker (`apps/worker/*`), or Prisma schema
- **Do NOT delete** existing premium components (`dca-calculator.tsx`, `bot-wizard.tsx`, etc.) — enhance/integrate them
- **Preserve** existing `design-tokens.ts` and `gsap-utils.ts` — extend if needed
- **All new code** must be TypeScript with no `any` unless absolutely necessary for TanStack Router v1 compatibility
