# CTO Orchestration DAG: 2FA + i18n (EN/ZH) + Dark Mode Fix

## Features
1. **TOTP Two-Factor Authentication** — QR-based setup, verify on login, disable in Settings
2. **i18n Localization** — English + Simplified Chinese only, lightweight custom hook
3. **Dark Mode Toggle Fix** — remove `system` from header toggle cycle (only `dark ↔ light`)

## Phase 1: Foundation
- **Task 1A**: Prisma schema migration — add `totpSecret`, `totpEnabled`, `totpVerified` to `User`
- **Task 1B**: Install `speakeasy` / `qrcode.react` and scaffold i18n dictionaries (`en`, `zh`)

## Phase 2: Backend (parallel)
- **Task 2A**: Auth routes — `/auth/2fa/setup` (generate secret + QR), `/auth/2fa/verify` (verify + enable), `/auth/2fa/disable` (require password), enforce 2FA on `/auth/login` when enabled
- **Task 2B**: `use-theme.ts` fix — `toggle()` cycles only `dark ↔ light`

## Phase 3: Frontend (parallel)
- **Task 3A**: Settings page — Add "Two-Factor Authentication" card with: Setup flow (show QR, verify TOTP code), Disable flow (password confirm), Status badge
- **Task 3B**: Login page — Show TOTP input step after password when `totpEnabled` is true on the user
- **Task 3C**: Header — Add language toggle dropdown (`EN / 中文`) next to theme toggle
- **Task 3D**: i18n shell — Create `useI18n` hook + `I18nProvider` context, wrap `main.tsx`, create dictionary JSONs for all hardcoded strings in Settings, Header, Sidebar, Dashboard, Login, Register

## Phase 4: QA
- **Task 4A**: Backend review — Verify 2FA middleware timing-safe compare, rate limits on setup/verify, secret encrypted at rest
- **Task 4B**: Frontend review — Verify all visible strings are translated, dark mode toggle works in one press, Settings 2FA flow complete

## Phase 5: Merge & Commit
- Build, type-check, commit all changes
