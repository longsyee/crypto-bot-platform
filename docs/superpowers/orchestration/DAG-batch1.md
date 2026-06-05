# Batch-1 Orchestration DAG

## Feature: DCA Cleanup + Creation Flow + Logs UI + i18n/Malay

### Phase 1: Parallel Foundation (no deps)
- **Agent A**: DCA Round Settings cleanup — remove Trailing On toggle, clean round types, update shared schema
- **Agent B**: Bot Creation Flow redesign — strategy chooser first, then wizard
- **Agent C**: Logs UI cleanup — clearer filter names, slim right-side controls
- **Agent D**: i18n Malay foundation — add ms dictionary, update use-i18n.tsx

### Phase 2: i18n Audit (depends on Agent D)
- **Agent E**: Audit all route files for hardcoded English, add missing keys to dictionary

### Phase 3: QA (depends on all)
- **Agent F**: Type-check, verify no broken imports, compile check

---

## Agent A: DCA Round Settings Cleanup
Files:
- `apps/web/src/components/bots/bot-wizard.tsx`
- `packages/shared/src/index.ts`

Tasks:
1. Remove "Trailing On" column from DCA Round Settings table (lines ~1685, ~1742-1760)
2. Remove `trailing` field from round default data (lines ~145-149)
3. Remove `trailing` from round type/interface if defined
4. In `packages/shared/src/index.ts`, remove `trailing_enabled` and `trailing_pct` from the `rounds` array schema (lines ~166-167)
5. Check that no code references `row.trailing` or `.trailing` in the wizard round rendering

## Agent B: Bot Creation Flow Redesign
Files:
- `apps/web/src/routes/bots/create.tsx`

Tasks:
1. Redesign so user FIRST sees 3 big strategy cards (DCA, Signal, Grid) with descriptions/icons
2. After clicking a strategy, the wizard for that strategy appears (replacing the cards)
3. Add a "Back to strategy selection" button inside the wizard view
4. Keep the existing BotWizard/GridWizard components, just change how they're rendered

## Agent C: Logs UI Cleanup
Files:
- `apps/web/src/components/bots/activity-feed.tsx`

Tasks:
1. Rename filter chip labels to be clear full words:
   - ALL → All
   - ORD → Orders
   - SIG → Signals
   - TRD → Trades
   - STA → State
   - ALR → Alerts
2. Slim down the right-side control bar — keep only essential controls, make compact
3. Ensure labels are readable

## Agent D: i18n Malay Foundation
Files:
- `apps/web/src/i18n/dictionary.ts`
- `apps/web/src/hooks/use-i18n.tsx`

Tasks:
1. Add `ms: { ... }` block to dictionary.ts with full Malay translations for all existing keys
2. Update `Lang` type in use-i18n.tsx to include `"ms"`
3. Update localStorage/lang handling to accept "ms"

## Agent E: i18n Audit
Files:
- `apps/web/src/routes/bots/$botId.tsx`
- `apps/web/src/routes/bots/create.tsx`
- `apps/web/src/routes/bots/index.tsx`
- `apps/web/src/routes/dashboard.tsx`
- `apps/web/src/routes/wallet.tsx`
- `apps/web/src/routes/settings.tsx`
- `apps/web/src/routes/profile.tsx`
- `apps/web/src/routes/community.tsx`
- `apps/web/src/routes/ai-integration.tsx`
- `apps/web/src/routes/api-docs.tsx`
- `apps/web/src/routes/login.tsx`
- `apps/web/src/routes/register.tsx`
- `apps/web/src/routes/forgot-password.tsx`
- `apps/web/src/routes/reset-password.tsx`
- `apps/web/src/routes/index.tsx`
- `apps/web/src/routes/admin.tsx`
- `apps/web/src/components/bots/activity-feed.tsx`
- `apps/web/src/components/bots/bot-wizard.tsx`
- `apps/web/src/components/layout/sidebar.tsx`
- `apps/web/src/components/layout/header.tsx`

Tasks:
1. Scan every file for hardcoded English strings that should be i18n keys
2. Add missing keys to BOTH `en` and `zh` (and `ms`) blocks in dictionary.ts
3. Replace hardcoded strings with `t("key.path")` calls

## Agent F: QA
Tasks:
1. Run `cd apps/web && npx tsc --noEmit` to check for TS errors
2. Verify no missing imports or broken references from the changes
3. Report any issues found
