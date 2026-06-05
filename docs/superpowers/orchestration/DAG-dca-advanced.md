# DAG: DCA Advanced Features (Sample/newrobot parity)

## Phases

### Phase 1: Foundation (Schema + Shared Types)
- **Task 1A:** Update Prisma schema — add guard/rounds/rsi/ema/trend fields to Bot model
- **Task 1B:** Update DcaBotConfigSchema in `packages/shared/src/index.ts` with all new fields
- **Task 1C:** Run `prisma db push` + `prisma generate`
- **Dependencies:** None
- **Parallel:** Yes (1A + 1B can run together, 1C after both)

### Phase 2: Backend (API + Worker)
- **Task 2A:** Update `apps/api/src/routes/bots.ts` — validate new config fields in create/update
- **Task 2B:** Implement Guard logic in `apps/worker/src/engine/dca-loop.ts`
- **Task 2C:** Implement Per-Round DCA table logic in `apps/worker/src/engine/dca-loop.ts`
- **Task 2D:** Implement RSI/EMA/Double FO/Trend logic in `apps/worker/src/engine/dca-loop.ts`
- **Dependencies:** Phase 1 complete
- **Parallel:** 2A || (2B + 2C + 2D) — 2A independent of worker changes

### Phase 3: Frontend (Wizard UI)
- **Task 3A:** Build Guard section in `bot-wizard.tsx`
- **Task 3B:** Build Per-Round DCA modal/table in `bot-wizard.tsx`
- **Task 3C:** Build RSI/EMA/Double FO/Trend sections in `bot-wizard.tsx`
- **Dependencies:** Phase 1 complete (needs types)
- **Parallel:** Yes (3A + 3B + 3C can run together if file locking isn't an issue — but since they're all in one file, they should be sequential or one agent does the whole file)

### Phase 4: QA + Type Check
- **Task 4A:** Type-check all 3 apps (api, worker, web)
- **Task 4B:** Review dca-loop.ts for correctness
- **Dependencies:** Phase 2 + 3 complete

### Phase 5: Merge + Report
- CTO compiles reports, confirms all 10 features implemented
